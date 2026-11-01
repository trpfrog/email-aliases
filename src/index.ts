import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { z } from "zod";
import { createAliasStore } from "./aliases/store";
import { AUTHORIZE_PATH, MANAGE_SCOPE, MCP_PATH, OAUTH_SCOPES } from "./config";
import { receiveEmail } from "./email/receive";
import { requirePublicOrigin, type Env } from "./env";
import { app } from "./http/app";
import { handleMcpRequest } from "./mcp/handler";

// OAuthProvider はトークンを検証した後に ctx.auth を設定するが、apiHandler の型には現れないため実行時に検証する。
const authenticatedContext = z.object({
  auth: z.object({ token: z.string(), audience: z.string(), scope: z.array(z.string()) }),
});

const mcp = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const { auth } = authenticatedContext.parse(ctx);
    return await handleMcpRequest(request, {
      aliases: createAliasStore(env.DB),
      auth,
      publicOrigin: requirePublicOrigin(env),
    });
  },
} satisfies ExportedHandler<Env>;

export default {
  fetch(request, env, ctx) {
    const publicOrigin = requirePublicOrigin(env);
    const provider = new OAuthProvider<Env>({
      apiRoute: MCP_PATH,
      apiHandler: mcp,
      defaultHandler: app,
      authorizeEndpoint: AUTHORIZE_PATH,
      tokenEndpoint: "/oauth/token",
      clientRegistrationEndpoint: "/oauth/register",
      clientIdMetadataDocumentEnabled: true,
      scopesSupported: OAUTH_SCOPES,
      requiredScopes: [MANAGE_SCOPE],
      resourceMetadata: {
        resource: `${publicOrigin}${MCP_PATH}`,
        authorization_servers: [publicOrigin],
      },
    });
    return provider.fetch(request, env, ctx);
  },

  email(message, env) {
    return receiveEmail(message, { aliases: createAliasStore(env.DB), forwardTo: env.FORWARD_TO });
  },
} satisfies ExportedHandler<Env>;
