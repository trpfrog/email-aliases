import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { createAliasStore } from "./aliases/store";
import { receiveEmail } from "./email/handler";
import { auth } from "./auth/routes";
import type { Env } from "./env";
import { AUTHORIZE_PATH, MANAGE_SCOPE, MCP_PATH, OAUTH_SCOPES } from "./config";
import { createMcpApp } from "./mcp/http";

export default {
  fetch(request, env, ctx) {
    const provider = new OAuthProvider<Env>({
      apiRoute: MCP_PATH,
      apiHandler: createMcpApp(createAliasStore(env.DB), env.PUBLIC_ORIGIN),
      defaultHandler: auth,
      authorizeEndpoint: AUTHORIZE_PATH,
      tokenEndpoint: "/oauth/token",
      clientRegistrationEndpoint: "/oauth/register",
      clientIdMetadataDocumentEnabled: true,
      scopesSupported: OAUTH_SCOPES,
      requiredScopes: [MANAGE_SCOPE],
      resourceMetadata: {
        resource: `${env.PUBLIC_ORIGIN}${MCP_PATH}`,
        authorization_servers: [env.PUBLIC_ORIGIN],
      },
    });

    return provider.fetch(request, env, ctx);
  },

  email(message, env) {
    return receiveEmail(message, createAliasStore(env.DB), env.FORWARD_TO);
  },
} satisfies ExportedHandler<Env>;
