CREATE TABLE IF NOT EXISTS dashboards (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    definition TEXT NOT NULL DEFAULT '{"schemaVersion":2,"root":[]}',
    date_created TEXT NOT NULL,
    date_modified TEXT NOT NULL
);
