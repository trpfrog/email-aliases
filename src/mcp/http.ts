import { StreamableHTTPTransport } from "@hono/mcp";
import type { OAuthResourceContext } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import type { AliasStore } from "../aliases/store";
import { MANAGE_SCOPE, MCP_PATH } from "../config";
import { createServer } from "./server";

export function createMcpApp(aliases: AliasStore, publicOrigin: string) {
  const app = new Hono();

  app.all(MCP_PATH, async (c) => {
    // OAuthProvider がトークンを検証し、このアダプターがアプリのスコープを確認する。
    const ctx = c.executionCtx as OAuthResourceContext<unknown>;
    if (!ctx.auth?.scope.includes(MANAGE_SCOPE)) {
      return c.json({ error: "insufficient_scope" }, 403);
    }

    const origin = c.req.header("Origin");
    if (origin && origin !== publicOrigin) {
      return c.json({ error: "Invalid origin" }, 403);
    }

    const server = createServer(aliases);
    const transport = new StreamableHTTPTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    await server.connect(transport);

    try {
      return (await transport.handleRequest(c)) ?? c.body(null, 202);
    } finally {
      await server.close();
    }
  });

  return app;
}
