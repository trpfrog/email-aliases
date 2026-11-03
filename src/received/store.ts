import type { SqliteClient } from "reylo";
import type { AliasAddress } from "../aliases/schema";
import {
  clearReceivedRows,
  deleteReceivedRow,
  insertReceivedEmail,
  listAliasActivityRows,
  listReceivedRows,
} from "./queries";
import {
  RECEIVED_LIMITS,
  type ClearReceivedEmailsResult,
  type DeleteReceivedEmailResult,
  type ListAliasActivityInput,
  type ListAliasActivityResult,
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
    /** drop と判定したが、ドライラン中だったため転送した。 */
    dry_run: boolean;
    /** 転送先のメールサーバーが恒久的に拒否したときの理由。省略すると拒否されていないものとする。 */
    forward_rejection?: string;
  }): Promise<boolean>;
  /** 新しい順に返す。 */
  list(input: ListReceivedEmailsInput): Promise<ListReceivedEmailsResult>;
  delete(id: number): Promise<DeleteReceivedEmailResult>;
  /** 絞り込みに一致する履歴をまとめて削除する。 */
  clear(filter: ReceivedFilter): Promise<ClearReceivedEmailsResult>;
  /** 登録済みのエイリアスごとの受信状況。受信のないエイリアスも含める。 */
  activity(input: ListAliasActivityInput): Promise<ListAliasActivityResult>;
}

export function createReceivedEmailStore(db: SqliteClient): ReceivedEmailStore {
  return {
    async record({ sender, forward_rejection, ...input }) {
      return await insertReceivedEmail(db, {
        ...input,
        sender: sender.slice(0, RECEIVED_LIMITS.sender),
        forward_rejection: forward_rejection?.slice(0, RECEIVED_LIMITS.forwardRejection),
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

    async activity({ sort, limit, offset }) {
      // 1 件多く取得して、次のページの有無を判定する
      const rows = await listAliasActivityRows(db, { sort, limit: limit + 1, offset });
      return {
        aliases: rows.slice(0, limit),
        next_offset: rows.length > limit ? offset + limit : null,
      };
    },
  };
}
