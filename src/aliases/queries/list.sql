SELECT address, note, created_at
FROM aliases
ORDER BY address
LIMIT :limit::int
OFFSET :offset::int;
