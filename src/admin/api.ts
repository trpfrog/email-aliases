import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import {
  addressInput,
  createAliasInput,
  listAliasesInput,
  updateAliasInput,
} from "../aliases/schema";
import { createAliasStore, type AliasStore } from "../aliases/store";
import type { Env } from "../env";
import { validate } from "../http/validate";

type AdminEnv = { Bindings: Env; Variables: { aliases: AliasStore } };

// クエリ文字列は数字の文字列として受け取り、MCP と同じ範囲・既定値で検証する。
const integerString = z.string().regex(/^\d+$/).transform(Number);
const listAliasesQuery = z.strictObject({
  limit: integerString.optional().pipe(listAliasesInput.shape.limit),
  offset: integerString.optional().pipe(listAliasesInput.shape.offset),
});

const withAliasStore = createMiddleware<AdminEnv>(async (c, next) => {
  c.set("aliases", createAliasStore(c.env.DB));
  await next();
});

/** 変更系のリクエストを、管理画面と同じ Origin からの JSON に限定する（CSRF 対策）。 */
const requireSameOriginJson = createMiddleware<AdminEnv>(async (c, next) => {
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    if (c.req.header("Origin") !== c.env.PUBLIC_ORIGIN) {
      return c.json({ error: "Invalid origin" }, 403);
    }
    const contentType = c.req.header("Content-Type")?.split(";")[0]?.trim().toLowerCase();
    if (contentType !== "application/json") {
      return c.json({ error: "JSON required" }, 415);
    }
  }
  return await next();
});

/** 管理画面向けの JSON API。型は `AdminApi` として `hono/client` と共有する。認証は呼び出し側で行う。 */
export const adminApi = new Hono<AdminEnv>()
  .basePath("/api")
  .use(withAliasStore, requireSameOriginJson)
  .get(
    "/aliases",
    validate("query", listAliasesQuery, "ページ指定を確認してください。"),
    async (c) => c.json(await c.var.aliases.list(c.req.valid("query")), 200),
  )
  .post(
    "/aliases",
    validate("json", createAliasInput, "アドレス・メモ・サービス URL を確認してください。"),
    async (c) => {
      const result = await c.var.aliases.create(c.req.valid("json"));
      return c.json(result, result.created ? 201 : 200);
    },
  )
  .patch(
    "/aliases",
    validate(
      "json",
      updateAliasInput,
      "アドレス・メモ・サービス URL・有効状態の指定を確認してください。",
    ),
    async (c) => {
      const input = c.req.valid("json");
      const result =
        "disabled" in input
          ? await c.var.aliases.setDisabled(input)
          : await c.var.aliases.updateDetails(input);
      if (!result.updated) return c.json({ error: "エイリアスが見つかりません。" }, 404);
      return c.json(result, 200);
    },
  )
  .delete("/aliases", validate("json", addressInput, "アドレスを確認してください。"), async (c) =>
    c.json(await c.var.aliases.delete(c.req.valid("json").address), 200),
  );

adminApi.onError((error, c) => {
  // 不正な JSON など、Hono がリクエストを解釈できなかった場合。
  if (error instanceof HTTPException) {
    return c.json({ error: "リクエストを解釈できませんでした。" }, error.status);
  }
  console.error("Admin API request failed", error);
  return c.json({ error: "操作に失敗しました。再度お試しください。" }, 500);
});

export type AdminApi = typeof adminApi;
