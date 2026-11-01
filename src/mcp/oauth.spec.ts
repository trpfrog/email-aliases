import { createHash, randomBytes } from "node:crypto";
import { describe, expect, test } from "vite-plus/test";
import { z } from "zod";
import { createAliasResult, deleteAliasResult, listAliasesResult } from "../aliases/schema";
import { MAIL_DOMAIN } from "../config";
import { base, basic, request } from "../test/e2e/server";

function requireHeader(response: Response, name: string): string {
  const value = response.headers.get(name);
  if (value === null) throw new Error(`Missing ${name} header`);
  return value;
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

const rpc = async (accessToken: string, method: string, params: Record<string, unknown> = {}) => {
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
  const body = z.object({ result: z.record(z.string(), z.unknown()) }).parse(await response.json());
  return body.result;
};

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
      resource: `${base}/mcp`,
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
      resource: `${base}/mcp`,
    });

    const invalidVerifier = new URLSearchParams(tokenRequest);
    invalidVerifier.set("code_verifier", randomBytes(32).toString("base64url"));
    expect((await request("/oauth/token", { method: "POST", body: invalidVerifier })).status).toBe(
      400,
    );

    const issued = await request("/oauth/token", { method: "POST", body: tokenRequest });
    expect(issued.status, await issued.clone().text()).toBe(200);
    const { access_token, refresh_token } = token.parse(await issued.json());

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
      "clear_received_emails",
      "create_alias",
      "delete_alias",
      "delete_received_email",
      "list_alias_activity",
      "list_aliases",
      "list_received_emails",
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
        resource: `${base}/mcp`,
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
