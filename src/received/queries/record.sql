-- 未登録の宛先（unknown）は、直近 1 時間の件数が上限未満のときだけ記録する。
-- 連番の宛先や同じ宛先へ大量に送る攻撃で、履歴が埋まらないようにするため
WITH input AS (
  SELECT
    :recipient::text AS recipient,
    :sender::text AS sender,
    :size::int AS size,
    :outcome::text AS outcome,
    :max_unknown_per_hour::int AS max_unknown,
    :max_new_unknown_per_hour::int AS max_new_unknown,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour') AS since
)
INSERT INTO received_emails (recipient, sender, size, outcome)
SELECT recipient, sender, size, outcome
FROM input
WHERE input.outcome <> 'unknown'
  OR (
    (
      SELECT count(*) FROM received_emails
      WHERE outcome = 'unknown' AND received_at > input.since
    ) < input.max_unknown
    AND (
      -- 一度でも受信したことのある宛先は、新しい宛先として数えない
      EXISTS (SELECT 1 FROM received_emails WHERE recipient = input.recipient)
      OR (
        SELECT count(DISTINCT recent.recipient) FROM received_emails AS recent
        WHERE recent.outcome = 'unknown'
          AND recent.received_at > input.since
          AND NOT EXISTS (
            SELECT 1 FROM received_emails AS earlier
            WHERE earlier.recipient = recent.recipient AND earlier.received_at <= input.since
          )
      ) < input.max_new_unknown
    )
  )
RETURNING id;
