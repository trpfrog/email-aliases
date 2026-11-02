import { app } from "../app.config";

export const APP_NAME = app.name;
// vite.config.ts の define が、環境変数 MAIL_DOMAIN か app.mailDomain に置き換える
declare const BUILD_MAIL_DOMAIN: string;

export const MAIL_DOMAIN = BUILD_MAIL_DOMAIN;
// vite.config.ts の define が、環境変数 APP_VERSION（リリースのタグ）か 0.0.0-dev に置き換える
declare const BUILD_APP_VERSION: string;

export const APP_VERSION = BUILD_APP_VERSION;
/**
 * ドライラン中に、drop と判定したメールへ付けるヘッダー。値は本来の判定（disabled・unknown）。
 * Email Routing は転送時に X- から始まるヘッダーだけを追加できる
 */
export const DRY_RUN_HEADER = "X-Email-Aliases-Dry-Run";
export const ADMIN_USERNAME = "admin";
export const MCP_PATH = "/mcp";
export const AUTHORIZE_PATH = "/authorize";
export const TOKEN_PATH = "/oauth/token";
export const REGISTER_PATH = "/oauth/register";
export const MANAGE_SCOPE = "aliases:manage";
export const OAUTH_SCOPES = [MANAGE_SCOPE, "offline_access"];
