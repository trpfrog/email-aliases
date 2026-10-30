import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite-plus";
import reylo from "reylo/vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
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
