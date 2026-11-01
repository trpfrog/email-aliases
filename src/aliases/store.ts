import type { SqliteClient } from "reylo";
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
import createAlias from "./queries/create.sql";
import deleteAlias from "./queries/delete.sql";
import getAlias from "./queries/get.sql";
import listAliases from "./queries/list.sql";
import setDisabled from "./queries/set-disabled.sql";
import updateDetails from "./queries/update-details.sql";

/**
 * エイリアスの永続化。MCP・管理 API・メール受信が共有する。
 *
 * SQL の型は Reylo（TypeScript の content mapper）が推論するため、型付きで扱えるのは tsc だけ。
 * このファイルを境界として外向きの型を明示し、推論結果との一致は store.test-d.ts で検査する。
 */
export interface AliasStore {
  /** 登録済みかつ有効なら true。 */
  isEnabled(address: AliasAddress): Promise<boolean>;
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
    async isEnabled(address) {
      const alias = await getAlias.run(db, { address });
      return alias !== null && alias.disabled_at === null;
    },

    async create(input) {
      const created = await createAlias.run(db, input);
      if (created !== null) return { created: true, alias: created };

      const existing = await getAlias.run(db, { address: input.address });
      if (existing === null)
        throw new Error(`Alias was deleted while being created: ${input.address}`);
      return { created: false, alias: existing };
    },

    async list({ limit, offset }) {
      const rows = await listAliases.run(db, { limit: limit + 1, offset });
      return {
        aliases: rows.slice(0, limit),
        next_offset: rows.length > limit ? offset + limit : null,
      };
    },

    async setDisabled({ address, disabled }) {
      return toUpdateResult(await setDisabled.run(db, { address, disabled: disabled ? 1 : 0 }));
    },

    async updateDetails({ address, note, service_url }) {
      const alias = await updateDetails.run(db, {
        address,
        note: note ?? "",
        service_url: service_url ?? "",
        update_note: note === undefined ? 0 : 1,
        update_service_url: service_url === undefined ? 0 : 1,
      });
      return toUpdateResult(alias);
    },

    async delete(address) {
      const row = await deleteAlias.run(db, { address });
      return { address, deleted: row !== null };
    },
  };
}

function toUpdateResult(alias: Alias | null): UpdateAliasResult {
  return alias === null ? { updated: false, alias: null } : { updated: true, alias };
}
