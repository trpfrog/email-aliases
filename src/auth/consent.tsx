import type { ConsentDescription } from "@cloudflare/workers-oauth-provider";
import { DOMAIN } from "../config";

export function ConsentPage({ details, handle }: { details: ConsentDescription; handle: string }) {
  return (
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <title>Email Aliases 接続承認</title>
      </head>
      <body>
        <h1>{details.clientName} の接続を許可しますか？</h1>
        <p>{DOMAIN} のアドレスの作成・一覧・削除を許可します。</p>
        <p>クライアント: {details.clientDomain ?? "自己申告（未検証）"}</p>
        <p>
          アクセスの送信先: <strong>{details.redirectHost}</strong>
        </p>
        {details.redirectIsLoopback && (
          <p>
            このコンピューターのアプリにアクセスを渡します。自分で開始した接続か確認してください。
          </p>
        )}
        <p>要求された権限: {details.scope.join(", ")}</p>
        <form method="post">
          <input type="hidden" name="handle" value={handle} />
          <button name="decision" value="approve">
            許可
          </button>
          <button name="decision" value="deny">
            拒否
          </button>
        </form>
      </body>
    </html>
  );
}
