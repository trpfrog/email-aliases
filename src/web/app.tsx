import { Box, Container, Stack, Tabs } from "@mantine/core";
import { useState } from "react";
import type { Alias } from "./api/aliases";
import { AliasDirectory } from "./components/aliases/alias-directory";
import { AliasPageHeading } from "./components/aliases/alias-page-heading";
import type { AliasActions } from "./components/aliases/alias-row";
import { CreateAliasDialog } from "./components/aliases/create-alias-dialog";
import { DeleteAliasDialog } from "./components/aliases/delete-alias-dialog";
import { EditAliasDetailsDialog } from "./components/aliases/edit-alias-details-dialog";
import { StatusNotification, type Notice } from "./components/feedback/status-notification";
import { AppFooter } from "./components/layout/app-footer";
import { AppHeader } from "./components/layout/app-header";
import { ReceivedSection } from "./components/received/received-section";
import { DropDryRunPanel } from "./components/settings/drop-dry-run-panel";
import { useAliases } from "./hooks/use-aliases";
import { useSettings } from "./hooks/use-settings";
import { isDisabled } from "./lib/alias-display";
import { errorMessage } from "./lib/error-message";

type Dialog = { type: "create"; localPart: string } | { type: "edit" | "delete"; alias: Alias };

export function App() {
  const aliases = useAliases();
  const settings = useSettings();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const registered = new Set(aliases.aliases.map((alias) => alias.address.toLowerCase()));

  /** ダイアログの操作が成功したら閉じて通知する。失敗はダイアログ内に表示される。 */
  async function completeDialog(operation: Promise<string>) {
    const message = await operation;
    setDialog(null);
    setNotice({ tone: "success", message });
  }

  /** ダイアログを伴わない操作は、成否を通知で知らせる。 */
  async function notifyResult(operation: Promise<string>) {
    try {
      setNotice({ tone: "success", message: await operation });
    } catch (error) {
      setNotice({ tone: "error", message: errorMessage(error) });
    }
  }

  const actions: AliasActions = {
    edit: (alias) => setDialog({ type: "edit", alias }),
    remove: (alias) => setDialog({ type: "delete", alias }),
    toggleDisabled: (alias) =>
      void notifyResult(aliases.setDisabled(alias.address, !isDisabled(alias))),
  };
  const openCreate = (localPart = "") => setDialog({ type: "create", localPart });
  const closeDialog = () => setDialog(null);

  return (
    <Box bg="gray.0" mih="100dvh">
      <AppHeader />
      <Container component="main" size="lg" py={{ base: "xl", sm: 48 }}>
        <Stack gap="xl">
          <AliasPageHeading
            loading={aliases.loading}
            count={aliases.aliases.length}
            onCreate={() => openCreate()}
          />
          <DropDryRunPanel
            settings={settings.settings}
            error={settings.error}
            busy={settings.busy}
            onChange={(enabled) => void notifyResult(settings.setDropDryRun(enabled))}
          />
          {/* 受信履歴はタブを開いたときだけ読み込む */}
          <Tabs defaultValue="aliases" keepMounted={false}>
            <Tabs.List mb="md">
              <Tabs.Tab value="aliases">エイリアス</Tabs.Tab>
              <Tabs.Tab value="received">受信履歴</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="aliases">
              <AliasDirectory
                aliases={aliases.aliases}
                loading={aliases.loading}
                busy={aliases.busy}
                error={aliases.error}
                onRefresh={() => void aliases.refresh()}
                onCreate={() => openCreate()}
                actions={actions}
              />
            </Tabs.Panel>
            <Tabs.Panel value="received">
              <ReceivedSection
                registered={registered}
                onRegister={openCreate}
                notify={notifyResult}
                onSuccess={(message) => setNotice({ tone: "success", message })}
              />
            </Tabs.Panel>
          </Tabs>
          <AppFooter />
        </Stack>
      </Container>
      <StatusNotification notice={notice} onClose={() => setNotice(null)} />
      {dialog?.type === "create" && (
        <CreateAliasDialog
          defaultLocalPart={dialog.localPart}
          onClose={closeDialog}
          onCreate={(input) => completeDialog(aliases.create(input))}
        />
      )}
      {dialog?.type === "edit" && (
        <EditAliasDetailsDialog
          alias={dialog.alias}
          onClose={closeDialog}
          onSave={(details) => completeDialog(aliases.updateDetails(details))}
        />
      )}
      {dialog?.type === "delete" && (
        <DeleteAliasDialog
          alias={dialog.alias}
          onClose={closeDialog}
          onDelete={(address) => completeDialog(aliases.remove(address))}
        />
      )}
    </Box>
  );
}
