-- 登録済みのエイリアスごとの受信状況。受信のないエイリアスも含める。
-- least_recent は最終受信の古い順（受信なしが先頭）、most_received_30d は直近 30 日の受信の多い順
WITH input AS (SELECT :sort::text AS sort),
stats AS (
  SELECT
    recipient,
    max(received_at) AS last_received_at,
    count(*) AS received_count,
    sum(received_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days')) AS received_count_30d
  FROM received_emails
  GROUP BY recipient
)
SELECT
  aliases.address,
  aliases.disabled_at,
  stats.last_received_at,
  coalesce(stats.received_count_30d, 0) AS received_count_30d,
  coalesce(stats.received_count, 0) AS received_count
FROM aliases
LEFT JOIN stats ON stats.recipient = aliases.address
ORDER BY
  CASE WHEN (SELECT sort FROM input) = 'most_received_30d'
    THEN -coalesce(stats.received_count_30d, 0) ELSE 0 END,
  CASE WHEN (SELECT sort FROM input) = 'least_recent'
    THEN coalesce(stats.last_received_at, '') ELSE '' END,
  aliases.address
LIMIT :limit::int
OFFSET :offset::int;
