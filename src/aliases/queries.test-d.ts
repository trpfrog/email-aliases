import { expectTypeOf, it } from "vite-plus/test";
import createAlias from "./queries/create.sql";
import deleteAlias from "./queries/delete.sql";
import getAlias from "./queries/get.sql";
import listAliases from "./queries/list.sql";

it("マイグレーション適用後のスキーマから SQL の引数・NULL 許容性・結果の件数を推論する", () => {
  expectTypeOf<typeof getAlias.dialect>().toEqualTypeOf<"sqlite">();
  expectTypeOf<typeof createAlias.dialect>().toEqualTypeOf<"sqlite">();
  expectTypeOf<typeof deleteAlias.dialect>().toEqualTypeOf<"sqlite">();
  expectTypeOf<typeof listAliases.dialect>().toEqualTypeOf<"sqlite">();

  expectTypeOf<(typeof getAlias)["~reylo"]["input"]>().toEqualTypeOf<{ address: string }>();

  expectTypeOf<Awaited<ReturnType<typeof getAlias.run>>>().toEqualTypeOf<{
    address: string;
    note: string;
    created_at: string;
  } | null>();

  expectTypeOf<(typeof createAlias)["~reylo"]["input"]>().toEqualTypeOf<{
    address: string;
    note: string;
  }>();

  expectTypeOf<(typeof listAliases)["~reylo"]["input"]>().toEqualTypeOf<{
    limit: number;
    offset: number;
  }>();
});
