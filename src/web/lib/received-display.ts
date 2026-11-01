import type { ReceivedEmail, ReceivedFilter } from "../api/received";

/** 画面で選べる絞り込み。MCP では未登録・無効だけに絞ることもできる。 */
export type ReceivedViewFilter = Extract<ReceivedFilter, "all" | "forwarded" | "dropped">;

export const RECEIVED_FILTER_LABELS = {
  all: "すべて",
  forwarded: "転送",
  dropped: "ドロップ",
} as const satisfies Record<ReceivedViewFilter, string>;

export const OUTCOME_BADGES = {
  forwarded: { label: "転送", color: "teal" },
  disabled: { label: "無効", color: "gray" },
  unknown: { label: "未登録", color: "orange" },
} as const satisfies Record<ReceivedEmail["outcome"], { label: string; color: string }>;

const dateTimeFormat = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** `shop@example.com` の @ より前。 */
export function localPartOf(address: string): string {
  const at = address.lastIndexOf("@");
  return at === -1 ? address : address.slice(0, at);
}
