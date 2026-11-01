/** `app.config.ts` の型。値の説明はエディターのホバーで見られるよう、ここに書く。 */

/** Mantine のカラーパレット。明るい順に 10 段階で指定する。 */
type ColorPalette = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

export interface AppConfig {
  /** 管理画面・承認ページ・`<title>` に表示する名前。 */
  name: string;
  /** Email Routing の Catch-all を設定したドメイン。このドメインのアドレスだけを管理する。 */
  mailDomain: string;
  theme: {
    /** 管理画面のメインカラー。https://mantine.dev/colors-generator/ で生成できる。 */
    primaryColor: ColorPalette;
    /** ボタンなどに使う primaryColor の段階。 */
    primaryShade: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
    /** ブラウザーの UI の色（`<meta name="theme-color">`）。 */
    browserColor: string;
  };
}

/** 管理画面のバンドルには含めない、デプロイ先の設定。 */
export interface DeployConfig {
  /** Worker 名。`<workerName>.<サブドメイン>.workers.dev` で公開される。 */
  workerName: string;
  /** 本番の公開 URL（末尾 `/` なし）。OAuth の発行者として使う。 */
  publicOrigin: string;
  /** `cf d1 create` で作成した D1 の database ID。 */
  d1DatabaseId?: string;
  /** `cf kv namespaces create` で作成した OAuth 用 KV の namespace ID。 */
  kvNamespaceId?: string;
}

export function defineApp(config: AppConfig): AppConfig {
  return config;
}

export function defineDeploy(config: DeployConfig): DeployConfig {
  return config;
}
