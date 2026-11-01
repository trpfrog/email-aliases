import { describe, expect, it } from "vite-plus/test";
import {
  addressSchema,
  serviceUrlSchema,
  setAliasDisabledInput,
  updateAliasDetailsInput,
} from "./schema";

describe("アドレスの検証", () => {
  it.each([
    "",
    "shop",
    "*",
    "a..b@mail.example.test",
    ".a@mail.example.test",
    "a.@mail.example.test",
    "a@other.example",
    "a@@mail.example.test",
    "a b@mail.example.test",
    "あ@mail.example.test",
    `${"x".repeat(65)}@mail.example.test`,
  ])("不正なアドレス %j を拒否する", (input) => {
    expect(addressSchema.safeParse(input).success).toBe(false);
  });

  it("使用可能な記号を維持し、前後の空白を除いて小文字に揃える", () => {
    expect(addressSchema.parse(" Shop+News@MAIL.EXAMPLE.TEST ")).toBe(
      "shop+news@mail.example.test",
    );
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
  const address = "shop@mail.example.test";

  it.each([
    { address },
    { address, disabled: true, note: "both" },
    { address, note: "x".repeat(1001) },
    { address, service_url: "javascript:alert(1)" },
    { address, unknown: 1 },
  ])("登録情報の更新 %j を拒否する", (input) => {
    expect(updateAliasDetailsInput.safeParse(input).success).toBe(false);
  });

  it.each([
    { address, note: "" },
    { address, service_url: "https://example.com" },
    { address, note: "メモ", service_url: "" },
  ])("登録情報の更新 %j を受け付ける", (input) => {
    expect(updateAliasDetailsInput.safeParse(input).success).toBe(true);
  });

  it.each([{ address }, { address, disabled: "true" }, { address, disabled: true, note: "x" }])(
    "有効状態の変更 %j を拒否する",
    (input) => {
      expect(setAliasDisabledInput.safeParse(input).success).toBe(false);
    },
  );
});
