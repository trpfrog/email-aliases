import { hc, parseResponse, type InferResponseType } from "hono/client";
import type { AdminApi } from "../../admin/routes";

const client = hc<AdminApi>("/", {
  init: { credentials: "same-origin" },
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await fetch(input, init);
    if (!response.ok) {
      if (response.status === 401)
        throw new Error("認証の有効期限が切れました。ページを再読み込みしてください。");
      const data = await response.json().catch(() => ({}));
      const message =
        data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : "読み込みに失敗しました。";
      throw new Error(message);
    }
    return response;
  },
}).api.aliases;

export type Alias = InferResponseType<typeof client.$get, 200>["aliases"][number];

export const aliasApi = {
  list: (offset: number) => parseResponse(client.$get({ query: { offset: String(offset) } })),
  create: (address: string, note: string, service_url: string) =>
    parseResponse(client.$post({ json: { address, note, service_url } })),
  delete: (address: string) => parseResponse(client.$delete({ json: { address } })),
  setDisabled: (address: string, disabled: boolean) =>
    parseResponse(client.$patch({ json: { address, disabled } })),
  updateDetails: (address: string, note: string, service_url: string) =>
    parseResponse(client.$patch({ json: { address, note, service_url } })),
};
