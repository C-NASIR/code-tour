import type { ProjectDatabase } from "./db.js";
import type { RouteHandlerRef, RouteRecord } from "../types/records.js";

type RouteRow = {
  id: string;
  method: string;
  path: string;
  fullPath: string;
  fullPathConfidence: string;
  filePath: string;
  startLine: number;
  endLine: number;
};

type RouteHandlerRow = {
  id: string;
  routeId: string;
  order: number;
  kind: string;
  name: string | null;
  filePath: string;
  targetFilePath: string | null;
  targetNodeId: string | null;
  confidence: string;
  startLine: number | null;
  endLine: number | null;
};

export function insertRoutes(db: ProjectDatabase, routes: RouteRecord[]): void {
  const routeStatement = db.prepare(
    `INSERT INTO routes (id, file_path, method, path, full_path, full_path_confidence, start_line, end_line)
     VALUES (@id, @filePath, @method, @path, @fullPath, @fullPathConfidence, @startLine, @endLine)`
  );
  const handlerStatement = db.prepare(
    `INSERT INTO route_handlers (
        id, route_id, order_index, kind, name, file_path, target_file_path, target_node_id, confidence, start_line, end_line
      ) VALUES (
        @id, @routeId, @order, @kind, @name, @filePath, @targetFilePath, @targetNodeId, @confidence, @startLine, @endLine
      )`
  );

  for (const record of routes) {
    routeStatement.run(record);

    for (const handler of record.handlers) {
      handlerStatement.run({
        ...handler,
        name: handler.name ?? null,
        targetFilePath: handler.targetFilePath ?? null,
        targetNodeId: handler.targetNodeId ?? null,
      });
    }
  }
}

export function listRoutes(db: ProjectDatabase): RouteRow[] {
  return db
    .prepare(
      `SELECT id, method, path, full_path AS fullPath, full_path_confidence AS fullPathConfidence, file_path AS filePath,
              start_line AS startLine, end_line AS endLine
       FROM routes
       ORDER BY file_path, start_line`
    )
    .all() as RouteRow[];
}

export function listRoutesForFile(db: ProjectDatabase, filePath: string): RouteRow[] {
  return db
    .prepare(
      `SELECT id, method, path, full_path AS fullPath, full_path_confidence AS fullPathConfidence, file_path AS filePath,
              start_line AS startLine, end_line AS endLine
       FROM routes
       WHERE file_path = ?
       ORDER BY start_line`
    )
    .all(filePath) as RouteRow[];
}

export function listRouteHandlers(db: ProjectDatabase, routeIds: string[]): RouteHandlerRow[] {
  if (routeIds.length === 0) {
    return [];
  }

  const placeholders = routeIds.map(() => "?").join(", ");

  return db
    .prepare(
      `SELECT id, route_id AS routeId, order_index AS "order", kind, name, file_path AS filePath,
              target_file_path AS targetFilePath, target_node_id AS targetNodeId, confidence,
              start_line AS startLine, end_line AS endLine
       FROM route_handlers
       WHERE route_id IN (${placeholders})
       ORDER BY route_id, order_index`
    )
    .all(...routeIds) as RouteHandlerRow[];
}

export function toRouteHandlerRef(row: RouteHandlerRow): RouteHandlerRef {
  return {
    id: row.id,
    routeId: row.routeId,
    order: row.order,
    kind: row.kind as RouteHandlerRef["kind"],
    name: row.name,
    filePath: row.filePath,
    targetFilePath: row.targetFilePath,
    targetNodeId: row.targetNodeId,
    confidence: row.confidence as RouteHandlerRef["confidence"],
    startLine: row.startLine,
    endLine: row.endLine,
  };
}
