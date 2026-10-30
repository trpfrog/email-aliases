import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { URL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, expectTypeOf, it as baseIt, vi } from "vite-plus/test";
import type { AliasAddress } from "./schema";
import { addressSchema } from "./schema";
import { receiveEmail } from "../email/handler";
import { createAliasStore } from "./store";
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
      arguments: { address: "Shop", note: "Shopping" },
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

    const deleted = await client.callTool({ name: "delete_alias", arguments: { address: "shop" } });

    expect(deleted.structuredContent).toMatchObject({ deleted: true });

    forward.mockClear();
    await receive(message);
    expect(forward).not.toHaveBeenCalled();

    expect(
      (await client.callTool({ name: "delete_alias", arguments: { address: "shop" } }))
        .structuredContent,
    ).toMatchObject({ deleted: false });
  });

  it("エイリアスを一定の順序で一覧表示し、ページ分割できる", async ({ client }) => {
    for (const address of ["beta", "alpha", "gamma"]) {
      await client.callTool({ name: "create_alias", arguments: { address } });
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
    await client.callTool({ name: "create_alias", arguments: { address: "shop" } });

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
    await client.callTool({ name: "create_alias", arguments: { address: "shop" } });

    forward.mockRejectedValueOnce(new Error("forward unavailable"));
    await expect(receive({ to: "shop@mail.example.com", forward })).rejects.toThrow(
      "forward unavailable",
    );

    sqlite.exec("DROP TABLE aliases");
    await expect(receive({ to: "shop@mail.example.com", forward })).rejects.toThrow();
  });

  it("転送ループを防ぎ、設定がない場合はエラーにする", async ({ client, forward, receive }) => {
    await client.callTool({ name: "create_alias", arguments: { address: "shop" } });

    for (const FORWARD_TO of ["", "other@mail.example.com"]) {
      await expect(receive({ to: "shop@mail.example.com", forward }, FORWARD_TO)).rejects.toThrow();
    }

    expect(forward).not.toHaveBeenCalled();
  });
});

describe("アドレスの検証", () => {
  it("検証済みのアドレスだけをストアに渡せる", () => {
    type Store = ReturnType<typeof createAliasStore>;

    expectTypeOf(addressSchema.parse("shop")).toEqualTypeOf<AliasAddress>();
    expectTypeOf<string>().not.toExtend<AliasAddress>();
    expectTypeOf<Parameters<Store["has"]>[0]>().toEqualTypeOf<AliasAddress>();
    expectTypeOf<Parameters<Store["delete"]>[0]>().toEqualTypeOf<AliasAddress>();
    expectTypeOf<Parameters<Store["create"]>[0]["address"]>().toEqualTypeOf<AliasAddress>();
  });

  it.each([
    "",
    "*",
    "a..b",
    ".a",
    "a.",
    "a@other.example",
    "a@@mail.example.com",
    "a b",
    "あ",
    "x".repeat(65),
  ])("不正なアドレス %j を拒否する", (input) => {
    expect(addressSchema.safeParse(input).success).toBe(false);
  });

  it("使用可能な記号を維持し、大文字を小文字に揃える", () => {
    expect(addressSchema.parse(" Shop+News ")).toBe("shop+news@mail.example.com");
  });
});
