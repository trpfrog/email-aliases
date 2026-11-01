import type { SqliteClient } from "reylo";
import {
  deleteAliasRow,
  findAlias,
  insertAlias,
  listAliasRows,
  updateDetails,
  updateDisabled,
} from "./queries";
import type {
  Alias,
  AliasAddress,
  CreateAliasInput,
  CreateAliasResult,
  DeleteAliasResult,
  ListAliasesInput,
  ListAliasesResult,
  SetAliasDisabledInput,
  UpdateAliasDetailsInput,
  UpdateAliasResult,
} from "./schema";

export type AliasStatus = "enabled" | "disabled" | "missing";

/** エイリアスの操作。MCP・管理 API・メール受信が共有する。 */
export interface AliasStore {
  /** 登録の有無と有効・無効。 */
  status(address: AliasAddress): Promise<AliasStatus>;
  /** 既存のアドレスは変更せず、そのまま返す。 */
  create(input: CreateAliasInput): Promise<CreateAliasResult>;
  list(input: ListAliasesInput): Promise<ListAliasesResult>;
  /** 無効化を繰り返しても最初の無効化日時を保つ。 */
  setDisabled(input: SetAliasDisabledInput): Promise<UpdateAliasResult>;
  /** 省略した項目は変更しない。 */
  updateDetails(input: UpdateAliasDetailsInput): Promise<UpdateAliasResult>;
  delete(address: AliasAddress): Promise<DeleteAliasResult>;
}

export function createAliasStore(db: SqliteClient): AliasStore {
  return {
    async status(address) {
      const alias = await findAlias(db, address);
      if (alias === null) return "missing";
      return alias.disabled_at === null ? "enabled" : "disabled";
    },

    async create(input) {
      const created = await insertAlias(db, input);
      if (created !== null) return { created: true, alias: created };

      const existing = await findAlias(db, input.address);
      if (existing === null) {
        throw new Error(`Alias was deleted while being created: ${input.address}`);
      }
      return { created: false, alias: existing };
    },

    async list({ limit, offset, ...filter }) {
      // 1 件多く取得して、次のページの有無を判定する
      const rows = await listAliasRows(db, { ...filter, limit: limit + 1, offset });
      return {
        aliases: rows.slice(0, limit),
        next_offset: rows.length > limit ? offset + limit : null,
      };
    },

    async setDisabled({ address, disabled }) {
      return toUpdateResult(await updateDisabled(db, address, disabled));
    },

    async updateDetails({ address, note, service_url }) {
      return toUpdateResult(await updateDetails(db, address, { note, service_url }));
    },

    async delete(address) {
      return { address, deleted: await deleteAliasRow(db, address) };
    },
  };
}

function toUpdateResult(alias: Alias | null): UpdateAliasResult {
  return alias === null ? { updated: false, alias: null } : { updated: true, alias };
}
