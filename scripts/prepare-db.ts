// Reylo が SQL を型検査するための使い捨て DB を、マイグレーションから作り直す。
// アプリのデータは D1 に保存し、この DB には保存しない。
import { mkdirSync, rmSync } from "node:fs";
import { openMigratedDatabase } from "./migrations.ts";

const path = ".reylo/schema.sqlite";

mkdirSync(".reylo", { recursive: true });
rmSync(path, { force: true });
openMigratedDatabase(path).close();
