// Reylo が SQL を型検査するための使い捨て DB を、マイグレーションから作り直す。
// アプリのデータは D1 に保存し、この DB には保存しない。
import { mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const path = ".reylo/schema.sqlite";

mkdirSync(".reylo", { recursive: true });
rmSync(path, { force: true });

const db = new DatabaseSync(path);
try {
  for (const file of readdirSync("migrations")
    .filter((name) => name.endsWith(".sql"))
    .toSorted()) {
    db.exec(readFileSync(join("migrations", file), "utf8"));
  }
} finally {
  db.close();
}
