-- Quality gate rules per report (evaluated at ingest; retro-applied on save)
CREATE TABLE IF NOT EXISTS report_gates (
    id TEXT PRIMARY KEY NOT NULL,
    report_key TEXT NOT NULL,
    metric TEXT NOT NULL,
    operator TEXT NOT NULL CHECK (operator IN ('<=', '>=')),
    warn_value REAL,
    fail_value REAL NOT NULL,
    date_created TEXT NOT NULL,
    FOREIGN KEY (report_key) REFERENCES reports(key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_report_gates_report_key ON report_gates(report_key);

ALTER TABLE report_versions ADD COLUMN gate_status TEXT;
ALTER TABLE report_versions ADD COLUMN gate_results TEXT NOT NULL DEFAULT '[]';
