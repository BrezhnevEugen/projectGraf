import type { DB } from './database.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  root_path TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_scanned_at TEXT
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rel_path TEXT NOT NULL,
  abs_path TEXT NOT NULL,
  language TEXT NOT NULL,
  mtime INTEGER NOT NULL,
  hash TEXT,
  UNIQUE(project_id, rel_path)
);
CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  language TEXT NOT NULL,
  parent_id TEXT,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_nodes_project ON nodes(project_id);
CREATE INDEX IF NOT EXISTS idx_nodes_file ON nodes(file_id);
CREATE INDEX IF NOT EXISTS idx_nodes_name ON nodes(project_id, name);

CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  target_id TEXT,
  kind TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  raw_target TEXT
);
CREATE INDEX IF NOT EXISTS idx_edges_project ON edges(project_id);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);

CREATE TABLE IF NOT EXISTS node_descriptions (
  node_id TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  role TEXT,
  concerns TEXT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  generated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS architecture_reviews (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  highlights TEXT NOT NULL,
  risks TEXT NOT NULL,
  recommendations TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  generated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS smells (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  metric REAL,
  node_ids TEXT NOT NULL,
  detected_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_smells_project ON smells(project_id);
`;

export function migrate(db: DB): void {
  db.exec(SCHEMA);
}
