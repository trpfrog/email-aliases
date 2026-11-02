// Vitest では実行せず、tsc（`vp run typecheck`）だけが content mapper を使って検査する型テスト。
// queries.ts で明示した型が、Reylo が SQL から推論する型とずれたら失敗する。
import { expectTypeOf, test } from "vite-plus/test";
import type activityQuery from "./queries/activity.sql";
import type clearQuery from "./queries/clear.sql";
import type deleteQuery from "./queries/delete.sql";
import type listQuery from "./queries/list.sql";
import type recordQuery from "./queries/record.sql";
import type { AliasActivity, ListAliasActivityInput, ReceivedEmail } from "./schema";

type Row<Query extends { "~reylo": { element: unknown } }> = Query["~reylo"]["element"];
type Params<Query extends { "~reylo": { input: unknown } }> = Query["~reylo"]["input"];

test("一覧の行は outcome・dry_run 以外が ReceivedEmail と一致する", () => {
  // outcome は Reylo が string と推論するため、queries.ts で Zod により絞り込む。
  // dry_run は 0 か 1 の整数なので、queries.ts で真偽値に変換する
  expectTypeOf<Row<typeof listQuery>>().toEqualTypeOf<{
    [Key in keyof ReceivedEmail]: Key extends "outcome"
      ? string
      : Key extends "dry_run"
        ? number
        : ReceivedEmail[Key];
  }>();
  expectTypeOf<ReceivedEmail["outcome"]>().toExtend<Row<typeof listQuery>["outcome"]>();
});

test("受信状況の行と引数が AliasActivity・入力と一致する", () => {
  expectTypeOf<Row<typeof activityQuery>>().toEqualTypeOf<AliasActivity>();
  expectTypeOf<Params<typeof activityQuery>>().toEqualTypeOf<{
    sort: string;
    limit: number;
    offset: number;
  }>();
  expectTypeOf<ListAliasActivityInput>().toExtend<Params<typeof activityQuery>>();
});

test("SQL の引数と戻り値が queries.ts の呼び出し方と一致する", () => {
  expectTypeOf<Params<typeof recordQuery>>().toEqualTypeOf<{
    recipient: string;
    sender: string;
    size: number;
    outcome: string;
    dry_run: number;
    max_unknown_per_hour: number;
    max_new_unknown_per_hour: number;
  }>();
  expectTypeOf<Row<typeof recordQuery>>().toEqualTypeOf<{ id: number }>();
  expectTypeOf<Params<typeof listQuery>>().toEqualTypeOf<{
    filter: string;
    limit: number;
    offset: number;
  }>();
  expectTypeOf<Params<typeof deleteQuery>>().toEqualTypeOf<{ id: number }>();
  expectTypeOf<Params<typeof clearQuery>>().toEqualTypeOf<{ filter: string }>();
  expectTypeOf<Row<typeof clearQuery>>().toEqualTypeOf<{ id: number }>();
});
