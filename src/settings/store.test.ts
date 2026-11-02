import { describe, expect } from "vite-plus/test";
import { dbTest } from "../test/fixtures";
import { createSettingsStore } from "./store";

const it = dbTest.extend("store", ({ db }) => createSettingsStore(db));

describe("設定の store", () => {
  it("一度も設定していなければドライランは無効", async ({ store }) => {
    expect(await store.get()).toEqual({ drop_dry_run_since: null });
  });

  it("ドライランを切り替え、有効化を繰り返しても開始日時を保つ", async ({ db, store }) => {
    const enabled = await store.setDropDryRun(true);
    expect(enabled.drop_dry_run_since).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(await store.get()).toEqual(enabled);

    db.exec("UPDATE settings SET drop_dry_run_since = '2026-01-01T00:00:00.000Z'");
    expect(await store.setDropDryRun(true)).toEqual({
      drop_dry_run_since: "2026-01-01T00:00:00.000Z",
    });

    expect(await store.setDropDryRun(false)).toEqual({ drop_dry_run_since: null });
    expect(await store.get()).toEqual({ drop_dry_run_since: null });
  });

  it("データベースのエラーを呼び出し元に伝える", async ({ db, store }) => {
    db.exec("DROP TABLE settings");
    await expect(store.get()).rejects.toThrow(/no such table/);
    await expect(store.setDropDryRun(true)).rejects.toThrow(/no such table/);
  });
});
