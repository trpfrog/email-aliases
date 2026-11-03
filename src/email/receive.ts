import { addressSchema } from "../aliases/schema";
import type { AliasStatus, AliasStore } from "../aliases/store";
import { DRY_RUN_HEADER, MAIL_DOMAIN } from "../config";
import type { ReceivedOutcome } from "../received/schema";
import type { ReceivedEmailStore } from "../received/store";
import { isDropDryRun } from "../settings/schema";
import type { SettingsStore } from "../settings/store";

const OUTCOMES = {
  enabled: "forwarded",
  disabled: "disabled",
  missing: "unknown",
} as const satisfies Record<AliasStatus, ReceivedOutcome>;

/**
 * 有効な登録済み宛先へのメールだけを固定の受信箱に転送し、受信履歴に記録する。
 * 無効・未登録の宛先は、転送も拒否もせずに破棄する（履歴には残す）。
 * ただし移行期間用のドライラン中は、破棄せずにヘッダーを付けて転送し、履歴に dry_run として残す。
 * 自ドメイン以外や形式が不正な宛先は、履歴にも残さない。
 * 設定・検索・転送の失敗は握りつぶさず、Worker の失敗として呼び出し元に伝える。
 * ただし転送先のメールサーバーがスパムなどとして内容を拒否した（5.7.x）ときは、Worker の失敗にすると
 * 一時的なエラーとして送信元が再送を繰り返すため、送信元に恒久的なエラーを返して履歴に理由を残す。
 * 宛先不明（5.1.x）など転送先の設定の誤りによる拒否は、全メールを拒否して気付けなくならないよう Worker の失敗にする。
 * 転送した後の記録の失敗だけは、再送による二重の転送を避けるためログに残して成功として扱う。
 */
export async function receiveEmail(
  message: Pick<ForwardableEmailMessage, "from" | "to" | "rawSize" | "forward" | "setReject">,
  {
    aliases,
    received,
    settings,
    forwardTo,
  }: {
    aliases: Pick<AliasStore, "status">;
    received: Pick<ReceivedEmailStore, "record">;
    settings: Pick<SettingsStore, "get">;
    forwardTo: string | undefined;
  },
): Promise<void> {
  const destination = parseForwardTo(forwardTo);
  const address = addressSchema.safeParse(message.to);
  if (!address.success) return;

  const outcome = OUTCOMES[await aliases.status(address.data)];
  // 設定の読み取りは drop と判定したメールだけにする
  const dropped = outcome !== "forwarded";
  const dryRun = dropped && isDropDryRun(await settings.get());
  const record = (forwardRejection?: string) =>
    received.record({
      recipient: address.data,
      sender: message.from,
      size: message.rawSize,
      outcome,
      dry_run: dryRun,
      forward_rejection: forwardRejection,
    });
  if (dropped && !dryRun) {
    await record();
    return;
  }

  // 転送に失敗したメールを転送済みとして記録しないよう、転送の後に記録する
  let forwardRejection: string | undefined;
  try {
    if (dryRun) {
      await message.forward(destination, new Headers({ [DRY_RUN_HEADER]: outcome }));
    } else {
      await message.forward(destination);
    }
  } catch (error) {
    forwardRejection = contentRejection(error);
    if (forwardRejection === undefined) throw error;
    console.error("The forwarding destination rejected an email for its content", error);
    // 転送先のアドレスを明かさないよう、拒否の理由は送信元に返さない
    message.setReject("Message rejected by the destination mail server");
  }
  try {
    await record(forwardRejection);
  } catch (error) {
    // 拒否したメールも、記録の失敗で再送されると転送先に何度も拒否されるため成功として扱う
    console.error(
      forwardRejection === undefined
        ? "Failed to record a forwarded email"
        : "Failed to record an email rejected by the forwarding destination",
      error,
    );
  }
}

/**
 * 転送先のメールサーバーがセキュリティ・ポリシー上の理由（拡張ステータスコード 5.7.x）で
 * 恒久的に拒否したときの理由を返す。それ以外のエラーなら undefined。
 * Cloudflare は種類を判別できるエラーを返さないため、SMTP の応答を含むメッセージから判定する
 */
function contentRejection(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  return /\bpermanent error \(5\d\d\): 5\.7\.\d{1,3}\b/.test(error.message)
    ? error.message
    : undefined;
}

function parseForwardTo(forwardTo: string | undefined): string {
  const destination = forwardTo?.trim() ?? "";
  if (destination === "") throw new Error("FORWARD_TO is not configured");
  if (destination.toLowerCase().endsWith(`@${MAIL_DOMAIN}`)) {
    throw new Error("FORWARD_TO must be outside the alias domain to avoid forwarding loops");
  }
  return destination;
}
