import { expect, it } from "vite-plus/test";
import createAlias from "./queries/create.sql";
import deleteAlias from "./queries/delete.sql";
import getAlias from "./queries/get.sql";
import listAliases from "./queries/list.sql";

it("推論した SQL の結果件数を実行時に参照できる", () => {
  expect(getAlias.cardinality).toBe("maybeOne");
  expect(createAlias.cardinality).toBe("maybeOne");
  expect(deleteAlias.cardinality).toBe("maybeOne");
  expect(listAliases.cardinality).toBe("many");
});
