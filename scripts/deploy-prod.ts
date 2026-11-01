// .prod.vars.tpl の 1Password の参照を一時ファイルに解決し、Worker Secrets と一緒にデプロイする
// 平文の Secret がリポジトリの中に残らないよう、一時ファイルは終了時に必ず消す
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "email-aliases-deploy-"));
const secrets = join(dir, ".prod.vars");
try {
  execFileSync("op", ["inject", "--in-file", ".prod.vars.tpl", "--out-file", secrets], {
    stdio: "inherit",
  });
  execFileSync("cf", ["deploy", "--secrets-file", secrets, ...process.argv.slice(2)], {
    stdio: "inherit",
  });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
