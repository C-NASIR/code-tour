import type { MiddlewareRecord } from "../types/records.js";
import type { ProjectDatabase } from "./db.js";

type MiddlewareRow = {
  filePath: string;
  mountPath: string | null;
  middlewareName: string | null;
  startLine: number;
  endLine: number;
};

export function insertMiddleware(db: ProjectDatabase, middleware: MiddlewareRecord[]): void {
  const statement = db.prepare(
    `INSERT INTO middleware (id, file_path, mount_path, middleware_name, start_line, end_line)
     VALUES (@id, @filePath, @mountPath, @middlewareName, @startLine, @endLine)`,
  );

  for (const record of middleware) {
    statement.run({
      ...record,
      mountPath: record.mountPath ?? null,
      middlewareName: record.middlewareName ?? null,
    });
  }
}

export function listMiddleware(db: ProjectDatabase): MiddlewareRow[] {
  return db
    .prepare(
      `SELECT file_path AS filePath, mount_path AS mountPath, middleware_name AS middlewareName,
              start_line AS startLine, end_line AS endLine
       FROM middleware
       ORDER BY file_path, start_line`,
    )
    .all() as MiddlewareRow[];
}

export function listMiddlewareForFile(db: ProjectDatabase, filePath: string): MiddlewareRow[] {
  return db
    .prepare(
      `SELECT file_path AS filePath, mount_path AS mountPath, middleware_name AS middlewareName,
              start_line AS startLine, end_line AS endLine
       FROM middleware
       WHERE file_path = ?
       ORDER BY start_line`,
    )
    .all(filePath) as MiddlewareRow[];
}
