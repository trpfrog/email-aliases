import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it as baseIt } from "vite-plus/test";
import {
  createAliasResult,
  deleteAliasResult,
  listAliasesResult,
  updateAliasResult,
} from "../aliases/schema";
import { createAliasStore } from "../aliases/store";
import { createMigratedDatabase } from "../test/database";
import { createMcpServer } from "./server";

const it = baseIt
  // eslint-disable-next-line no-empty-pattern -- Vitest がフィクスチャーの依存関係を検出するには分割代入が必要。
  .extend("client", async ({}, { onCleanup }) => {
    const db = createMigratedDatabase();
    const server = createMcpServer(createAliasStore(db));
    const client = new Client({ name: "test", version: "1.0.0" });
    onCleanup(async () => {
      await client.close();
      await server.close();
      db.close();
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    return client;
  });

describe("MCP ツール", () => {
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
    });
    for (const tool of tools) expect(tool.outputSchema).toBeDefined();
  });

  it("作成・一覧・更新・削除の結果を構造化して返す", async ({ client }) => {
    const address = "shop@mail.example.com";

    const created = await client.callTool({
      name: "create_alias",
      arguments: {
        address: "Shop@mail.example.com",
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

  it.for([
    { name: "create_alias", arguments: { address: "wrong@other.example" } },
    {
      name: "create_alias",
      arguments: { address: "shop@mail.example.com", note: "x".repeat(1001) },
    },
    { name: "delete_alias", arguments: { address: "*" } },
    { name: "list_aliases", arguments: { limit: 101 } },
    { name: "list_aliases", arguments: { offset: -1 } },
    { name: "update_alias_details", arguments: { address: "shop@mail.example.com" } },
    {
      name: "update_alias_details",
      arguments: { address: "shop@mail.example.com", service_url: "javascript:alert(1)" },
    },
  ])("$name への不正な入力 $arguments をツールエラーにする", async (params, { client }) => {
    expect((await client.callTool(params)).isError).toBe(true);
  });
});
