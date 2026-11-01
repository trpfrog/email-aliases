DELETE FROM received_emails
WHERE id = :id::int
RETURNING id;
