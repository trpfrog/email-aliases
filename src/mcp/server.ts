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
import { APP_VERSION, MAIL_DOMAIN } from "../config";
import {
  clearReceivedEmailsInput,
  clearReceivedEmailsResult,
  deleteReceivedEmailResult,
  listAliasActivityInput,
  listAliasActivityResult,
  listReceivedEmailsInput,
  listReceivedEmailsResult,
  RECEIVED_LIMITS,
  receivedEmailIdInput,
} from "../received/schema";
import type { ReceivedEmailStore } from "../received/store";

const readOnly: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };
const idempotentWrite: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const idempotentDelete: ToolAnnotations = { ...idempotentWrite, destructiveHint: true };

/**
 * ツール引数に含められる要素数（オブジェクトのキーと配列の要素）の上限。
 * どのツールも引数は数個のキーだけなので、深い・大きい入力を Zod の検証前に拒否する
 */
export const MAX_TOOL_INPUT_ELEMENTS = 16;

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
      content: [{ type: "text", text: "The database is unavailable. Try again later." }],
    };
  }
}

export function createMcpServer({
  aliases,
  received,
}: {
  aliases: AliasStore;
  received: ReceivedEmailStore;
}): McpServer {
  const server = new McpServer(
    { name: "email-aliases", version: APP_VERSION },
    { maxToolInputElements: MAX_TOOL_INPUT_ELEMENTS },
  );

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
        "List or search email aliases, ordered by address. query matches part of the address, note, or service_url (case-insensitive for ASCII); pass a full address to look up one alias. status filters by enabled or disabled (default: all). has_service_url filters by whether a service URL is set. disabled_at is null when enabled and contains the disabling timestamp when forwarding is stopped. Use next_offset as offset to fetch the next page.",
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

  server.registerTool(
    "list_received_emails",
    {
      description: `List the history of emails received at ${MAIL_DOMAIN} from the last 180 days, newest first. outcome is "forwarded" (sent to the inbox), "disabled" (dropped because the alias is disabled), or "unknown" (dropped because no alias exists; useful for finding aliases that were never created). filter narrows by outcome; "dropped" matches both "disabled" and "unknown". Unknown recipients are not recorded during floods (over ${RECEIVED_LIMITS.newUnknownPerHour} new or ${RECEIVED_LIMITS.unknownPerHour} total per hour). Use next_offset as offset to fetch the next page.`,
      inputSchema: listReceivedEmailsInput,
      outputSchema: listReceivedEmailsResult,
      annotations: readOnly,
    },
    (input) => respond(listReceivedEmailsResult, received.list(input)),
  );

  server.registerTool(
    "list_alias_activity",
    {
      description:
        'List how often each registered alias receives email, including aliases that never received any. Counts cover every outcome (forwarded and dropped) within the 180-day history; received_count_30d covers the last 30 days. sort is "least_recent" (aliases with no or the oldest last email first; useful for finding unused aliases) or "most_received_30d" (useful for finding aliases that attract spam). Use next_offset as offset to fetch the next page.',
      inputSchema: listAliasActivityInput,
      outputSchema: listAliasActivityResult,
      annotations: readOnly,
    },
    (input) => respond(listAliasActivityResult, received.activity(input)),
  );

  server.registerTool(
    "delete_received_email",
    {
      description:
        "Delete one entry from the received email history by its id. Does not affect aliases or delivered messages.",
      inputSchema: receivedEmailIdInput,
      outputSchema: deleteReceivedEmailResult,
      annotations: idempotentDelete,
    },
    ({ id }) => respond(deleteReceivedEmailResult, received.delete(id)),
  );

  server.registerTool(
    "clear_received_emails",
    {
      description:
        'Delete every entry in the received email history that matches filter ("all", "forwarded", "dropped", "disabled", or "unknown") and return how many were deleted. Does not affect aliases or delivered messages.',
      inputSchema: clearReceivedEmailsInput,
      outputSchema: clearReceivedEmailsResult,
      annotations: idempotentDelete,
    },
    ({ filter }) => respond(clearReceivedEmailsResult, received.clear(filter)),
  );

  return server;
}
