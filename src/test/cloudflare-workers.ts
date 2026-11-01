// Node で動く単体テスト用の `cloudflare:workers` の代替。
// @cloudflare/workers-oauth-provider が instanceof の判定にだけ使う。
// oxlint-disable-next-line typescript/no-extraneous-class -- ライブラリの instanceof 判定に必要な空クラス
export class WorkerEntrypoint {}
