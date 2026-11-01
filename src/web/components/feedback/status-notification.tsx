import { Affix, Notification } from "@mantine/core";

export type Notice = { tone: "success" | "error"; message: string };

export function StatusNotification({
  notice,
  onClose,
}: {
  notice: Notice | null;
  onClose: () => void;
}) {
  if (notice === null) return null;
  return (
    <Affix position={{ bottom: 16, right: 16 }} maw="calc(100vw - 32px)">
      <Notification
        role={notice.tone === "error" ? "alert" : "status"}
        color={notice.tone === "error" ? "red" : undefined}
        onClose={onClose}
        withBorder
        closeButtonProps={{ "aria-label": "通知を閉じる" }}
      >
        {notice.message}
      </Notification>
    </Affix>
  );
}
