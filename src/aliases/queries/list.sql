-- query は address・note・service_url の部分一致（ASCII は大文字・小文字を区別しない）。
-- has_service_url は 1・0 で絞り込み、-1 なら絞り込まない
WITH input AS (
  SELECT
    lower(:query::text) AS query,
    :status::text AS status,
    :has_service_url::int AS has_service_url
)
SELECT address, note, created_at, disabled_at, service_url
FROM aliases
WHERE (
    instr(lower(address), (SELECT query FROM input)) > 0
    OR instr(lower(note), (SELECT query FROM input)) > 0
    OR instr(lower(service_url), (SELECT query FROM input)) > 0
  )
  AND (
    (SELECT status FROM input) = 'all'
    OR ((SELECT status FROM input) = 'enabled') = (disabled_at IS NULL)
  )
  AND (
    (SELECT has_service_url FROM input) = -1
    OR (SELECT has_service_url FROM input) = (service_url <> '')
  )
ORDER BY address
LIMIT :limit::int
OFFSET :offset::int;
