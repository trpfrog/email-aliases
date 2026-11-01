import { z } from "zod";
import { DOMAIN } from "../config";

/** 入力の上限。UI のフォームでも同じ値を使う。 */
export const ALIAS_LIMITS = { localPart: 64, note: 1000, serviceUrl: 2048 } as const;

const LOCAL_PART = /^[a-z0-9!#$%&'+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'+/=?^_`{|}~-]+)*$/;

// ドメインを含む完全なアドレスを受け付け、大文字・小文字を区別せず扱う。
export const addressSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine((address) => {
    const [local = "", domain, ...rest] = address.split("@");
    return (
      domain === DOMAIN &&
      rest.length === 0 &&
      local.length <= ALIAS_LIMITS.localPart &&
      LOCAL_PART.test(local)
    );
  }, `Use an address at ${DOMAIN} (local part: 1–64 ASCII characters).`)
  .brand<"AliasAddress">();

export type AliasAddress = z.output<typeof addressSchema>;

export const noteSchema = z.string().max(ALIAS_LIMITS.note);

// 空文字は「未設定」を表す。
export const serviceUrlSchema = z
  .string()
  .trim()
  .max(ALIAS_LIMITS.serviceUrl)
  .pipe(
    z.union([
      z.literal(""),
      z.url({
        protocol: /^https?$/,
        error: "サービス URL は http:// または https:// で始まる URL を入力してください。",
      }),
    ]),
  );

/** DB に保存されたエイリアス。Reylo が SQL から推論する行の型と一致することを型テストで保証する。 */
export const aliasSchema = z.object({
  address: z.string(),
  note: z.string(),
  service_url: z.string(),
  created_at: z.string(),
  disabled_at: z.string().nullable(),
});

export type Alias = z.output<typeof aliasSchema>;

// ---- 操作の入力 ----

export const createAliasInput = z.strictObject({
  address: addressSchema,
  note: noteSchema.default(""),
  service_url: serviceUrlSchema.default(""),
});

export const listAliasesInput = z.strictObject({
  limit: z.int().min(1).max(100).default(100),
  offset: z.int().min(0).default(0),
});

export const addressInput = z.strictObject({ address: addressSchema });

export const setAliasDisabledInput = z.strictObject({
  address: addressSchema,
  disabled: z.boolean(),
});

export const updateAliasDetailsInput = z
  .strictObject({
    address: addressSchema,
    note: noteSchema.optional(),
    service_url: serviceUrlSchema.optional(),
  })
  .refine(
    (input) => input.note !== undefined || input.service_url !== undefined,
    "更新する項目を指定してください。",
  );

export type CreateAliasInput = z.output<typeof createAliasInput>;
export type ListAliasesInput = z.output<typeof listAliasesInput>;
export type SetAliasDisabledInput = z.output<typeof setAliasDisabledInput>;
export type UpdateAliasDetailsInput = z.output<typeof updateAliasDetailsInput>;

// ---- 操作の結果（MCP の outputSchema にも使う） ----

export const createAliasResult = z.object({ created: z.boolean(), alias: aliasSchema });
export const listAliasesResult = z.object({
  aliases: z.array(aliasSchema),
  next_offset: z.int().nullable(),
});
export const updateAliasResult = z.object({
  updated: z.boolean(),
  alias: aliasSchema.nullable(),
});
export const deleteAliasResult = z.object({ address: z.string(), deleted: z.boolean() });

export type CreateAliasResult = z.output<typeof createAliasResult>;
export type ListAliasesResult = z.output<typeof listAliasesResult>;
/** `updated` で `alias` の有無を判別できるよう、スキーマより狭い型にする。 */
export type UpdateAliasResult = { updated: true; alias: Alias } | { updated: false; alias: null };
export type DeleteAliasResult = z.output<typeof deleteAliasResult>;
