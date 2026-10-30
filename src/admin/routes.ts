import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
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

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  if (!["/", "/index.html"].includes(c.req.path) && !c.req.path.startsWith("/api/")) {
    return next();
  }
  if (!c.env.ADMIN_PASSWORD) return c.json({ error: "ADMIN_PASSWORD is not configured" }, 503);
  await basicAuth({ username: "admin", password: c.env.ADMIN_PASSWORD })(c, next);
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
});

app.get("/", (c) => c.env.ASSETS.fetch(c.req.raw));
app.get("/index.html", (c) => c.redirect("/"));

app.use("/api/*", async (c, next) => {
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

const listAliasesQuerySchema = z.object({
  limit: z.string().transform(Number).optional().pipe(listAliasesSchema.shape.limit),
  offset: z.string().transform(Number).optional().pipe(listAliasesSchema.shape.offset),
});

export const admin = app
  .get(
    "/api/aliases",
    zValidator("query", listAliasesQuerySchema, (result, c) => {
      if (!result.success) return c.json({ error: "Invalid pagination" }, 400);
    }),
    async (c) => c.json(await createAliasStore(c.env.DB).list(c.req.valid("query"))),
  )
  .post(
    "/api/aliases",
    zValidator("json", createAliasSchema, (result, c) => {
      if (!result.success)
        return c.json({ error: "アドレス・メモ・サービス URL を確認してください。" }, 400);
    }),
    async (c) => {
      const result = await createAliasStore(c.env.DB).create(c.req.valid("json"));
      return c.json(result, result.created ? 201 : 200);
    },
  )
  .patch(
    "/api/aliases",
    zValidator("json", updateAliasSchema, (result, c) => {
      if (!result.success)
        return c.json(
          { error: "アドレス・メモ・サービス URL・有効状態の指定を確認してください。" },
          400,
        );
    }),
    async (c) => {
      const input = c.req.valid("json");
      const store = createAliasStore(c.env.DB);
      const result =
        "disabled" in input ? await store.setDisabled(input) : await store.updateDetails(input);
      if (!result.updated) return c.json({ error: "エイリアスが見つかりません。" }, 404);
      return c.json(result);
    },
  )
  .delete(
    "/api/aliases",
    zValidator("json", deleteAliasSchema, (result, c) => {
      if (!result.success) return c.json({ error: "アドレスを確認してください。" }, 400);
    }),
    async (c) => c.json(await createAliasStore(c.env.DB).delete(c.req.valid("json").address)),
  );

export type AdminApi = typeof admin;

app.onError((error, c) => {
  if (error instanceof HTTPException) return error.getResponse();
  console.error("Admin request failed", error);
  return c.json({ error: "操作に失敗しました。再度お試しください。" }, 500);
});
