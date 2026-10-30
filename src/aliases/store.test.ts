import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { URL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, expectTypeOf, it as baseIt, vi } from "vite-plus/test";
import type { AliasAddress } from "./schema";
import { addressSchema, serviceUrlSchema } from "./schema";
import { receiveEmail } from "../email/handler";
import { createAliasStore, type AliasStore } from "./store";
import { createServer } from "../mcp/server";

const it = baseIt
  // eslint-disable-next-line no-empty-pattern -- Vitest がフィクスチャーの依存関係を検出するには分割代入が必要。
  .extend("sqlite", async ({}, { onCleanup }) => {
    const sqlite = new DatabaseSync(":memory:");
    onCleanup(() => sqlite.close());

    const migrations = new URL("../../migrations/", import.meta.url);

    for (const file of readdirSync(migrations)
      .filter((file) => file.endsWith(".sql"))
      .sort()) {
      sqlite.exec(readFileSync(new URL(file, migrations), "utf8"));
    }

    return sqlite;
  })
  .extend("server", ({ sqlite }, { onCleanup }) => {
    const server = createServer(createAliasStore(sqlite));
    onCleanup(() => server.close());

    return server;
  })
  .extend("client", async ({ server }, { onCleanup }) => {
    const client = new Client({ name: "test", version: "1.0.0" });
    onCleanup(() => client.close());

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    return client;
  })
  .extend("forward", () =>
    vi
      .fn<Parameters<typeof receiveEmail>[0]["forward"]>()
      .mockResolvedValue({ messageId: "test-message" }),
  )
  .extend(
    "receive",
    ({ sqlite }) =>
      (message: Parameters<typeof receiveEmail>[0], forwardTo = "inbox@example.com") =>
        receiveEmail(message, createAliasStore(sqlite), forwardTo),
  );

