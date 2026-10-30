import { z } from "zod";
import { DOMAIN } from "./env";

// Accept a local part or a full address. Treat local parts as case-insensitive.
export const addressSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((input) => (input.includes("@") ? input : `${input}@${DOMAIN}`))
  .refine((address) => {
    const [local, domain, extra] = address.split("@");
    return (
      domain === DOMAIN &&
      extra === undefined &&
      local.length <= 64 &&
      /^[a-z0-9!#$%&'+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'+/=?^_`{|}~-]+)*$/.test(local)
    );
  }, `Use an address at ${DOMAIN} (local part: 1–64 ASCII characters).`);

export async function receiveEmail(
  message: Pick<ForwardableEmailMessage, "to" | "forward">,
  env: { DB: D1Database; FORWARD_TO: string },
) {
  if (!message.to.toLowerCase().endsWith(`@${DOMAIN}`)) return;
  const address = addressSchema.safeParse(message.to);
  if (!address.success) return;

  const alias = await env.DB.prepare("SELECT address FROM aliases WHERE address = ?")
    .bind(address.data)
    .first();
  // Returning without forward/reject silently drops an unregistered recipient.
  if (!alias) return;
  if (!env.FORWARD_TO) throw new Error("FORWARD_TO is not configured");
  if (env.FORWARD_TO.trim().toLowerCase().endsWith(`@${DOMAIN}`)) {
    throw new Error("FORWARD_TO must be outside the alias domain to avoid forwarding loops");
  }
  // Let database/forwarding failures propagate; do not silently drop them.
  await message.forward(env.FORWARD_TO);
}
