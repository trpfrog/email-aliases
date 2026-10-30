SELECT address, note, created_at, disabled_at, service_url
FROM aliases
ORDER BY address
LIMIT :limit::int
OFFSET :offset::int;
