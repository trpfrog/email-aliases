import {
  DetailedError,
  hc,
  parseResponse,
  type ClientResponse,
  type InferRequestType,
} from "hono/client";
import { z } from "zod";
import type { AdminApi } from "../../admin/api";

export type { Alias } from "../../aliases/schema";

const aliases = hc<AdminApi>("/", { init: { credentials: "same-origin" } }).api.aliases;

export type CreateAliasRequest = InferRequestType<typeof aliases.$post>["json"];
export type UpdateAliasRequest = InferRequestType<typeof aliases.$patch>["json"];
export type UpdateDetailsRequest = Exclude<UpdateAliasRequest, { disabled: boolean }>;

const errorBody = z.object({ data: z.object({ error: z.string() }) });

/** API のエラーを、画面にそのまま表示できるメッセージの Error に変換する。 */
function toDisplayError(error: unknown): Error {
  if (error instanceof DetailedError) {
    if (error.statusCode === 401) {
      return new Error("認証の有効期限が切れました。ページを再読み込みしてください。");
    }
    const body = errorBody.safeParse(error.detail);
    if (body.success) return new Error(body.data.data.error);
  }
  return new Error("通信に失敗しました。再度お試しください。", { cause: error });
}

async function request<T extends ClientResponse<unknown>>(response: Promise<T>) {
  try {
    return await parseResponse(response);
  } catch (error) {
    throw toDisplayError(error);
  }
}

export const aliasApi = {
  list: (offset: number) => request(aliases.$get({ query: { offset: String(offset) } })),
  create: (json: CreateAliasRequest) => request(aliases.$post({ json })),
  update: (json: UpdateAliasRequest) => request(aliases.$patch({ json })),
  delete: (address: string) => request(aliases.$delete({ json: { address } })),
};
