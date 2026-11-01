/**
 * 自分の環境で使うときに編集する設定
 * 転送先（FORWARD_TO）と管理者パスワード（ADMIN_PASSWORD）は秘密情報なので .dev.vars に置く
 */
import { defineDeploy, defineApp } from "./src/app-config.ts";

export const app = defineApp({
  // 管理画面・承認ページ・<title> に表示する名前
  name: "Email Aliases",
  // Email Routing の Catch-all を設定したドメイン
  // このドメイン宛てのメールだけを転送する
  mailDomain: "mail.example.com",
  theme: {
    // 管理画面のメインカラー
    // 明るい順に 10 段階で指定する
    // https://mantine.dev/colors-generator/ で生成したものを貼り付けられる
    primaryColor: [
      "#f0f7f1",
      "#e0ede2",
      "#c1d9c6",
      "#9bc3a5",
      "#73aa83",
      "#539367",
      "#3b7c52",
      "#276349",
      "#20513c",
      "#193e2f",
    ],
    // ボタンなどに使う primaryColor の段階（0〜9）
    primaryShade: 7,
    // ブラウザーの UI の色（<meta name="theme-color">）
    browserColor: "#f4f5f0",
  },
});

// デプロイ先の設定
// 管理画面のバンドルには含まれない
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
