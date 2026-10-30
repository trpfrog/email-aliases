import type { AliasStore } from "../../aliases/store";

export type Alias = Awaited<ReturnType<AliasStore["list"]>>["aliases"][number];

async function api<T>(method = "GET", body?: unknown, offset = 0): Promise<T> {
  const response = await fetch(`/api/aliases?offset=${offset}`, {
    method,
    credentials: "same-origin",
    ...(body
      ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      : {}),
  });
  if (!response.ok) {
    if (response.status === 401)
      throw new Error("認証の有効期限が切れました。ページを再読み込みしてください。");
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? "読み込みに失敗しました。");
  }
  return response.json();
}

export const aliasApi = {
  list: (offset: number) => api<Awaited<ReturnType<AliasStore["list"]>>>("GET", undefined, offset),
  create: (address: string, note: string) =>
    api<Awaited<ReturnType<AliasStore["create"]>>>("POST", { address, note }),
  delete: (address: string) =>
    api<Awaited<ReturnType<AliasStore["delete"]>>>("DELETE", { address }),
};
