import { AuthorizationError, CimdFetchError } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { HTTPException } from "hono/http-exception";
import type { Env } from "../env";
import { AUTHORIZE_PATH } from "../config";
import { ConsentPage } from "./consent";

export const auth = new Hono<{ Bindings: Env }>();

auth.use(AUTHORIZE_PATH, async (c, next) => {
  if (!c.env.ADMIN_PASSWORD) {
    return c.text("ADMIN_PASSWORD is not configured", 503);
  }

  return basicAuth({ username: "admin", password: c.env.ADMIN_PASSWORD })(c, next);
});

auth.get(AUTHORIZE_PATH, async (c) => {
  const oauth = c.env.OAUTH_PROVIDER;
  const request = await oauth.parseAuthRequest(c.req.raw);
  const details = await oauth.describeConsent(request);
  const consent = await oauth.beginConsent(request);

  consent.headers.set("Content-Type", "text/html; charset=utf-8");

  const page = ConsentPage({ details, handle: consent.handle });

  return new Response(`<!doctype html>${page.toString()}`, { headers: consent.headers });
});

auth.post(AUTHORIZE_PATH, async (c) => {
  const oauth = c.env.OAUTH_PROVIDER;
  const form = await c.req.formData();
  const handle = String(form.get("handle") ?? "");

  if (form.get("decision") !== "approve") {
    const denied = await oauth.denyConsent(c.req.raw, handle);

    return new Response(null, { status: 302, headers: denied.headers });
  }

  // ライブラリがブラウザーに紐づく使い捨てハンドル（CSRF 対策）とスコープを検証する。
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
  if (error instanceof HTTPException) {
    return error.getResponse();
  }

  if (error instanceof AuthorizationError && error.redirectTo) {
    return c.redirect(error.redirectTo, 302);
  }

  if (error instanceof AuthorizationError || error instanceof CimdFetchError) {
    return c.text(
      "接続要求が無効か期限切れです。MCP クライアントから接続をやり直してください。",
      400,
    );
  }

  console.error("Request failed", error);
  return c.text("Internal server error", 500);
});
