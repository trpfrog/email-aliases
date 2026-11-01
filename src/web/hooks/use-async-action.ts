import { useState } from "react";
import { errorMessage } from "../lib/error-message";

/** 非同期の操作の実行中フラグと、失敗時に表示するメッセージを管理する。 */
export function useAsyncAction<Args extends unknown[]>(action: (...args: Args) => Promise<void>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function run(...args: Args): Promise<void> {
    setPending(true);
    setError("");
    try {
      await action(...args);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  return { run, pending, error };
}
