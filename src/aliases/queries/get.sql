SELECT address, note, created_at, disabled_at, service_url
FROM aliases
WHERE address = :address;
