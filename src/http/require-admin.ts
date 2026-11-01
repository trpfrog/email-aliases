import { basicAuth } from "hono/basic-auth";
import { createMiddleware } from "hono/factory";
import { ADMIN_USERNAME } from "../config";
import type { Env } from "../env";
import { rateLimitByIp } from "./rate-limit";

/** 管理画面・管理 API・接続承認ページに共通の Basic 認証。 */
export const requireAdmin = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const password = c.env.ADMIN_PASSWORD;
  if (password === undefined || password === "") {
    return c.text("ADMIN_PASSWORD is not configured", 503);
  }
  // パスワードを照合する前に数え、総当たりの試行回数を抑える
  const limited = await rateLimitByIp(c.env.ADMIN_RATE_LIMIT, c.req.raw);
  if (limited !== undefined) return limited;
  return await basicAuth({ username: ADMIN_USERNAME, password })(c, next);
});
