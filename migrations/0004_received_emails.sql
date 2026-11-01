-- 受信したメールの履歴。転送の有無にかかわらず記録し、登録漏れの確認や分析に使う
CREATE TABLE IF NOT EXISTS received_emails (
  id INTEGER PRIMARY KEY,
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- エイリアスを削除・再作成しても履歴を残すため、aliases への外部キーにはしない
  recipient TEXT NOT NULL COLLATE NOCASE,
  sender TEXT NOT NULL,
  size INTEGER NOT NULL,
  -- 受信時点の判定。forwarded: 転送した、disabled: 無効なエイリアス宛てで破棄した、unknown: 未登録の宛先で破棄した
  outcome TEXT NOT NULL CHECK (outcome IN ('forwarded', 'disabled', 'unknown'))
) STRICT;

CREATE INDEX IF NOT EXISTS received_emails_received_at ON received_emails (received_at);
CREATE INDEX IF NOT EXISTS received_emails_recipient ON received_emails (recipient, received_at);

-- 受信のたびに、保持期間（180 日）を過ぎた履歴を消す
CREATE TRIGGER IF NOT EXISTS received_emails_retention
AFTER INSERT ON received_emails
BEGIN
  DELETE FROM received_emails
  WHERE received_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-180 days');
END;
