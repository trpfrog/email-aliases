import { vi } from "vite-plus/test";

/** 単体テストは app.config.ts の値に左右されないよう、固定のドメインで動かす。 */
export const TEST_MAIL_DOMAIN = "mail.example.test";

vi.mock(import("../config"), async (importOriginal) => ({
  ...(await importOriginal()),
  MAIL_DOMAIN: TEST_MAIL_DOMAIN,
}));
