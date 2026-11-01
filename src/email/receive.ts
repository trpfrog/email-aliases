import type { AliasStore } from "../aliases/store";
import { addressSchema } from "../aliases/schema";
import { DOMAIN } from "../config";

/**
 * 有効な登録済み宛先へのメールだけを固定の受信箱に転送する。
 * 未登録・無効な宛先は、転送も拒否もせずに処理を終えて破棄する。
 * 設定・検索・転送の失敗は握りつぶさず、Worker の失敗として呼び出し元に伝える。
 */
export async function receiveEmail(
  message: Pick<ForwardableEmailMessage, "to" | "forward">,
  { aliases, forwardTo }: { aliases: Pick<AliasStore, "isEnabled">; forwardTo: string | undefined },
): Promise<void> {
  const destination = parseForwardTo(forwardTo);
  const address = addressSchema.safeParse(message.to);
  if (!address.success || !(await aliases.isEnabled(address.data))) return;

  await message.forward(destination);
}

function parseForwardTo(forwardTo: string | undefined): string {
  const destination = forwardTo?.trim() ?? "";
  if (destination === "") throw new Error("FORWARD_TO is not configured");
  if (destination.toLowerCase().endsWith(`@${DOMAIN}`)) {
    throw new Error("FORWARD_TO must be outside the alias domain to avoid forwarding loops");
  }
  return destination;
}
