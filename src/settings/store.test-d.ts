// Vitest では実行せず、tsc（`vp run typecheck`）だけが content mapper を使って検査する型テスト。
// queries.ts で明示した型が、Reylo が SQL から推論する型とずれたら失敗する。
import { expectTypeOf, test } from "vite-plus/test";
import type getQuery from "./queries/get.sql";
import type setDropDryRunQuery from "./queries/set-drop-dry-run.sql";
import type { Settings } from "./schema";

type Row<Query extends { "~reylo": { element: unknown } }> = Query["~reylo"]["element"];
type Params<Query extends { "~reylo": { input: unknown } }> = Query["~reylo"]["input"];

test("SQL の引数と戻り値が queries.ts の呼び出し方と一致する", () => {
  expectTypeOf<Row<typeof getQuery>>().toEqualTypeOf<Settings>();
  expectTypeOf<Row<typeof setDropDryRunQuery>>().toEqualTypeOf<Settings>();
  expectTypeOf<Params<typeof setDropDryRunQuery>>().toEqualTypeOf<{ enabled: number }>();
});
