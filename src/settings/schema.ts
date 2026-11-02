import { z } from "zod";

/**
 * アプリ全体の設定。
 * drop_dry_run_since は移行期間用のドライランを始めた日時で、null なら無効。
 * 有効な間は、無効・未登録の宛先へのメールも drop せずに転送し、受信履歴には本来の判定を残す
 */
export const settingsSchema = z.object({ drop_dry_run_since: z.string().nullable() });
export type Settings = z.output<typeof settingsSchema>;

export function isDropDryRun(settings: Settings): boolean {
  return settings.drop_dry_run_since !== null;
}

export const getSettingsInput = z.strictObject({});
export const setDropDryRunInput = z.strictObject({ enabled: z.boolean() });
