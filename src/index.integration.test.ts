import { execFile, spawn, type ChildProcess } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { once } from "node:events";
import { cp, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { hc } from "hono/client";
import { afterAll, beforeAll, describe, expect, test, vi } from "vite-plus/test";
import { z } from "zod";
import { LOCAL_D1_ID } from "../cloudflare.config";
import type { AdminApi } from "./admin/api";
import {
  createAliasResult,
  deleteAliasResult,
  listAliasesResult,
  updateAliasResult,
} from "./aliases/schema";
import { MAIL_DOMAIN } from "./config";

const run = promisify(execFile);
const root = join(import.meta.dirname, "..");
const cli = join(root, "node_modules/.bin/cf");
const password = randomBytes(32).toString("hex");
const basicAuth = (user: string, pass: string) => `Basic ${btoa(`${user}:${pass}`)}`;
const basic = basicAuth("admin", password);

type DevServer = { workspace: string; worker: ChildProcess; base: string; logs: () => string };
let server: DevServer | undefined;

function base(): string {
  if (server === undefined) throw new Error("Dev server is not running");
  return server.base;
}

async function findFreePort(): Promise<number> {
  const socket = createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const { port } = z.object({ port: z.number() }).parse(socket.address());
  await new Promise<void>((resolve) => socket.close(() => resolve()));
  return port;
}

/** 実際のシークレットやローカルの D1/KV に干渉しないよう、一時ディレクトリのコピーで Worker を起動する。 */
async function startDevServer(): Promise<DevServer> {
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

  return { workspace, worker, base: origin, logs: () => logs };
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

function request(path: string, init: RequestInit = {}) {
  return fetch(new URL(path, base()), {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(5000),
  });
}

function requireHeader(response: Response, name: string): string {
  const value = response.headers.get(name);
  if (value === null) throw new Error(`Missing ${name} header`);
  return value;
}

beforeAll(async () => {
  server = await startDevServer();
  const { worker, logs } = server;
  await vi.waitUntil(
    async () => {
      if (worker.exitCode !== null) throw new Error(`Worker exited: ${logs()}`);
      try {
        return (await request("/health")).ok;
      } catch {
        return false;
      }
    },
    { timeout: 20000, interval: 100 },
  );
}, 60000);

afterAll(async () => {
  if (server !== undefined) await stopDevServer(server);
});

describe("Basic 認証と OAuth の検出情報", () => {
  test("MCP と接続承認のエンドポイントを保護する", async () => {
    const challenge = await request("/mcp");
    expect(challenge.status).toBe(401);
    expect(challenge.headers.get("www-authenticate")).toMatch(/resource_metadata/);

    for (const method of ["GET", "POST"]) {
      expect((await request("/authorize", { method })).status).toBe(401);
    }

    const wrong = basicAuth("admin", "wrong");
    expect((await request("/authorize", { headers: { Authorization: wrong } })).status).toBe(401);

    const metadata = z
      .object({ resource: z.string() })
      .parse(await (await request("/.well-known/oauth-protected-resource/mcp")).json());
    expect(metadata.resource).toBe(`${base()}/mcp`);

    const discovery = z
      .object({ code_challenge_methods_supported: z.array(z.string()) })
      .parse(await (await request("/.well-known/oauth-authorization-server")).json());
    expect(discovery.code_challenge_methods_supported).toContain("S256");
  });
});

const rawPost = (body: string, headers: Record<string, string> = {}) =>
  request("/api/aliases", {
    method: "POST",
    headers: {
      Authorization: basic,
      Origin: base(),
      "Content-Type": "application/json",
      ...headers,
    },
    body,
  });

describe("React 管理画面と API", () => {
  const address = `admin-test@${MAIL_DOMAIN}`;
  const input = { address, note: "管理画面テスト", service_url: "https://example.com/settings" };

  test("認証なしのアクセスを拒否し、認証後はキャッシュさせずに画面を返す", async () => {
    expect((await request("/")).status).toBe(401);
    expect((await request("/api/aliases")).status).toBe(401);

    const page = await request("/", { headers: { Authorization: basic } });
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("/src/web/main.tsx");
    expect(page.headers.get("cache-control")).toContain("no-store");
    expect(page.headers.get("x-frame-options")).toBe("DENY");
  });

  test("別 Origin・JSON 以外・不正な入力を拒否する", async () => {
    const body = JSON.stringify(input);
    expect((await rawPost(body, { Origin: "https://other.example" })).status).toBe(403);
    expect((await rawPost(body, { "Content-Type": "text/plain" })).status).toBe(415);
    expect((await rawPost("{")).status).toBe(400);
    expect((await rawPost(JSON.stringify({ address: "admin-test" }))).status).toBe(400);
    expect(
      (await rawPost(JSON.stringify({ ...input, service_url: "javascript:alert(1)" }))).status,
    ).toBe(400);
    expect(
      (await request("/api/aliases?offset=-1", { headers: { Authorization: basic } })).status,
    ).toBe(400);
  });

  test("Hono RPC で作成・更新・一覧・削除できる", async () => {
    const aliases = hc<AdminApi>(base(), {
      headers: { Authorization: basic, Origin: base() },
    }).api.aliases;

    const created = await aliases.$post({ json: input });
    expect(created.status).toBe(201);
    expect(createAliasResult.parse(await created.json()).alias.address).toBe(address);
    expect((await aliases.$post({ json: input })).status).toBe(200);

    const setDisabled = (disabled: boolean, target = address) =>
      aliases.disabled.$put({ json: { address: target, disabled } });

    expect((await setDisabled(true, `missing@${MAIL_DOMAIN}`)).status).toBe(404);

    const disabled = updateAliasResult.parse(await (await setDisabled(true)).json());
    expect(disabled.alias).toMatchObject({ disabled_at: expect.any(String), note: input.note });

    const edited = updateAliasResult.parse(
      await (await aliases.$patch({ json: { address, note: "一括更新", service_url: "" } })).json(),
    );
    expect(edited.alias).toMatchObject({
      note: "一括更新",
      service_url: "",
      disabled_at: expect.any(String),
    });

    const enabled = updateAliasResult.parse(await (await setDisabled(false)).json());
    expect(enabled.alias?.disabled_at).toBeNull();

    const list = listAliasesResult.parse(await (await aliases.$get({ query: {} })).json());
    expect(list.aliases).toContainEqual(expect.objectContaining({ address, note: "一括更新" }));

    const deleted = deleteAliasResult.parse(
      await (await aliases.$delete({ json: { address } })).json(),
    );
    expect(deleted.deleted).toBe(true);
  });
});

describe("OAuth と MCP", () => {
  const redirectUri = "https://example.test/callback";
  const token = z.object({ access_token: z.string(), refresh_token: z.string() });
  const consentForm = z.tuple([z.string(), z.string()]);

  test("接続承認・PKCE・MCP・トークン更新が動作する", async () => {
    const registration = await request("/oauth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "<script>alert(1)</script>",
        redirect_uris: [redirectUri],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      }),
    });
    expect(registration.status, await registration.clone().text()).toBe(201);
    const { client_id } = z.object({ client_id: z.string() }).parse(await registration.json());

    const verifier = randomBytes(32).toString("base64url");
    const authorizeParams = new URLSearchParams({
      client_id,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "aliases:manage offline_access",
      resource: `${base()}/mcp`,
      state: "test-state",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
    });

    async function openConsent() {
      const response = await request(`/authorize?${authorizeParams.toString()}`, {
        headers: { Authorization: basic },
      });
      expect(response.status, await response.clone().text()).toBe(200);
      expect(requireHeader(response, "content-security-policy")).toContain(
        "frame-ancestors 'none'",
      );

      const html = await response.text();
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");

      const [, handle] = consentForm.parse(html.match(/name="handle" value="([^"]+)"/));
      const cookie = requireHeader(response, "set-cookie").split(";")[0] ?? "";
      return { handle, cookie };
    }

    const submitConsent = (
      { handle, cookie }: { handle: string; cookie: string },
      decision: "approve" | "deny",
    ) =>
      request("/authorize", {
        method: "POST",
        headers: { Authorization: basic, ...(cookie === "" ? {} : { Cookie: cookie }) },
        body: new URLSearchParams({ handle, decision }),
      });

    const withoutCookie = await openConsent();
    expect(
      (await submitConsent({ ...withoutCookie, cookie: "" }, "approve")).status,
      "ブラウザーの Cookie がない場合は接続承認を拒否する",
    ).toBe(400);

    const denial = await openConsent();
    const denied = await submitConsent(denial, "deny");
    expect(new URL(requireHeader(denied, "location")).searchParams.get("error")).toBe(
      "access_denied",
    );
    expect(
      (await submitConsent(denial, "approve")).status,
      "接続承認のハンドルは一度しか使えない",
    ).toBe(400);

    const approved = await submitConsent(await openConsent(), "approve");
    expect(approved.status, await approved.clone().text()).toBe(302);
    const callback = new URL(requireHeader(approved, "location"));
    expect(callback.searchParams.get("state")).toBe("test-state");

    const tokenRequest = new URLSearchParams({
      grant_type: "authorization_code",
      code: callback.searchParams.get("code") ?? "",
      client_id,
      redirect_uri: redirectUri,
      code_verifier: verifier,
      resource: `${base()}/mcp`,
    });

    const invalidVerifier = new URLSearchParams(tokenRequest);
    invalidVerifier.set("code_verifier", randomBytes(32).toString("base64url"));
    expect((await request("/oauth/token", { method: "POST", body: invalidVerifier })).status).toBe(
      400,
    );

    const issued = await request("/oauth/token", { method: "POST", body: tokenRequest });
    expect(issued.status, await issued.clone().text()).toBe(200);
    const { access_token, refresh_token } = token.parse(await issued.json());

    const rpc = async (
      accessToken: string,
      method: string,
      params: Record<string, unknown> = {},
    ) => {
      const response = await request("/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      expect(response.status, await response.clone().text()).toBe(200);
      const body = z
        .object({ result: z.record(z.string(), z.unknown()) })
        .parse(await response.json());
      return body.result;
    };
    const callTool = async (name: string, args: Record<string, unknown>) =>
      (await rpc(access_token, "tools/call", { name, arguments: args })).structuredContent;

    await rpc(access_token, "initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });

    const { tools } = z
      .object({ tools: z.array(z.object({ name: z.string() })) })
      .parse(await rpc(access_token, "tools/list"));
    expect(tools.map((tool) => tool.name).toSorted()).toEqual([
      "create_alias",
      "delete_alias",
      "list_aliases",
      "set_alias_disabled",
      "update_alias_details",
    ]);

    const address = `test-alias@${MAIL_DOMAIN}`;
    expect(createAliasResult.parse(await callTool("create_alias", { address })).created).toBe(true);
    expect(listAliasesResult.parse(await callTool("list_aliases", {})).aliases).toContainEqual(
      expect.objectContaining({ address }),
    );
    expect(deleteAliasResult.parse(await callTool("delete_alias", { address })).deleted).toBe(true);

    const refreshedResponse = await request("/oauth/token", {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token,
        client_id,
        resource: `${base()}/mcp`,
      }),
    });
    expect(refreshedResponse.status, await refreshedResponse.clone().text()).toBe(200);
    const refreshed = token.parse(await refreshedResponse.json());
    await rpc(refreshed.access_token, "tools/list");

    expect(
      (await request("/oauth/token", { method: "POST", body: tokenRequest })).status,
      "認可コードは再利用できない",
    ).toBe(400);
  });
});
