# Email Aliases

`*@mail.example.com` の受信許可リストを管理する、個人用の MCP サーバー。

```text
受信メール → Cloudflare Email Routing の Catch-all → Worker
                                                    └ 有効な宛先がある → 固定の受信箱へ転送
                                                    └ 未登録・無効     → drop

ChatGPT → OAuth → /mcp → D1 の作成・一覧・更新・削除
```

TypeScript / React / SWR / Mantine / Hono（`hono/jsx`）/ Vite+ / SWC / React Compiler / Reylo / Cloudflare Workers / D1。
Worker は 1 つ、D1 は 1 テーブル。OAuth の保存先として KV を 1 つ使う。
`/` に React SPA の管理画面があり、一覧・検索・追加・メモとサービス URL の編集・無効化・有効化・削除に対応する。
ユーザー登録・メール本文の保存はない。接続承認ページは Hono で返す。
タスクは `vite.config.ts` の `run.tasks` に定義し、`vp run <タスク名>` で実行する。
開発・デプロイ・リソース操作には `cf` CLI を使う。

## コードの構成

```text
src/
├── index.ts                  # Worker の入口。OAuthProvider・MCP・メール受信を組み立てる
├── index.integration.test.ts # cf dev を起動する OAuth/MCP/管理 API の結合テスト
├── config.ts                 # ドメイン・パス・権限の共通定義
├── env.ts                    # Worker bindings の型
├── aliases/
│   ├── schema.ts             # 入力・結果・Alias の Zod スキーマ（MCP の outputSchema にも使う）
│   ├── store.ts              # SQL を扱う唯一の境界。AliasStore の型を明示する
│   ├── store.test-d.ts       # Alias と Reylo が推論する行の型の一致を検査
│   └── queries/*.sql         # Reylo が型推論する SQL
├── email/receive.ts          # 有効な登録済み宛先なら転送、未登録・無効なら drop
├── mcp/
│   ├── server.ts             # MCP ツール定義
│   └── handler.ts            # Streamable HTTP・scope・Origin の検証
├── http/
│   ├── app.ts                # OAuthProvider の defaultHandler（管理画面・API・承認・health）
│   ├── require-admin.ts      # Basic 認証
│   └── validate.ts           # Standard Schema による入力検証
├── admin/api.ts              # 管理 API と、hono/client と共有する AdminApi 型
├── auth/
│   ├── authorize.ts          # OAuth の接続承認
│   └── consent.tsx           # hono/jsx の接続承認ページ
├── test/                     # テスト用の fixture・モジュールの代替
└── web/                      # React SPA の管理画面
    ├── api/                  # Hono RPC の型付き API クライアント
    ├── hooks/                # 一覧の取得・変更、非同期操作の状態
    ├── lib/                  # 表示・絞り込み・フォームの補助関数
    └── components/           # 一覧・ダイアログ・通知・レイアウト
```

テストは実装の隣に置く。

MCP・管理 API・メール受信は同じ store を使い、SQL は `queries/` に集約する。
入力の検証は Zod のスキーマを `aliases/schema.ts` に置き、MCP では SDK に、HTTP では
`@hono/standard-validator`（Standard Schema）に渡す。検証ライブラリへの依存は `http/validate.ts` に閉じる。
管理画面は `admin/api.ts` の `AdminApi` 型を `hono/client` の `hc` に渡し、リクエスト・レスポンスの型を共有する。

## 型安全と Lint

`any`・型アサーション（`as`）・non-null アサーション（`!`）は lint で禁止している（`as const` は可）。
`vite.config.ts` の `lint` で oxlint の type-aware ルール（tsgolint）を有効にし、`vp run check` で検査する。
tsconfig は `strict` に加えて `noUncheckedIndexedAccess` を有効にしている。

tsgolint は TypeScript 7.0 ベースで content mapper に対応しないため、`.sql` の import は型が解決されない。
そこで `aliases/store.ts` を境界とし、外向きの型（`AliasStore`・`Alias`）を明示する。
この 2 ファイル（`store.ts`・`store.test-d.ts`）だけ `no-unsafe-*` 系のルールを外し、
手書きの型と Reylo の推論結果の一致は `store.test-d.ts` を tsc（content mapper あり）で検査して保証する。

## SQL と型検査

Reylo が `.sql` のパラメーター・行の型・結果件数を推論する。
`Alias` の型は store の外へ公開するために Zod で定義しているが、推論結果と一致しなければ型検査が失敗する。
`vp run db:prepare` は `migrations/*.sql` から型検査専用の使い捨て DB `.reylo/schema.sqlite` を作り直す（Git 管理外）。
開発・ビルド・型検査・単体テストの各タスクから自動実行する。

