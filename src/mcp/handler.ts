import { insufficientScope, type OAuthResourceAuth } from "@cloudflare/workers-oauth-provider";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { AliasStore } from "../aliases/store";
import { MANAGE_SCOPE } from "../config";
import { createMcpServer } from "./server";

export type McpRequestContext = {
  aliases: AliasStore;
  /** OAuthProvider が検証したトークンの情報。 */
  auth: OAuthResourceAuth;
  publicOrigin: string;
};

/** ステートレスな Streamable HTTP として、リクエストごとに MCP サーバーを作って応答する。 */
export async function handleMcpRequest(
  request: Request,
  { aliases, auth, publicOrigin }: McpRequestContext,
): Promise<Response> {
  // トークン自体は OAuthProvider が検証済み。アプリの権限はここで確認する。
  if (!auth.scope.includes(MANAGE_SCOPE)) return insufficientScope(auth, [MANAGE_SCOPE]);

  const origin = request.headers.get("Origin");
  if (origin !== null && origin !== publicOrigin) {
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  }

  const server = createMcpServer(aliases);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);

  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
}
