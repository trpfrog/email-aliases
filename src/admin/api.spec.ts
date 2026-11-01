import { hc } from "hono/client";
import { describe, expect, test } from "vite-plus/test";
import {
  createAliasResult,
  deleteAliasResult,
  listAliasesResult,
  updateAliasResult,
} from "../aliases/schema";
import { MAIL_DOMAIN } from "../config";
import { base, basic, request } from "../test/e2e/server";
import type { AdminApi } from "./api";

const rawPost = (body: string, headers: Record<string, string> = {}) =>
  request("/api/aliases", {
    method: "POST",
    headers: {
      Authorization: basic,
      Origin: base,
      "Content-Type": "application/json",
      ...headers,
    },
    body,
  });

describe("React 管理画面と API", () => {
  const address = `admin-test@${MAIL_DOMAIN}`;
  const input = { address, note: "管理画面テスト", service_url: "https://example.com/settings" };

  test("認証なしのアクセスを拒否し、認証後はキャッシュさせずに画面を返す", async () => {
    expect((await request("/")).status).toBe(401);
    expect((await request("/api/aliases")).status).toBe(401);

    const page = await request("/", { headers: { Authorization: basic } });
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("/src/web/main.tsx");
    expect(page.headers.get("cache-control")).toContain("no-store");
    expect(page.headers.get("x-frame-options")).toBe("DENY");
  });

  test("別 Origin・JSON 以外・不正な入力を拒否する", async () => {
    const body = JSON.stringify(input);
    expect((await rawPost(body, { Origin: "https://other.example" })).status).toBe(403);
    expect((await rawPost(body, { "Content-Type": "text/plain" })).status).toBe(415);
    expect((await rawPost("{")).status).toBe(400);
    expect((await rawPost(JSON.stringify({ address: "admin-test" }))).status).toBe(400);
    expect(
      (await rawPost(JSON.stringify({ ...input, service_url: "javascript:alert(1)" }))).status,
    ).toBe(400);
    expect(
      (await request("/api/aliases?offset=-1", { headers: { Authorization: basic } })).status,
    ).toBe(400);
  });

  test("Hono RPC で作成・更新・一覧・削除できる", async () => {
    const aliases = hc<AdminApi>(base, {
      headers: { Authorization: basic, Origin: base },
    }).api.aliases;

    const created = await aliases.$post({ json: input });
    expect(created.status).toBe(201);
    expect(createAliasResult.parse(await created.json()).alias.address).toBe(address);
    expect((await aliases.$post({ json: input })).status).toBe(200);

    const setDisabled = (disabled: boolean, target = address) =>
      aliases.disabled.$put({ json: { address: target, disabled } });

    expect((await setDisabled(true, `missing@${MAIL_DOMAIN}`)).status).toBe(404);

    const disabled = updateAliasResult.parse(await (await setDisabled(true)).json());
    expect(disabled.alias).toMatchObject({ disabled_at: expect.any(String), note: input.note });

    const edited = updateAliasResult.parse(
      await (await aliases.$patch({ json: { address, note: "一括更新", service_url: "" } })).json(),
    );
    expect(edited.alias).toMatchObject({
      note: "一括更新",
      service_url: "",
      disabled_at: expect.any(String),
    });

    const enabled = updateAliasResult.parse(await (await setDisabled(false)).json());
    expect(enabled.alias?.disabled_at).toBeNull();

    const list = listAliasesResult.parse(await (await aliases.$get({ query: {} })).json());
    expect(list.aliases).toContainEqual(expect.objectContaining({ address, note: "一括更新" }));

    const deleted = deleteAliasResult.parse(
      await (await aliases.$delete({ json: { address } })).json(),
    );
    expect(deleted.deleted).toBe(true);
  });
});
