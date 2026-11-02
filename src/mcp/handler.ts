import { insufficientScope, type OAuthResourceAuth } from "@cloudflare/workers-oauth-provider";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { AliasStore } from "../aliases/store";
import { MANAGE_SCOPE, MCP_PATH } from "../config";
import type { ReceivedEmailStore } from "../received/store";
import type { SettingsStore } from "../settings/store";
import { createMcpServer } from "./server";

export type McpRequestContext = {
  aliases: AliasStore;
  received: ReceivedEmailStore;
  settings: SettingsStore;
  /** OAuthProvider が検証したトークンの情報。 */
  auth: OAuthResourceAuth;
  publicOrigin: string;
};

/**
 * MCP リクエストの本文の上限（バイト）。SDK の既定は 4 MiB だが、
 * 最大の入力（メモ 1000 文字・URL 2048 文字）をエスケープしても十分に収まる大きさに絞る
 */
export const MAX_MCP_REQUEST_BODY_BYTES = 64 * 1024;

/** ステートレスな Streamable HTTP として、リクエストごとに MCP サーバーを作って応答する。 */
export async function handleMcpRequest(
  request: Request,
  { aliases, received, settings, auth, publicOrigin }: McpRequestContext,
): Promise<Response> {
  // OAuthProvider は /mcp 配下のすべてのパスを渡してくるため、エンドポイント以外は 404 にする
  if (new URL(request.url).pathname !== MCP_PATH) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  // OAuthProvider の requiredScopes は案内用で強制されないため、ここで権限を確認する
  if (!auth.scope.includes(MANAGE_SCOPE)) return insufficientScope(auth, [MANAGE_SCOPE]);

  // ステートレスなので GET の SSE ストリームは応答後すぐに閉じてしまい、クライアントが約 1 秒ごとに
  // 再接続し続ける。仕様どおり 405 を返して、サーバーからの通知を受けるストリームを開かせない
  if (request.method === "GET") {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null },
      { status: 405, headers: { Allow: "POST" } },
    );
  }

  const origin = request.headers.get("Origin");
  if (origin !== null && origin !== publicOrigin) {
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  }

  const server = createMcpServer({ aliases, received, settings });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: MAX_MCP_REQUEST_BODY_BYTES,
  });
  await server.connect(transport);

  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
}
