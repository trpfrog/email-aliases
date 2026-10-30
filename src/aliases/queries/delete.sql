DELETE FROM aliases
WHERE address = :address
RETURNING address;
