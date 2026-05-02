import type { ProjectDatabase } from "./db.js";
import type { RouteRecord } from "../types/records.js";

type RouteRow = {
  method: string;
  path: string;
  handlerName: string | null;
  filePath: string;
  startLine: number;
  endLine: number;
};

export function insertRoutes(db: ProjectDatabase, routes: RouteRecord[]): void {
  const statement = db.prepare(
    `INSERT INTO routes (id, file_path, method, path, handler_name, start_line, end_line)
     VALUES (@id, @filePath, @method, @path, @handlerName, @startLine, @endLine)`
  );

  for (const record of routes) {
    statement.run({
      ...record,
      handlerName: record.handlerName ?? null,
    });
  }
}

export function listRoutes(db: ProjectDatabase): RouteRow[] {
  return db
    .prepare(
      `SELECT method, path, handler_name AS handlerName, file_path AS filePath,
              start_line AS startLine, end_line AS endLine
       FROM routes
       ORDER BY file_path, start_line`
    )
    .all() as RouteRow[];
}

export function listRoutesForFile(db: ProjectDatabase, filePath: string): RouteRow[] {
  return db
    .prepare(
      `SELECT method, path, handler_name AS handlerName, file_path AS filePath,
              start_line AS startLine, end_line AS endLine
       FROM routes
       WHERE file_path = ?
       ORDER BY start_line`
    )
    .all(filePath) as RouteRow[];
}
