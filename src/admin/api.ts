import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import {
  addressInput,
  createAliasInput,
  listAliasesInput,
  setAliasDisabledInput,
  updateAliasDetailsInput,
} from "../aliases/schema";
import { createAliasStore, type AliasStore } from "../aliases/store";
import { requirePublicOrigin, type Env } from "../env";
import { validate } from "../http/validate";
import {
  clearReceivedEmailsInput,
  listReceivedEmailsInput,
  receivedEmailIdInput,
} from "../received/schema";
import { createReceivedEmailStore, type ReceivedEmailStore } from "../received/store";
import { setDropDryRunInput } from "../settings/schema";
import { createSettingsStore, type SettingsStore } from "../settings/store";

const NOT_FOUND = "エイリアスが見つかりません。";

type AdminEnv = {
  Bindings: Env;
  Variables: { aliases: AliasStore; received: ReceivedEmailStore; settings: SettingsStore };
};

// クエリ文字列は数字の文字列として受け取り、MCP と同じ範囲・既定値で検証する
const integerString = z.string().regex(/^\d+$/).transform(Number);
const listAliasesQuery = z.object({
  query: listAliasesInput.shape.query,
  status: listAliasesInput.shape.status,
  has_service_url: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  limit: integerString.optional().pipe(listAliasesInput.shape.limit),
  offset: integerString.optional().pipe(listAliasesInput.shape.offset),
});

const listReceivedEmailsQuery = z.object({
  filter: listReceivedEmailsInput.shape.filter,
  limit: integerString.optional().pipe(listReceivedEmailsInput.shape.limit),
  offset: integerString.optional().pipe(listReceivedEmailsInput.shape.offset),
});

const withStores = createMiddleware<AdminEnv>(async (c, next) => {
  c.set("aliases", createAliasStore(c.env.DB));
  c.set("received", createReceivedEmailStore(c.env.DB));
  c.set("settings", createSettingsStore(c.env.DB));
  await next();
});

/** 変更系のリクエストを、管理画面と同じ Origin からの JSON に限定する（CSRF 対策）。 */
const requireSameOriginJson = createMiddleware<AdminEnv>(async (c, next) => {
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    if (c.req.header("Origin") !== requirePublicOrigin(c.env)) {
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
  .use(withStores, requireSameOriginJson)
  .get(
    "/aliases",
    validate("query", listAliasesQuery, "絞り込みとページ指定を確認してください。"),
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
    validate("json", updateAliasDetailsInput, "アドレス・メモ・サービス URL を確認してください。"),
    async (c) => {
      const result = await c.var.aliases.updateDetails(c.req.valid("json"));
      if (!result.updated) return c.json({ error: NOT_FOUND }, 404);
      return c.json(result, 200);
    },
  )
  .put(
    "/aliases/disabled",
    validate("json", setAliasDisabledInput, "アドレスと有効状態を確認してください。"),
    async (c) => {
      const result = await c.var.aliases.setDisabled(c.req.valid("json"));
      if (!result.updated) return c.json({ error: NOT_FOUND }, 404);
      return c.json(result, 200);
    },
  )
  .delete("/aliases", validate("json", addressInput, "アドレスを確認してください。"), async (c) =>
    c.json(await c.var.aliases.delete(c.req.valid("json").address), 200),
  )
  .get(
    "/received",
    validate("query", listReceivedEmailsQuery, "絞り込みとページ指定を確認してください。"),
    async (c) => c.json(await c.var.received.list(c.req.valid("query")), 200),
  )
  .delete(
    "/received",
    validate("json", receivedEmailIdInput, "ID を確認してください。"),
    async (c) => c.json(await c.var.received.delete(c.req.valid("json").id), 200),
  )
  .post(
    "/received/clear",
    validate("json", clearReceivedEmailsInput, "絞り込みを確認してください。"),
    async (c) => c.json(await c.var.received.clear(c.req.valid("json").filter), 200),
  )
  .get("/settings", async (c) => c.json(await c.var.settings.get(), 200))
  .put(
    "/settings/drop-dry-run",
    validate("json", setDropDryRunInput, "ドライランの有効・無効を確認してください。"),
    async (c) => c.json(await c.var.settings.setDropDryRun(c.req.valid("json").enabled), 200),
  );

adminApi.onError((error, c) => {
  // 不正な JSON など、Hono がリクエストを解釈できなかった場合
  if (error instanceof HTTPException) {
    return c.json({ error: "リクエストを解釈できませんでした。" }, error.status);
  }
  console.error("Admin API request failed", error);
  return c.json({ error: "操作に失敗しました。再度お試しください。" }, 500);
});

export type AdminApi = typeof adminApi;
