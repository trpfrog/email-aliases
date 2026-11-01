import { useState } from "react";
import useSWRInfinite from "swr/infinite";
import { receivedApi, type ReceivedFilter } from "../api/received";

type PageKey = readonly ["/api/received", ReceivedFilter, number];

/**
 * 受信履歴の取得と削除。ページ単位で読み込み、`loadMore` で続きを取得する。
 * 削除は成功時に通知用のメッセージを返し、失敗時は表示用のメッセージを持つ Error を投げる。
 */
export function useReceivedEmails(filter: ReceivedFilter) {
  const { data, error, isLoading, isValidating, mutate, size, setSize } = useSWRInfinite<
    Awaited<ReturnType<typeof receivedApi.list>>,
    Error
  >(
    (index, previous: Awaited<ReturnType<typeof receivedApi.list>> | null): PageKey | null => {
      if (index === 0) return ["/api/received", filter, 0];
      if (previous?.next_offset == null) return null;
      return ["/api/received", filter, previous.next_offset];
    },
    ([, pageFilter, offset]: PageKey) => receivedApi.list(pageFilter, offset),
    { revalidateOnFocus: false, revalidateFirstPage: false, shouldRetryOnError: false },
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

  const pages = data ?? [];
  const hasMore = pages.at(-1)?.next_offset != null;

  return {
    emails: pages.flatMap((page) => page.emails),
    error: error?.message ?? "",
    loading: isLoading || isValidating,
    busy: pendingCount > 0,
    hasMore,
    loadMore: () => void setSize(size + 1),
    refresh: () => void mutate(),

    remove: (id: number) =>
      change(async () => {
        await receivedApi.delete(id);
        return "履歴を削除しました";
      }),
    clear: () =>
      change(async () => {
        const { deleted } = await receivedApi.clear(filter);
        return `${deleted} 件の履歴を削除しました`;
      }),
  };
}
