import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect } from "vite-plus/test";
import {
  createAliasResult,
  deleteAliasResult,
  listAliasesResult,
  updateAliasResult,
} from "../aliases/schema";
import { createAliasStore } from "../aliases/store";
import {
  clearReceivedEmailsResult,
  deleteReceivedEmailResult,
  listReceivedEmailsResult,
} from "../received/schema";
import { createReceivedEmailStore } from "../received/store";
import { address as aliasAddress, dbTest } from "../test/fixtures";
import { createMcpServer, MAX_TOOL_INPUT_ELEMENTS } from "./server";

const it = dbTest
  .extend("received", ({ db }) => createReceivedEmailStore(db))
  .extend("client", async ({ db, received }, { onCleanup }) => {
    const server = createMcpServer({ aliases: createAliasStore(db), received });
    const client = new Client({ name: "test", version: "1.0.0" });
    onCleanup(async () => {
      await client.close();
      await server.close();
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    return client;
  });

describe("MCP ツール", () => {
  it("サーバーのバージョンにリリースのバージョンを返す", ({ client }) => {
    // テストではリリースのタグを渡さないため、開発用の値になる
    expect(client.getServerVersion()).toEqual({ name: "email-aliases", version: "0.0.0-dev" });
  });

  it("公開するツールと注釈", async ({ client }) => {
    const { tools } = await client.listTools();
    expect(Object.fromEntries(tools.map((tool) => [tool.name, tool.annotations]))).toEqual({
      create_alias: expect.objectContaining({ readOnlyHint: false, destructiveHint: false }),
      list_aliases: expect.objectContaining({ readOnlyHint: true }),
      set_alias_disabled: expect.objectContaining({ readOnlyHint: false, destructiveHint: false }),
      update_alias_details: expect.objectContaining({
        readOnlyHint: false,
        destructiveHint: false,
      }),
      delete_alias: expect.objectContaining({ destructiveHint: true }),
      list_received_emails: expect.objectContaining({ readOnlyHint: true }),
      list_alias_activity: expect.objectContaining({ readOnlyHint: true }),
      delete_received_email: expect.objectContaining({ destructiveHint: true }),
      clear_received_emails: expect.objectContaining({ destructiveHint: true }),
    });
    for (const tool of tools) expect(tool.outputSchema).toBeDefined();
  });

  it("作成・一覧・更新・削除の結果を構造化して返す", async ({ client }) => {
    const address = "shop@mail.example.test";

    const created = await client.callTool({
      name: "create_alias",
      arguments: {
        address: "Shop@mail.example.test",
        note: "メモ",
        service_url: " https://a.example ",
      },
    });
    expect(createAliasResult.parse(created.structuredContent)).toMatchObject({
      created: true,
      alias: { address, note: "メモ", service_url: "https://a.example" },
    });

    const listed = await client.callTool({ name: "list_aliases", arguments: {} });
    expect(listAliasesResult.parse(listed.structuredContent)).toMatchObject({
      aliases: [{ address }],
      next_offset: null,
    });

    const disabled = await client.callTool({
      name: "set_alias_disabled",
      arguments: { address, disabled: true },
    });
    expect(updateAliasResult.parse(disabled.structuredContent).alias?.disabled_at).toEqual(
      expect.any(String),
    );

    const updated = await client.callTool({
      name: "update_alias_details",
      arguments: { address, service_url: "" },
    });
    expect(updateAliasResult.parse(updated.structuredContent)).toMatchObject({
      updated: true,
      alias: { note: "メモ", service_url: "" },
    });

    const deleted = await client.callTool({ name: "delete_alias", arguments: { address } });
    expect(deleteAliasResult.parse(deleted.structuredContent)).toEqual({ address, deleted: true });

    const missing = await client.callTool({
      name: "update_alias_details",
      arguments: { address, note: "x" },
    });
    expect(updateAliasResult.parse(missing.structuredContent)).toEqual({
      updated: false,
      alias: null,
    });
  });

  it("受信履歴を絞り込んで一覧し、個別・一括で削除できる", async ({ client, received }) => {
    for (const [local, outcome] of [
      ["shop", "forwarded"],
      ["old", "disabled"],
      ["typo", "unknown"],
    ] as const) {
      await received.record({
        recipient: aliasAddress(`${local}@mail.example.test`),
        sender: "sender@example.com",
        size: 100,
        outcome,
      });
    }
    const list = async (filter: string) =>
      listReceivedEmailsResult.parse(
        (await client.callTool({ name: "list_received_emails", arguments: { filter } }))
          .structuredContent,
      ).emails;

    expect((await list("dropped")).map((email) => email.outcome).toSorted()).toEqual([
      "disabled",
      "unknown",
    ]);
    const [unknown] = await list("unknown");
    expect(unknown).toMatchObject({
      recipient: "typo@mail.example.test",
      sender: "sender@example.com",
    });

    const deleted = await client.callTool({
      name: "delete_received_email",
      arguments: { id: unknown?.id },
    });
    expect(deleteReceivedEmailResult.parse(deleted.structuredContent).deleted).toBe(true);

    const cleared = await client.callTool({
      name: "clear_received_emails",
      arguments: { filter: "dropped" },
    });
    expect(clearReceivedEmailsResult.parse(cleared.structuredContent)).toEqual({ deleted: 1 });
    expect((await list("all")).map((email) => email.outcome)).toEqual(["forwarded"]);
  });

  it.for([
    { name: "create_alias", arguments: { address: "wrong@other.example" } },
    {
      name: "create_alias",
      arguments: { address: "shop@mail.example.test", note: "x".repeat(1001) },
    },
    { name: "delete_alias", arguments: { address: "*" } },
    { name: "list_aliases", arguments: { limit: 101 } },
    { name: "list_aliases", arguments: { offset: -1 } },
    { name: "list_aliases", arguments: { status: "on" } },
    { name: "list_aliases", arguments: { query: "x".repeat(201) } },
    { name: "list_received_emails", arguments: { filter: "spam" } },
    { name: "delete_received_email", arguments: { id: 0 } },
    { name: "list_alias_activity", arguments: { sort: "random" } },
    { name: "clear_received_emails", arguments: {} },
    { name: "update_alias_details", arguments: { address: "shop@mail.example.test" } },
    {
      name: "update_alias_details",
      arguments: { address: "shop@mail.example.test", service_url: "javascript:alert(1)" },
    },
  ])("$name への不正な入力 $arguments をツールエラーにする", async (params, { client }) => {
    expect((await client.callTool(params)).isError).toBe(true);
  });

  it("要素数が上限を超える引数を検証前に拒否する", async ({ client }) => {
    const result = await client.callTool({
      name: "list_aliases",
      arguments: { offset: Array.from({ length: MAX_TOOL_INPUT_ELEMENTS }, () => 0) },
    });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain(
      `more than the maximum of ${MAX_TOOL_INPUT_ELEMENTS} elements`,
    );
  });
});
