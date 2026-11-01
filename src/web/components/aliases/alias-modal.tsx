import { Modal } from "@mantine/core";
import type { ReactNode } from "react";

/** 処理中は閉じられないダイアログ。 */
export function AliasModal({
  title,
  busy,
  onClose,
  children,
}: {
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal
      opened
      onClose={onClose}
      title={title}
      centered
      padding="xl"
      closeOnClickOutside={!busy}
      closeOnEscape={!busy}
      withCloseButton={!busy}
      closeButtonProps={{ "aria-label": "閉じる" }}
    >
      {children}
    </Modal>
  );
}
