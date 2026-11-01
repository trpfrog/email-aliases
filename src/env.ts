import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  OAUTH_KV: KVNamespace;
  PUBLIC_ORIGIN: string;
  // Secret は未設定のまま起動できるため、存在を確認してから使う。
  ADMIN_PASSWORD: string | undefined;
  FORWARD_TO: string | undefined;
  // OAuthProvider が defaultHandler の呼び出し前に設定する。
  OAUTH_PROVIDER: OAuthHelpers;
}
