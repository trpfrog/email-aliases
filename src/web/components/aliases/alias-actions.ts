import type { Alias } from "../../api/aliases";

/** 一覧の各行から呼び出す操作。 */
export type AliasActions = {
  edit: (alias: Alias) => void;
  toggleDisabled: (alias: Alias) => void;
  remove: (alias: Alias) => void;
};
