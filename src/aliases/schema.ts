import { z } from "zod";
import { DOMAIN } from "../config";

// ローカル部のみ、または完全なアドレスを受け付け、大文字・小文字を区別せず扱う。
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
  }, `Use an address at ${DOMAIN} (local part: 1–64 ASCII characters).`)
  .brand<"AliasAddress">();

export type AliasAddress = z.output<typeof addressSchema>;

export const createAliasSchema = z.object({
  address: addressSchema,
  note: z.string().max(1000).default(""),
});

export const listAliasesSchema = z.object({
  limit: z.number().int().min(1).max(100).default(100),
  offset: z.number().int().min(0).default(0),
});

export const deleteAliasSchema = z.object({ address: addressSchema });
