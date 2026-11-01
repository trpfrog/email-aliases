import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const migrations = join(import.meta.dirname, "../../migrations");

/** マイグレーションを適用したインメモリ SQLite。D1 の代わりに store へ渡せる。 */
export function createMigratedDatabase(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  for (const file of readdirSync(migrations)
    .filter((name) => name.endsWith(".sql"))
    .toSorted()) {
    db.exec(readFileSync(join(migrations, file), "utf8"));
  }
  return db;
}
