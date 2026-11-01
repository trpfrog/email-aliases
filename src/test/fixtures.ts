import { test } from "vite-plus/test";
import { openMigratedDatabase } from "../../scripts/migrations";
import { addressSchema, createAliasInput, type AliasAddress } from "../aliases/schema";

/** テストごとに、マイグレーションを適用したインメモリ SQLite（D1 の代わり）を `db` として用意する。 */
// eslint-disable-next-line no-empty-pattern -- Vitest がフィクスチャーの依存関係を検出するには分割代入が必要
export const dbTest = test.extend("db", ({}, { onCleanup }) => {
  const db = openMigratedDatabase();
  onCleanup(() => db.close());
  return db;
});

export const address = (value: string): AliasAddress => addressSchema.parse(value);

export const newAlias = (input: { address: string; note?: string; service_url?: string }) =>
  createAliasInput.parse(input);
