import { describe, expect } from "vite-plus/test";
import { address, dbTest, newAlias } from "../test/fixtures";
import { updateAliasDetailsInput } from "./schema";
import { createAliasStore } from "./store";

const it = dbTest.extend("store", ({ db }) => createAliasStore(db));

const details = (input: { address: string; note?: string; service_url?: string }) =>
  updateAliasDetailsInput.parse(input);

describe("エイリアスの store", () => {
  it("作成したエイリアスを返し、既存のアドレスは変更しない", async ({ store }) => {
    const created = await store.create(
      newAlias({
        address: "shop@mail.example.test",
        note: "メモ",
        service_url: "https://a.example",
      }),
    );
    expect(created).toMatchObject({
      created: true,
      alias: {
        address: "shop@mail.example.test",
        note: "メモ",
        service_url: "https://a.example",
        disabled_at: null,
        created_at: expect.any(String),
      },
    });

    await store.setDisabled({ address: address("shop@mail.example.test"), disabled: true });
    const duplicate = await store.create(
      newAlias({
        address: "SHOP@mail.example.test",
        note: "上書き",
        service_url: "https://b.example",
      }),
    );
    expect(duplicate).toEqual({
      created: false,
      alias: { ...created.alias, disabled_at: expect.any(String) },
    });
  });

  it("アドレス順に一覧し、next_offset でページ分割する", async ({ store }) => {
    for (const local of ["beta", "alpha", "gamma"]) {
      await store.create(newAlias({ address: `${local}@mail.example.test` }));
    }

    const first = await store.list({ limit: 2, offset: 0 });
    expect(first.aliases.map((alias) => alias.address)).toEqual([
      "alpha@mail.example.test",
      "beta@mail.example.test",
    ]);
    expect(first.next_offset).toBe(2);

    const last = await store.list({ limit: 2, offset: 2 });
    expect(last.aliases.map((alias) => alias.address)).toEqual(["gamma@mail.example.test"]);
    expect(last.next_offset).toBeNull();
  });

  it("無効化しても登録情報を保ち、最初の無効化日時を維持して再有効化できる", async ({ store }) => {
    const target = address("toggle@mail.example.test");
    const { alias: original } = await store.create(newAlias({ address: target, note: "残す" }));
    expect(await store.status(target)).toBe("enabled");

    const disabled = await store.setDisabled({ address: target, disabled: true });
    expect(disabled).toEqual({
      updated: true,
      alias: { ...original, disabled_at: expect.any(String) },
    });
    expect(await store.status(target)).toBe("disabled");
    expect(await store.setDisabled({ address: target, disabled: true })).toEqual(disabled);

    expect(await store.setDisabled({ address: target, disabled: false })).toEqual({
      updated: true,
      alias: original,
    });
    expect(await store.status(target)).toBe("enabled");
  });

  it("指定した項目だけを更新し、空文字で消去する", async ({ store }) => {
    const target = "notes@mail.example.test";
    await store.create(newAlias({ address: target, note: "元", service_url: "https://a.example" }));
    await store.setDisabled({ address: address(target), disabled: true });

    const noteOnly = await store.updateDetails(details({ address: target, note: "変更" }));
    expect(noteOnly.alias).toMatchObject({
      note: "変更",
      service_url: "https://a.example",
      disabled_at: expect.any(String),
    });

    const urlOnly = await store.updateDetails(details({ address: target, service_url: "" }));
    expect(urlOnly.alias).toMatchObject({ note: "変更", service_url: "" });

    const both = await store.updateDetails(
      details({ address: target, note: "", service_url: "https://b.example" }),
    );
    expect(both.alias).toMatchObject({ note: "", service_url: "https://b.example" });
  });

  it("未登録のアドレスは更新・削除せず、未登録として扱う", async ({ store }) => {
    const missing = address("missing@mail.example.test");
    expect(await store.status(missing)).toBe("missing");
    expect(await store.setDisabled({ address: missing, disabled: false })).toEqual({
      updated: false,
      alias: null,
    });
    expect(await store.updateDetails(details({ address: missing, note: "x" }))).toEqual({
      updated: false,
      alias: null,
    });
    expect(await store.delete(missing)).toEqual({ address: missing, deleted: false });
  });

  it("削除したアドレスは有効でなくなる", async ({ store }) => {
    const target = address("gone@mail.example.test");
    await store.create(newAlias({ address: target }));
    expect(await store.delete(target)).toEqual({ address: target, deleted: true });
    expect(await store.status(target)).toBe("missing");
  });

  it("データベースのエラーを呼び出し元に伝える", async ({ db, store }) => {
    db.exec("DROP TABLE aliases");
    await expect(store.status(address("shop@mail.example.test"))).rejects.toThrow(/no such table/);
  });
});
