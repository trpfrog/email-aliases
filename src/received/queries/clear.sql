WITH input AS (SELECT :filter::text AS filter)
DELETE FROM received_emails
WHERE (SELECT filter FROM input) = 'all'
  OR outcome = (SELECT filter FROM input)
  OR ((SELECT filter FROM input) = 'dropped' AND outcome <> 'forwarded')
RETURNING id;
