import type { SqliteClient } from "reylo";
import type { Alias, AliasAddress, AliasStatusFilter } from "./schema";
import createQuery from "./queries/create.sql";
import deleteQuery from "./queries/delete.sql";
import getQuery from "./queries/get.sql";
import listQuery from "./queries/list.sql";
import setDisabledQuery from "./queries/set-disabled.sql";
import updateDetailsQuery from "./queries/update-details.sql";

// Reylo の SQL の型は tsc の content mapper でしか解決できず、oxlint（tsgolint）からは見えない。
// `.sql` を呼ぶのはこのファイルだけにして、引数と戻り値の型を明示する。
// 明示した型と推論結果の一致は store.test-d.ts で検査する。

/** 挿入した行。既に登録済みなら null。 */
export function insertAlias(
  db: SqliteClient,
  row: { address: AliasAddress; note: string; service_url: string },
): Promise<Alias | null> {
  return createQuery.run(db, row);
}

export function findAlias(db: SqliteClient, address: AliasAddress): Promise<Alias | null> {
  return getQuery.run(db, { address });
}

/** 絞り込みに一致するエイリアスを、アドレス順に `limit` 件まで返す。 */
export function listAliasRows(
  db: SqliteClient,
  {
    query,
    status,
    has_service_url,
    limit,
    offset,
  }: {
    query: string;
    status: AliasStatusFilter;
    has_service_url?: boolean | undefined;
    limit: number;
    offset: number;
  },
): Promise<Alias[]> {
  return listQuery.run(db, {
    query,
    status,
    has_service_url: has_service_url === undefined ? -1 : has_service_url ? 1 : 0,
    limit,
    offset,
  });
}

/** 無効化を繰り返しても最初の無効化日時を保つ。未登録なら null。 */
export function updateDisabled(
  db: SqliteClient,
  address: AliasAddress,
  disabled: boolean,
): Promise<Alias | null> {
  return setDisabledQuery.run(db, { address, disabled: disabled ? 1 : 0 });
}

/** undefined の項目は変更しない。未登録なら null。 */
export function updateDetails(
  db: SqliteClient,
  address: AliasAddress,
  { note, service_url }: { note: string | undefined; service_url: string | undefined },
): Promise<Alias | null> {
  return updateDetailsQuery.run(db, {
    address,
    note: note ?? "",
    service_url: service_url ?? "",
    update_note: note === undefined ? 0 : 1,
    update_service_url: service_url === undefined ? 0 : 1,
  });
}

/** 削除したら true。 */
export async function deleteAliasRow(db: SqliteClient, address: AliasAddress): Promise<boolean> {
  return (await deleteQuery.run(db, { address })) !== null;
}
