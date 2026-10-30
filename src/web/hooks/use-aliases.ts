import { useEffect, useState } from "react";
import { aliasApi, type Alias } from "../api/aliases";

export function useAliases() {
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const rows: Alias[] = [];
      let offset: number | null = 0;
      do {
        const page = await aliasApi.list(offset);
        rows.push(...page.aliases);
        offset = page.next_offset;
      } while (offset !== null);
      setAliases(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

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
    loading,
    saving,
    error,
    notice,
    refresh,
    clearError: () => setError(""),
    clearNotice: () => setNotice(""),
    create: (address: string, note: string) =>
      mutate(async () => {
        const result = await aliasApi.create(address, note);
        return result.created ? "追加しました" : "登録済みのアドレスです";
      }),
    updateNote: (address: string, note: string) =>
      mutate(async () => {
        await aliasApi.updateNote(address, note);
        return "メモを更新しました";
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
