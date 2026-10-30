import type { AliasStore } from "../aliases/store";
import { addressSchema } from "../aliases/schema";
import { DOMAIN } from "../config";

export async function receiveEmail(
  message: Pick<ForwardableEmailMessage, "to" | "forward">,
  aliases: Pick<AliasStore, "has">,
  forwardTo: string,
) {
  if (!message.to.toLowerCase().endsWith(`@${DOMAIN}`)) {
    return;
  }

  const address = addressSchema.safeParse(message.to);
  // 未登録の宛先は、転送も拒否もせずに処理を終えて破棄する。
  if (!address.success || !(await aliases.has(address.data))) {
    return;
  }

  if (!forwardTo) {
    throw new Error("FORWARD_TO is not configured");
  }

  if (forwardTo.trim().toLowerCase().endsWith(`@${DOMAIN}`)) {
    throw new Error("FORWARD_TO must be outside the alias domain to avoid forwarding loops");
  }

  // 検索や転送に失敗した場合は、メールを黙って破棄せずエラーを呼び出し元に伝える。
  await message.forward(forwardTo);
}
