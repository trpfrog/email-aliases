import { Center, Divider, Loader, Paper } from "@mantine/core";
import { useState } from "react";
import type { Alias } from "../../api/aliases";
import { filterAliases, type AliasStatus } from "../../lib/alias-display";
import { ErrorAlert } from "../feedback/error-alert";
import type { AliasActions } from "./alias-actions";
import { AliasEmptyState } from "./alias-empty-state";
import { AliasListFooter } from "./alias-list-footer";
import { AliasTable } from "./alias-table";
import { AliasToolbar } from "./alias-toolbar";

export function AliasDirectory({
  aliases,
  loading,
  busy,
  error,
  onRefresh,
  onCreate,
  actions,
}: {
  aliases: Alias[];
  loading: boolean;
  busy: boolean;
  error: string;
  onRefresh: () => void;
  onCreate: () => void;
  actions: AliasActions;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AliasStatus>("enabled");
  const visible = filterAliases(aliases, { status, query });

  return (
    <Paper component="section" withBorder shadow="xs" aria-label="エイリアス一覧">
      <AliasToolbar
        query={query}
        onQueryChange={setQuery}
        status={status}
        onStatusChange={setStatus}
        refreshDisabled={loading || busy}
        onRefresh={onRefresh}
      />
      <Divider />
      <ErrorAlert message={error} m="md" />
      <AliasTable aliases={visible} busy={loading || busy} actions={actions} />
      {loading ? (
        <Center py={64} role="status" aria-label="読み込み中">
          <Loader size="sm" />
        </Center>
      ) : (
        visible.length === 0 && (
          <AliasEmptyState filtered={aliases.length > 0} onCreate={onCreate} />
        )
      )}
      <Divider />
      <AliasListFooter loading={loading} count={visible.length} />
    </Paper>
  );
}
