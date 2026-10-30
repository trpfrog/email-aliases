import { mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

// このデータベースは SQL 解析専用。アプリのデータは D1 に保存する。
mkdirSync(".reylo", { recursive: true });

const path = ".reylo/schema.sqlite";
rmSync(path, { force: true });

const db = new DatabaseSync(path);

try {
  for (const file of readdirSync("migrations")
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    db.exec(readFileSync(join("migrations", file), "utf8"));
  }
} finally {
  db.close();
}
