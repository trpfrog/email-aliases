UPDATE aliases
SET note = :note
WHERE address = :address
RETURNING address, note, created_at, disabled_at;
