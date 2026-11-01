import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
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
import { MAIL_DOMAIN } from "../config";

const readOnly: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };
const idempotentWrite: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const idempotentDelete: ToolAnnotations = { ...idempotentWrite, destructiveHint: true };

/**
 * ツールの結果を返す。`outputSchema` に渡したスキーマを受け取り、結果の型がそれに従うことを検査する。
 * 入力の検証エラーは SDK が詳細を返す。store の失敗は内部の情報を含みうるため、ログに残して汎用のエラーを返す。
 */
async function respond<Output extends z.ZodObject>(
  _outputSchema: Output,
  result: Promise<z.output<Output>>,
): Promise<CallToolResult> {
  try {
    const value: Record<string, unknown> = await result;
    return { content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value };
  } catch (error) {
    console.error("MCP tool failed", error);
    return {
      isError: true,
      content: [{ type: "text", text: "The alias database is unavailable. Try again later." }],
    };
  }
}

export function createMcpServer(aliases: AliasStore): McpServer {
  const server = new McpServer({ name: "email-aliases", version: "0.1.0" });

  server.registerTool(
    "create_alias",
    {
      description: `Allow an address at ${MAIL_DOMAIN} to receive forwarded email, with an optional note and HTTP(S) service_url. Requires a full address including the domain. Creating an existing alias leaves its note, service URL, and disabled state unchanged.`,
      inputSchema: createAliasInput,
      outputSchema: createAliasResult,
      annotations: idempotentWrite,
    },
    (input) => respond(createAliasResult, aliases.create(input)),
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
    (input) => respond(listAliasesResult, aliases.list(input)),
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
    (input) => respond(updateAliasResult, aliases.setDisabled(input)),
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
    (input) => respond(updateAliasResult, aliases.updateDetails(input)),
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
    ({ address }) => respond(deleteAliasResult, aliases.delete(address)),
  );

  return server;
}
