// .prod.vars.tpl の 1Password の参照を解決し、Worker Secrets と一緒にデプロイする
// 平文の Secret をディスクに書かないよう、解決した内容はメモリに置き、パイプ（fd 3）で cf に渡す
import { execFileSync, spawn } from "node:child_process";
import { Writable } from "node:stream";

// op が失敗したら空の Secret でデプロイしないよう、ここで例外にして止める
const secrets = execFileSync("op", ["inject", "--in-file", ".prod.vars.tpl"], {
  encoding: "utf8",
  stdio: ["inherit", "pipe", "inherit"],
});

const deploy = spawn("cf", ["deploy", "--secrets-file", "/dev/fd/3", ...process.argv.slice(2)], {
  stdio: ["inherit", "inherit", "inherit", "pipe"],
});
const pipe = deploy.stdio[3];
if (!(pipe instanceof Writable)) throw new Error("cf に Secret を渡すパイプを開けませんでした");
pipe.end(secrets);

const code = await new Promise<number | null>((resolve, reject) => {
  deploy.once("error", reject);
  deploy.once("exit", resolve);
});
process.exitCode = code ?? 1;
