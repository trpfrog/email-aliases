import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AliasStore } from "../aliases/store";
import { createAliasSchema, deleteAliasSchema, listAliasesSchema } from "../aliases/schema";
import { DOMAIN } from "../config";

function result(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

export function createServer(aliases: AliasStore) {
  const server = new McpServer({ name: "email-aliases", version: "0.1.0" });

  server.registerTool(
    "create_alias",
    {
      description: `Allow an address at ${DOMAIN} to receive forwarded email. Requires a full address including the domain. Creating an existing alias leaves its note unchanged.`,
      inputSchema: createAliasSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => result(await aliases.create(input)),
  );

  server.registerTool(
    "list_aliases",
    {
      description: "List allowed email aliases, ordered by address. Use offset to paginate.",
      inputSchema: listAliasesSchema.shape,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (input) => result(await aliases.list(input)),
  );

  server.registerTool(
    "delete_alias",
    {
      description:
        "Remove an email alias. Future emails to this address are silently dropped. Previously forwarded messages are unaffected.",
      inputSchema: deleteAliasSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ address }) => result(await aliases.delete(address)),
  );

  return server;
}
