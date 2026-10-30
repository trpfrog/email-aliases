import { AppHeader } from "./components/layout/app-header";
import { AppFooter } from "./components/layout/app-footer";
import { AliasPageHeading } from "./components/aliases/alias-page-heading";
import { StatusNotification } from "./components/feedback/status-notification";
import { useState } from "react";
import { Box, Container, Stack } from "@mantine/core";
import type { Alias } from "./api/aliases";
import { useAliases } from "./hooks/use-aliases";
import { AliasDirectory } from "./components/aliases/alias-directory";
import { CreateAliasDialog } from "./components/aliases/create-alias-dialog";
import { DeleteAliasDialog } from "./components/aliases/delete-alias-dialog";
import { EditAliasDetailsDialog } from "./components/aliases/edit-alias-details-dialog";

type Dialog = { type: "create" } | { type: "delete" | "editDetails"; alias: Alias };

export function App() {
  const aliases = useAliases();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  function openDialog(value: Dialog) {
    aliases.clearError();
    setDialog(value);
  }
  function closeDialog() {
    aliases.clearError();
    setDialog(null);
  }

  return (
    <Box bg="gray.0" mih="100dvh">
      <AppHeader />
      <Container component="main" size="lg" py={{ base: "xl", sm: 48 }}>
        <Stack gap="xl">
          <AliasPageHeading
            loading={aliases.loading}
            count={aliases.aliases.length}
            onCreate={() => openDialog({ type: "create" })}
          />
          <AliasDirectory
            aliases={aliases.aliases}
            loading={aliases.loading}
            saving={aliases.saving}
            error={dialog ? "" : aliases.error}
            onRefresh={() => void aliases.refresh()}
            onCreate={() => openDialog({ type: "create" })}
            onDelete={(alias) => openDialog({ type: "delete", alias })}
            onEditDetails={(alias) => openDialog({ type: "editDetails", alias })}
            onSetDisabled={(address, disabled) => void aliases.setDisabled(address, disabled)}
          />
          <AppFooter />
        </Stack>
      </Container>
      <StatusNotification message={aliases.notice} onClose={aliases.clearNotice} />
      {dialog?.type === "create" && (
        <CreateAliasDialog
          saving={aliases.saving}
          error={aliases.error}
          onClose={closeDialog}
          onCreate={aliases.create}
        />
      )}
      {dialog?.type === "editDetails" && (
        <EditAliasDetailsDialog
          alias={dialog.alias}
          saving={aliases.saving}
          error={aliases.error}
          onClose={closeDialog}
          onSave={aliases.updateDetails}
        />
      )}
      {dialog?.type === "delete" && (
        <DeleteAliasDialog
          alias={dialog.alias}
          saving={aliases.saving}
          error={aliases.error}
          onClose={closeDialog}
          onDelete={aliases.remove}
        />
      )}
    </Box>
  );
}
