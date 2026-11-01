import { bindings, defineConfig } from "cf/config";

/** 開発用のローカル D1 の ID。db:migrate:local と結合テストも使う。 */
export const LOCAL_D1_ID = "00000000-0000-4000-8000-000000000001";

export default defineConfig(({ mode }) => ({
  worker: {
    name: "email-aliases",
    entrypoint: "./src/index.ts",
    compatibilityDate: "2026-10-27",
    compatibilityFlags: ["nodejs_compat", "global_fetch_strictly_public"],
    assets: { runWorkerFirst: ["/", "/index.html", "/api/*"] },
    env: {
      ASSETS: bindings.assets(),
      DB: bindings.d1({
        name: "email-aliases",
        // 本番環境には実際の ID を設定する。
        id: mode === "development" ? LOCAL_D1_ID : undefined,
      }),
      OAUTH_KV: bindings.kv({}),
      PUBLIC_ORIGIN: bindings.text(
        mode === "development"
          ? // 結合テストは空いているポートで起動するため、開発時だけ上書きできる。
            (process.env.DEV_PUBLIC_ORIGIN ?? "http://localhost:5173")
          : "https://email-aliases.YOUR_SUBDOMAIN.workers.dev",
      ),
      ADMIN_PASSWORD: bindings.secret(),
      FORWARD_TO: bindings.secret(),
    },
  },
}));
