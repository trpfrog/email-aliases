import { Affix, Notification } from "@mantine/core";

export function StatusNotification({ message, onClose }: { message: string; onClose: () => void }) {
  if (!message) return null;
  return (
    <Affix position={{ bottom: 16, right: 16 }} maw="calc(100vw - 32px)">
      <Notification
        role="status"
        onClose={onClose}
        withBorder
        closeButtonProps={{ "aria-label": "通知を閉じる" }}
      >
        {message}
      </Notification>
    </Affix>
  );
}
