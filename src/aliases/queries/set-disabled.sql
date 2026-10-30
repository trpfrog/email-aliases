UPDATE aliases
SET disabled_at = CASE WHEN :disabled::int = 1
  THEN COALESCE(disabled_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ELSE NULL END
WHERE address = :address
RETURNING address, note, created_at, disabled_at, service_url;
