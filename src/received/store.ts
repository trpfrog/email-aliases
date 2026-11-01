import type { SqliteClient } from "reylo";
import type { AliasAddress } from "../aliases/schema";
import {
  clearReceivedRows,
  deleteReceivedRow,
  insertReceivedEmail,
  listReceivedRows,
} from "./queries";
import {
  RECEIVED_LIMITS,
  type ClearReceivedEmailsResult,
  type DeleteReceivedEmailResult,
  type ListReceivedEmailsInput,
  type ListReceivedEmailsResult,
  type ReceivedFilter,
  type ReceivedOutcome,
} from "./schema";

/** 受信履歴の操作。メール受信が記録し、MCP・管理 API が参照・削除する。 */
export interface ReceivedEmailStore {
  /** 記録したら true。未登録の宛先は、直近 1 時間の件数が上限に達していれば記録しない。 */
  record(input: {
    recipient: AliasAddress;
    sender: string;
    size: number;
    outcome: ReceivedOutcome;
  }): Promise<boolean>;
  /** 新しい順に返す。 */
  list(input: ListReceivedEmailsInput): Promise<ListReceivedEmailsResult>;
  delete(id: number): Promise<DeleteReceivedEmailResult>;
  /** 絞り込みに一致する履歴をまとめて削除する。 */
  clear(filter: ReceivedFilter): Promise<ClearReceivedEmailsResult>;
}

export function createReceivedEmailStore(db: SqliteClient): ReceivedEmailStore {
  return {
    async record({ sender, ...input }) {
      return await insertReceivedEmail(db, {
        ...input,
        sender: sender.slice(0, RECEIVED_LIMITS.sender),
      });
    },

    async list({ filter, limit, offset }) {
      // 1 件多く取得して、次のページの有無を判定する
      const rows = await listReceivedRows(db, { filter, limit: limit + 1, offset });
      return {
        emails: rows.slice(0, limit),
        next_offset: rows.length > limit ? offset + limit : null,
      };
    },

    async delete(id) {
      return { id, deleted: await deleteReceivedRow(db, id) };
    },

    async clear(filter) {
      return { deleted: await clearReceivedRows(db, filter) };
    },
  };
}