describe("エイリアスの作成から削除まで", () => {
  it("サービス URL を登録・編集・消去し、メモや有効状態を保持する", async ({ client }) => {
    const address = "service@mail.example.com";
    const created = await client.callTool({
      name: "create_alias",
      arguments: {
        address,
        note: "サービス",
        service_url: " https://example.com/settings ",
      },
    });
    expect(created.structuredContent).toMatchObject({
      created: true,
      alias: { service_url: "https://example.com/settings" },
    });
    const duplicate = await client.callTool({
      name: "create_alias",
      arguments: { address, service_url: "https://other.example" },
    });
    expect(duplicate.structuredContent).toMatchObject({
      created: false,
      alias: { service_url: "https://example.com/settings" },
    });
    await client.callTool({ name: "set_alias_disabled", arguments: { address, disabled: true } });
    const noteUpdated = await client.callTool({
      name: "update_alias_note",
      arguments: { address, note: "変更" },
    });
    expect(noteUpdated.structuredContent).toMatchObject({
      alias: {
        note: "変更",
        service_url: "https://example.com/settings",
        disabled_at: expect.any(String),
      },
    });
    for (const service_url of ["https://example.com/account", ""]) {
      const updated = await client.callTool({
        name: "update_alias_details",
        arguments: { address, service_url },
      });
      expect(updated.structuredContent).toMatchObject({
        updated: true,
        alias: { note: "変更", service_url, disabled_at: expect.any(String) },
      });
    }
    const both = await client.callTool({
      name: "update_alias_details",
      arguments: { address, note: "両方", service_url: "https://example.com" },
    });
    expect(both.structuredContent).toMatchObject({
      alias: { note: "両方", service_url: "https://example.com" },
    });
    expect(
      (await client.callTool({ name: "update_alias_details", arguments: { address } })).isError,
    ).toBe(true);
    expect(
      (
        await client.callTool({
          name: "update_alias_details",
          arguments: { address, service_url: "javascript:alert(1)" },
        })
      ).isError,
    ).toBe(true);
    const listed = await client.callTool({ name: "list_aliases" });
    expect(listed.structuredContent).toMatchObject({
      aliases: [{ address, service_url: "https://example.com" }],
    });
  });

  it("無効化で転送を停止し、メモや作成日時を保持して再有効化できる", async ({
    client,
    forward,
    receive,
  }) => {
    const address = "toggle@mail.example.com";
    const created = await client.callTool({
      name: "create_alias",
      arguments: { address, note: "残すメモ" },
    });
    const original = (created.structuredContent as Awaited<ReturnType<AliasStore["create"]>>).alias;
    const disabled = await client.callTool({
      name: "set_alias_disabled",
      arguments: { address, disabled: true },
    });
    expect(disabled.structuredContent).toMatchObject({
      updated: true,
      alias: { ...original, disabled_at: expect.any(String) },
    });
    const repeated = await client.callTool({
      name: "set_alias_disabled",
      arguments: { address, disabled: true },
    });
    expect(repeated.structuredContent).toEqual(disabled.structuredContent);
    await receive({ to: address, forward });
    expect(forward).not.toHaveBeenCalled();

    const duplicate = await client.callTool({
      name: "create_alias",
      arguments: { address, note: "上書きしない" },
    });
    expect(duplicate.structuredContent).toMatchObject({
      created: false,
      alias: { note: "残すメモ", disabled_at: expect.any(String) },
    });
    const list = await client.callTool({ name: "list_aliases" });
    expect(list.structuredContent).toMatchObject({
      aliases: [{ address, note: "残すメモ", disabled_at: expect.any(String) }],
    });

    const enabled = await client.callTool({
      name: "set_alias_disabled",
      arguments: { address, disabled: false },
    });
    expect(enabled.structuredContent).toMatchObject({ updated: true, alias: original });
    await receive({ to: address, forward });
    expect(forward).toHaveBeenCalledExactlyOnceWith("inbox@example.com");

    await client.callTool({ name: "set_alias_disabled", arguments: { address, disabled: true } });
    expect(
      (await client.callTool({ name: "delete_alias", arguments: { address } })).structuredContent,
    ).toMatchObject({ deleted: true });
    expect(
      (
        await client.callTool({
          name: "set_alias_disabled",
          arguments: { address, disabled: false },
        })
      ).structuredContent,
    ).toMatchObject({ updated: false, alias: null });
  });

  it("メモだけを更新・消去し、無効状態や作成日時を変更しない", async ({ client }) => {
    const address = "notes@mail.example.com";
    await client.callTool({
      name: "create_alias",
      arguments: { address, note: "元のメモ" },
    });
    const disabled = await client.callTool({
      name: "set_alias_disabled",
      arguments: { address, disabled: true },
    });
    for (const note of ["変更したメモ", ""]) {
      const updated = await client.callTool({
        name: "update_alias_note",
        arguments: { address, note },
      });
      expect(updated.structuredContent).toMatchObject({
        updated: true,
        alias: {
          ...(disabled.structuredContent as Awaited<ReturnType<AliasStore["setDisabled"]>>).alias,
          note,
        },
      });
    }
    const invalid = await client.callTool({
      name: "update_alias_note",
      arguments: { address, note: "x".repeat(1001) },
    });
    expect(invalid.isError).toBe(true);
    const missing = await client.callTool({
      name: "update_alias_note",
      arguments: { address: "missing@mail.example.com", note: "メモ" },
    });
    expect(missing.structuredContent).toMatchObject({ updated: false, alias: null });
  });

  it("未登録の宛先は破棄し、登録後は転送し、削除後は再び破棄する", async ({
    client,
    forward,
    receive,
  }) => {
    const message = { to: "SHOP@mail.example.com", forward };

    await receive(message);
    expect(forward).not.toHaveBeenCalled();

    const created = await client.callTool({
      name: "create_alias",
      arguments: { address: "Shop@mail.example.com", note: "Shopping" },
    });

    expect(created.structuredContent).toMatchObject({
      created: true,
      alias: { address: "shop@mail.example.com", note: "Shopping" },
    });

    await receive(message);
    expect(forward).toHaveBeenCalledExactlyOnceWith("inbox@example.com");

    const duplicate = await client.callTool({
      name: "create_alias",
      arguments: { address: message.to, note: "replacement" },
    });

    expect(duplicate.structuredContent).toMatchObject({
      created: false,
      alias: { note: "Shopping" },
    });

    const deleted = await client.callTool({
      name: "delete_alias",
      arguments: { address: "shop@mail.example.com" },
    });

    expect(deleted.structuredContent).toMatchObject({ deleted: true });

    forward.mockClear();
    await receive(message);
    expect(forward).not.toHaveBeenCalled();

    expect(
      (
        await client.callTool({
          name: "delete_alias",
          arguments: { address: "shop@mail.example.com" },
        })
      ).structuredContent,
    ).toMatchObject({ deleted: false });
  });

  it("エイリアスを一定の順序で一覧表示し、ページ分割できる", async ({ client }) => {
    for (const address of ["beta", "alpha", "gamma"]) {
      await client.callTool({
        name: "create_alias",
        arguments: { address: `${address}@mail.example.com` },
      });
    }

    const first = await client.callTool({ name: "list_aliases", arguments: { limit: 2 } });

    expect(first.structuredContent).toMatchObject({
      aliases: [{ address: "alpha@mail.example.com" }, { address: "beta@mail.example.com" }],
      next_offset: 2,
    });

    const last = await client.callTool({
      name: "list_aliases",
      arguments: { limit: 2, offset: 2 },
    });

    expect(last.structuredContent).toMatchObject({
      aliases: [{ address: "gamma@mail.example.com" }],
      next_offset: null,
    });
  });

  it("プラスタグも含めて完全なアドレスで一致を判定する", async ({ client, forward, receive }) => {
    await client.callTool({
      name: "create_alias",
      arguments: { address: "shop@mail.example.com" },
    });

    for (const to of [
      "shop",
      "shop@other.example",
      "shop+tag@mail.example.com",
      "other@mail.example.com",
    ]) {
      await receive({ to, forward });
    }

    expect(forward).not.toHaveBeenCalled();
  });

  it("データベースや転送のエラーを呼び出し元に伝える", async ({
    client,
    sqlite,
    forward,
    receive,
  }) => {
    await client.callTool({
      name: "create_alias",
      arguments: { address: "shop@mail.example.com" },
    });

    forward.mockRejectedValueOnce(new Error("forward unavailable"));
    await expect(receive({ to: "shop@mail.example.com", forward })).rejects.toThrow(
      "forward unavailable",
    );

    sqlite.exec("DROP TABLE aliases");
    await expect(receive({ to: "shop@mail.example.com", forward })).rejects.toThrow();
  });

  it("転送ループを防ぎ、設定がない場合はエラーにする", async ({ client, forward, receive }) => {
    await client.callTool({
      name: "create_alias",
      arguments: { address: "shop@mail.example.com" },
    });

    for (const FORWARD_TO of ["", "other@mail.example.com"]) {
      await expect(receive({ to: "shop@mail.example.com", forward }, FORWARD_TO)).rejects.toThrow();
    }

    expect(forward).not.toHaveBeenCalled();
  });
});

