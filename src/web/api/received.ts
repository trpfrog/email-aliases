import { api, request } from "./request";

export type { ReceivedEmail, ReceivedFilter } from "../../received/schema";
import type { ReceivedFilter } from "../../received/schema";

const received = api.received;

export const receivedApi = {
  list: (filter: ReceivedFilter, offset: number) =>
    request(received.$get({ query: { filter, offset: String(offset) } })),
  delete: (id: number) => request(received.$delete({ json: { id } })),
  clear: (filter: ReceivedFilter) => request(received.clear.$post({ json: { filter } })),
};
