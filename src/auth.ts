import { AuthorizationError, CimdFetchError } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { html } from "hono/html";
import { HTTPException } from "hono/http-exception";
import { SCOPE, type Env } from "./env";

export const auth = new Hono<{ Bindings: Env }>();

auth.use("/authorize", async (c, next) => {
  if (!c.env.ADMIN_PASSWORD) return c.text("ADMIN_PASSWORD is not configured", 503);
  return basicAuth({ username: "admin", password: c.env.ADMIN_PASSWORD })(c, next);
});

auth.get("/authorize", async (c) => {
  const oauth = c.env.OAUTH_PROVIDER;
  const request = await oauth.parseAuthRequest(c.req.raw);
  const details = await oauth.describeConsent(request);
  const consent = await oauth.beginConsent(request);
  consent.headers.set("Content-Type", "text/html; charset=utf-8");
  const page = html`<!doctype html>
    <html lang="ja">
      <meta charset="utf-8" />
      <title>Email Aliases 接続承認</title>
      <h1>${details.clientName} の接続を許可しますか？</h1>
      <p>mail.example.com のアドレスの作成・一覧・削除を許可します。</p>
      <p>クライアント: ${details.clientDomain ?? "自己申告（未検証）"}</p>
      <p>アクセスの送信先: <strong>${details.redirectHost}</strong></p>
      ${details.redirectIsLoopback ? html`<p>このコンピューターのアプリにアクセスを渡します。自分で開始した接続か確認してください。</p>` : ""}
      <p>要求された権限: ${details.scope.join(", ")}</p>
      <form method="post">
        <input type="hidden" name="handle" value="${consent.handle}" />
        <button name="decision" value="approve">許可</button>
        <button name="decision" value="deny">拒否</button>
      </form>
    </html>`;
  return new Response(page.toString(), { headers: consent.headers });
});

auth.post("/authorize", async (c) => {
  const oauth = c.env.OAUTH_PROVIDER;
  const form = await c.req.formData();
  const handle = String(form.get("handle") ?? "");
  if (form.get("decision") !== "approve") {
    const denied = await oauth.denyConsent(c.req.raw, handle);
    return new Response(null, { status: 302, headers: denied.headers });
  }
  // Library checks a one-use, browser-bound handle (CSRF) and validates scopes.
  const approved = await oauth.approveConsent(c.req.raw, handle);
  const { redirectTo } = await oauth.completeAuthorization({
    request: approved.request,
    userId: "owner",
    metadata: {},
    scope: approved.request.scope,
    props: { userId: "owner" },
  });
  approved.headers.set("Location", redirectTo);
  return new Response(null, { status: 302, headers: approved.headers });
});

auth.get("/health", (c) => c.json({ ok: true }));
auth.onError((error, c) => {
  if (error instanceof HTTPException) return error.getResponse();
  if (error instanceof AuthorizationError && error.redirectTo)
    return c.redirect(error.redirectTo, 302);
  if (error instanceof AuthorizationError || error instanceof CimdFetchError) {
    return c.text(
      "接続要求が無効か期限切れです。MCP クライアントから接続をやり直してください。",
      400,
    );
  }
  console.error("Request failed", error);
  return c.text("Internal server error", 500);
});

export const scopes = [SCOPE, "offline_access"];
