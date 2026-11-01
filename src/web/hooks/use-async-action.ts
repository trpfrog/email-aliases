import { useState } from "react";

/** 非同期の操作の実行中フラグと、失敗時に表示するメッセージを管理する。 */
export function useAsyncAction<Args extends unknown[]>(action: (...args: Args) => Promise<void>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  /** 成功したら true を返す。 */
  async function run(...args: Args): Promise<boolean> {
    setPending(true);
    setError("");
    try {
      await action(...args);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作に失敗しました。");
      return false;
    } finally {
      setPending(false);
    }
  }

  return { run, pending, error };
}
