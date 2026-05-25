CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    passwordEncrypted VARCHAR(500) NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    permissions TEXT NOT NULL DEFAULT '{}'
);
