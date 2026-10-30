import { Alert, Center, Divider, Loader, Paper } from "@mantine/core";
import { useState } from "react";
import type { Alias } from "../../api/aliases";
import { AliasToolbar } from "./alias-toolbar";
import { AliasTable } from "./alias-table";
import { AliasEmptyState } from "./alias-empty-state";
import { AliasListFooter } from "./alias-list-footer";

type Props = {
  aliases: Alias[];
  loading: boolean;
  saving: boolean;
  error: string;
  onRefresh: () => void;
  onCreate: () => void;
  onDelete: (alias: Alias) => void;
};

export function AliasDirectory({
  aliases,
  loading,
  saving,
  error,
  onRefresh,
  onCreate,
  onDelete,
}: Props) {
  const [search, setSearch] = useState("");
  const filtered = aliases.filter((alias) =>
    `${alias.address} ${alias.note}`.toLowerCase().includes(search.toLowerCase().trim()),
  );
  return (
    <Paper component="section" withBorder shadow="xs" aria-label="エイリアス一覧">
      <AliasToolbar
        search={search}
        onSearch={setSearch}
        disabled={loading || saving}
        onRefresh={onRefresh}
      />
      <Divider />
      {error && (
        <Alert color="red" role="alert" m="md">
          {error}
        </Alert>
      )}
      <AliasTable aliases={filtered} onDelete={onDelete} />
      {loading ? (
        <Center py={64} role="status" aria-label="読み込み中">
          <Loader size="sm" />
        </Center>
      ) : (
        filtered.length === 0 && (
          <AliasEmptyState searching={Boolean(search.trim())} onCreate={onCreate} />
        )
      )}
      <Divider />
      <AliasListFooter loading={loading} count={filtered.length} />
    </Paper>
  );
}
