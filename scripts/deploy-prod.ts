// .prod.vars.tpl の 1Password の参照を解決し、Worker Secrets と一緒にデプロイする
// 平文の Secret をディスクに書かないよう、cf の --secrets-file にはキーだけを書いたファイルを渡し、
// 値は op run が環境変数として渡す（cf は secrets file の $VAR を環境変数で展開し、環境変数を優先する）。
// CI の Linux では、以前のように /dev/fd/3 のパイプで渡すと cf が読めなかった
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";

const TEMPLATE = ".prod.vars.tpl";
// op run は相対パスで見つかった実行ファイルを拒否するため、node_modules の cf を絶対パスで渡す
const CF = resolvePath(import.meta.dirname, "../node_modules/.bin/cf");

// op が失敗したら空の値でデプロイしないよう、ここで例外にして止める
const op = (...args: string[]) =>
  execFileSync("op", args, { encoding: "utf8", stdio: ["inherit", "pipe", "inherit"] });

// メールのドメインは Secret ではなくビルド時に埋め込む値なので、別に読んで環境変数で渡す
const mailDomain = op("read", "op://Production/email-aliases/MAIL_DOMAIN").trim();

// Deploy ワークフローがリリースのバージョンを渡したときは、Worker のバージョン履歴にタグとして残す
const appVersion = process.env.APP_VERSION?.trim() ?? "";
const versionArgs = appVersion === "" ? [] : ["--tag", `v${appVersion}`];

const keys = readFileSync(TEMPLATE, "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line !== "" && !line.startsWith("#"))
  .map((line) => line.slice(0, line.indexOf("=")));
if (keys.length === 0 || keys.includes(""))
  throw new Error(`${TEMPLATE} からキーを読めませんでした`);

const dir = mkdtempSync(join(tmpdir(), "email-aliases-deploy-"));
try {
  const keysFile = join(dir, "secrets.env");
  // 値は環境変数から展開させる。ファイルには Secret の値を書かない
  writeFileSync(keysFile, keys.map((key) => `${key}=\${${key}}\n`).join(""), { mode: 0o600 });

  const deploy = spawn(
    "op",
    [
      "run",
      "--env-file",
      TEMPLATE,
      "--",
      CF,
      "deploy",
      "--secrets-file",
      keysFile,
      ...versionArgs,
      ...process.argv.slice(2),
    ],
    { stdio: "inherit", env: { ...process.env, MAIL_DOMAIN: mailDomain } },
  );
  const code = await new Promise<number | null>((resolve, reject) => {
    deploy.once("error", reject);
    deploy.once("exit", resolve);
  });
  process.exitCode = code ?? 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
