import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { adminApi } from "../admin/api";
import { authorize } from "../auth/authorize";
import { AUTHORIZE_PATH } from "../config";
import type { Env } from "../env";
import { requireAdmin } from "./require-admin";

const noStore = createMiddleware(async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
});

// 認証エラーの応答にもヘッダーが付くよう、認証より先に置く
const protectedPage = [noStore, secureHeaders({ xFrameOptions: "DENY" }), requireAdmin] as const;

/** OAuth と MCP 以外のすべての HTTP リクエスト（OAuthProvider の defaultHandler）。 */
export const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ ok: true }));

app.use("/", ...protectedPage);
app.use("/api/*", ...protectedPage);
app.use(AUTHORIZE_PATH, requireAdmin);

// 管理画面の SPA。静的アセットより先に Worker で受け、認証を通してから返す。
app.get("/", async (c) => {
  const asset = await c.env.ASSETS.fetch(c.req.raw);
  // ヘッダーを追加できるよう、変更可能な Response に作り直す
  return new Response(asset.body, asset);
});
app.get("/index.html", (c) => c.redirect("/"));

app.route("/", adminApi);
app.route("/", authorize);

app.onError((error, c) => {
  if (error instanceof HTTPException) return error.getResponse();
  console.error("Request failed", error);
  return c.text("Internal server error", 500);
});
