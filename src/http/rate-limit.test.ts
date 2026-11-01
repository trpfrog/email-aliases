import { describe, expect, it as baseIt, vi } from "vite-plus/test";
import { z } from "zod";
import { rateLimitByIp } from "./rate-limit";

const it = baseIt.extend("limit", () =>
  vi.fn<RateLimit["limit"]>().mockResolvedValue({ success: true }),
);

describe("rateLimitByIp", () => {
  it("接続元 IP をキーに数え、上限内なら通す", async ({ limit }) => {
    const request = new Request("https://aliases.example/oauth/token", {
      headers: { "CF-Connecting-IP": "203.0.113.1" },
    });

    expect(await rateLimitByIp({ limit }, request)).toBeUndefined();
    expect(limit).toHaveBeenCalledExactlyOnceWith({ key: "203.0.113.1" });
  });

  it("IP が分からなければ共通のキーで数える", async ({ limit }) => {
    await rateLimitByIp({ limit }, new Request("http://localhost/oauth/token"));
    expect(limit).toHaveBeenCalledExactlyOnceWith({ key: "unknown" });
  });

  it("上限を超えたら 429 と Retry-After を返す", async ({ limit }) => {
    limit.mockResolvedValueOnce({ success: false });

    const response = await rateLimitByIp({ limit }, new Request("http://localhost/oauth/token"));

    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBe("60");
    expect(z.object({ error: z.string() }).parse(await response?.json())).toEqual({
      error: "Too many requests",
    });
  });
});
