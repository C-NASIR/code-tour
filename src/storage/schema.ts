export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    language TEXT NOT NULL,
    content TEXT NOT NULL,
    hash TEXT NOT NULL,
    size INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS imports (
    id TEXT PRIMARY KEY,
    source_file TEXT NOT NULL,
    imported_from TEXT NOT NULL,
    imported_names TEXT NOT NULL,
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS exports (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    exported_names TEXT NOT NULL,
    export_kind TEXT NOT NULL,
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS symbols (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    start_line INTEGER,
    end_line INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS routes (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    handler_name TEXT,
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS middleware (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    mount_path TEXT,
    middleware_name TEXT,
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS function_calls (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    callee TEXT NOT NULL,
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS file_summaries (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL UNIQUE,
    summary_json TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_files_path ON files(path)`,
  `CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name)`,
  `CREATE INDEX IF NOT EXISTS idx_symbols_file_path ON symbols(file_path)`,
  `CREATE INDEX IF NOT EXISTS idx_imports_source_file ON imports(source_file)`,
  `CREATE INDEX IF NOT EXISTS idx_exports_file_path ON exports(file_path)`,
  `CREATE INDEX IF NOT EXISTS idx_routes_file_path ON routes(file_path)`,
  `CREATE INDEX IF NOT EXISTS idx_middleware_file_path ON middleware(file_path)`,
  `CREATE INDEX IF NOT EXISTS idx_function_calls_file_path ON function_calls(file_path)`,
  `CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(path, content)`
] as const;
