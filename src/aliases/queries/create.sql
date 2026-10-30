INSERT INTO aliases (address, note, service_url)
VALUES (:address, :note, :service_url)

ON CONFLICT(address) DO NOTHING

RETURNING address, note, created_at, disabled_at, service_url;
