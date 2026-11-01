import { useState } from "react";
import useSWRImmutable from "swr/immutable";
import {
  aliasApi,
  type Alias,
  type CreateAliasRequest,
  type UpdateDetailsRequest,
} from "../api/aliases";

async function fetchAllAliases(): Promise<Alias[]> {
  const rows: Alias[] = [];
  let offset: number | null = 0;
  while (offset !== null) {
    const page = await aliasApi.list(offset);
    rows.push(...page.aliases);
    offset = page.next_offset;
  }
  return rows;
}

/**
 * エイリアス一覧の取得と変更。
 * 変更系の操作は成功時に通知用のメッセージを返し、失敗時は表示用のメッセージを持つ Error を投げる。
 */
export function useAliases() {
  const { data, error, isLoading, isValidating, mutate } = useSWRImmutable<Alias[], Error>(
    "/api/aliases",
    fetchAllAliases,
    { shouldRetryOnError: false },
  );
  const [pendingCount, setPendingCount] = useState(0);

  async function change(operation: () => Promise<string>): Promise<string> {
    setPendingCount((count) => count + 1);
    try {
      const message = await operation();
      await mutate();
      return message;
    } finally {
      setPendingCount((count) => count - 1);
    }
  }

  return {
    aliases: data ?? [],
    error: error?.message ?? "",
    loading: isLoading || isValidating,
    busy: pendingCount > 0,
    refresh: () => mutate(),

    create: (input: CreateAliasRequest) =>
      change(async () =>
        (await aliasApi.create(input)).created ? "追加しました" : "登録済みのアドレスです",
      ),
    updateDetails: (input: UpdateDetailsRequest) =>
      change(async () => {
        await aliasApi.update(input);
        return "登録情報を更新しました";
      }),
    setDisabled: (address: string, disabled: boolean) =>
      change(async () => {
        await aliasApi.update({ address, disabled });
        return disabled ? "無効化しました" : "有効化しました";
      }),
    remove: (address: string) =>
      change(async () => {
        await aliasApi.delete(address);
        return "削除しました";
      }),
  };
}
