import { useState } from "react";
import useSWRImmutable from "swr/immutable";
import { aliasApi, type Alias } from "../api/aliases";

async function fetchAliases() {
  const rows: Alias[] = [];
  let offset: number | null = 0;
  do {
    const page = await aliasApi.list(offset);
    rows.push(...page.aliases);
    offset = page.next_offset;
  } while (offset !== null);
  return rows;
}

export function useAliases() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const {
    data: aliases = [],
    isLoading,
    isValidating,
    mutate: revalidate,
  } = useSWRImmutable("/api/aliases", fetchAliases, {
    shouldRetryOnError: false,
    onSuccess: () => setError(""),
    onError: (err: unknown) =>
      setError(err instanceof Error ? err.message : "読み込みに失敗しました。"),
  });

  async function refresh() {
    setError("");
    try {
      await revalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました。");
    }
  }

  async function mutate(operation: () => Promise<string>) {
    setSaving(true);
    setError("");
    try {
      setNotice(await operation());
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作に失敗しました。");
      return false;
    } finally {
      setSaving(false);
    }
  }

  return {
    aliases,
    loading: isLoading || isValidating,
    saving,
    error,
    notice,
    refresh,
    clearError: () => setError(""),
    clearNotice: () => setNotice(""),
    create: (address: string, note: string, serviceUrl: string) =>
      mutate(async () => {
        const result = await aliasApi.create(address, note, serviceUrl);
        return result.created ? "追加しました" : "登録済みのアドレスです";
      }),
    updateDetails: (address: string, note: string, serviceUrl: string) =>
      mutate(async () => {
        await aliasApi.updateDetails(address, note, serviceUrl);
        return "登録情報を更新しました";
      }),
    setDisabled: (address: string, disabled: boolean) =>
      mutate(async () => {
        await aliasApi.setDisabled(address, disabled);
        return disabled ? "無効化しました" : "有効化しました";
      }),
    remove: (address: string) =>
      mutate(async () => {
        await aliasApi.delete(address);
        return "削除しました";
      }),
  };
}
