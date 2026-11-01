/**
 * デプロイ先の設定
 * cloudflare.config.ts だけが読む
 * Cloudflare の Vite プラグインは設定ファイルの依存を開発サーバーから読めなくするため、
 * Worker や管理画面が読む app.config.ts とは分けている
 */
import { defineDeploy } from "./src/deploy-config.ts";

export const deploy = defineDeploy({
  // Worker 名
  // <workerName>.<サブドメイン>.workers.dev で公開される
  workerName: "email-aliases",
  // 本番の公開 URL（末尾 / なし）
  // OAuth の発行者として使う
  publicOrigin: "https://email-aliases.YOUR_SUBDOMAIN.workers.dev",
  // cf d1 create で作成した D1 の database ID
  // d1DatabaseId: "",
  // cf kv namespaces create で作成した OAuth 用 KV の namespace ID
  // kvNamespaceId: "",
});
