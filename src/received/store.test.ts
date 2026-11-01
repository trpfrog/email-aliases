import { describe, expect } from "vite-plus/test";
import { createAliasStore } from "../aliases/store";
import { address, dbTest, newAlias } from "../test/fixtures";
import { RECEIVED_LIMITS, type ReceivedOutcome } from "./schema";
import { createReceivedEmailStore } from "./store";

const it = dbTest
  .extend("store", ({ db }) => createReceivedEmailStore(db))
  .extend(
    "record",
    ({ store }) =>
      (local: string, outcome: ReceivedOutcome = "unknown") =>
        store.record({
          recipient: address(`${local}@mail.example.test`),
          sender: "sender@example.com",
          size: 100,
          outcome,
        }),
  )
  .extend("recipients", ({ store }) => async () => {
    const { emails } = await store.list({ filter: "all", limit: 100, offset: 0 });
    return emails.map((email) => email.recipient.split("@")[0]);
  });

describe("受信履歴の store", () => {
  it("新しい順に一覧し、絞り込みと next_offset でページ分割する", async ({
    store,
    record,
    recipients,
  }) => {
    await record("a", "forwarded");
    await record("b", "disabled");
    await record("c", "unknown");
    expect(await recipients()).toEqual(["c", "b", "a"]);

    const list = async (filter: "forwarded" | "dropped" | "disabled" | "unknown") =>
      (await store.list({ filter, limit: 100, offset: 0 })).emails.map((email) => email.outcome);
    expect(await list("forwarded")).toEqual(["forwarded"]);
    expect(await list("dropped")).toEqual(["unknown", "disabled"]);
    expect(await list("disabled")).toEqual(["disabled"]);
    expect(await list("unknown")).toEqual(["unknown"]);

    const first = await store.list({ filter: "all", limit: 2, offset: 0 });
    expect(first.next_offset).toBe(2);
    const last = await store.list({ filter: "all", limit: 2, offset: 2 });
    expect(last.emails.map((email) => email.outcome)).toEqual(["forwarded"]);
    expect(last.next_offset).toBeNull();
  });

  it("送信元を上限の長さに切り詰める", async ({ store }) => {
    await store.record({
      recipient: address("a@mail.example.test"),
      sender: "x".repeat(RECEIVED_LIMITS.sender + 10),
      size: 1,
      outcome: "forwarded",
    });
    const { emails } = await store.list({ filter: "all", limit: 1, offset: 0 });
    expect(emails[0]?.sender).toHaveLength(RECEIVED_LIMITS.sender);
  });

  it("個別に削除し、絞り込みに一致する行だけをまとめて削除する", async ({
    store,
    record,
    recipients,
  }) => {
    await record("a", "forwarded");
    await record("b", "disabled");
    await record("c", "unknown");

    const { emails } = await store.list({ filter: "disabled", limit: 1, offset: 0 });
    const id = emails[0]?.id ?? 0;
    expect(await store.delete(id)).toEqual({ id, deleted: true });
    expect(await store.delete(id)).toEqual({ id, deleted: false });
    expect(await recipients()).toEqual(["c", "a"]);

    expect(await store.clear("dropped")).toEqual({ deleted: 1 });
    expect(await recipients()).toEqual(["a"]);
    expect(await store.clear("all")).toEqual({ deleted: 1 });
    expect(await recipients()).toEqual([]);
  });

  it("1 時間に記録する新しい未登録の宛先を制限し、既知の宛先や登録済みの宛先は記録する", async ({
    db,
    record,
  }) => {
    // 1 時間より前に受信した宛先は、新しい宛先として数えない
    db.exec(`INSERT INTO received_emails (received_at, recipient, sender, size, outcome)
      VALUES (strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 hours'), 'known@mail.example.test', '', 1, 'unknown')`);

    for (let i = 0; i < RECEIVED_LIMITS.newUnknownPerHour; i++) {
      expect(await record(`test${i}`)).toBe(true);
    }
    expect(await record("test-over")).toBe(false);
    expect(await record("test0")).toBe(true);
    expect(await record("known")).toBe(true);
    expect(await record("test-over", "forwarded")).toBe(true);
  });

  it("1 時間に記録する未登録の宛先への受信件数を制限する", async ({ record }) => {
    for (let i = 0; i < RECEIVED_LIMITS.unknownPerHour; i++) {
      expect(await record("spam")).toBe(true);
    }
    expect(await record("spam")).toBe(false);
    expect(await record("spam", "disabled")).toBe(true);
  });

  it("記録のたびに 180 日を過ぎた履歴を削除する", async ({ db, record, recipients }) => {
    db.exec(`INSERT INTO received_emails (received_at, recipient, sender, size, outcome) VALUES
      (strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-181 days'), 'expired@mail.example.test', '', 1, 'forwarded'),
      (strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-179 days'), 'kept@mail.example.test', '', 1, 'forwarded')`);

    await record("new", "forwarded");
    expect(await recipients()).toEqual(["new", "kept"]);
  });

  it("エイリアスごとの受信状況を、受信のないものも含めて並べ替えて返す", async ({ db, store }) => {
    const aliases = createAliasStore(db);
    for (const local of ["silent", "stale", "busy"]) {
      await aliases.create(newAlias({ address: `${local}@mail.example.test` }));
    }
    await aliases.setDisabled({ address: address("busy@mail.example.test"), disabled: true });
    db.exec(`INSERT INTO received_emails (received_at, recipient, sender, size, outcome) VALUES
      (strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-60 days'), 'stale@mail.example.test', '', 1, 'forwarded'),
      (strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-40 days'), 'busy@mail.example.test', '', 1, 'forwarded'),
      (strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day'), 'busy@mail.example.test', '', 1, 'disabled'),
      (strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour'), 'busy@mail.example.test', '', 1, 'disabled'),
      (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'unregistered@mail.example.test', '', 1, 'unknown')`);

    const leastRecent = await store.activity({ sort: "least_recent", limit: 100, offset: 0 });
    expect(leastRecent).toEqual({
      aliases: [
        {
          address: "silent@mail.example.test",
          disabled_at: null,
          last_received_at: null,
          received_count_30d: 0,
          received_count: 0,
        },
        {
          address: "stale@mail.example.test",
          disabled_at: null,
          last_received_at: expect.any(String),
          received_count_30d: 0,
          received_count: 1,
        },
        {
          address: "busy@mail.example.test",
          disabled_at: expect.any(String),
          last_received_at: expect.any(String),
          received_count_30d: 2,
          received_count: 3,
        },
      ],
      next_offset: null,
    });

    const busiest = await store.activity({ sort: "most_received_30d", limit: 2, offset: 0 });
    expect(busiest.aliases.map((alias) => alias.address.split("@")[0])).toEqual(["busy", "silent"]);
    expect(busiest.next_offset).toBe(2);
  });

  it("データベースのエラーを呼び出し元に伝える", async ({ db, record }) => {
    db.exec("DROP TABLE received_emails");
    await expect(record("a")).rejects.toThrow(/no such table/);
  });
});
