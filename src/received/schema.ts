import { z } from "zod";

/** 受信時点の判定。転送したか、無効なエイリアス宛て・未登録の宛先として破棄したか。 */
export const RECEIVED_OUTCOMES = ["forwarded", "disabled", "unknown"] as const;
export const receivedOutcomeSchema = z.enum(RECEIVED_OUTCOMES);
export type ReceivedOutcome = z.output<typeof receivedOutcomeSchema>;

/**
 * 履歴の記録の上限。未登録の宛先（unknown）は直近 1 時間について数え、超えたら記録しない。
 * 送信元は長さを切り詰めて保存する
 */
export const RECEIVED_LIMITS = {
  unknownPerHour: 100,
  newUnknownPerHour: 10,
  sender: 320,
} as const;

/** DB に保存された受信履歴。Reylo が SQL から推論する行の型と一致することを型テストで保証する。 */
export const receivedEmailSchema = z.object({
  id: z.int(),
  received_at: z.string(),
  recipient: z.string(),
  sender: z.string(),
  size: z.int(),
  outcome: receivedOutcomeSchema,
  /** drop と判定したが、ドライラン中だったため転送した。 */
  dry_run: z.boolean(),
});

export type ReceivedEmail = z.output<typeof receivedEmailSchema>;

/** 一覧・一括削除の絞り込み。dropped は disabled と unknown をまとめたもの。 */
export const receivedFilterSchema = z.enum(["all", "forwarded", "dropped", "disabled", "unknown"]);
export type ReceivedFilter = z.output<typeof receivedFilterSchema>;

/** エイリアスごとの受信状況。件数は保持期間（180 日）内の履歴から数える。 */
export const aliasActivitySchema = z.object({
  address: z.string(),
  disabled_at: z.string().nullable(),
  last_received_at: z.string().nullable(),
  received_count_30d: z.int(),
  received_count: z.int(),
});

export type AliasActivity = z.output<typeof aliasActivitySchema>;

// ---- 操作の入力 ----

export const listReceivedEmailsInput = z.strictObject({
  filter: receivedFilterSchema.default("all"),
  limit: z.int().min(1).max(100).default(100),
  offset: z.int().min(0).default(0),
});

export const receivedEmailIdInput = z.strictObject({ id: z.int().min(1) });

// 誤って全件を消さないよう、一括削除では絞り込みを省略できないようにする
export const clearReceivedEmailsInput = z.strictObject({ filter: receivedFilterSchema });

export const listAliasActivityInput = z.strictObject({
  sort: z.enum(["least_recent", "most_received_30d"]).default("least_recent"),
  limit: z.int().min(1).max(100).default(100),
  offset: z.int().min(0).default(0),
});

export type ListReceivedEmailsInput = z.output<typeof listReceivedEmailsInput>;
export type ListAliasActivityInput = z.output<typeof listAliasActivityInput>;

// ---- 操作の結果（MCP の outputSchema にも使う） ----

export const listReceivedEmailsResult = z.object({
  emails: z.array(receivedEmailSchema),
  next_offset: z.int().nullable(),
});
export const deleteReceivedEmailResult = z.object({ id: z.int(), deleted: z.boolean() });
export const clearReceivedEmailsResult = z.object({ deleted: z.int() });

export const listAliasActivityResult = z.object({
  aliases: z.array(aliasActivitySchema),
  next_offset: z.int().nullable(),
});

export type ListAliasActivityResult = z.output<typeof listAliasActivityResult>;
export type ListReceivedEmailsResult = z.output<typeof listReceivedEmailsResult>;
export type DeleteReceivedEmailResult = z.output<typeof deleteReceivedEmailResult>;
export type ClearReceivedEmailsResult = z.output<typeof clearReceivedEmailsResult>;
