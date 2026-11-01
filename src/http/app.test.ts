import { describe, expect } from "vite-plus/test";
import { z } from "zod";
import { createAliasResult, listAliasesResult, updateAliasResult } from "../aliases/schema";
import { dbTest } from "../test/fixtures";
import { app } from "./app";

const origin = "https://aliases.example";
const password = "test-password";
const authorization = `Basic ${btoa(`admin:${password}`)}`;
const errorBody = z.object({ error: z.string() });

const it = dbTest
  .extend("env", ({ db }) => ({
    DB: db,
    PUBLIC_ORIGIN: origin,
    ADMIN_PASSWORD: password,
    ASSETS: { fetch: () => Promise.resolve(new Response("<!doctype html><title>SPA</title>")) },
  }))
  .extend("request", ({ env }) => (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (!headers.has("Authorization")) headers.set("Authorization", authorization);
    return app.request(path, { ...init, headers }, env);
  })
  .extend(
    "api",
    ({ request }) =>
      (
        method: string,
        body: unknown,
        {
          path = "/api/aliases",
          headers = {},
        }: { path?: string; headers?: Record<string, string> } = {},
      ) =>
        request(path, {
          method,
          headers: { Origin: origin, "Content-Type": "application/json", ...headers },
          body: typeof body === "string" ? body : JSON.stringify(body),
        }),
  );

const address = "shop@mail.example.test";
const DISABLED_PATH = "/api/aliases/disabled";

describe("管理画面", () => {
  it("health は認証なしで応答する", async ({ env }) => {
    expect((await app.request("/health", {}, env)).status).toBe(200);
  });

  it.for(["/", "/api/aliases"])(
    "%s は Basic 認証を求め、拒否の応答もキャッシュさせない",
    async (path, { request }) => {
      const response = await request(path, { headers: { Authorization: "Basic invalid" } });
      expect(response.status).toBe(401);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    },
  );

  it("パスワードが未設定なら 503 を返す", async ({ env }) => {
    const response = await app.request(
      "/",
      { headers: { Authorization: authorization } },
      { ...env, ADMIN_PASSWORD: undefined },
    );
    expect(response.status).toBe(503);
  });

  it("認証後は SPA をキャッシュさせずに返し、/index.html は / に転送する", async ({ request }) => {
    const page = await request("/");
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("SPA");
    expect(page.headers.get("Cache-Control")).toBe("no-store");
    expect(page.headers.get("X-Content-Type-Options")).toBe("nosniff");

    const redirect = await request("/index.html");
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get("Location")).toBe("/");
  });
});

describe("管理 API", () => {
  it("変更系は同じ Origin の JSON リクエストに限る", async ({ api }) => {
    expect(
      (await api("POST", { address }, { headers: { Origin: "https://other.example" } })).status,
    ).toBe(403);
    const withoutOrigin = await api("POST", { address }, { headers: { Origin: "" } });
    expect(withoutOrigin.status).toBe(403);
    expect(
      (await api("POST", { address }, { headers: { "Content-Type": "text/plain" } })).status,
    ).toBe(415);
  });

  it("PUBLIC_ORIGIN が未設定なら変更系を受け付けない", async ({ env }) => {
    const response = await app.request(
      "/api/aliases",
      {
        method: "POST",
        headers: { Authorization: authorization, "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      },
      { ...env, PUBLIC_ORIGIN: undefined },
    );
    expect(response.status).toBe(500);
  });

  it("解釈できない JSON と不正な入力は 400 とエラーメッセージを返す", async ({ api }) => {
    for (const body of ["{", { address: "shop" }, { address, service_url: "javascript:x" }]) {
      const response = await api("POST", body);
      expect(response.status).toBe(400);
      expect(errorBody.safeParse(await response.json()).success).toBe(true);
    }
  });

  it("作成・更新・一覧・削除", async ({ api, request }) => {
    const created = await api("POST", { address, note: "メモ" });
    expect(created.status).toBe(201);
    expect(createAliasResult.parse(await created.json()).alias.note).toBe("メモ");
    expect((await api("POST", { address })).status).toBe(200);

    const disabled = await api("PUT", { address, disabled: true }, { path: DISABLED_PATH });
    expect(updateAliasResult.parse(await disabled.json()).alias?.disabled_at).toEqual(
      expect.any(String),
    );
    const edited = await api("PATCH", { address, service_url: "https://example.com" });
    expect(updateAliasResult.parse(await edited.json()).alias).toMatchObject({
      note: "メモ",
      service_url: "https://example.com",
    });
    expect((await api("PATCH", { address, disabled: false, note: "両方" })).status).toBe(400);
    expect(
      (
        await api(
          "PUT",
          { address: "missing@mail.example.test", disabled: true },
          { path: DISABLED_PATH },
        )
      ).status,
    ).toBe(404);
    expect((await api("PATCH", { address: "missing@mail.example.test", note: "x" })).status).toBe(
      404,
    );

    const list = await request("/api/aliases?offset=0&_=cache-buster");
    expect(listAliasesResult.parse(await list.json()).aliases).toHaveLength(1);
    expect((await request("/api/aliases?offset=-1")).status).toBe(400);

    expect((await api("DELETE", { address })).status).toBe(200);
    expect(listAliasesResult.parse(await (await request("/api/aliases")).json()).aliases).toEqual(
      [],
    );
  });

  it("DB の失敗は内部の情報を含まない 500 にする", async ({ db, request }) => {
    db.exec("DROP TABLE aliases");
    const response = await request("/api/aliases");
    expect(response.status).toBe(500);
    expect(errorBody.parse(await response.json()).error).not.toMatch(/table/);
  });
});

describe("接続承認", () => {
  it("不正な承認フォームは処理せず 400 にする", async ({ request }) => {
    const response = await request("/authorize", {
      method: "POST",
      body: new URLSearchParams({ handle: "x", decision: "maybe" }),
    });
    expect(response.status).toBe(400);
  });
});
