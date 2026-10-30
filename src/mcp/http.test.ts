import { describe, expect, it as baseIt, vi } from "vite-plus/test";
import type { AliasStore } from "../aliases/store";
import { MANAGE_SCOPE } from "../config";
import { createMcpApp } from "./http";

const it = baseIt.extend(
  "aliases",
  () =>
    ({
      has: vi.fn(async () => false),
      create: vi.fn(async () => ({ created: true, alias: null })),
      list: vi.fn(async () => ({ aliases: [], next_offset: null })),
      delete: vi.fn(async (address) => ({ address, deleted: false })),
      setDisabled: vi.fn(async () => ({ updated: false, alias: null })),
      updateDetails: vi.fn(async () => ({ updated: false, alias: null })),
    }) satisfies AliasStore,
);

const origin = "https://aliases.example";

const test = it.extend("request", ({ aliases }) => {
  const app = createMcpApp(aliases, origin);

  return (method: string, params = {}, options: { scope?: string[]; origin?: string } = {}) => {
    const ctx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
      auth: { scope: options.scope ?? [MANAGE_SCOPE] },
    } as unknown as ExecutionContext;

    return app.fetch(
      new Request(`${origin}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          ...(options.origin ? { Origin: options.origin } : {}),
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      }),
      {},
      ctx,
    );
  };
});

describe("MCP の HTTP アダプター", () => {
  test("管理スコープのないトークンをデータにアクセスする前に拒否する", async ({
    aliases,
    request,
  }) => {
    for (const scope of [[], ["offline_access"]]) {
      expect((await request("tools/list", {}, { scope })).status).toBe(403);
    }

    expect(aliases.list).not.toHaveBeenCalled();
    expect(aliases.create).not.toHaveBeenCalled();
    expect(aliases.delete).not.toHaveBeenCalled();
  });

  test("異なる Origin をツールの実行前に拒否する", async ({ aliases, request }) => {
    const response = await request(
      "tools/call",
      { name: "list_aliases", arguments: {} },
      { origin: "https://other.example" },
    );

    expect(response.status).toBe(403);
    expect(aliases.list).not.toHaveBeenCalled();
  });

  test.for([undefined, origin])(
    "Origin が %j の認可済みリクエストを受け付ける",
    async (requestOrigin, { aliases, request }) => {
      const response = await request(
        "tools/call",
        { name: "list_aliases", arguments: {} },
        { origin: requestOrigin },
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        result: { structuredContent: { aliases: [], next_offset: null } },
      });
      expect(aliases.list).toHaveBeenCalledExactlyOnceWith({ limit: 100, offset: 0 });
    },
  );

  test.for([
    { name: "create_alias", arguments: { address: "wrong@other.example" } },
    { name: "create_alias", arguments: { address: "shop", note: "x".repeat(1001) } },
    { name: "delete_alias", arguments: { address: "*" } },
    { name: "list_aliases", arguments: { limit: 101 } },
    { name: "list_aliases", arguments: { offset: -1 } },
  ])("ツール $name への不正な入力を拒否する", async (params, { aliases, request }) => {
    const response = await request("tools/call", params);
    const body = (await response.json()) as { result?: { isError?: boolean }; error?: unknown };

    expect(body.result?.isError || body.error).toBeTruthy();
    expect(aliases.create).not.toHaveBeenCalled();
    expect(aliases.list).not.toHaveBeenCalled();
    expect(aliases.delete).not.toHaveBeenCalled();
  });

  test("ストレージの処理に失敗した場合はツールエラーを返す", async ({ aliases, request }) => {
    aliases.list.mockRejectedValueOnce(new Error("storage unavailable"));

    const response = await request("tools/call", { name: "list_aliases", arguments: {} });

    expect(await response.json()).toMatchObject({ result: { isError: true } });
  });
});
