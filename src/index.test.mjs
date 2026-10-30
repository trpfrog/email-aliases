import { execFile, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { once } from "node:events";
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, expect, test, vi } from "vite-plus/test";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const cli = join(root, "node_modules/.bin/cf");
const password = randomBytes(32).toString("hex");
const basic = "Basic " + Buffer.from(`admin:${password}`).toString("base64");

let workspace;
let worker;
let base;
let logs = "";

beforeAll(async () => {
  // 専用のコピーを使い、実際のシークレットやローカルの D1/KV にテストが干渉するのを防ぐ。
  workspace = await mkdtemp(join(tmpdir(), "email-aliases-test-"));

  for (const file of [
    "package.json",
    "tsconfig.json",
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

  const socket = createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const port = socket.address().port;
  await new Promise((done) => socket.close(done));
  base = `http://localhost:${port}`;

  const config = await readFile(join(workspace, "cloudflare.config.ts"), "utf8");
  await writeFile(
    join(workspace, "cloudflare.config.ts"),
    config.replace("http://localhost:5173", base),
  );

  const vite = await readFile(join(workspace, "vite.config.ts"), "utf8");
  await writeFile(
    join(workspace, "vite.config.ts"),
    vite
      .replace("defineConfig({", `defineConfig({server: { port: ${port}, strictPort: true },`)
      .replace("cloudflare()", "cloudflare({ inspectorPort: false })"),
  );
  await writeFile(
    join(workspace, ".dev.vars"),
    `ADMIN_PASSWORD=${password}\nFORWARD_TO=inbox@example.com\n`,
  );

  const env = { ...process.env, CI: "1", NO_COLOR: "1" };
  delete env.VITEST;

  const options = { cwd: workspace, env };

  await run(process.execPath, [join(workspace, "scripts/prepare-db.mjs")], options);
  await run(
    cli,
    [
      "d1",
      "migrations",
      "apply",
      "00000000-0000-4000-8000-000000000001",
      "--local",
      "--persist-to",
      ".cloudflare/state",
      "--mode",
      "development",
    ],
    { ...options, timeout: 30000 },
  );

  worker = spawn(cli, ["dev"], { ...options, detached: true, stdio: ["ignore", "pipe", "pipe"] });

  for (const stream of [worker.stdout, worker.stderr]) {
    stream.on("data", (chunk) => {
      logs = (logs + chunk.toString()).slice(-16000);
    });
  }

  await vi.waitUntil(
    async () => {
      if (worker.exitCode !== null) {
        throw new Error(`Worker exited: ${logs}`);
      }

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
  try {
    if (worker?.exitCode === null) {
      const exited = once(worker, "exit");
      process.kill(-worker.pid, "SIGTERM");
      await exited;
    }
  } finally {
    if (workspace) {
      await rm(workspace, { recursive: true, force: true });
    }
  }
});

function request(path, options = {}) {
  return fetch(new URL(path, base), {
    ...options,
    redirect: "manual",
    signal: AbortSignal.timeout(5000),
  });
}

const jsonPost = (body) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

test("Basic 認証と OAuth の検出情報で MCP と接続承認のエンドポイントを保護する", async () => {
  const challenge = await request("/mcp");
  expect(challenge.status).toBe(401);
  expect(challenge.headers.get("www-authenticate")).toMatch(/resource_metadata/);

  for (const method of ["GET", "POST"]) {
    expect((await request("/authorize", { method })).status).toBe(401);
  }

  const wrong = "Basic " + Buffer.from("admin:wrong").toString("base64");
  expect((await request("/authorize", { headers: { Authorization: wrong } })).status).toBe(401);

  const metadata = await (await request("/.well-known/oauth-protected-resource/mcp")).json();
  expect(metadata.resource).toBe(`${base}/mcp`);

  const discovery = await (await request("/.well-known/oauth-authorization-server")).json();
  expect(discovery.code_challenge_methods_supported).toContain("S256");
});

test("React 管理画面と API の認証・検証・D1 操作", async () => {
  expect((await request("/")).status).toBe(401);
  expect((await request("/api/aliases")).status).toBe(401);
  const page = await request("/", { headers: { Authorization: basic } });
  expect(page.status).toBe(200);
  expect(await page.text()).toContain("/src/web/main.tsx");
  expect(page.headers.get("cache-control")).toContain("no-store");

  const headers = { Authorization: basic, Origin: base, "Content-Type": "application/json" };
  const body = JSON.stringify({ address: "admin-test@mail.example.com", note: "管理画面テスト" });
  expect(
    (
      await request("/api/aliases", {
        method: "POST",
        headers: { ...headers, Origin: "https://other.example" },
        body,
      })
    ).status,
  ).toBe(403);
  expect(
    (await request("/api/aliases", { method: "POST", headers: { Authorization: basic }, body }))
      .status,
  ).toBe(403);
  expect((await request("/api/aliases", { method: "POST", headers, body: "{" })).status).toBe(400);
  for (const method of ["POST", "DELETE"]) {
    expect(
      (
        await request("/api/aliases", {
          method,
          headers,
          body: JSON.stringify({ address: "admin-test" }),
        })
      ).status,
    ).toBe(400);
  }
  expect(
    (await request("/api/aliases?offset=-1", { headers: { Authorization: basic } })).status,
  ).toBe(400);

  const created = await request("/api/aliases", { method: "POST", headers, body });
  expect(created.status).toBe(201);
  expect((await created.json()).alias.address).toBe("admin-test@mail.example.com");
  expect((await request("/api/aliases", { method: "POST", headers, body })).status).toBe(200);
  const list = await request("/api/aliases", { headers: { Authorization: basic } });
  expect((await list.json()).aliases).toContainEqual(
    expect.objectContaining({ address: "admin-test@mail.example.com", note: "管理画面テスト" }),
  );
  expect(
    (await (await request("/api/aliases", { method: "DELETE", headers, body })).json()).deleted,
  ).toBe(true);
});

test("実際のローカル D1/KV で OAuth の接続承認・PKCE・MCP・トークン更新が動作する", async () => {
  const registration = await request(
    "/oauth/register",
    jsonPost({
      client_name: "<script>alert(1)</script>",
      redirect_uris: ["https://example.test/callback"],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    }),
  );
  expect(registration.status, await registration.clone().text()).toBe(201);

  const { client_id } = await registration.json();

  const verifier = randomBytes(32).toString("base64url");
  const params = new URLSearchParams({
    client_id,
    redirect_uri: "https://example.test/callback",
    response_type: "code",
    scope: "aliases:manage offline_access",
    resource: `${base}/mcp`,
    state: "test-state",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  });

  const consent = async () => {
    const response = await request("/authorize?" + params, { headers: { Authorization: basic } });
    expect(response.status, await response.clone().text()).toBe(200);

    const html = await response.text();
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");

    return {
      handle: html.match(/name="handle" value="([^"]+)"/)[1],
      cookie: response.headers.get("set-cookie").split(";")[0],
    };
  };

  let page = await consent();

  const approve = (page, cookie = page.cookie, decision = "approve") =>
    request("/authorize", {
      method: "POST",
      headers: { Authorization: basic, ...(cookie ? { Cookie: cookie } : {}) },
      body: new URLSearchParams({ handle: page.handle, decision }),
    });

  expect(
    (await approve(page, "")).status,
    "ブラウザーの Cookie がない場合は接続承認を拒否する",
  ).toBe(400);

  page = await consent();
  const denied = await approve(page, page.cookie, "deny");
  expect(new URL(denied.headers.get("location")).searchParams.get("error")).toBe("access_denied");
  expect((await approve(page)).status, "接続承認のハンドルは一度しか使えない").toBe(400);

  page = await consent();
  const approved = await approve(page);
  expect(approved.status, await approved.clone().text()).toBe(302);
  const callback = new URL(approved.headers.get("location"));
  expect(callback.searchParams.get("state")).toBe("test-state");

  const tokenRequest = new URLSearchParams({
    grant_type: "authorization_code",
    code: callback.searchParams.get("code"),
    client_id,
    redirect_uri: "https://example.test/callback",
    code_verifier: verifier,
    resource: `${base}/mcp`,
  });

  const invalidVerifier = new URLSearchParams(tokenRequest);
  invalidVerifier.set("code_verifier", randomBytes(32).toString("base64url"));
  expect((await request("/oauth/token", { method: "POST", body: invalidVerifier })).status).toBe(
    400,
  );

  const tokenResponse = await request("/oauth/token", { method: "POST", body: tokenRequest });
  expect(tokenResponse.status, await tokenResponse.clone().text()).toBe(200);

  const token = await tokenResponse.json();
  expect(token.refresh_token).toBeTruthy();

  const rpc = async (method, params) => {
    const response = await request("/mcp", {
      ...jsonPost({ jsonrpc: "2.0", id: 1, method, params }),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${token.access_token}`,
      },
    });
    expect(response.status, await response.clone().text()).toBe(200);

    const value = await response.json();
    expect(value.error, JSON.stringify(value)).toBeUndefined();

    return value.result;
  };

  await rpc("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "test", version: "1" },
  });

  expect((await rpc("tools/list", {})).tools.map((t) => t.name).sort()).toEqual([
    "create_alias",
    "delete_alias",
    "list_aliases",
  ]);

  expect(
    (
      await rpc("tools/call", {
        name: "create_alias",
        arguments: { address: "test-alias@mail.example.com", note: "test" },
      })
    ).structuredContent.created,
  ).toBe(true);

  expect(
    (await rpc("tools/call", { name: "list_aliases", arguments: {} })).structuredContent.aliases,
  ).toEqual(
    expect.arrayContaining([expect.objectContaining({ address: "test-alias@mail.example.com" })]),
  );

  expect(
    (
      await rpc("tools/call", {
        name: "delete_alias",
        arguments: { address: "test-alias@mail.example.com" },
      })
    ).structuredContent.deleted,
  ).toBe(true);

  const refreshResponse = await request("/oauth/token", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
      client_id,
      resource: `${base}/mcp`,
    }),
  });
  expect(refreshResponse.status, await refreshResponse.clone().text()).toBe(200);

  const refreshed = await refreshResponse.json();
  expect(refreshed.access_token).toBeTruthy();

  expect(
    (
      await request("/mcp", {
        ...jsonPost({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          Authorization: `Bearer ${refreshed.access_token}`,
        },
      })
    ).status,
  ).toBe(200);

  expect(
    (await request("/oauth/token", { method: "POST", body: tokenRequest })).status,
    "認可コードは再利用できない",
  ).toBe(400);
});
