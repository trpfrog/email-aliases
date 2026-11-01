import { describe, expect, test } from "vite-plus/test";
import { z } from "zod";
import { base, basicAuth, request } from "../test/e2e/server";

describe("Basic 認証と OAuth の検出情報", () => {
  test("MCP と接続承認のエンドポイントを保護する", async () => {
    const challenge = await request("/mcp");
    expect(challenge.status).toBe(401);
    expect(challenge.headers.get("www-authenticate")).toMatch(/resource_metadata/);

    for (const method of ["GET", "POST"]) {
      expect((await request("/authorize", { method })).status).toBe(401);
    }

    const wrong = basicAuth("admin", "wrong");
    expect((await request("/authorize", { headers: { Authorization: wrong } })).status).toBe(401);

    const metadata = z
      .object({ resource: z.string() })
      .parse(await (await request("/.well-known/oauth-protected-resource/mcp")).json());
    expect(metadata.resource).toBe(`${base}/mcp`);

    const discovery = z
      .object({ code_challenge_methods_supported: z.array(z.string()) })
      .parse(await (await request("/.well-known/oauth-authorization-server")).json());
    expect(discovery.code_challenge_methods_supported).toContain("S256");
  });
});
