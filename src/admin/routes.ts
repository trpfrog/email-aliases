import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { HTTPException } from "hono/http-exception";
import { createAliasStore } from "../aliases/store";
import {
  createAliasSchema,
  deleteAliasSchema,
  listAliasesSchema,
  updateAliasSchema,
} from "../aliases/schema";
import type { Env } from "../env";

export const admin = new Hono<{ Bindings: Env }>();

admin.use("*", async (c, next) => {
  if (!["/", "/index.html"].includes(c.req.path) && !c.req.path.startsWith("/api/")) {
    return next();
  }
  if (!c.env.ADMIN_PASSWORD) return c.json({ error: "ADMIN_PASSWORD is not configured" }, 503);
  await basicAuth({ username: "admin", password: c.env.ADMIN_PASSWORD })(c, next);
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
});

admin.get("/", (c) => c.env.ASSETS.fetch(c.req.raw));
admin.get("/index.html", (c) => c.redirect("/"));

admin.use("/api/*", async (c, next) => {
  if (c.req.method !== "GET") {
    if (c.req.header("Origin") !== c.env.PUBLIC_ORIGIN) {
      return c.json({ error: "Invalid origin" }, 403);
    }
    if (c.req.header("Content-Type")?.split(";")[0].trim() !== "application/json") {
      return c.json({ error: "JSON required" }, 415);
    }
  }
  await next();
});

admin.get("/api/aliases", async (c) => {
  const input = listAliasesSchema.safeParse({
    limit: c.req.query("limit") === undefined ? undefined : Number(c.req.query("limit")),
    offset: c.req.query("offset") === undefined ? undefined : Number(c.req.query("offset")),
  });
  if (!input.success) return c.json({ error: "Invalid pagination" }, 400);
  return c.json(await createAliasStore(c.env.DB).list(input.data));
});

admin.on(["POST", "PATCH", "DELETE"], "/api/aliases", async (c) => {
  const body = await c.req.json().catch(() => null);
  const store = createAliasStore(c.env.DB);
  if (c.req.method === "PATCH") {
    const input = updateAliasSchema.safeParse(body);
    if (!input.success)
      return c.json(
        { error: "アドレス・メモ・サービス URL・有効状態の指定を確認してください。" },
        400,
      );
    const result =
      "disabled" in input.data
        ? await store.setDisabled(input.data)
        : await store.updateDetails(input.data);
    if (!result.updated) return c.json({ error: "エイリアスが見つかりません。" }, 404);
    return c.json(result);
  }
  if (c.req.method === "POST") {
    const input = createAliasSchema.safeParse(body);
    if (!input.success)
      return c.json({ error: "アドレス・メモ・サービス URL を確認してください。" }, 400);
    const result = await store.create(input.data);
    return c.json(result, result.created ? 201 : 200);
  }
  const input = deleteAliasSchema.safeParse(body);
  if (!input.success) return c.json({ error: "アドレスを確認してください。" }, 400);
  return c.json(await store.delete(input.data.address));
});

admin.onError((error, c) => {
  if (error instanceof HTTPException) return error.getResponse();
  console.error("Admin request failed", error);
  return c.json({ error: "操作に失敗しました。再度お試しください。" }, 500);
});
