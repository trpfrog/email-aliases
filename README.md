# Email Aliases

`*@mail.example.com` の受信許可リストを管理する、個人用の MCP サーバー。

```text
受信メール → Cloudflare Email Routing の Catch-all → Worker
                                                    └ D1 に宛先がある → 固定の受信箱へ転送
                                                    └ 宛先がない     → drop

ChatGPT → OAuth → /mcp → D1 の作成・一覧・削除
```

TypeScript / Hono / Vite+ / Cloudflare Workers / D1。
Worker は 1 つ、D1 は 1 テーブル。OAuth の保存先として KV を 1 つ使う。
ユーザー登録・管理画面・メール本文の保存はない。接続承認ページのみ Hono で返す。
開発・デプロイ・リソース操作には `cf` CLI を使う。

## MCP ツール

| ツール         | 入力                | 動作                                             |
| -------------- | ------------------- | ------------------------------------------------ |
| `create_alias` | `address`, `note?`  | 受信を許可。同じアドレスは変更しない             |
| `list_aliases` | `limit?`, `offset?` | アドレス順に一覧。`next_offset` で次ページを取得 |
| `delete_alias` | `address`           | 登録を削除。以後のメールを drop                  |

`address` は `shopping` または `shopping@mail.example.com`。前後の空白を除去して小文字にする。
ASCII のドット区切りのローカルパート（最大 64 文字）のみ対応し、`*` は使えない。
完全一致で判定するため、`shopping` の登録で `shopping+news` は許可されない。
転送先は全アドレス共通で、Cloudflare で確認済みの受信箱を指定する。
転送ループ防止のため `mail.example.com` 自体は転送先に指定できない。
DB の参照失敗や転送エラーは握りつぶさず、Worker の失敗として扱う。

## ローカル開発

Node.js 24 以降と pnpm 10 を用意する。

```sh
pnpm install
cp .dev.vars.example .dev.vars
# .dev.vars の ADMIN_PASSWORD と FORWARD_TO を設定する
pnpm db:migrate:local
pnpm dev
```

開発 URL は `http://localhost:5173`。`/health` で起動を確認できる。
D1 と KV は `.cloudflare/state` に保存される。ローカル操作は本番のデータを変更しない。
`cf` と Cloudflare Vite plugin は Beta 版を固定している。Vite+ の Vite を plugin と共有する。

```sh
pnpm check       # フォーマット・Lint・TypeScript
pnpm test        # MCP の実操作と SQLite を使った受信判定のテスト
pnpm build      # cf build（アップロードなし）
```

## 本番への配置

1. Cloudflare にログインし、D1 と KV を作成する。

   ```sh
   pnpm exec cf auth login
   pnpm exec cf d1 create --name email-aliases
   pnpm exec cf kv namespaces create --title email-aliases-oauth
   ```

2. `cloudflare.config.ts` を編集する。
   - D1 の `id` の本番側（`undefined`）を作成した database ID に置き換える。開発側の ID はそのままにする。
   - `OAUTH_KV` を `bindings.kv({ id: "作成した namespace ID" })` にする。
   - 本番の `PUBLIC_ORIGIN` を実際の HTTPS origin にする。例: `https://email-aliases.<subdomain>.workers.dev`。末尾の `/` やパスは含めない。

   ID を固定して、再デプロイ後も同じ DB・OAuth トークンを使う。

3. 本番 D1 にマイグレーションを適用する。`cf` は DB 名や binding 名ではなく **database ID** を受け取る。

   ```sh
   pnpm exec cf d1 migrations apply <database-id>
   ```

4. `.dev.vars` に長いランダムな `ADMIN_PASSWORD` と確認済み受信箱の `FORWARD_TO` を設定してデプロイする。このコマンドはファイル内の値を Worker Secrets にアップロードする。

   ```sh
   pnpm exec cf deploy --secrets-file .dev.vars
   ```

   `.dev.vars` は Git 管理対象外。`FORWARD_TO` は Cloudflare Email Routing の Destination Addresses で確認済みである必要がある。

5. ChatGPT から接続し、現在使っているアドレスを **先に** `create_alias` で登録する。

6. Cloudflare Email Routing で **`mail.example.com` の既存 Catch-all の転送先をこの Worker に変更**する。別途存在する個別ルールは Catch-all を迂回するため、許可リストの対象にしたいアドレスは個別ルールも整理する。

   切り替え時点で D1 にない宛先はすべて drop される。既存アドレスの登録と、登録済み・未登録の両方へのテスト送信を行う。

## ChatGPT から接続

ChatGPT の開発者向け MCP 接続で、デプロイした `https://<worker-origin>/mcp` を指定し、OAuth を選ぶ。
クライアント登録は CIMD と動的登録（DCR）に対応している。
ログインが開いたら Basic 認証のユーザー名 `admin` と `ADMIN_PASSWORD` を入力し、接続承認ページで許可する。
接続後は「shopping 用のアドレスを作って」「アドレスを一覧にして」「shopping を削除して」などで操作できる。

MCP の認証は OAuth 2.1（PKCE）で、Basic 認証はブラウザーで開く接続承認ページにだけ使う。
承認処理にはライブラリのブラウザーに紐づくワンタイムハンドルを使う。
パスワード変更は発行済み OAuth トークンを失効させない。すべての接続を失効させる場合は OAuth 用 KV を新規作成して binding を切り替え、再接続する。

参考: [Cloudflare CLI](https://developers.cloudflare.com/cf/projects/)、[Email Routing](https://developers.cloudflare.com/email-service/configuration/email-routing-addresses/)、[Workers OAuth Provider](https://github.com/cloudflare/workers-oauth-provider)、[ChatGPT MCP 認証](https://developers.openai.com/plugins/build/auth)。
