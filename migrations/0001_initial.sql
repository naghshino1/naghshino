PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT 'ceo',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit (
  id TEXT PRIMARY KEY,
  event TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TEXT NOT NULL
);
