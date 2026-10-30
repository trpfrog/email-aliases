SELECT address, note, created_at
FROM aliases
WHERE address = :address;
