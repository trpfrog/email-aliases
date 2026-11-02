import { api, request } from "./request";

export type { Settings } from "../../settings/schema";

const settings = api.settings;

export const settingsApi = {
  get: () => request(settings.$get()),
  setDropDryRun: (enabled: boolean) =>
    request(settings["drop-dry-run"].$put({ json: { enabled } })),
};
