-- Complete database schema for quality-dashboard
-- This file creates all tables for the current design (reports with versions, tags, and dashboards)

-- Logical reports (stable key, optional display name)
CREATE TABLE IF NOT EXISTS reports (
    key TEXT PRIMARY KEY NOT NULL,
    display_name TEXT,
    date_created TEXT NOT NULL
);

-- Each upload creates a new version of a report
CREATE TABLE IF NOT EXISTS report_versions (
    id TEXT PRIMARY KEY NOT NULL,
    report_key TEXT NOT NULL,
    processor TEXT NOT NULL,
    file_entrypoint TEXT,
    has_file INTEGER NOT NULL DEFAULT 0,
    info TEXT NOT NULL DEFAULT '{}',
    date_created TEXT NOT NULL,
    FOREIGN KEY (report_key) REFERENCES reports(key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_report_versions_report_key ON report_versions(report_key);
CREATE INDEX IF NOT EXISTS idx_report_versions_date_created ON report_versions(date_created);

-- Metrics per report version
CREATE TABLE IF NOT EXISTS report_version_metrics (
    id TEXT PRIMARY KEY NOT NULL,
    report_version_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('count', 'percentage', 'duration', 'boolean')),
    value REAL NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (report_version_id) REFERENCES report_versions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_report_version_metrics_version_id ON report_version_metrics(report_version_id);

-- Tags attached to a report key (apply to all versions)
CREATE TABLE IF NOT EXISTS report_tags (
    report_key TEXT NOT NULL,
    tag TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (report_key, tag),
    FOREIGN KEY (report_key) REFERENCES reports(key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_report_tags_tag ON report_tags(tag);
CREATE INDEX IF NOT EXISTS idx_report_tags_tag_value ON report_tags(tag, value);

-- User-defined dashboards with ordered levels
CREATE TABLE IF NOT EXISTS dashboards (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    levels TEXT NOT NULL DEFAULT '[]',
    date_created TEXT NOT NULL,
    date_modified TEXT NOT NULL
);
