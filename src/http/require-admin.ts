import { basicAuth } from "hono/basic-auth";
import { createMiddleware } from "hono/factory";
import { ADMIN_USERNAME } from "../config";
import type { Env } from "../env";

/** 管理画面・管理 API・接続承認ページに共通の Basic 認証。 */
export const requireAdmin = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const password = c.env.ADMIN_PASSWORD;
  if (password === undefined || password === "") {
    return c.text("ADMIN_PASSWORD is not configured", 503);
  }
  return await basicAuth({ username: ADMIN_USERNAME, password })(c, next);
});
