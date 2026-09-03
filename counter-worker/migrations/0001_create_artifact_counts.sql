CREATE TABLE IF NOT EXISTS artifact_counts (
  artifact TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO artifact_counts (artifact, count)
VALUES ('build-the-entity', 0);
