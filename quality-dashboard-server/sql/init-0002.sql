CREATE TABLE reports (
    id VARCHAR(50) NOT NULL,
    name VARCHAR(1000) NOT NULL,
    processor VARCHAR(200) NOT NULL,
    results TEXT,
    info TEXT,
    dateCreated VARCHAR(100) NOT NULL
);

CREATE TABLE labels (
    id VARCHAR(50) NOT NULL,
    name VARCHAR(1000) NOT NULL,
    value VARCHAR(1000) NOT NULL
);

CREATE TABLE reports_labels (
    reportId VARCHAR(50) NOT NULL,
    labelId VARCHAR(50) NOT NULL,
    FOREIGN KEY (reportId) REFERENCES reports(id) ON DELETE CASCADE,
    FOREIGN KEY (labelId) REFERENCES labels(id) ON DELETE CASCADE,
    UNIQUE(reportId, labelId)
);
