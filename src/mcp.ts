import { StreamableHTTPTransport } from "@hono/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Hono } from "hono";
import { z } from "zod";
import { addressSchema } from "./aliases";
import { SCOPE, type Env } from "./env";

function result(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

export function createServer(db: D1Database) {
  const server = new McpServer({ name: "email-aliases", version: "0.1.0" });

  server.registerTool(
    "create_alias",
    {
      description:
        "Allow an address at mail.example.com to receive forwarded email. Accepts a local part or full address. Creating an existing alias leaves its note unchanged.",
      inputSchema: { address: addressSchema, note: z.string().max(1000).default("") },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ address, note }) => {
      const row = await db
        .prepare(
          "INSERT INTO aliases (address, note) VALUES (?, ?) ON CONFLICT(address) DO NOTHING RETURNING address, note, created_at",
        )
        .bind(address, note)
        .first();
      return result({
        created: row !== null,
        alias:
          row ??
          (await db
            .prepare("SELECT address, note, created_at FROM aliases WHERE address = ?")
            .bind(address)
            .first()),
      });
    },
  );

  server.registerTool(
    "list_aliases",
    {
      description: "List allowed email aliases, ordered by address. Use offset to paginate.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).default(100),
        offset: z.number().int().min(0).default(0),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ limit, offset }) => {
      const { results } = await db
        .prepare("SELECT address, note, created_at FROM aliases ORDER BY address LIMIT ? OFFSET ?")
        .bind(limit + 1, offset)
        .all();
      return result({
        aliases: results.slice(0, limit),
        next_offset: results.length > limit ? offset + limit : null,
      });
    },
  );

  server.registerTool(
    "delete_alias",
    {
      description:
        "Remove an email alias. Future emails to this address are silently dropped. Previously forwarded messages are unaffected.",
      inputSchema: { address: addressSchema },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ address }) => {
      const row = await db
        .prepare("DELETE FROM aliases WHERE address = ? RETURNING address")
        .bind(address)
        .first();
      return result({ address, deleted: row !== null });
    },
  );

  return server;
}

export const mcp = new Hono<{ Bindings: Env }>();
mcp.all("/mcp", async (c) => {
  // OAuthProvider validates the token, but the application must enforce scopes.
  const ctx = c.executionCtx as ExecutionContext & { auth?: { scope: string[] } };
  if (!ctx.auth?.scope.includes(SCOPE)) return c.json({ error: "insufficient_scope" }, 403);
  const origin = c.req.header("Origin");
  if (origin && origin !== c.env.PUBLIC_ORIGIN) return c.json({ error: "Invalid origin" }, 403);

  // A fresh, stateless transport per request; no Durable Objects or shared sessions.
  const server = createServer(c.env.DB);
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
