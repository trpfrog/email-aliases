import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  OAUTH_KV: KVNamespace;
  PUBLIC_ORIGIN: string;
  ADMIN_PASSWORD: string;
  FORWARD_TO: string;
  OAUTH_PROVIDER: OAuthHelpers;
}
