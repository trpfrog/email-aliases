import { inject } from "vite-plus/test";

/** global-setup.ts が起動した Worker のオリジン */
export const base = inject("e2eOrigin");

export const basicAuth = (user: string, pass: string) => `Basic ${btoa(`${user}:${pass}`)}`;
export const basic = basicAuth("admin", inject("e2eAdminPassword"));

export function request(path: string, init: RequestInit = {}) {
  return fetch(new URL(path, base), {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(5000),
  });
}
