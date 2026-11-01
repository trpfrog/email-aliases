import type { Alias } from "../api/aliases";

/** `shop@example.com` を `["shop", "@example.com"]` に分ける。 */
export function splitAddress(address: string): [local: string, domain: string] {
  const at = address.lastIndexOf("@");
  return at === -1 ? [address, ""] : [address.slice(0, at), address.slice(at)];
}

/** リンクの表示用のホスト名。URL として解釈できなければそのまま返す。 */
export function hostnameOf(url: string): string {
  return URL.parse(url)?.hostname ?? url;
}

export function isDisabled(alias: Alias): boolean {
  return alias.disabled_at !== null;
}

export type AliasStatus = "enabled" | "disabled" | "all";

export function filterAliases(
  aliases: Alias[],
  { status, query }: { status: AliasStatus; query: string },
) {
  const needle = query.trim().toLowerCase();
  return aliases.filter(
    (alias) =>
      (status === "all" || isDisabled(alias) === (status === "disabled")) &&
      `${alias.address} ${alias.note} ${alias.service_url}`.toLowerCase().includes(needle),
  );
}
