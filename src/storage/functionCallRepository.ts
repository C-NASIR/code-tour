import type { FunctionCallRecord } from "../types/records.js";
import type { ProjectDatabase } from "./db.js";

type FunctionCallRow = {
  callee: string;
  startLine: number;
  endLine: number;
};

export function insertFunctionCalls(db: ProjectDatabase, functionCalls: FunctionCallRecord[]): void {
  const statement = db.prepare(
    `INSERT INTO function_calls (id, file_path, callee, start_line, end_line)
     VALUES (@id, @filePath, @callee, @startLine, @endLine)`,
  );

  for (const record of functionCalls) {
    statement.run(record);
  }
}

export function listFunctionCallsForFile(db: ProjectDatabase, filePath: string): FunctionCallRow[] {
  return db
    .prepare(
      `SELECT callee, start_line AS startLine, end_line AS endLine
       FROM function_calls
       WHERE file_path = ?
       ORDER BY start_line`,
    )
    .all(filePath) as FunctionCallRow[];
}
