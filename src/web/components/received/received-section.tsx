import { useState } from "react";
import { useReceivedEmails } from "../../hooks/use-received-emails";
import type { ReceivedViewFilter } from "../../lib/received-display";
import { localPartOf } from "../../lib/received-display";
import { ClearReceivedDialog } from "./clear-received-dialog";
import { ReceivedHistory } from "./received-history";

/** 受信履歴のタブ。表示中だけ履歴を読み込む。 */
export function ReceivedSection({
  registered,
  onRegister,
  notify,
  onSuccess,
}: {
  registered: ReadonlySet<string>;
  /** @ より前の部分を入力した状態で、エイリアスの作成ダイアログを開く。 */
  onRegister: (localPart: string) => void;
  /** ダイアログを伴わない操作の成否を通知する。 */
  notify: (operation: Promise<string>) => Promise<void>;
  /** ダイアログの操作が成功したときに通知する。失敗はダイアログ内に表示される。 */
  onSuccess: (message: string) => void;
}) {
  const [filter, setFilter] = useState<ReceivedViewFilter>("dropped");
  const [clearing, setClearing] = useState(false);
  const received = useReceivedEmails(filter);

  return (
    <>
      <ReceivedHistory
        filter={filter}
        onFilterChange={setFilter}
        emails={received.emails}
        registered={registered}
        loading={received.loading}
        busy={received.busy}
        error={received.error}
        hasMore={received.hasMore}
        onLoadMore={received.loadMore}
        onRefresh={received.refresh}
        onClear={() => setClearing(true)}
        actions={{
          register: (email) => onRegister(localPartOf(email.recipient)),
          remove: (email) => void notify(received.remove(email.id)),
        }}
      />
      {clearing && (
        <ClearReceivedDialog
          filter={filter}
          onClose={() => setClearing(false)}
          onClear={async () => {
            const message = await received.clear();
            setClearing(false);
            onSuccess(message);
          }}
        />
      )}
    </>
  );
}
