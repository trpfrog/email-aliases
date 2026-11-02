-- 有効化を繰り返しても最初に有効にした日時を保つ
INSERT INTO settings (id, drop_dry_run_since)
VALUES (1, CASE WHEN :enabled::int = 1 THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') ELSE NULL END)
ON CONFLICT (id) DO UPDATE SET drop_dry_run_since = CASE WHEN excluded.drop_dry_run_since IS NULL
  THEN NULL ELSE COALESCE(settings.drop_dry_run_since, excluded.drop_dry_run_since) END
RETURNING drop_dry_run_since;
