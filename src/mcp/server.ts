import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AliasStore } from "../aliases/store";
import {
  createAliasSchema,
  deleteAliasSchema,
  listAliasesSchema,
  setAliasDisabledSchema,
  updateAliasNoteSchema,
} from "../aliases/schema";
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
      description: `Allow an address at ${DOMAIN} to receive forwarded email. Requires a full address including the domain. Creating an existing alias leaves its note and disabled state unchanged.`,
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
      description:
        "List email aliases, including disabled aliases, ordered by address. disabled_at is null when enabled and contains the disabling timestamp when forwarding is stopped. Use offset to paginate.",
      inputSchema: listAliasesSchema.shape,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (input) => result(await aliases.list(input)),
  );

  server.registerTool(
    "set_alias_disabled",
    {
      description:
        "Disable or re-enable forwarding for an existing alias. Preserves its address, note, and creation date. Set disabled to true to stop forwarding or false to resume it.",
      inputSchema: setAliasDisabledSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => result(await aliases.setDisabled(input)),
  );

  server.registerTool(
    "update_alias_note",
    {
      description:
        "Edit an existing alias's note without changing its address or enabled state. Pass an empty note to clear it.",
      inputSchema: updateAliasNoteSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => result(await aliases.updateNote(input)),
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
