/** 画面に表示するエラーメッセージ。API クライアントは表示用のメッセージを持つ Error を投げる。 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "操作に失敗しました。";
}
