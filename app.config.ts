import { defineDeploy, defineApp } from "./src/app-config.ts";

export const app = defineApp({
  name: "Email Aliases",
  mailDomain: "mail.example.com",
  theme: {
    primaryColor: [
      "#f0f7f1",
      "#e0ede2",
      "#c1d9c6",
      "#9bc3a5",
      "#73aa83",
      "#539367",
      "#3b7c52",
      "#276349",
      "#20513c",
      "#193e2f",
    ],
    primaryShade: 7,
    browserColor: "#f4f5f0",
  },
});

export const deploy = defineDeploy({
  workerName: "email-aliases",
  publicOrigin: "https://email-aliases.YOUR_SUBDOMAIN.workers.dev",
  // d1DatabaseId: "",
  // kvNamespaceId: "",
});
