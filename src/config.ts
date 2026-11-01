import { app } from "../app.config";

export const APP_NAME = app.name;
export const DOMAIN = app.mailDomain;
export const ADMIN_USERNAME = "admin";
export const MCP_PATH = "/mcp";
export const AUTHORIZE_PATH = "/authorize";
export const MANAGE_SCOPE = "aliases:manage";
export const OAUTH_SCOPES = [MANAGE_SCOPE, "offline_access"];
