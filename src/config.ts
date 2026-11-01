import { app } from "../app.config";

export const APP_NAME = app.name;
// vite.config.ts の define が、環境変数 MAIL_DOMAIN か app.mailDomain に置き換える
declare const BUILD_MAIL_DOMAIN: string;

export const MAIL_DOMAIN = BUILD_MAIL_DOMAIN;
export const ADMIN_USERNAME = "admin";
export const MCP_PATH = "/mcp";
export const AUTHORIZE_PATH = "/authorize";
export const TOKEN_PATH = "/oauth/token";
export const REGISTER_PATH = "/oauth/register";
export const MANAGE_SCOPE = "aliases:manage";
export const OAUTH_SCOPES = [MANAGE_SCOPE, "offline_access"];