Reylo の content mapper を使うため **TypeScript 7.1 Beta** を固定している。

### VS Code で `.sql` の import が解決できない場合

拡張内蔵の TypeScript 7.0 は content mapper に対応しないため、ワークスペースの 7.1 を使う必要がある。

1. `pnpm install` と `vp run typecheck` を実行する。
2. 推奨拡張 **TypeScript 7**（`TypeScriptTeam.native-preview`）を入れ、リポジトリを信頼済みワークスペースとして開く。
3. `Developer: Reload Window` を実行し、ワークスペースの TypeScript の使用と外部コードの実行を許可する。
4. 型が `PostgresClient` 向けになる場合は、Reylo の SQLite エンジンが読み込めていない。
   VS Code から起動される Node が 24 未満（`node:sqlite` がない）なことが多いので、
   VS Code を完全終了（macOS は ⌘Q）してから `mise exec node@24.14.0 -- code .` で開き直す。

## MCP ツール

| ツール                 | 入力                               | 動作                                                    |
| ---------------------- | ---------------------------------- | ------------------------------------------------------- |
| `create_alias`         | `address`, `note?`, `service_url?` | 受信を許可。同じアドレスは変更しない                    |
| `list_aliases`         | `limit?`, `offset?`                | アドレス順に一覧。`next_offset` で次ページを取得        |
| `delete_alias`         | `address`                          | 登録を削除。以後のメールを drop                         |
| `set_alias_disabled`   | `address`, `disabled`              | `true` で転送停止、`false` で再開。登録情報は保持       |
| `update_alias_details` | `address`, `note?`, `service_url?` | メモ・サービス URL を編集。省略項目は保持、空文字で消去 |

一覧には無効なエイリアスも含む。`disabled_at` が `null` なら有効、日時が入っていれば無効。
無効化を繰り返しても日時は維持され、有効化すると `null` に戻る。
既存アドレスを `create_alias` で再登録してもメモ・サービス URL・無効状態は変わらない。
`service_url` は任意の HTTP(S) URL（最大 2048 文字）。未設定は空文字で表す。
各ツールは `outputSchema` を宣言し、結果を `structuredContent` で返す。

`address` は `shopping@mail.example.com` のようなドメインを含む完全なアドレス。前後の空白を除去して小文字にする。
Web UI では `@` より前だけを入力し、UI 側でドメインを付けて API に送信する。
ASCII のドット区切りのローカルパート（最大 64 文字）のみ対応し、`*` は使えない。
完全一致で判定するため、`shopping` の登録で `shopping+news` は許可されない。
転送先は全アドレス共通で、Cloudflare で確認済みの受信箱を指定する。
転送ループ防止のため `mail.example.com` 自体は転送先に指定できない。
`FORWARD_TO` の未設定・誤設定、DB の参照失敗や転送エラーは握りつぶさず、Worker の失敗として扱う。

## ローカル開発

Node.js 24 以降と pnpm 10 を用意する。`vp` を PATH に入れていない場合は `pnpm exec vp run <タスク名>` でも実行できる。

```sh
pnpm install
cp .dev.vars.example .dev.vars
# .dev.vars の ADMIN_PASSWORD と FORWARD_TO を設定する
vp run db:migrate:local
vp run dev
```

開発 URL は `http://localhost:5173`。`/health` で起動を確認できる。
`/` を開き、Basic 認証の `admin` と `ADMIN_PASSWORD` で管理画面にログインする。
検索はアドレス・メモ・サービス URL が対象。管理 API は `/api/aliases` で、MCP と同じ store を使う。
各行の「操作」から登録情報の編集・無効化・有効化・削除を選べる。一覧は「有効・無効・すべて」で切り替える。
サービス URL は追加・編集画面で入力でき、一覧のリンクから別タブで開ける。
一覧は SWR の `useSWRImmutable` でキャッシュし、初回表示・手動更新・追加や更新、削除の後に取得する。フォーカス復帰・再接続・エラー時の自動再取得は行わない。
`PATCH /api/aliases` は登録情報 `{ address, note?: string, service_url?: string }`、`PUT /api/aliases/disabled` は有効状態 `{ address, disabled: boolean }` を更新する。
登録情報の更新ではメモ・URL の少なくとも一方を指定する。省略した項目は変更しない。
追加・更新・削除は `PUBLIC_ORIGIN` と同じ Origin の JSON リクエストに限定する。
React 側の変換は SWC、最適化は SWC 内蔵の React Compiler を使う。
UI は Mantine のコンポーネントと style props、`theme.ts` で構成し、独自 CSS・外部フォントは使わない。
Hono の JSX と Worker・テストの変換は Vite 標準のまま維持する。
D1 と KV は `.cloudflare/state` に保存される。ローカル操作は本番のデータを変更しない。
`cf` と Cloudflare Vite plugin は Beta 版を固定している。Vite+ の Vite を plugin と共有する。

