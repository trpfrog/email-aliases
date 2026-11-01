import { addressSchema } from "../aliases/schema";
import type { AliasStatus, AliasStore } from "../aliases/store";
import { MAIL_DOMAIN } from "../config";
import type { ReceivedOutcome } from "../received/schema";
import type { ReceivedEmailStore } from "../received/store";

const OUTCOMES = {
  enabled: "forwarded",
  disabled: "disabled",
  missing: "unknown",
} as const satisfies Record<AliasStatus, ReceivedOutcome>;

/**
 * 有効な登録済み宛先へのメールだけを固定の受信箱に転送し、受信履歴に記録する。
 * 無効・未登録の宛先は、転送も拒否もせずに破棄する（履歴には残す）。
 * 自ドメイン以外や形式が不正な宛先は、履歴にも残さない。
 * 設定・検索・転送・記録の失敗は握りつぶさず、Worker の失敗として呼び出し元に伝える。
 */
export async function receiveEmail(
  message: Pick<ForwardableEmailMessage, "from" | "to" | "rawSize" | "forward">,
  {
    aliases,
    received,
    forwardTo,
  }: {
    aliases: Pick<AliasStore, "status">;
    received: Pick<ReceivedEmailStore, "record">;
    forwardTo: string | undefined;
  },
): Promise<void> {
  const destination = parseForwardTo(forwardTo);
  const address = addressSchema.safeParse(message.to);
  if (!address.success) return;

  const outcome = OUTCOMES[await aliases.status(address.data)];
  // 転送に失敗したメールを転送済みとして記録しないよう、転送の後に記録する
  if (outcome === "forwarded") await message.forward(destination);
  await received.record({
    recipient: address.data,
    sender: message.from,
    size: message.rawSize,
    outcome,
  });
}

function parseForwardTo(forwardTo: string | undefined): string {
  const destination = forwardTo?.trim() ?? "";
  if (destination === "") throw new Error("FORWARD_TO is not configured");
  if (destination.toLowerCase().endsWith(`@${MAIL_DOMAIN}`)) {
    throw new Error("FORWARD_TO must be outside the alias domain to avoid forwarding loops");
  }
  return destination;
}
