import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  OAUTH_KV: KVNamespace;
  // Secret は未設定のまま起動できるため、存在を確認してから使う。
  // PUBLIC_ORIGIN は開発時は固定値、本番では URL を公開しないよう Secret にしている。
  PUBLIC_ORIGIN: string | undefined;
  ADMIN_PASSWORD: string | undefined;
  FORWARD_TO: string | undefined;
  // OAuthProvider が defaultHandler の呼び出し前に設定する。
  OAUTH_PROVIDER: OAuthHelpers;
}

/** 公開 URL を返す。未設定なら Origin の検査が素通りしないよう、Worker の失敗として扱う。 */
export function requirePublicOrigin(env: Pick<Env, "PUBLIC_ORIGIN">): string {
  const origin = env.PUBLIC_ORIGIN?.trim() ?? "";
  if (origin === "") throw new Error("PUBLIC_ORIGIN is not configured");
  return origin;
}
