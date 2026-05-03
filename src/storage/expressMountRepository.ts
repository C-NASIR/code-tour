import type { ExpressMountRecord } from "../types/records.js";
import type { ProjectDatabase } from "./db.js";

type ExpressMountRow = {
  id: string;
  filePath: string;
  mountPath: string;
  routerName: string | null;
  routerFilePath: string | null;
  confidence: string;
  middlewareJson: string;
  startLine: number;
  endLine: number;
};

export function insertExpressMounts(db: ProjectDatabase, mounts: ExpressMountRecord[]): void {
  const statement = db.prepare(
    `INSERT INTO express_mounts (
        id, file_path, mount_path, router_name, router_file_path, confidence, middleware_json, start_line, end_line
      ) VALUES (
        @id, @filePath, @mountPath, @routerName, @routerFilePath, @confidence, @middlewareJson, @startLine, @endLine
      )`
  );

  for (const mount of mounts) {
    statement.run({
      ...mount,
      routerName: mount.routerName ?? null,
      routerFilePath: mount.routerFilePath ?? null,
      middlewareJson: JSON.stringify(mount.middleware),
    });
  }
}

export function listExpressMounts(db: ProjectDatabase): ExpressMountRow[] {
  return db
    .prepare(
      `SELECT id, file_path AS filePath, mount_path AS mountPath, router_name AS routerName,
              router_file_path AS routerFilePath, confidence, middleware_json AS middlewareJson,
              start_line AS startLine, end_line AS endLine
       FROM express_mounts
       ORDER BY file_path, start_line`
    )
    .all() as ExpressMountRow[];
}

export function listExpressMountsByRouterFilePath(db: ProjectDatabase, routerFilePath: string): ExpressMountRow[] {
  return db
    .prepare(
      `SELECT id, file_path AS filePath, mount_path AS mountPath, router_name AS routerName,
              router_file_path AS routerFilePath, confidence, middleware_json AS middlewareJson,
              start_line AS startLine, end_line AS endLine
       FROM express_mounts
       WHERE router_file_path = ?
       ORDER BY file_path, start_line`
    )
    .all(routerFilePath) as ExpressMountRow[];
}

export function toExpressMountRecord(row: ExpressMountRow): ExpressMountRecord {
  return {
    id: row.id,
    filePath: row.filePath,
    mountPath: row.mountPath,
    routerName: row.routerName,
    routerFilePath: row.routerFilePath,
    confidence: row.confidence as ExpressMountRecord["confidence"],
    middleware: JSON.parse(row.middlewareJson) as ExpressMountRecord["middleware"],
    startLine: row.startLine,
    endLine: row.endLine,
  };
}
