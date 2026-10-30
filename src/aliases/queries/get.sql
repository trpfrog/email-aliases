SELECT address, note, created_at, disabled_at
FROM aliases
WHERE address = :address;
