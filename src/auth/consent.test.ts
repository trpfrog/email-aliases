import type { ConsentDescription } from "@cloudflare/workers-oauth-provider";
import { describe, expect, it } from "vite-plus/test";
import { renderConsentPage } from "./consent";

const details = {
  clientId: "https://client.example/metadata.json",
  clientName: "My client",
  clientDomain: "client.example",
  redirectHost: "callback.example",
  redirectUri: "https://callback.example/callback",
  redirectIsLoopback: false,
  scope: ["aliases:manage", "offline_access"],
} satisfies ConsentDescription;

describe("接続承認ページ", () => {
  it("クライアント情報・送信先・権限と、許可・拒否の選択肢を表示する", async () => {
    const page = await renderConsentPage({ details, handle: "test-handle" });

    for (const text of [
      details.clientName,
      details.clientDomain,
      details.redirectHost,
      ...details.scope,
    ]) {
      expect(page).toContain(text);
    }

    expect(page).toContain('name="handle" value="test-handle"');
    expect(page).toContain('value="approve"');
    expect(page).toContain('value="deny"');
    expect(page).not.toContain("このコンピューターのアプリ");
  });

  it("クライアントから受け取ったテキストとフォーム属性をエスケープする", async () => {
    const page = await renderConsentPage({
      details: {
        ...details,
        clientName: '<script>alert("x")</script>',
        redirectHost: "<img src=x>",
        scope: ["<script>"],
      },
      handle: '"/><script>alert(1)</script>',
    });

    expect(page).not.toContain("<script>");
    expect(page).not.toContain("<img");
    expect(page).toContain("&lt;script&gt;");
    expect(page).toContain("&quot;");
  });

  it("ループバック接続の注意と、クライアント名が未検証であることを表示する", async () => {
    const page = await renderConsentPage({
      details: { ...details, clientDomain: undefined, redirectIsLoopback: true },
      handle: "test",
    });

    expect(page).toContain("自己申告（未検証）");
    expect(page).toContain("このコンピューターのアプリ");
  });
});
