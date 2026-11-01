import { describe, expect, it as baseIt, vi } from "vite-plus/test";
import { addressSchema, createAliasInput } from "../aliases/schema";
import { createAliasStore } from "../aliases/store";
import { createMigratedDatabase } from "../test/database";
import { receiveEmail } from "./receive";

type Message = Parameters<typeof receiveEmail>[0];

const it = baseIt
  // eslint-disable-next-line no-empty-pattern -- Vitest がフィクスチャーの依存関係を検出するには分割代入が必要。
  .extend("db", ({}, { onCleanup }) => {
    const db = createMigratedDatabase();
    onCleanup(() => db.close());
    return db;
  })
  .extend("aliases", ({ db }) => createAliasStore(db))
  .extend("forward", () =>
    vi.fn<Message["forward"]>().mockResolvedValue({ messageId: "test-message" }),
  )
  .extend(
    "receive",
    ({ aliases, forward }) =>
      (to: string, { forwardTo }: { forwardTo?: string } = { forwardTo: "inbox@example.com" }) =>
        receiveEmail({ to, forward }, { aliases, forwardTo }),
  );

describe("メールの受信", () => {
  it("有効な登録済みの宛先だけを転送する", async ({ aliases, forward, receive }) => {
    await receive("shop@mail.example.com");
    expect(forward).not.toHaveBeenCalled();

    await aliases.create(createAliasInput.parse({ address: "Shop@mail.example.com" }));
    await receive("SHOP@mail.example.com");
    expect(forward).toHaveBeenCalledExactlyOnceWith("inbox@example.com");

    forward.mockClear();
    await aliases.setDisabled({
      address: addressSchema.parse("shop@mail.example.com"),
      disabled: true,
    });
    await receive("shop@mail.example.com");
    expect(forward).not.toHaveBeenCalled();
  });

  it("プラスタグも含めて完全なアドレスで一致を判定する", async ({ aliases, forward, receive }) => {
    await aliases.create(createAliasInput.parse({ address: "shop@mail.example.com" }));

    for (const to of [
      "shop",
      "shop@other.example",
      "shop+tag@mail.example.com",
      "other@mail.example.com",
    ]) {
      await receive(to);
    }
    expect(forward).not.toHaveBeenCalled();
  });

  it("データベースや転送のエラーを呼び出し元に伝える", async ({
    db,
    aliases,
    forward,
    receive,
  }) => {
    await aliases.create(createAliasInput.parse({ address: "shop@mail.example.com" }));

    forward.mockRejectedValueOnce(new Error("forward unavailable"));
    await expect(receive("shop@mail.example.com")).rejects.toThrow("forward unavailable");

    db.exec("DROP TABLE aliases");
    await expect(receive("shop@mail.example.com")).rejects.toThrow(/no such table/);
  });

  it.for([undefined, "", "  ", "other@mail.example.com", "Other@MAIL.trpfrog.net"])(
    "転送先 %j は設定の誤りとしてエラーにする",
    async (forwardTo, { aliases, forward, receive }) => {
      await aliases.create(createAliasInput.parse({ address: "shop@mail.example.com" }));
      await expect(receive("shop@mail.example.com", { forwardTo })).rejects.toThrow(/FORWARD_TO/);
      expect(forward).not.toHaveBeenCalled();
    },
  );
});
