import { describe, expect, vi } from "vite-plus/test";
import { createAliasStore } from "../aliases/store";
import { createReceivedEmailStore } from "../received/store";
import { address, dbTest, newAlias } from "../test/fixtures";
import { receiveEmail } from "./receive";

type Message = Parameters<typeof receiveEmail>[0];

const it = dbTest
  .extend("aliases", ({ db }) => createAliasStore(db))
  .extend("received", ({ db }) => createReceivedEmailStore(db))
  .extend("forward", () =>
    vi.fn<Message["forward"]>().mockResolvedValue({ messageId: "test-message" }),
  )
  .extend(
    "receive",
    ({ aliases, received, forward }) =>
      (to: string, { forwardTo }: { forwardTo?: string } = { forwardTo: "inbox@example.com" }) =>
        receiveEmail(
          { from: "sender@example.com", to, rawSize: 1234, forward },
          { aliases, received, forwardTo },
        ),
  )
  .extend("history", ({ received }) => async () => {
    const { emails } = await received.list({ filter: "all", limit: 100, offset: 0 });
    return emails.map(({ recipient, outcome }) => ({ recipient, outcome })).toReversed();
  });

describe("メールの受信", () => {
  it("有効な登録済みの宛先だけを転送する", async ({ aliases, forward, receive }) => {
    await receive("shop@mail.example.test");
    expect(forward).not.toHaveBeenCalled();

    await aliases.create(newAlias({ address: "Shop@mail.example.test" }));
    await receive("SHOP@mail.example.test");
    expect(forward).toHaveBeenCalledExactlyOnceWith("inbox@example.com");

    forward.mockClear();
    await aliases.setDisabled({
      address: address("shop@mail.example.test"),
      disabled: true,
    });
    await receive("shop@mail.example.test");
    expect(forward).not.toHaveBeenCalled();
  });

  it("受信の結果を履歴に記録し、自ドメイン以外や不正な宛先は記録しない", async ({
    aliases,
    received,
    receive,
    history,
  }) => {
    await aliases.create(newAlias({ address: "shop@mail.example.test" }));
    await aliases.create(newAlias({ address: "old@mail.example.test" }));
    await aliases.setDisabled({ address: address("old@mail.example.test"), disabled: true });

    for (const to of [
      "SHOP@mail.example.test",
      "old@mail.example.test",
      "typo@mail.example.test",
      "shop@other.example",
      "not an address",
    ]) {
      await receive(to);
    }

    expect(await history()).toEqual([
      { recipient: "shop@mail.example.test", outcome: "forwarded" },
      { recipient: "old@mail.example.test", outcome: "disabled" },
      { recipient: "typo@mail.example.test", outcome: "unknown" },
    ]);
    const { emails } = await received.list({ filter: "forwarded", limit: 1, offset: 0 });
    expect(emails[0]).toMatchObject({ sender: "sender@example.com", size: 1234 });
  });

  it("転送に失敗したメールは履歴に記録しない", async ({ aliases, forward, receive, history }) => {
    await aliases.create(newAlias({ address: "shop@mail.example.test" }));
    forward.mockRejectedValueOnce(new Error("forward unavailable"));

    await expect(receive("shop@mail.example.test")).rejects.toThrow("forward unavailable");
    expect(await history()).toEqual([]);
  });

  it("プラスタグも含めて完全なアドレスで一致を判定する", async ({ aliases, forward, receive }) => {
    await aliases.create(newAlias({ address: "shop@mail.example.test" }));

    for (const to of [
      "shop",
      "shop@other.example",
      "shop+tag@mail.example.test",
      "other@mail.example.test",
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
    await aliases.create(newAlias({ address: "shop@mail.example.test" }));

    forward.mockRejectedValueOnce(new Error("forward unavailable"));
    await expect(receive("shop@mail.example.test")).rejects.toThrow("forward unavailable");

    db.exec("DROP TABLE received_emails");
    await expect(receive("shop@mail.example.test")).rejects.toThrow(/no such table/);

    db.exec("DROP TABLE aliases");
    await expect(receive("shop@mail.example.test")).rejects.toThrow(/no such table/);
  });

  it("転送先の設定がなければ、未登録の宛先でもエラーにして誤設定に気付けるようにする", async ({
    forward,
    receive,
  }) => {
    await expect(receive("unknown@mail.example.test", { forwardTo: undefined })).rejects.toThrow(
      /FORWARD_TO/,
    );
    expect(forward).not.toHaveBeenCalled();
  });

  it.for([undefined, "", "  ", "other@mail.example.test", "Other@MAIL.EXAMPLE.TEST"])(
    "転送先 %j は設定の誤りとしてエラーにする",
    async (forwardTo, { aliases, forward, receive }) => {
      await aliases.create(newAlias({ address: "shop@mail.example.test" }));
      await expect(receive("shop@mail.example.test", { forwardTo })).rejects.toThrow(/FORWARD_TO/);
      expect(forward).not.toHaveBeenCalled();
    },
  );
});