describe("アドレスの検証", () => {
  it.each([
    "javascript:alert(1)",
    "data:text/html,hello",
    "ftp://example.com",
    "/settings",
    "example.com",
    `https://example.com/${"a".repeat(2048)}`,
  ])("サービス URL %j を拒否する", (url) => {
    expect(serviceUrlSchema.safeParse(url).success).toBe(false);
  });
  it.each(["", "https://example.com/settings", "http://example.com"])(
    "サービス URL %j を受け付ける",
    (url) => {
      expect(serviceUrlSchema.parse(url)).toBe(url);
    },
  );
  it("検証済みのアドレスだけをストアに渡せる", () => {
    type Store = ReturnType<typeof createAliasStore>;

    expectTypeOf(addressSchema.parse("shop@mail.example.com")).toEqualTypeOf<AliasAddress>();
    expectTypeOf<string>().not.toExtend<AliasAddress>();
    expectTypeOf<Parameters<Store["has"]>[0]>().toEqualTypeOf<AliasAddress>();
    expectTypeOf<Parameters<Store["delete"]>[0]>().toEqualTypeOf<AliasAddress>();
    expectTypeOf<Parameters<Store["create"]>[0]["address"]>().toEqualTypeOf<AliasAddress>();
  });

  it.each([
    "",
    "shop",
    "*",
    "a..b@mail.example.com",
    ".a@mail.example.com",
    "a.@mail.example.com",
    "a@other.example",
    "a@@mail.example.com",
    "a b@mail.example.com",
    "あ@mail.example.com",
    `${"x".repeat(65)}@mail.example.com`,
  ])("不正なアドレス %j を拒否する", (input) => {
    expect(addressSchema.safeParse(input).success).toBe(false);
  });

  it("使用可能な記号を維持し、大文字を小文字に揃える", () => {
    expect(addressSchema.parse(" Shop+News@MAIL.TRPFROG.NET ")).toBe("shop+news@mail.example.com");
  });
});
