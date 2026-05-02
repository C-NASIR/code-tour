import type { ProjectDatabase } from "./db.js";
import type { ParsedFile } from "../types/parsedFile.js";
import type { StoredFileSummary } from "../types/fileSummary.js";
import type { SourceFileRecord } from "../types/sourceFile.js";
import { insertExports } from "./exportRepository.js";
import { insertFiles } from "./fileRepository.js";
import { insertFunctionCalls } from "./functionCallRepository.js";
import { insertImports } from "./importRepository.js";
import { insertMiddleware } from "./middlewareRepository.js";
import { insertRoutes } from "./routeRepository.js";
import { insertFileSummaries } from "./summaryRepository.js";
import { insertSymbols } from "./symbolRepository.js";

/**
 * Replaces the persisted SQLite snapshot for a project in a single
 * transaction.
 *
 * This guarantees the database is either fully refreshed or left unchanged.
 */
export function replaceProjectIndex(
  db: ProjectDatabase,
  files: SourceFileRecord[],
  parsedFiles: ParsedFile[],
  summaries: StoredFileSummary[]
): void {
  const transaction = db.transaction(() => {
    db.exec(`
      DELETE FROM metadata;
      DELETE FROM imports;
      DELETE FROM exports;
      DELETE FROM symbols;
      DELETE FROM routes;
      DELETE FROM middleware;
      DELETE FROM function_calls;
      DELETE FROM file_summaries;
      DELETE FROM files;
      DELETE FROM files_fts;
    `);

    insertFiles(db, files);
    insertImports(
      db,
      parsedFiles.flatMap((file) => file.imports)
    );
    insertExports(
      db,
      parsedFiles.flatMap((file) => file.exports)
    );
    insertSymbols(
      db,
      parsedFiles.flatMap((file) => file.symbols)
    );
    insertRoutes(
      db,
      parsedFiles.flatMap((file) => file.routes)
    );
    insertMiddleware(
      db,
      parsedFiles.flatMap((file) => file.middleware)
    );
    insertFunctionCalls(
      db,
      parsedFiles.flatMap((file) => file.functionCalls)
    );
    insertFileSummaries(db, summaries);

    db.exec(`
      INSERT INTO files_fts (path, content)
      SELECT path, content
      FROM files;
    `);

    const metadataStatement = db.prepare(
      `INSERT INTO metadata (key, value) VALUES (?, ?)`
    );
    metadataStatement.run("schema_version", "1");
    metadataStatement.run("indexed_at", new Date().toISOString());
  });

  transaction();
}
