import type { SqliteClient } from "reylo";
import type { AliasAddress } from "../aliases/schema";
import {
  RECEIVED_LIMITS,
  receivedEmailSchema,
  type AliasActivity,
  type ListAliasActivityInput,
  type ReceivedEmail,
  type ReceivedFilter,
  type ReceivedOutcome,
} from "./schema";
import activityQuery from "./queries/activity.sql";
import clearQuery from "./queries/clear.sql";
import deleteQuery from "./queries/delete.sql";
import listQuery from "./queries/list.sql";
import recordQuery from "./queries/record.sql";

// Reylo の SQL の型は tsc の content mapper でしか解決できず、oxlint（tsgolint）からは見えない。
// `.sql` を呼ぶのはこのファイルだけにして、引数と戻り値の型を明示する。
// 明示した型と推論結果の一致は store.test-d.ts で検査する。
// Reylo は SQLite の CHECK 制約から outcome の union を推論しないため、行は Zod で検証して返す。
// dry_run は 0 か 1 の整数で保存しているため、真偽値に変換する。
// forward_rejection は拒否されていなければ空文字で SQL に渡し、null として保存する。

/** 記録したら true。未登録の宛先で、直近 1 時間の件数が上限に達していれば記録しない。 */
export async function insertReceivedEmail(
  db: SqliteClient,
  {
    dry_run,
    forward_rejection,
    ...row
  }: {
    recipient: AliasAddress;
    sender: string;
    size: number;
    outcome: ReceivedOutcome;
    dry_run: boolean;
    forward_rejection: string | null;
  },
): Promise<boolean> {
  const inserted = await recordQuery.run(db, {
    ...row,
    dry_run: dry_run ? 1 : 0,
    forward_rejection: forward_rejection ?? "",
    max_unknown_per_hour: RECEIVED_LIMITS.unknownPerHour,
    max_new_unknown_per_hour: RECEIVED_LIMITS.newUnknownPerHour,
  });
  return inserted.length > 0;
}

/** 新しい順に `limit` 件まで返す。 */
export async function listReceivedRows(
  db: SqliteClient,
  { filter, limit, offset }: { filter: ReceivedFilter; limit: number; offset: number },
): Promise<ReceivedEmail[]> {
  const rows = await listQuery.run(db, { filter, limit, offset });
  return rows.map((row) => receivedEmailSchema.parse({ ...row, dry_run: row.dry_run === 1 }));
}

/** 登録済みのエイリアスごとの受信状況を、`sort` の順に `limit` 件まで返す。 */
export function listAliasActivityRows(
  db: SqliteClient,
  input: ListAliasActivityInput,
): Promise<AliasActivity[]> {
  return activityQuery.run(db, input);
}

/** 削除したら true。 */
export async function deleteReceivedRow(db: SqliteClient, id: number): Promise<boolean> {
  return (await deleteQuery.run(db, { id })) !== null;
}

/** 絞り込みに一致する行を削除し、その件数を返す。 */
export async function clearReceivedRows(db: SqliteClient, filter: ReceivedFilter): Promise<number> {
  return (await clearQuery.run(db, { filter })).length;
}
