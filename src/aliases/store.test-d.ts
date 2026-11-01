// Vitest では実行せず、tsc（`vp run typecheck`）だけが content mapper を使って検査する型テスト。
// queries.ts で明示した型が、Reylo が SQL から推論する型とずれたら失敗する。
import { expectTypeOf, test } from "vite-plus/test";
import type { z } from "zod";
import type createQuery from "./queries/create.sql";
import type deleteQuery from "./queries/delete.sql";
import type getQuery from "./queries/get.sql";
import type listQuery from "./queries/list.sql";
import type setDisabledQuery from "./queries/set-disabled.sql";
import type updateDetailsQuery from "./queries/update-details.sql";
import type { Alias, AliasAddress, UpdateAliasResult, updateAliasResult } from "./schema";
import type { AliasStore } from "./store";

type Row<Query extends { "~reylo": { element: unknown } }> = Query["~reylo"]["element"];
type Params<Query extends { "~reylo": { input: unknown } }> = Query["~reylo"]["input"];

test("SQL が返す行の型が Alias と一致する", () => {
  expectTypeOf<Row<typeof getQuery>>().toEqualTypeOf<Alias>();
  expectTypeOf<Row<typeof createQuery>>().toEqualTypeOf<Alias>();
  expectTypeOf<Row<typeof listQuery>>().toEqualTypeOf<Alias>();
  expectTypeOf<Row<typeof setDisabledQuery>>().toEqualTypeOf<Alias>();
  expectTypeOf<Row<typeof updateDetailsQuery>>().toEqualTypeOf<Alias>();
});

test("SQL の引数が queries.ts の呼び出し方と一致する", () => {
  expectTypeOf<Params<typeof getQuery>>().toEqualTypeOf<{ address: string }>();
  expectTypeOf<Params<typeof deleteQuery>>().toEqualTypeOf<{ address: string }>();
  expectTypeOf<Params<typeof listQuery>>().toEqualTypeOf<{
    query: string;
    status: string;
    has_service_url: number;
    limit: number;
    offset: number;
  }>();
  expectTypeOf<Params<typeof createQuery>>().toEqualTypeOf<{
    address: string;
    note: string;
    service_url: string;
  }>();
});

test("store の結果の型が MCP の outputSchema に収まる", () => {
  expectTypeOf<UpdateAliasResult>().toExtend<z.output<typeof updateAliasResult>>();
});

test("検証済みのアドレスだけを store に渡せる", () => {
  expectTypeOf<string>().not.toExtend<AliasAddress>();
  expectTypeOf<Parameters<AliasStore["status"]>[0]>().toEqualTypeOf<AliasAddress>();
  expectTypeOf<Parameters<AliasStore["delete"]>[0]>().toEqualTypeOf<AliasAddress>();
  expectTypeOf<Parameters<AliasStore["create"]>[0]["address"]>().toEqualTypeOf<AliasAddress>();
});
