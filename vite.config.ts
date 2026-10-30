import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite-plus";
import reylo from "reylo/vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  run: {
    tasks: {
      dev: { command: "cf dev", dependsOn: ["db:prepare"], cache: false },
      build: {
        command: "cf build",
        dependsOn: ["db:prepare"],
        cache: { output: [".cloudflare/output/**"] },
      },
      deploy: { command: "cf deploy", dependsOn: ["db:prepare"], cache: false },
      "db:prepare": {
        command: "node scripts/prepare-db.mjs",
        cache: {
          input: ["scripts/prepare-db.mjs", "migrations/*.sql"],
          output: [".reylo/schema.sqlite"],
        },
      },
      "db:migrate:local": {
        command:
          "cf d1 migrations apply 00000000-0000-4000-8000-000000000001 --local --persist-to .cloudflare/state --mode development",
        cache: false,
      },
      check: { command: "vp check", dependsOn: ["typecheck"] },
      typecheck: {
        command: ["tsc --noEmit --runExternalCode", "tsc -p src/web --noEmit --runExternalCode"],
        dependsOn: ["db:prepare"],
      },
      test: { command: "vp test run --project unit", dependsOn: ["db:prepare"] },
      "test:integration": { command: "vp test run --project integration", cache: false },
    },
  },
  plugins: [
    reylo(),
    react({
      // Hono の承認ページは既存の JSX 変換を使う。
      parserConfig: (id) =>
        id.includes("/src/web/") && /\.tsx?$/.test(id)
          ? { syntax: "typescript", tsx: id.endsWith(".tsx") }
          : undefined,
      useAtYourOwnRisk_mutateSwcOptions(options) {
        options.jsc!.transform!.reactCompiler = true;
      },
    }).map((plugin) => ({
      ...plugin,
      applyToEnvironment: (environment) => environment.name === "client",
      // SWC プラグインのグローバルな oxc 無効化をクライアントに限定する。
      ...(plugin.name === "vite:react-swc" && plugin.apply === "serve"
        ? {
            config: () => ({ optimizeDeps: { include: ["react/jsx-dev-runtime"] } }),
            configEnvironment: (name: string) =>
              name === "client" ? { oxc: false as const } : undefined,
          }
        : {}),
    })),
    ...(process.env.VITEST ? [] : [cloudflare()]),
  ],
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["src/**/*.test.ts"] },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/**/*.test.mjs"],
          testTimeout: 30000,
        },
      },
    ],
  },
});
