import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { URL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { addressSchema, receiveEmail } from "../src/aliases";
import { createServer } from "../src/mcp";

// Execute the production SQL against SQLite; only the D1 transport is adapted.
function d1(sqlite: DatabaseSync): D1Database {
  return {
    prepare(sql: string) {
      let values: (string | number)[] = [];
      const statement = {
        bind(...args: (string | number)[]) {
          values = args;
          return statement;
        },
        async first() {
          return sqlite.prepare(sql).get(...values) ?? null;
        },
        async all() {
          return { results: sqlite.prepare(sql).all(...values) };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
}

describe("alias lifecycle", () => {
  let sqlite: DatabaseSync;
  let db: D1Database;
  let client: Client;
  let server: ReturnType<typeof createServer>;
  const forward = vi.fn().mockResolvedValue(undefined);
  const env = () => ({ DB: db, FORWARD_TO: "inbox@example.com" });

  beforeEach(async () => {
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec(readFileSync(new URL("../migrations/0001_aliases.sql", import.meta.url), "utf8"));
    db = d1(sqlite);
    server = createServer(db);
    client = new Client({ name: "test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    forward.mockClear();
  });

  afterEach(async () => {
    await client.close();
    await server.close();
    sqlite.close();
  });

  it("drops unknown recipients, forwards a created alias, then drops it after deletion", async () => {
    const message = { to: "SHOP@mail.example.com", forward };
    await receiveEmail(message, env());
    expect(forward).not.toHaveBeenCalled();
    const created = await client.callTool({
      name: "create_alias",
      arguments: { address: "Shop", note: "Shopping" },
    });
    expect(created.structuredContent).toMatchObject({
      created: true,
      alias: { address: "shop@mail.example.com", note: "Shopping" },
    });
    await receiveEmail(message, env());
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
    await receiveEmail(message, env());
    expect(forward).not.toHaveBeenCalled();
    expect(
      (await client.callTool({ name: "delete_alias", arguments: { address: "shop" } }))
        .structuredContent,
    ).toMatchObject({ deleted: false });
  });

  it("lists aliases with stable ordering and pagination", async () => {
    for (const address of ["beta", "alpha", "gamma"])
      await client.callTool({ name: "create_alias", arguments: { address } });
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

  it("matches the full address exactly, including plus tags", async () => {
    await client.callTool({ name: "create_alias", arguments: { address: "shop" } });
    for (const to of [
      "shop",
      "shop@other.example",
      "shop+tag@mail.example.com",
      "other@mail.example.com",
    ])
      await receiveEmail({ to, forward }, env());
    expect(forward).not.toHaveBeenCalled();
  });

  it("does not swallow database or forwarding failures", async () => {
    await client.callTool({ name: "create_alias", arguments: { address: "shop" } });
    forward.mockRejectedValueOnce(new Error("forward unavailable"));
    await expect(receiveEmail({ to: "shop@mail.example.com", forward }, env())).rejects.toThrow(
      "forward unavailable",
    );
    sqlite.exec("DROP TABLE aliases");
    await expect(receiveEmail({ to: "shop@mail.example.com", forward }, env())).rejects.toThrow();
  });

  it("prevents forwarding loops and fails on missing configuration", async () => {
    await client.callTool({ name: "create_alias", arguments: { address: "shop" } });
    for (const FORWARD_TO of ["", "other@mail.example.com"])
      await expect(
        receiveEmail({ to: "shop@mail.example.com", forward }, { DB: db, FORWARD_TO }),
      ).rejects.toThrow();
    expect(forward).not.toHaveBeenCalled();
  });
});

describe("address validation", () => {
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
  ])("rejects %j", (input) => {
    expect(addressSchema.safeParse(input).success).toBe(false);
  });
  it("keeps supported punctuation and normalizes case", () => {
    expect(addressSchema.parse(" Shop+News ")).toBe("shop+news@mail.example.com");
  });
});
