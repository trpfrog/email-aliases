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
├── index.ts              # Worker の入口と依存の組み立て
├── index.test.mjs        # OAuth/MCP の結合テスト
├── config.ts             # ドメイン・パス・権限の共通定義
├── env.ts                # Worker bindings の型
├── aliases/
│   ├── schema.ts         # 入力検証と正規化
│   ├── store.ts          # エイリアスの作成・一覧・更新・削除・有効状態の確認
│   ├── store.test.ts     # SQLite と MCP を使った操作・受信判断のテスト
│   └── queries/*.sql     # Reylo が型推論する SQL
├── email/handler.ts      # 有効な登録済み宛先なら転送、未登録・無効なら drop
├── admin/routes.ts       # 管理画面と JSON API の Basic 認証・Origin 検証
├── web/
│   ├── main.tsx          # React の起動
│   ├── app.tsx           # 画面の組み立て
│   ├── theme.ts          # Mantine の緑テーマ・標準フォント
│   ├── api/              # 型付き API クライアント
│   ├── hooks/            # 一覧取得と追加・削除の状態管理
│   ├── components/
│   │   ├── aliases/      # 見出し・検索欄・テーブル・行・空状態・ダイアログ
│   │   ├── layout/       # 共通ヘッダー・フッター
│   │   └── feedback/     # 操作結果の通知
│   └── tsconfig.json     # DOM・React 用の型検査設定
├── mcp/
│   ├── server.ts         # MCP ツール定義
│   ├── http.ts           # HTTP transport・scope・Origin の検証
│   └── http.test.ts
└── auth/
    ├── routes.ts         # Basic 認証と OAuth の承認処理
    ├── consent.tsx       # hono/jsx の接続承認ページ
    └── consent.test.ts   # JSX の表示・エスケープ
```

テストは実装の隣に置く。Worker 全体の OAuth/MCP 結合テストは `src/index.test.mjs` に置く。

MCP とメール受信は同じ store を使い、SQL は `queries/` に集約する。
store には DB クライアント、メール受信には存在確認だけを渡す。
認証と通信処理を変更しても、エイリアス操作の実装に手を入れる必要はない。

## SQL と型検査

Reylo が `.sql` のパラメーター・行の型・結果件数を推論するため、DB の行の型は手書きしない。
`vp run db:prepare` は `migrations/*.sql` から型検査専用の `.reylo/schema.sqlite` を作り直す。
アプリのデータを持つ D1 とは別の使い捨て DB で、SQL とテーブル定義の整合性を確認する。
開発・ビルド・型検査・単体テストの各スクリプトから自動実行する。

Reylo の content mapper を使うため **TypeScript 7.1 Beta** を固定している。
VS Code では `TypeScriptTeam.native-preview` 拡張を入れ、ワークスペースの TypeScript と外部コードの実行を許可すると SQL の型を表示できる。
`.reylo/` はキャッシュと使い捨て DB のため Git 管理しない。

### VS Code で `.sql` の import が解決できない場合

1. `pnpm install`、`vp run typecheck` を実行する。型検査用の DB も準備される。
2. 推奨拡張の **TypeScript 7**（`TypeScriptTeam.native-preview`）をインストール・有効化する。
3. このリポジトリのルートを信頼済みワークスペースとして開く。
4. `Developer: Reload Window` を実行し、ワークスペースの TypeScript の使用と content mapper の外部コード実行の確認が出たら許可する。通知を見逃した場合は通知センターも確認する。
5. まだ解決しない場合は `TypeScript: Enable TypeScript 7` を実行し、出力パネルの **TypeScript 7** でワークスペースの TypeScript 7.1 が使われているか確認する。

`.vscode/settings.json` はワークスペースの TypeScript と content mapper の有効化を指定し、`.vscode/extensions.json` に必要な拡張を推薦している。
拡張内蔵の TypeScript 7.0 は content mapper に対応しないため、Reylo の SQL import にはワークスペースの 7.1 が必要。

`SqliteClient` を `PostgresClient` に渡せないというエラーの場合は、Reylo の SQLite 解析エンジンが読み込めていない可能性がある。読み込み失敗時の代替の型が Postgres になるため、実際の原因は `.sql` ファイルの診断も確認する。
特にエディターから起動する `node` が 20 系の場合、必須の `node:sqlite` がない。mise 向けに `.tool-versions` で Node 24.14.0 を指定しているので、`mise install` 後に VS Code を再起動する。シェルでの `node --version` だけでなく、VS Code 側の Node も 24 以上にする。

VS Code が古い Node の PATH を引き継いでいる場合、`Reload Window` では直らない。作業を保存して **VS Code の全ウィンドウを完全終了（macOS は ⌘Q）**してから、リポジトリで次を実行する。

```sh
mise exec node@24.14.0 -- code .
```

VS Code が既に起動していると既存プロセスの環境が再利用されるため、全終了してから実行する。

## MCP ツール

| ツール                 | 入力                               | 動作                                                    |
| ---------------------- | ---------------------------------- | ------------------------------------------------------- |
| `create_alias`         | `address`, `note?`, `service_url?` | 受信を許可。同じアドレスは変更しない                    |
| `list_aliases`         | `limit?`, `offset?`                | アドレス順に一覧。`next_offset` で次ページを取得        |
| `delete_alias`         | `address`                          | 登録を削除。以後のメールを drop                         |
| `set_alias_disabled`   | `address`, `disabled`              | `true` で転送停止、`false` で再開。登録情報は保持       |
| `update_alias_note`    | `address`, `note`                  | メモを編集。空文字で消去。有効状態は変更しない          |
| `update_alias_details` | `address`, `note?`, `service_url?` | メモ・サービス URL を編集。省略項目は保持、空文字で消去 |

一覧には無効なエイリアスも含む。`disabled_at` が `null` なら有効、日時が入っていれば無効。
無効化を繰り返しても日時は維持され、有効化すると `null` に戻る。
既存アドレスを `create_alias` で再登録してもメモ・サービス URL・無効状態は変わらない。
`service_url` は任意の HTTP(S) URL（最大 2048 文字）。未設定は空文字で表す。

`address` は `shopping@mail.example.com` のようなドメインを含む完全なアドレス。前後の空白を除去して小文字にする。
Web UI では `@` より前だけを入力し、UI 側でドメインを付けて API に送信する。
ASCII のドット区切りのローカルパート（最大 64 文字）のみ対応し、`*` は使えない。
完全一致で判定するため、`shopping` の登録で `shopping+news` は許可されない。
転送先は全アドレス共通で、Cloudflare で確認済みの受信箱を指定する。
転送ループ防止のため `mail.example.com` 自体は転送先に指定できない。
DB の参照失敗や転送エラーは握りつぶさず、Worker の失敗として扱う。

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
`PATCH /api/aliases` は `{ address, disabled: boolean }` または `{ address, note?: string, service_url?: string }` を受け付ける。
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
vp run test:integration # 一時ディレクトリで cf dev・D1・KV を起動して OAuth/MCP を検証
vp run build      # cf build（アップロードなし）
```

`db:prepare` はマイグレーションと準備スクリプトを入力に、型検査用 DB を出力にキャッシュする。
`dev`・`deploy`・`db:migrate:local`・`test:integration` はキャッシュせず毎回実行する。
`vp check` / `vp test` / `vp build` は Vite+ の組み込みコマンドなので、プロジェクトのタスクは `vp run` 経由で実行する。

### テストの書き方

Vite+ 同梱の Vitest を使い、API は `vite-plus/test` から明示的に import する。
`unit` と `integration` の test project を分け、通常の `vp run test` では単体テスト、
`vp run test:integration` ではローカル Worker を起動する結合テストを実行する。

- DB・MCP 接続・モックは `test.extend` の fixture でテストごとに作る。接続の解放は `onCleanup` に登録し、準備の途中で失敗しても後片付けする。
- fixture を使うパラメーター化テストは、第二引数で test context を受け取れる `test.for` を使う。
- 非同期の assertion は必ず `await` する。起動待ちは固定時間の sleep ではなく `vi.waitUntil` で状態を確認する。
- SQL の型 assertion は `*.test-d.ts` に置く。`vp run typecheck`（`vp run check` にも含む）で Reylo の content mapper を有効にして検査する。`vp run test` 単独では型を検査しない。
- 実際の SQLite・MCP transport を使った既存の振る舞いの検証を保ち、HTTP adapter のテストでは store をモックする。

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
