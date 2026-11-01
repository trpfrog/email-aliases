import type { OAuthResourceAuth } from "@cloudflare/workers-oauth-provider";
import { describe, expect, it as baseIt, vi } from "vite-plus/test";
import { z } from "zod";
import type { AliasStore } from "../aliases/store";
import { MANAGE_SCOPE } from "../config";
import type { ReceivedEmailStore } from "../received/store";
import { handleMcpRequest, MAX_MCP_REQUEST_BODY_BYTES } from "./handler";

const origin = "https://aliases.example";

const authFor = (scope: string[]): OAuthResourceAuth => ({
  token: "token",
  audience: `${origin}/mcp`,
  scope,
});

const it = baseIt
  .extend("aliases", () => ({
    status: vi.fn<AliasStore["status"]>().mockResolvedValue("missing"),
    create: vi.fn<AliasStore["create"]>(),
    list: vi.fn<AliasStore["list"]>().mockResolvedValue({ aliases: [], next_offset: null }),
    setDisabled: vi.fn<AliasStore["setDisabled"]>(),
    updateDetails: vi.fn<AliasStore["updateDetails"]>(),
    delete: vi.fn<AliasStore["delete"]>(),
  }))
  .extend("received", () => ({
    record: vi.fn<ReceivedEmailStore["record"]>(),
    list: vi.fn<ReceivedEmailStore["list"]>(),
    delete: vi.fn<ReceivedEmailStore["delete"]>(),
    clear: vi.fn<ReceivedEmailStore["clear"]>(),
    activity: vi.fn<ReceivedEmailStore["activity"]>(),
  }))
  .extend(
    "request",
    ({ aliases, received }) =>
      (
        method: string,
        params: Record<string, unknown> = {},
        options: { scope?: string[]; origin?: string } = {},
      ) => {
        const auth = authFor(options.scope ?? [MANAGE_SCOPE]);
        const headers = new Headers({
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        });
        if (options.origin !== undefined) headers.set("Origin", options.origin);

        return handleMcpRequest(
          new Request(`${origin}/mcp`, {
            method: "POST",
            headers,
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
          }),
          { aliases, received, auth, publicOrigin: origin },
        );
      },
  );

const toolResponse = z.object({
  result: z.object({
    isError: z.boolean().optional(),
    content: z.array(z.object({ text: z.string() })),
    structuredContent: z.unknown().optional(),
  }),
});

describe("MCP の HTTP ハンドラー", () => {
  it("エンドポイント以外のパスは 404 にする", async ({ aliases, received }) => {
    const response = await handleMcpRequest(
      new Request(`${origin}/mcp/other`, { method: "POST" }),
      {
        aliases,
        received,
        auth: authFor([MANAGE_SCOPE]),
        publicOrigin: origin,
      },
    );
    expect(response.status).toBe(404);
  });

  it.for([[], ["offline_access"]])(
    "管理スコープのないトークン %j をデータにアクセスする前に拒否する",
    async (scope, { aliases, request }) => {
      const response = await request("tools/list", {}, { scope });

      expect(response.status).toBe(403);
      expect(response.headers.get("WWW-Authenticate")).toContain("insufficient_scope");
      expect(aliases.list).not.toHaveBeenCalled();
    },
  );

  it("異なる Origin をツールの実行前に拒否する", async ({ aliases, request }) => {
    const response = await request(
      "tools/call",
      { name: "list_aliases", arguments: {} },
      { origin: "https://other.example" },
    );

    expect(response.status).toBe(403);
    expect(aliases.list).not.toHaveBeenCalled();
  });

  it.for([undefined, origin])(
    "Origin が %j の認可済みリクエストを受け付ける",
    async (requestOrigin, { aliases, request }) => {
      const response = await request(
        "tools/call",
        { name: "list_aliases", arguments: {} },
        { origin: requestOrigin },
      );

      expect(response.status).toBe(200);
      expect(toolResponse.parse(await response.json()).result.structuredContent).toEqual({
        aliases: [],
        next_offset: null,
      });
      expect(aliases.list).toHaveBeenCalledExactlyOnceWith({
        query: "",
        status: "all",
        limit: 100,
        offset: 0,
      });
    },
  );

  it("ストレージの失敗は内部の情報を含まないツールエラーにする", async ({ aliases, request }) => {
    aliases.list.mockRejectedValueOnce(new Error("storage unavailable"));

    const response = await request("tools/call", { name: "list_aliases", arguments: {} });

    const { result } = toolResponse.parse(await response.json());
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).not.toContain("storage unavailable");
  });

  it("上限を超える本文をツールの実行前に 413 で拒否する", async ({ aliases, request }) => {
    const response = await request("tools/call", {
      name: "list_aliases",
      arguments: {},
      padding: "x".repeat(MAX_MCP_REQUEST_BODY_BYTES),
    });

    expect(response.status).toBe(413);
    expect(aliases.list).not.toHaveBeenCalled();
  });
});
