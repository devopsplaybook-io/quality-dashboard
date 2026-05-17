-- Dashboard tree-levels enhancement.
-- Drops the legacy `dashboards` table (flat ordered levels) and recreates it
-- with a single JSON `definition` column that holds the new tree structure.
-- Existing dashboards are intentionally discarded.

DROP TABLE IF EXISTS dashboards;

CREATE TABLE IF NOT EXISTS dashboards (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    definition TEXT NOT NULL DEFAULT '{"schemaVersion":2,"root":[]}',
    date_created TEXT NOT NULL,
    date_modified TEXT NOT NULL
);
