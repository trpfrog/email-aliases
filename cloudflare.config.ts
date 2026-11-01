import { bindings, defineConfig } from "cf/config";
import { deploy } from "./deploy.config.ts";

/** 開発用のローカル D1 の ID。db:migrate:local と結合テストも使う。 */
export const LOCAL_D1_ID = "00000000-0000-4000-8000-000000000001";

export default defineConfig(({ mode }) => ({
  worker: {
    name: deploy.workerName,
    entrypoint: "./src/index.ts",
    compatibilityDate: "2026-10-27",
    compatibilityFlags: ["nodejs_compat", "global_fetch_strictly_public"],
    assets: { runWorkerFirst: ["/", "/index.html", "/api/*"] },
    env: {
      ASSETS: bindings.assets(),
      DB: bindings.d1({
        name: "email-aliases",
        id: mode === "development" ? LOCAL_D1_ID : deploy.d1DatabaseId,
      }),
      OAUTH_KV: bindings.kv({ id: mode === "development" ? undefined : deploy.kvNamespaceId }),
      // 本番の URL は公開リポジトリに載せないよう、Secret として渡す（.prod.vars.tpl）
      PUBLIC_ORIGIN:
        mode === "development"
          ? // 結合テストは空いているポートで起動するため、開発時だけ上書きできる
            bindings.text(process.env.DEV_PUBLIC_ORIGIN ?? "http://localhost:5173")
          : bindings.secret(),
      ADMIN_PASSWORD: bindings.secret(),
      FORWARD_TO: bindings.secret(),
    },
  },
}));
