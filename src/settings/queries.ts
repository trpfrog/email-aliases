import type { SqliteClient } from "reylo";
import type { Settings } from "./schema";
import getQuery from "./queries/get.sql";
import setDropDryRunQuery from "./queries/set-drop-dry-run.sql";

// Reylo の SQL の型は tsc の content mapper でしか解決できず、oxlint（tsgolint）からは見えない。
// `.sql` を呼ぶのはこのファイルだけにして、引数と戻り値の型を明示する。
// 明示した型と推論結果の一致は store.test-d.ts で検査する。

/** 一度も設定していなければ null。 */
export function findSettings(db: SqliteClient): Promise<Settings | null> {
  return getQuery.run(db);
}

export async function updateDropDryRun(db: SqliteClient, enabled: boolean): Promise<Settings> {
  return await setDropDryRunQuery.run(db, { enabled: enabled ? 1 : 0 });
}
