import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { AliasStore } from "../aliases/store";
import {
  addressInput,
  createAliasInput,
  createAliasResult,
  deleteAliasResult,
  listAliasesInput,
  listAliasesResult,
  setAliasDisabledInput,
  updateAliasDetailsInput,
  updateAliasResult,
} from "../aliases/schema";
import { DOMAIN } from "../config";

const readOnly: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };
const idempotentWrite: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const idempotentDelete: ToolAnnotations = { ...idempotentWrite, destructiveHint: true };

function structured(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

export function createMcpServer(aliases: AliasStore): McpServer {
  const server = new McpServer({ name: "email-aliases", version: "0.1.0" });

  server.registerTool(
    "create_alias",
    {
      description: `Allow an address at ${DOMAIN} to receive forwarded email, with an optional note and HTTP(S) service_url. Requires a full address including the domain. Creating an existing alias leaves its note, service URL, and disabled state unchanged.`,
      inputSchema: createAliasInput,
      outputSchema: createAliasResult,
      annotations: idempotentWrite,
    },
    async (input) => structured(await aliases.create(input)),
  );

  server.registerTool(
    "list_aliases",
    {
      description:
        "List email aliases, including disabled aliases, ordered by address. disabled_at is null when enabled and contains the disabling timestamp when forwarding is stopped. Use next_offset as offset to fetch the next page.",
      inputSchema: listAliasesInput,
      outputSchema: listAliasesResult,
      annotations: readOnly,
    },
    async (input) => structured(await aliases.list(input)),
  );

  server.registerTool(
    "set_alias_disabled",
    {
      description:
        "Disable or re-enable forwarding for an existing alias. Preserves its address, note, service URL, and creation date. Set disabled to true to stop forwarding or false to resume it.",
      inputSchema: setAliasDisabledInput,
      outputSchema: updateAliasResult,
      annotations: idempotentWrite,
    },
    async (input) => structured(await aliases.setDisabled(input)),
  );

  server.registerTool(
    "update_alias_details",
    {
      description:
        "Update an existing alias's note and/or service URL without changing its address or enabled state. Omitted fields remain unchanged; empty strings clear them. Service URLs must use HTTP or HTTPS.",
      inputSchema: updateAliasDetailsInput,
      outputSchema: updateAliasResult,
      annotations: idempotentWrite,
    },
    async (input) => structured(await aliases.updateDetails(input)),
  );

  server.registerTool(
    "delete_alias",
    {
      description:
        "Remove an email alias. Future emails to this address are silently dropped. Previously forwarded messages are unaffected.",
      inputSchema: addressInput,
      outputSchema: deleteAliasResult,
      annotations: idempotentDelete,
    },
    async ({ address }) => structured(await aliases.delete(address)),
  );

  return server;
}
