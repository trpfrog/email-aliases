import { bindings, defineConfig } from "cf/config";

export default defineConfig(({ mode }) => ({
  worker: {
    name: "email-aliases",
    entrypoint: "./src/index.ts",
    compatibilityDate: "2026-10-27",
    compatibilityFlags: ["nodejs_compat", "global_fetch_strictly_public"],
    env: {
      DB: bindings.d1({
        name: "email-aliases",
        // db:migrate:local と共通のローカル専用 ID。本番環境には実際の ID を設定する。
        id: mode === "development" ? "00000000-0000-4000-8000-000000000001" : undefined,
      }),
      OAUTH_KV: bindings.kv({}),
      PUBLIC_ORIGIN: bindings.text(
        mode === "development"
          ? "http://localhost:5173"
          : "https://email-aliases.YOUR_SUBDOMAIN.workers.dev",
      ),
      ADMIN_PASSWORD: bindings.secret(),
      FORWARD_TO: bindings.secret(),
    },
  },
}));
