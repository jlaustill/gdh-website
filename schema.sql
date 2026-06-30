CREATE TABLE IF NOT EXISTS locations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  recorded_at TEXT    NOT NULL,
  latitude    REAL    NOT NULL,
  longitude   REAL    NOT NULL,
  accuracy    REAL,
  speed       REAL,
  heading     REAL
);

CREATE INDEX IF NOT EXISTS idx_locations_recorded_at ON locations (recorded_at);
