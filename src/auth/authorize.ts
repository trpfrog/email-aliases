import { AuthorizationError, CimdFetchError } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { AUTHORIZE_PATH } from "../config";
import type { Env } from "../env";
import { validate } from "../http/validate";
import { renderConsentPage } from "./consent";

const consentDecision = z.object({
  handle: z.string(),
  decision: z.enum(["approve", "deny"]),
});

/** OAuth の接続承認ページ。認証は呼び出し側で行う。 */
export const authorize = new Hono<{ Bindings: Env }>()
  .get(AUTHORIZE_PATH, async (c) => {
    const oauth = c.env.OAUTH_PROVIDER;
    const request = await oauth.parseAuthRequest(c.req.raw);
    const details = await oauth.describeConsent(request);
    const consent = await oauth.beginConsent(request);

    consent.headers.set("Content-Type", "text/html; charset=utf-8");
    const page = await renderConsentPage({ details, handle: consent.handle });
    return new Response(page, { headers: consent.headers });
  })
  .post(
    AUTHORIZE_PATH,
    validate("form", consentDecision, "接続承認の送信内容が不正です。"),
    async (c) => {
      const oauth = c.env.OAUTH_PROVIDER;
      const { handle, decision } = c.req.valid("form");

      if (decision === "deny") {
        const denied = await oauth.denyConsent(c.req.raw, handle);
        return new Response(null, { status: 302, headers: denied.headers });
      }

      // ライブラリがブラウザーに紐づく使い捨てハンドル（CSRF 対策）とスコープを検証する
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
    },
  );

authorize.onError((error, c) => {
  // 解釈できないフォームなど、Hono がリクエストを拒否した場合
  if (error instanceof HTTPException) return error.getResponse();
  if (error instanceof AuthorizationError && error.redirectTo !== undefined) {
    return c.redirect(error.redirectTo, 302);
  }
  if (error instanceof AuthorizationError || error instanceof CimdFetchError) {
    return c.text(
      "接続要求が無効か期限切れです。MCP クライアントから接続をやり直してください。",
      400,
    );
  }
  console.error("Authorization failed", error);
  return c.text("Internal server error", 500);
});
