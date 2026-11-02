-- アプリ全体の設定。1 行だけを持つ
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  -- 移行期間用。設定中は drop と判定したメールも転送し、履歴に dry_run として残す。null なら drop する
  drop_dry_run_since TEXT
) STRICT;

-- drop と判定したが、ドライラン中のため転送したなら 1
ALTER TABLE received_emails ADD COLUMN dry_run INTEGER NOT NULL DEFAULT 0 CHECK (dry_run IN (0, 1));