```sh
vp run check       # フォーマット・Lint・TypeScript
vp run typecheck   # マイグレーションから DB を作り、SQL と TypeScript を型検査
vp run test        # MCP・SQLite・受信判断・JSX・HTTP のテスト
vp run test:integration # 一時ディレクトリで cf dev・D1・KV を起動して OAuth/MCP/管理 API を検証
vp run build      # cf build（アップロードなし）
```

`db:prepare` はマイグレーションと準備スクリプトを入力に、型検査用 DB を出力にキャッシュする。
`dev`・`deploy`・`db:migrate:local`・`test:integration` はキャッシュせず毎回実行する。
`vp check` / `vp test` / `vp build` は Vite+ の組み込みコマンドなので、プロジェクトのタスクは `vp run` 経由で実行する。

### テストの書き方

Vite+ 同梱の Vitest を使い、API は `vite-plus/test` から明示的に import する。
`unit` と `integration` の test project を分け、通常の `vp run test` では単体テスト、
`vp run test:integration` ではローカル Worker を起動する結合テスト（`*.integration.test.ts`）を実行する。
結合テストは空いているポートで起動し、開発モードの `PUBLIC_ORIGIN` を環境変数 `DEV_PUBLIC_ORIGIN` で上書きする。
単体テストでは `cloudflare:workers` を `src/test/cloudflare-workers.ts` に差し替える。

- DB・MCP 接続・モックは `test.extend` の fixture でテストごとに作る。接続の解放は `onCleanup` に登録し、準備の途中で失敗しても後片付けする。
- fixture を使うパラメーター化テストは、第二引数で test context を受け取れる `test.for` を使う。
- 非同期の assertion は必ず `await` する。起動待ちは固定時間の sleep ではなく `vi.waitUntil` で状態を確認する。
- SQL の型 assertion は `*.test-d.ts` に置く。`vp run typecheck`（`vp run check` にも含む）で Reylo の content mapper を有効にして検査する。`vp run test` 単独では型を検査しない。
- store・メール受信・MCP ツールは実際の SQLite（`src/test/fixtures.ts` の `dbTest`）で検証し、MCP の HTTP ハンドラーのテストでは store をモックする。
- レスポンスや `structuredContent` は型アサーションではなく Zod のスキーマで parse して型を付ける。

参考: [Test Context](https://vitest.dev/guide/test-context)、[Testing Types](https://vitest.dev/guide/testing-types)、[Test Projects](https://vitest.dev/guide/projects)。

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

   既存環境の更新時も、デプロイ前に適用する。`0002_alias_disabled_at.sql` は既存の登録を有効なまま引き継ぐ。
   `0003_alias_service_url.sql` は既存の登録に未設定のサービス URL を追加する。

   ```sh
   pnpm exec cf d1 migrations apply <database-id>
   ```

4. `.dev.vars` に長いランダムな `ADMIN_PASSWORD` と確認済み受信箱の `FORWARD_TO` を設定してデプロイする。このコマンドはファイル内の値を Worker Secrets にアップロードする。

   ```sh
   vp run deploy --secrets-file .dev.vars
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

MCP の認証は OAuth 2.1（PKCE）で、Basic 認証は管理画面・管理 API・接続承認ページに使う。
承認処理にはライブラリのブラウザーに紐づくワンタイムハンドルを使う。
パスワード変更は発行済み OAuth トークンを失効させない。すべての接続を失効させる場合は OAuth 用 KV を新規作成して binding を切り替え、再接続する。

参考: [Cloudflare CLI](https://developers.cloudflare.com/cf/projects/)、[Email Routing](https://developers.cloudflare.com/email-service/configuration/email-routing-addresses/)、[Workers OAuth Provider](https://github.com/cloudflare/workers-oauth-provider)、[ChatGPT MCP 認証](https://developers.openai.com/plugins/build/auth)。
