WITH input AS (SELECT :filter::text AS filter)
SELECT id, received_at, recipient, sender, size, outcome
FROM received_emails
WHERE (SELECT filter FROM input) = 'all'
  OR outcome = (SELECT filter FROM input)
  OR ((SELECT filter FROM input) = 'dropped' AND outcome <> 'forwarded')
ORDER BY received_at DESC, id DESC
LIMIT :limit::int
OFFSET :offset::int;
