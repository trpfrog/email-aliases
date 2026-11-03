import { describe, expect, vi } from "vite-plus/test";
import { createAliasStore } from "../aliases/store";
import { createReceivedEmailStore } from "../received/store";
import { address, dbTest, newAlias } from "../test/fixtures";
import { createSettingsStore } from "../settings/store";
import { DRY_RUN_HEADER } from "../config";
import { receiveEmail } from "./receive";

type Message = Parameters<typeof receiveEmail>[0];

const it = dbTest
  .extend("aliases", ({ db }) => createAliasStore(db))
  .extend("received", ({ db }) => createReceivedEmailStore(db))
  .extend("settings", ({ db }) => createSettingsStore(db))
  // eslint-disable-next-line no-empty-pattern -- Vitest がフィクスチャーの依存関係を検出するには分割代入が必要
  .extend("consoleError", ({}, { onCleanup }) => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    onCleanup(() => spy.mockRestore());
    return spy;
  })
  .extend("forward", () =>
    vi.fn<Message["forward"]>().mockResolvedValue({ messageId: "test-message" }),
  )
  .extend("setReject", () => vi.fn<Message["setReject"]>())
  .extend(
    "receive",
    ({ aliases, received, settings, forward, setReject }) =>
      (to: string, { forwardTo }: { forwardTo?: string } = { forwardTo: "inbox@example.com" }) =>
        receiveEmail(
          { from: "sender@example.com", to, rawSize: 1234, forward, setReject },
          { aliases, received, settings, forwardTo },
        ),
  )
  .extend("history", ({ received }) => async () => {
    const { emails } = await received.list({ filter: "all", limit: 100, offset: 0 });
    return emails
      .map(({ recipient, outcome, dry_run }) => ({ recipient, outcome, dry_run }))
      .toReversed();
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
      { recipient: "shop@mail.example.test", outcome: "forwarded", dry_run: false },
      { recipient: "old@mail.example.test", outcome: "disabled", dry_run: false },
      { recipient: "typo@mail.example.test", outcome: "unknown", dry_run: false },
    ]);
    const { emails } = await received.list({ filter: "forwarded", limit: 1, offset: 0 });
    expect(emails[0]).toMatchObject({ sender: "sender@example.com", size: 1234 });
  });

  it("ドライラン中は drop と判定したメールもヘッダーを付けて転送し、判定を履歴に残す", async ({
    aliases,
    settings,
    forward,
    receive,
    history,
  }) => {
    await aliases.create(newAlias({ address: "shop@mail.example.test" }));
    await aliases.create(newAlias({ address: "old@mail.example.test" }));
    await aliases.setDisabled({ address: address("old@mail.example.test"), disabled: true });
    await settings.setDropDryRun(true);

    for (const to of [
      "shop@mail.example.test",
      "old@mail.example.test",
      "typo@mail.example.test",
    ]) {
      await receive(to);
    }

    expect(forward.mock.calls.map(([to, headers]) => [to, headers?.get(DRY_RUN_HEADER)])).toEqual([
      ["inbox@example.com", undefined],
      ["inbox@example.com", "disabled"],
      ["inbox@example.com", "unknown"],
    ]);
    expect(await history()).toEqual([
      { recipient: "shop@mail.example.test", outcome: "forwarded", dry_run: false },
      { recipient: "old@mail.example.test", outcome: "disabled", dry_run: true },
      { recipient: "typo@mail.example.test", outcome: "unknown", dry_run: true },
    ]);

    forward.mockClear();
    await settings.setDropDryRun(false);
    await receive("typo@mail.example.test");
    expect(forward).not.toHaveBeenCalled();
  });

  it("ドライランの転送に失敗したら履歴に記録せず、記録の失敗は成功として扱う", async ({
    db,
    settings,
    forward,
    receive,
    history,
    consoleError,
  }) => {
    await settings.setDropDryRun(true);

    forward.mockRejectedValueOnce(new Error("forward unavailable"));
    await expect(receive("typo@mail.example.test")).rejects.toThrow("forward unavailable");
    expect(await history()).toEqual([]);

    db.exec("DROP TABLE received_emails");
    await receive("typo@mail.example.test");
    expect(forward).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to record a forwarded email",
      expect.any(Error),
    );
  });

  it("drop と判定したときだけ設定を読み、読めなければエラーを伝える", async ({
    db,
    aliases,
    forward,
    receive,
  }) => {
    await aliases.create(newAlias({ address: "shop@mail.example.test" }));
    db.exec("DROP TABLE settings");

    await receive("shop@mail.example.test");
    expect(forward).toHaveBeenCalledOnce();
    await expect(receive("typo@mail.example.test")).rejects.toThrow(/no such table/);
  });

  it("転送に失敗したメールは履歴に記録しない", async ({ aliases, forward, receive, history }) => {
    await aliases.create(newAlias({ address: "shop@mail.example.test" }));
    forward.mockRejectedValueOnce(new Error("forward unavailable"));

    await expect(receive("shop@mail.example.test")).rejects.toThrow("forward unavailable");
    expect(await history()).toEqual([]);
  });

  it("転送先が内容を理由に拒否したら、再送されないよう送信元に拒否を返して理由を履歴に残す", async ({
    aliases,
    received,
    settings,
    forward,
    setReject,
    receive,
    consoleError,
  }) => {
    await aliases.create(newAlias({ address: "shop@mail.example.test" }));
    await settings.setDropDryRun(true);
    // 転送先の応答が受信箱のアドレスを含んでも、送信元には返さない
    const reason =
      "Permanent Unknown error: permanent error (552): 5.7.0 <inbox@example.com> This message was blocked";
    forward.mockRejectedValue(new Error(reason));

    await receive("shop@mail.example.test");
    await receive("typo@mail.example.test");

    expect(setReject).toHaveBeenCalledTimes(2);
    for (const [rejection] of setReject.mock.calls) {
      expect(rejection).not.toContain("inbox@example.com");
    }
    expect(consoleError).toHaveBeenCalledWith(
      "The forwarding destination rejected an email for its content",
      expect.any(Error),
    );
    const { emails } = await received.list({ filter: "all", limit: 100, offset: 0 });
    expect(
      emails.map(({ outcome, dry_run, forward_rejection }) => ({
        outcome,
        dry_run,
        forward_rejection,
      })),
    ).toEqual([
      { outcome: "unknown", dry_run: true, forward_rejection: reason },
      { outcome: "forwarded", dry_run: false, forward_rejection: reason },
    ]);
  });

  it.for([
    "temporary error (451): 4.3.0 Try again later",
    "permanent error (550): 5.1.1 The email account that you tried to reach does not exist",
    "forward unavailable",
    "destination address not verified",
  ])(
    "内容による拒否でない転送のエラー %j は、Worker の失敗として気付けるようにする",
    async (message, { aliases, forward, setReject, receive, history }) => {
      await aliases.create(newAlias({ address: "shop@mail.example.test" }));
      forward.mockRejectedValueOnce(new Error(message));

      await expect(receive("shop@mail.example.test")).rejects.toThrow(message);
      expect(setReject).not.toHaveBeenCalled();
      expect(await history()).toEqual([]);
    },
  );

  it("転送した後の記録の失敗は、再送で二重に転送されないよう成功として扱う", async ({
    db,
    aliases,
    forward,
    receive,
    consoleError,
  }) => {
    await aliases.create(newAlias({ address: "shop@mail.example.test" }));
    db.exec("DROP TABLE received_emails");

    await receive("shop@mail.example.test");
    expect(forward).toHaveBeenCalledExactlyOnceWith("inbox@example.com");
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to record a forwarded email",
      expect.any(Error),
    );
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
    await expect(receive("unknown@mail.example.test")).rejects.toThrow(/no such table/);

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
