import { join } from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite-plus";
import reylo from "reylo/vite";
import react from "@vitejs/plugin-react-swc";
import { LOCAL_D1_ID } from "./cloudflare.config";
import { app } from "./app.config.ts";

/** 本番のドメインをリポジトリに載せないよう、ビルド時の環境変数で app.config.ts の値を上書きできる */
const envMailDomain = process.env.MAIL_DOMAIN?.trim() ?? "";
const mailDomain = envMailDomain === "" ? app.mailDomain : envMailDomain;

export default defineConfig({
  define: { BUILD_MAIL_DOMAIN: JSON.stringify(mailDomain) },
  lint: {
    plugins: ["typescript", "unicorn", "oxc", "react", "import", "vitest"],
    categories: { correctness: "error", suspicious: "error" },
    options: { typeAware: true },
    rules: {
      // 型安全を崩す書き方を禁止する。`as const` は許可される。
      "typescript/no-explicit-any": "error",
      "typescript/no-non-null-assertion": "error",
      "typescript/consistent-type-assertions": ["error", { assertionStyle: "never" }],
      "typescript/no-unsafe-argument": "error",
      "typescript/no-unsafe-assignment": "error",
      "typescript/no-unsafe-call": "error",
      "typescript/no-unsafe-member-access": "error",
      "typescript/no-unsafe-return": "error",
      "typescript/no-unsafe-type-assertion": "error",
      "typescript/no-unnecessary-type-assertion": "error",
      "typescript/no-unnecessary-condition": "error",
      "typescript/strict-boolean-expressions": "error",
      "typescript/switch-exhaustiveness-check": "error",
      "typescript/restrict-template-expressions": "error",
      "typescript/use-unknown-in-catch-callback-variable": "error",
      "typescript/only-throw-error": "error",
      "typescript/no-floating-promises": "error",
      "typescript/no-misused-promises": "error",
      "typescript/await-thenable": "error",
      "typescript/return-await": ["error", "always"],
      "typescript/prefer-nullish-coalescing": "error",
      "typescript/consistent-type-imports": "error",
      // 自動 JSX ランタイム（React・hono/jsx）では不要
      "react/react-in-jsx-scope": "off",
      "import/no-unassigned-import": ["error", { allow: ["**/*.css"] }],
      // `it.extend` で作った fixture 付きの `it` も test ブロックとして扱う。
      // 失敗時の説明を第 2 引数で渡せるようにする。
      "vitest/valid-expect": ["error", { maxArgs: 2 }],
      "vitest/no-standalone-expect": [
        "error",
        { additionalTestBlockFunctions: ["it", "it.for", "it.each"] },
      ],
    },
    overrides: [
      {
        // `expect.any()` などの非対称マッチャーが any を返すため、テストでは代入だけ許可する
        files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts"],
        rules: { "typescript/no-unsafe-assignment": "off" },
      },
      {
        // Reylo の SQL の型は tsc の content mapper でしか解決できず、tsgolint からは error 型に見える。
        // queries.ts が外向きの型を明示し、store.test-d.ts が tsc で推論結果との一致を検査する。
        files: [
          "src/aliases/queries.ts",
          "src/aliases/store.test-d.ts",
          "src/received/queries.ts",
          "src/received/store.test-d.ts",
        ],
        rules: {
          "typescript/no-unsafe-argument": "off",
          "typescript/no-unsafe-assignment": "off",
          "typescript/no-unsafe-call": "off",
          "typescript/no-unsafe-member-access": "off",
          "typescript/no-unsafe-return": "off",
          "typescript/no-unnecessary-condition": "off",
          "typescript/strict-boolean-expressions": "off",
        },
      },
    ],
  },
  run: {
    tasks: {
      dev: { command: "cf dev", dependsOn: ["db:prepare"], cache: false },
      build: {
        command: "cf build",
        dependsOn: ["db:prepare"],
        cache: { env: ["MAIL_DOMAIN"], output: [".cloudflare/output/**"] },
      },
      deploy: { command: "cf deploy", dependsOn: ["db:prepare"], cache: false },
      // 1Password の Production 保管庫の Secret と一緒にデプロイする
      "deploy:prod": {
        command: "node scripts/deploy-prod.ts",
        dependsOn: ["db:prepare"],
        cache: false,
      },
      // 1Password の Development 保管庫から .dev.vars を作る
      "secrets:dev": {
        command: "op inject --force --in-file .dev.vars.tpl --out-file .dev.vars",
        cache: false,
      },
      "db:prepare": {
        command: "node scripts/prepare-db.ts",
        cache: {
          input: ["scripts/prepare-db.ts", "migrations/*.sql"],
          output: [".reylo/schema.sqlite"],
        },
      },
      "db:migrate:local": {
        command: `cf d1 migrations apply ${LOCAL_D1_ID} --local --persist-to .cloudflare/state --mode development`,
        cache: false,
      },
      check: { command: "vp check", dependsOn: ["typecheck"] },
      typecheck: {
        command: ["tsc --noEmit --runExternalCode", "tsc -p src/web --noEmit --runExternalCode"],
        dependsOn: ["db:prepare"],
      },
      test: { command: "vp test run --project unit", dependsOn: ["db:prepare"] },
      "test:e2e": { command: "vp test run --project e2e", cache: false },
    },
  },
  server: {
    // 開発用の PUBLIC_ORIGIN と .mcp.json が 5173 を前提にしているため、別のポートへずらさない
    port: 5173,
    strictPort: true,
    // 本番用の平文の Secret を開発サーバーから配信しない。
    // Cloudflare の Vite プラグインが .env や .dev.vars などの拒否リストを追加する。
    fs: { deny: [".prod.vars", ".prod.vars.*"] },
  },
  plugins: [
    {
      // index.html の %APP_*% を app.config.ts の値に置き換える
      name: "app-config-html",
      transformIndexHtml: (html) =>
        html
          .replaceAll("%APP_NAME%", app.name)
          .replaceAll("%APP_BROWSER_COLOR%", app.theme.browserColor),
    },
    reylo(),
    react({
      // Hono の承認ページは既存の JSX 変換を使う
      parserConfig: (id) =>
        id.includes("/src/web/") && /\.tsx?$/.test(id)
          ? { syntax: "typescript", tsx: id.endsWith(".tsx") }
          : undefined,
      useAtYourOwnRisk_mutateSwcOptions(options) {
        options.jsc = {
          ...options.jsc,
          transform: { ...options.jsc?.transform, reactCompiler: true },
        };
      },
    }).map((plugin) => ({
      ...plugin,
      applyToEnvironment: (environment) => environment.name === "client",
      // SWC プラグインのグローバルな oxc 無効化をクライアントに限定する
      ...(plugin.name === "vite:react-swc" && plugin.apply === "serve"
        ? {
            config: () => ({ optimizeDeps: { include: ["react/jsx-dev-runtime"] } }),
            configEnvironment: (name: string) =>
              name === "client" ? { oxc: false as const } : undefined,
          }
        : {}),
    })),
    ...(process.env.VITEST === undefined ? [cloudflare()] : []),
  ],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          setupFiles: ["src/test/setup.ts"],
          include: ["src/**/*.test.ts"],
          alias: {
            "cloudflare:workers": join(import.meta.dirname, "src/test/cloudflare-workers.ts"),
          },
          server: { deps: { inline: ["@cloudflare/workers-oauth-provider"] } },
        },
      },
      {
        extends: true,
        test: {
          name: "e2e",
          include: ["src/**/*.spec.ts"],
          globalSetup: ["src/test/e2e/global-setup.ts"],
          testTimeout: 30000,
        },
      },
    ],
  },
});
