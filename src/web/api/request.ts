import { DetailedError, hc, parseResponse, type ClientResponse } from "hono/client";
import { z } from "zod";
import type { AdminApi } from "../../admin/api";

/** 管理 API のクライアント。型は `AdminApi` から共有する。 */
export const api = hc<AdminApi>("/", { init: { credentials: "same-origin" } }).api;

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

/** レスポンスを解釈し、失敗時は表示用のメッセージを持つ Error を投げる。 */
export async function request<T extends ClientResponse<unknown>>(response: Promise<T>) {
  try {
    return await parseResponse(response);
  } catch (error) {
    throw toDisplayError(error);
  }
}
