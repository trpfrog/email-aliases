import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite-plus";
import reylo from "reylo/vite";

export default defineConfig({
  plugins: [reylo(), ...(process.env.VITEST ? [] : [cloudflare()])],
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
