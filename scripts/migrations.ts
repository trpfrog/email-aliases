import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const migrationsDir = join(import.meta.dirname, "../migrations");

/** `migrations/*.sql` を順に適用した SQLite を開く。型検査用の DB とテストで共有する。 */
export function openMigratedDatabase(path = ":memory:"): DatabaseSync {
  const db = new DatabaseSync(path);
  for (const file of readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .toSorted()) {
    db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }
  return db;
}
