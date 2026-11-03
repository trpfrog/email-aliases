# AGENTS.md

概要とセットアップは README.md を参照。

## コマンド

タスクは `vite.config.ts` の `run.tasks` に定義している。`vp check` / `vp test` / `vp build` は Vite+ の組み込みコマンドなので、必ず `vp run` 経由で実行する。

```sh
vp run check            # フォーマット・Lint・型検査（変更後は必ず通す）
vp run test             # 単体テスト（型は検査しない）
vp run test:e2e         # cf dev を起動する E2E テスト
```

Cloudflare の操作には `wrangler` ではなく `cf` CLI を使う。

## 構成

```mermaid
flowchart TD
  index[src/index.ts<br/>OAuthProvider] --> mcp[mcp/handler.ts<br/>mcp/server.ts]
  index --> app[http/app.ts]
  index --> email[email/receive.ts]
  app --> admin[admin/api.ts]
  app --> auth[auth/authorize.ts<br/>auth/consent.tsx]
  web[web/<br/>React SPA] -. AdminApi 型 .-> admin
  mcp --> store[aliases/store.ts]
  admin --> store
  email --> store
  mcp --> received[received/store.ts]
  mcp --> settings[settings/store.ts]
  admin --> settings
  email --> settings
  settings --> ssql[settings/queries/*.sql]
  ssql --> D1
  admin --> received
  email --> received
  store --> sql[aliases/queries/*.sql]
  received --> rsql[received/queries/*.sql]
  sql --> D1[(D1)]
  rsql --> D1
```

- SQL を扱う境界はエイリアスの `src/aliases/store.ts`、受信履歴の `src/received/store.ts`、設定の `src/settings/store.ts` だけ。MCP・管理 API・メール受信はすべてこの store を使う。
- SQL は各ディレクトリの `queries/*.sql` に置き、Reylo が型を推論する。スキーマ変更は `migrations/` に追加する。Reylo は SQLite の CHECK 制約から union を推論しないため、そうした列は `queries.ts` で Zod により検証する。
- 入力のスキーマは Zod で `src/aliases/schema.ts`・`src/received/schema.ts`・`src/settings/schema.ts` に置く。検証ライブラリへの依存は `src/http/validate.ts` に閉じる。
- ドメイン・表示名・テーマカラーは `app.config.ts`、デプロイ先は `deploy.config.ts` に置く。`cloudflare.config.ts` の依存は開発サーバーから読めないため、Worker が読む設定を `deploy.config.ts` 側に入れない。コードに直接書かず、`src/config.ts` の `MAIL_DOMAIN`・`APP_NAME` などを使う。本番のドメインはリポジトリに載せず、ビルド時の環境変数 `MAIL_DOMAIN` で渡す（`vite.config.ts` の `define`）。単体テストのドメインは `src/test/setup.ts` で `mail.example.test` に固定している。
- 運用中に切り替える設定（ドライランなど）は、ビルド時の設定や環境変数ではなく D1 の `settings` テーブル（`src/settings/store.ts`）に置き、管理画面・MCP から変更する。デプロイは GitHub Release を経るため、切り替えのたびにリリースしなくて済むようにする。D1 は読み取った行数で課金されるため、設定は 1 行を主キーで読み、必要な場合（例: drop と判定したメール）だけ読む。インスタンスごとにキャッシュすると切り替えがすぐに効かないため、キャッシュしない。
- 管理画面（`src/web/`）は `src/admin/api.ts` の `AdminApi` 型を `hono/client` に渡して型を共有する。
- 管理画面の UI は Mantine のコンポーネントと style props、`theme.ts` で作る。独自 CSS・外部フォントは使わない。

## 型安全

- `any`・型アサーション（`as`）・non-null アサーション（`!`）は禁止（`as const` は可）。
- 例外は `src/aliases/queries.ts`・`src/received/queries.ts`・`src/settings/queries.ts` と各 `store.test-d.ts` のみ。tsgolint は `.sql` の import を解決できないため、queries の外向きの型を明示し、Reylo の推論との一致を `store.test-d.ts` で検査する。
- TypeScript 7.1 Beta、`cf`、Cloudflare Vite plugin はバージョンを固定している。勝手に上げない。

## テスト

- テストは実装の隣に置く。単体テストは `*.test.ts`、cf dev を起動する E2E テストは `*.spec.ts`（共通の起動処理は `src/test/e2e/`）、型テストは `*.test-d.ts`。
- API は `vite-plus/test` から明示的に import する。
- DB・MCP 接続・モックは `test.extend` の fixture でテストごとに作り、解放は `onCleanup` に登録する。fixture を使うパラメーター化テストは `test.for` を使う。
- 非同期の assertion は必ず `await` する。待機は固定 sleep ではなく `vi.waitUntil` を使う（`vi` を使えない E2E の globalSetup だけはポーリングで待つ）。
- store・メール受信・MCP ツールは実際の SQLite（`src/test/fixtures.ts` の `dbTest`）で検証する。MCP の HTTP ハンドラーのテストでは store をモックする。
- レスポンスや `structuredContent` は型アサーションではなく Zod のスキーマで parse する。

## 注意

- 一文だけのコメントは文末に「。」を付けない。
- 転送エラーや DB の参照失敗は握りつぶさず、Worker の失敗として扱う。例外は 2 つある。転送した後の受信履歴の記録は、再送による二重の転送を避けるためログに残して成功として扱う。転送先のメールサーバーの恒久的な拒否（5xx）は、Worker の失敗にすると一時的なエラーとして再送が続くため、`setReject` で送信元に拒否を返し、理由を受信履歴に残す。
- 本番 D1 へのマイグレーションやデプロイは、指示がない限り実行しない。通常は GitHub Release を公開して、Deploy ワークフローで行う。
- マイグレーションはデプロイの前に適用されるため、旧コードが動いたままでも壊れない変更（列・テーブルの追加など）に限る。
