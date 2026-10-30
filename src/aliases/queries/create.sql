INSERT INTO aliases (address, note)
VALUES (:address, :note)

ON CONFLICT(address) DO NOTHING

RETURNING address, note, created_at, disabled_at;
