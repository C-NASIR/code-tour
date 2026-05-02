import type { ProjectDatabase } from "./db.js";
import type { SymbolRecord } from "../types/records.js";

type SymbolRow = {
  name: string;
  kind: string;
  filePath: string;
  startLine: number | null;
  endLine: number | null;
};

export function insertSymbols(db: ProjectDatabase, symbols: SymbolRecord[]): void {
  const statement = db.prepare(
    `INSERT INTO symbols (id, file_path, name, kind, start_line, end_line)
     VALUES (@id, @filePath, @name, @kind, @startLine, @endLine)`
  );

  for (const record of symbols) {
    statement.run(record);
  }
}

export function listSymbols(db: ProjectDatabase): SymbolRow[] {
  return db
    .prepare(
      `SELECT name, kind, file_path AS filePath, start_line AS startLine, end_line AS endLine
       FROM symbols
       WHERE kind IN ('function', 'class', 'method')
       ORDER BY name, file_path`
    )
    .all() as SymbolRow[];
}

export function listSymbolsForFile(db: ProjectDatabase, filePath: string): SymbolRow[] {
  return db
    .prepare(
      `SELECT name, kind, file_path AS filePath, start_line AS startLine, end_line AS endLine
       FROM symbols
       WHERE file_path = ?
       ORDER BY start_line, name`
    )
    .all(filePath) as SymbolRow[];
}
