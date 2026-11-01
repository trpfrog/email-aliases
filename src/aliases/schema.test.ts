import { describe, expect, it } from "vite-plus/test";
import { addressSchema, serviceUrlSchema, updateAliasInput } from "./schema";

describe("アドレスの検証", () => {
  it.each([
    "",
    "shop",
    "*",
    "a..b@mail.example.com",
    ".a@mail.example.com",
    "a.@mail.example.com",
    "a@other.example",
    "a@@mail.example.com",
    "a b@mail.example.com",
    "あ@mail.example.com",
    `${"x".repeat(65)}@mail.example.com`,
  ])("不正なアドレス %j を拒否する", (input) => {
    expect(addressSchema.safeParse(input).success).toBe(false);
  });

  it("使用可能な記号を維持し、前後の空白を除いて小文字に揃える", () => {
    expect(addressSchema.parse(" Shop+News@MAIL.TRPFROG.NET ")).toBe("shop+news@mail.example.com");
  });
});

describe("サービス URL の検証", () => {
  it.each([
    "javascript:alert(1)",
    "data:text/html,hello",
    "ftp://example.com",
    "/settings",
    "example.com",
    `https://example.com/${"a".repeat(2048)}`,
  ])("%j を拒否する", (url) => {
    expect(serviceUrlSchema.safeParse(url).success).toBe(false);
  });

  it.each(["", "https://example.com/settings", "http://example.com"])("%j を受け付ける", (url) => {
    expect(serviceUrlSchema.parse(url)).toBe(url);
  });

  it("前後の空白を除く", () => {
    expect(serviceUrlSchema.parse(" https://example.com ")).toBe("https://example.com");
  });
});

describe("更新内容の検証", () => {
  const address = "shop@mail.example.com";

  it.each([
    { address },
    { address, disabled: true, note: "both" },
    { address, disabled: "true" },
    { address, note: "x".repeat(1001) },
    { address, service_url: "javascript:alert(1)" },
    { address, unknown: 1 },
  ])("%j を拒否する", (input) => {
    expect(updateAliasInput.safeParse(input).success).toBe(false);
  });

  it.each([
    { address, disabled: true },
    { address, note: "" },
    { address, service_url: "https://example.com" },
    { address, note: "メモ", service_url: "" },
  ])("%j を受け付ける", (input) => {
    expect(updateAliasInput.safeParse(input).success).toBe(true);
  });
});
