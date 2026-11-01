/**
 * 自分の環境で使うときに編集する設定（デプロイ先は deploy.config.ts）
 * 転送先（FORWARD_TO）と管理者パスワード（ADMIN_PASSWORD）は秘密情報なので .dev.vars.tpl と .prod.vars.tpl で扱う
 */
import { defineApp } from "./src/app-config.ts";

export const app = defineApp({
  // 管理画面・承認ページ・<title> に表示する名前
  name: "Email Aliases",
  // Email Routing の Catch-all を設定したドメイン
  // このドメイン宛てのメールだけを転送する
  // ビルド時に環境変数 MAIL_DOMAIN があればそちらを使う（vp run deploy:prod は 1Password から渡す）
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
