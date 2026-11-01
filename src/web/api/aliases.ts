import type { InferRequestType } from "hono/client";
import { api, request } from "./request";

export { ALIAS_LIMITS, type Alias } from "../../aliases/schema";

const aliases = api.aliases;

export type CreateAliasRequest = InferRequestType<typeof aliases.$post>["json"];
export type UpdateDetailsRequest = InferRequestType<typeof aliases.$patch>["json"];

export const aliasApi = {
  list: (offset: number) => request(aliases.$get({ query: { offset: String(offset) } })),
  create: (json: CreateAliasRequest) => request(aliases.$post({ json })),
  updateDetails: (json: UpdateDetailsRequest) => request(aliases.$patch({ json })),
  setDisabled: (address: string, disabled: boolean) =>
    request(aliases.disabled.$put({ json: { address, disabled } })),
  delete: (address: string) => request(aliases.$delete({ json: { address } })),
};
