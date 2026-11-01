import { sValidator } from "@hono/standard-validator";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ValidationTargets } from "hono";

/**
 * Standard Schema 対応のスキーマでリクエストを検証し、失敗時は `{ error: message }` を 400 で返す。
 * 検証ライブラリの詳細なエラーはクライアントに返さない。
 */
export function validate<Target extends keyof ValidationTargets, Schema extends StandardSchemaV1>(
  target: Target,
  schema: Schema,
  message: string,
) {
  return sValidator(target, schema, (result, c) =>
    result.success ? undefined : c.json({ error: message }, 400),
  );
}
