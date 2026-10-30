import type { SqliteClient } from "reylo";
import type { z } from "zod";
import type {
  AliasAddress,
  createAliasSchema,
  listAliasesSchema,
  setAliasDisabledSchema,
  updateAliasNoteSchema,
} from "./schema";
import createAlias from "./queries/create.sql";
import deleteAlias from "./queries/delete.sql";
import getAlias from "./queries/get.sql";
import listAliases from "./queries/list.sql";
import setDisabled from "./queries/set-disabled.sql";
import updateNote from "./queries/update-note.sql";

// Reylo がマイグレーション適用後のスキーマからクエリの引数と結果の型を推論する。
export function createAliasStore(db: SqliteClient) {
  return {
    async has(address: AliasAddress): Promise<boolean> {
      const alias = await getAlias.run(db, { address });
      return alias !== null && alias.disabled_at === null;
    },

    async create(input: z.output<typeof createAliasSchema>) {
      const row = await createAlias.run(db, input);

      return {
        created: row !== null,
        alias: row ?? (await getAlias.run(db, { address: input.address })),
      };
    },

    async list({ limit, offset }: z.output<typeof listAliasesSchema>) {
      const rows = await listAliases.run(db, { limit: limit + 1, offset });

      return {
        aliases: rows.slice(0, limit),
        next_offset: rows.length > limit ? offset + limit : null,
      };
    },

    async setDisabled({ address, disabled }: z.output<typeof setAliasDisabledSchema>) {
      const alias = await setDisabled.run(db, { address, disabled: disabled ? 1 : 0 });
      return { updated: alias !== null, alias };
    },

    async updateNote(input: z.output<typeof updateAliasNoteSchema>) {
      const alias = await updateNote.run(db, input);
      return { updated: alias !== null, alias };
    },

    async delete(address: AliasAddress) {
      const row = await deleteAlias.run(db, { address });

      return { address, deleted: row !== null };
    },
  };
}

export type AliasStore = ReturnType<typeof createAliasStore>;
