// .prod.vars.tpl の 1Password の参照を解決し、Worker Secrets と一緒にデプロイする
// 平文の Secret をディスクに書かないよう、解決した内容はメモリに置き、パイプ（fd 3）で cf に渡す
import { execFileSync, spawn } from "node:child_process";
import { Writable } from "node:stream";

// op が失敗したら空の値でデプロイしないよう、ここで例外にして止める
const op = (...args: string[]) =>
  execFileSync("op", args, { encoding: "utf8", stdio: ["inherit", "pipe", "inherit"] });

const secrets = op("inject", "--in-file", ".prod.vars.tpl");

// メールのドメインは Secret ではなくビルド時に埋め込む値なので、別に読んで環境変数で渡す
const mailDomain = op("read", "op://Production/email-aliases/MAIL_DOMAIN").trim();

const deploy = spawn("cf", ["deploy", "--secrets-file", "/dev/fd/3", ...process.argv.slice(2)], {
  stdio: ["inherit", "inherit", "inherit", "pipe"],
  env: { ...process.env, MAIL_DOMAIN: mailDomain },
});
const pipe = deploy.stdio[3];
if (!(pipe instanceof Writable)) throw new Error("cf に Secret を渡すパイプを開けませんでした");
pipe.end(secrets);

const code = await new Promise<number | null>((resolve, reject) => {
  deploy.once("error", reject);
  deploy.once("exit", resolve);
});
process.exitCode = code ?? 1;
