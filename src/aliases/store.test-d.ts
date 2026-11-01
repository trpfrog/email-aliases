import { expectTypeOf, test } from "vite-plus/test";
import type createAlias from "./queries/create.sql";
import type getAlias from "./queries/get.sql";
import type listAliases from "./queries/list.sql";
import type setDisabled from "./queries/set-disabled.sql";
import type updateDetails from "./queries/update-details.sql";
import type { Alias, AliasAddress } from "./schema";
import type { AliasStore } from "./store";

// tsc（content mapper あり）でのみ意味を持つ。手書きの Alias が SQL の行の型とずれたら失敗する。
test("SQL が返す行の型が Alias と一致する", () => {
  expectTypeOf<(typeof getAlias)["~reylo"]["element"]>().toEqualTypeOf<Alias>();
  expectTypeOf<(typeof createAlias)["~reylo"]["element"]>().toEqualTypeOf<Alias>();
  expectTypeOf<(typeof listAliases)["~reylo"]["element"]>().toEqualTypeOf<Alias>();
  expectTypeOf<(typeof setDisabled)["~reylo"]["element"]>().toEqualTypeOf<Alias>();
  expectTypeOf<(typeof updateDetails)["~reylo"]["element"]>().toEqualTypeOf<Alias>();
});

test("検証済みのアドレスだけを store に渡せる", () => {
  expectTypeOf<string>().not.toExtend<AliasAddress>();
  expectTypeOf<Parameters<AliasStore["isEnabled"]>[0]>().toEqualTypeOf<AliasAddress>();
  expectTypeOf<Parameters<AliasStore["delete"]>[0]>().toEqualTypeOf<AliasAddress>();
  expectTypeOf<Parameters<AliasStore["create"]>[0]["address"]>().toEqualTypeOf<AliasAddress>();
});
