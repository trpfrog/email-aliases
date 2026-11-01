import { Alert, type AlertProps } from "@mantine/core";

/** メッセージが空のときは何も表示しない。 */
export function ErrorAlert({ message, ...props }: { message: string } & AlertProps) {
  if (message === "") return null;
  return (
    <Alert color="red" role="alert" {...props}>
      {message}
    </Alert>
  );
}
