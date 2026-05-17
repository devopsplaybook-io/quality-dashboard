CREATE TABLE IF NOT EXISTS metadata (
    type TEXT NOT NULL,
    value TEXT NOT NULL,
    dateCreated TEXT NOT NULL
);

-- DEBUG: temporary admin override
UPDATE users SET role = 'admin' WHERE name = 'admin';
