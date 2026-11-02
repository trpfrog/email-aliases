import type { SqliteClient } from "reylo";
import { findSettings, updateDropDryRun } from "./queries";
import type { Settings } from "./schema";

const DEFAULT_SETTINGS: Settings = { drop_dry_run_since: null };

/** アプリ全体の設定。メール受信が参照し、MCP・管理 API が変更する。 */
export interface SettingsStore {
  get(): Promise<Settings>;
  /** 有効化を繰り返しても最初に有効にした日時を保つ。 */
  setDropDryRun(enabled: boolean): Promise<Settings>;
}

export function createSettingsStore(db: SqliteClient): SettingsStore {
  return {
    async get() {
      return (await findSettings(db)) ?? DEFAULT_SETTINGS;
    },
    async setDropDryRun(enabled) {
      return await updateDropDryRun(db, enabled);
    },
  };
}
