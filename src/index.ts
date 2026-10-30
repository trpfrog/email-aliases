import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { receiveEmail } from "./aliases";
import { auth, scopes } from "./auth";
import { SCOPE, type Env } from "./env";
import { mcp } from "./mcp";

export default {
  fetch(request, env, ctx) {
    const provider = new OAuthProvider<Env>({
      apiRoute: "/mcp",
      apiHandler: mcp,
      defaultHandler: auth,
      authorizeEndpoint: "/authorize",
      tokenEndpoint: "/oauth/token",
      clientRegistrationEndpoint: "/oauth/register",
      clientIdMetadataDocumentEnabled: true,
      scopesSupported: scopes,
      requiredScopes: [SCOPE],
      resourceMetadata: {
        resource: `${env.PUBLIC_ORIGIN}/mcp`,
        authorization_servers: [env.PUBLIC_ORIGIN],
      },
    });
    return provider.fetch(request, env, ctx);
  },
  email: receiveEmail,
} satisfies ExportedHandler<Env>;
