import { execFile, spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { cp, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { promisify } from "node:util";
import type { TestProject } from "vite-plus/test/node";
import { z } from "zod";
import { LOCAL_D1_ID } from "../../../cloudflare.config";

declare module "vite-plus/test" {
  interface ProvidedContext {
    /** E2E テスト用に起動した Worker のオリジン。 */
    e2eOrigin: string;
    /** E2E テスト用の Worker に設定した管理者パスワード。 */
    e2eAdminPassword: string;
  }
}

const run = promisify(execFile);
const root = join(import.meta.dirname, "../../..");
const cli = join(root, "node_modules/.bin/cf");

type DevServer = { workspace: string; worker: ChildProcess; origin: string; logs: () => string };

async function findFreePort(): Promise<number> {
  const socket = createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const { port } = z.object({ port: z.number() }).parse(socket.address());
  await new Promise<void>((resolve) => socket.close(() => resolve()));
  return port;
}

/** 実際のシークレットやローカルの D1/KV に干渉しないよう、一時ディレクトリのコピーで Worker を起動する。 */
async function startDevServer(password: string): Promise<DevServer> {
  const workspace = await mkdtemp(join(tmpdir(), "email-aliases-test-"));
  for (const file of [
    "package.json",
    "tsconfig.json",
    "app.config.ts",
    "deploy.config.ts",
    "cloudflare.config.ts",
    "vite.config.ts",
    "index.html",
    ".reylo.yaml",
    "scripts",
    "src",
    "migrations",
  ]) {
    await cp(join(root, file), join(workspace, file), { recursive: true });
  }
  await symlink(join(root, "node_modules"), join(workspace, "node_modules"), "dir");

  const port = await findFreePort();
  const origin = `http://localhost:${port}`;
  await writeFile(
    join(workspace, ".dev.vars"),
    `ADMIN_PASSWORD=${password}\nFORWARD_TO=inbox@example.com\n`,
  );

  const { VITEST: _vitest, ...parentEnv } = process.env;
  const options = {
    cwd: workspace,
    env: { ...parentEnv, CI: "1", NO_COLOR: "1", DEV_PUBLIC_ORIGIN: origin },
  };

  await run(process.execPath, [join(workspace, "scripts/prepare-db.ts")], options);
  await run(
    cli,
    [
      "d1",
      "migrations",
      "apply",
      LOCAL_D1_ID,
      "--local",
      "--persist-to",
      ".cloudflare/state",
      "--mode",
      "development",
    ],
    { ...options, timeout: 30000 },
  );

  const worker = spawn(cli, ["dev", "--port", String(port)], {
    ...options,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  for (const stream of [worker.stdout, worker.stderr]) {
    stream.on("data", (chunk: Buffer) => {
      logs = (logs + chunk.toString()).slice(-16000);
    });
  }

  return { workspace, worker, origin, logs: () => logs };
}

async function stopDevServer({ workspace, worker }: DevServer) {
  try {
    if (worker.exitCode === null && worker.pid !== undefined) {
      const exited = once(worker, "exit");
      process.kill(-worker.pid, "SIGTERM");
      await exited;
    }
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

/**
 * `/health` が応答するまでポーリングする。
 * globalSetup はテストランナーの外で動き `vi.waitUntil` を使えないため、同じ方式（100ms 間隔・20 秒で打ち切り）で待つ。
 */
async function waitUntilReady({ worker, origin, logs }: DevServer) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (worker.exitCode !== null) throw new Error(`Worker exited: ${logs()}`);
    try {
      const response = await fetch(new URL("/health", origin), {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) return;
    } catch {
      // 起動前は接続を拒否されるので、次の試行まで待つ。
    }
    await setTimeout(100);
  }
  throw new Error(`Worker did not become ready: ${logs()}`);
}

/**
 * cf dev の起動は遅いため、E2E の全ファイルで 1 つの Worker を共有する。
 * テストファイルからは `inject` でオリジンとパスワードを受け取る。
 */
export default async function setup(project: TestProject) {
  const password = randomBytes(32).toString("hex");
  const server = await startDevServer(password);
  try {
    await waitUntilReady(server);
  } catch (error) {
    await stopDevServer(server);
    throw error;
  }
  project.provide("e2eOrigin", server.origin);
  project.provide("e2eAdminPassword", password);
  return async () => await stopDevServer(server);
}
