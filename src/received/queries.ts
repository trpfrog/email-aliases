import type { SqliteClient } from "reylo";
import type { AliasAddress } from "../aliases/schema";
import {
  RECEIVED_LIMITS,
  receivedEmailSchema,
  type ReceivedEmail,
  type ReceivedFilter,
  type ReceivedOutcome,
} from "./schema";
import clearQuery from "./queries/clear.sql";
import deleteQuery from "./queries/delete.sql";
import listQuery from "./queries/list.sql";
import recordQuery from "./queries/record.sql";

// Reylo の SQL の型は tsc の content mapper でしか解決できず、oxlint（tsgolint）からは見えない。
// `.sql` を呼ぶのはこのファイルだけにして、引数と戻り値の型を明示する。
// 明示した型と推論結果の一致は store.test-d.ts で検査する。
// Reylo は SQLite の CHECK 制約から outcome の union を推論しないため、行は Zod で検証して返す。

/** 記録したら true。未登録の宛先で、直近 1 時間の件数が上限に達していれば記録しない。 */
export async function insertReceivedEmail(
  db: SqliteClient,
  row: { recipient: AliasAddress; sender: string; size: number; outcome: ReceivedOutcome },
): Promise<boolean> {
  const inserted = await recordQuery.run(db, {
    ...row,
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
  return rows.map((row) => receivedEmailSchema.parse(row));
}

/** 削除したら true。 */
export async function deleteReceivedRow(db: SqliteClient, id: number): Promise<boolean> {
  return (await deleteQuery.run(db, { id })) !== null;
}

/** 絞り込みに一致する行を削除し、その件数を返す。 */
export async function clearReceivedRows(db: SqliteClient, filter: ReceivedFilter): Promise<number> {
  return (await clearQuery.run(db, { filter })).length;
}
