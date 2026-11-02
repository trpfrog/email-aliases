import { useState } from "react";
import useSWRImmutable from "swr/immutable";
import { settingsApi, type Settings } from "../api/settings";

/**
 * アプリ全体の設定の取得と変更。
 * 変更は成功時に通知用のメッセージを返し、失敗時は表示用のメッセージを持つ Error を投げる。
 */
export function useSettings() {
  const { data, error, isLoading, mutate } = useSWRImmutable<Settings, Error>(
    "/api/settings",
    settingsApi.get,
    { shouldRetryOnError: false },
  );
  const [pending, setPending] = useState(false);

  return {
    settings: data,
    error: error?.message ?? "",
    loading: isLoading,
    busy: pending,

    setDropDryRun: async (enabled: boolean) => {
      setPending(true);
      try {
        await mutate(await settingsApi.setDropDryRun(enabled), { revalidate: false });
        return enabled ? "ドライランを始めました" : "ドライランを終了しました";
      } finally {
        setPending(false);
      }
    },
  };
}
