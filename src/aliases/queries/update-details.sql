UPDATE aliases
SET note = CASE WHEN :update_note::int = 1 THEN :note ELSE note END,
    service_url = CASE WHEN :update_service_url::int = 1 THEN :service_url ELSE service_url END
WHERE address = :address
RETURNING address, note, created_at, disabled_at, service_url;
