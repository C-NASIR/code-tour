import { listFunctionCallsForFile } from "./functionCallRepository.js";
import { openIndexedProjectDatabase } from "./db.js";
import { listExportsForFile } from "./exportRepository.js";
import { getFileByPath, listFiles } from "./fileRepository.js";
import { listImportsForFile } from "./importRepository.js";
import { listMiddleware, listMiddlewareForFile } from "./middlewareRepository.js";
import { listRoutes, listRoutesForFile } from "./routeRepository.js";
import { getFileSummary } from "./summaryRepository.js";
import { listSymbols, listSymbolsForFile } from "./symbolRepository.js";

/**
 * Returns all indexed file paths for a project from the persisted snapshot.
 */
export function readIndexedFiles(projectRoot: string): string[] {
  const db = openIndexedProjectDatabase(projectRoot);

  try {
    return listFiles(db);
  } finally {
    db.close();
  }
}

/**
 * Returns the combined symbol view used by the `symbols` command.
 *
 * Symbols remain generic and exclude framework-specific records such as routes
 * and middleware.
 */
export function readIndexedSymbols(projectRoot: string): Array<{
  name: string;
  kind: string;
  filePath: string;
}> {
  const db = openIndexedProjectDatabase(projectRoot);

  try {
    return listSymbols(db).map((row) => ({
      name: row.name,
      kind: row.kind,
      filePath: row.filePath
    }));
  } finally {
    db.close();
  }
}

export function readIndexedRoutes(projectRoot: string): Array<{
  method: string;
  path: string;
  handlerName: string | null;
  filePath: string;
}> {
  const db = openIndexedProjectDatabase(projectRoot);

  try {
    return listRoutes(db).map((route) => ({
      method: route.method,
      path: route.path,
      handlerName: route.handlerName,
      filePath: route.filePath,
    }));
  } finally {
    db.close();
  }
}

export function readIndexedMiddleware(projectRoot: string): Array<{
  mountPath: string | null;
  middlewareName: string | null;
  filePath: string;
}> {
  const db = openIndexedProjectDatabase(projectRoot);

  try {
    return listMiddleware(db).map((record) => ({
      mountPath: record.mountPath,
      middlewareName: record.middlewareName,
      filePath: record.filePath,
    }));
  } finally {
    db.close();
  }
}

/**
 * Returns normalized import records for one indexed file.
 */
export function readImportsForFile(projectRoot: string, filePath: string): Array<{
  importedFrom: string;
  importedNames: string[];
}> {
  const db = openIndexedProjectDatabase(projectRoot);

  try {
    assertIndexedFile(db, filePath);
    return listImportsForFile(db, filePath).map((record) => ({
      importedFrom: record.importedFrom,
      importedNames: record.importedNames
    }));
  } finally {
    db.close();
  }
}

/**
 * Loads the full explanation payload for one indexed file, including metadata,
 * extracted structural facts, and the stored summary when one exists.
 */
export function readExplainData(projectRoot: string, filePath: string): {
  file: {
    path: string;
    language: string;
    hash: string;
    size: number;
  };
  imports: Array<{ importedFrom: string; importedNames: string[] }>;
  exports: Array<{ exportedNames: string[]; exportKind: string }>;
  symbols: Array<{ name: string; kind: string }>;
  routes: Array<{ method: string; path: string; handlerName: string | null }>;
  middleware: Array<{ mountPath: string | null; middlewareName: string | null }>;
  functionCalls: Array<{ callee: string }>;
  summary: {
    purpose: string;
    mainExports: string[];
    importantFunctions: string[];
    importantClasses: string[];
    externalDependencies: string[];
    sideEffects: string[];
  } | null;
} {
  const db = openIndexedProjectDatabase(projectRoot);

  try {
    const file = assertIndexedFile(db, filePath);

    return {
      file: {
        path: file.path,
        language: file.language,
        hash: file.hash,
        size: file.size
      },
      imports: listImportsForFile(db, filePath).map((record) => ({
        importedFrom: record.importedFrom,
        importedNames: record.importedNames
      })),
      exports: listExportsForFile(db, filePath).map((record) => ({
        exportedNames: record.exportedNames,
        exportKind: record.exportKind
      })),
      symbols: listSymbolsForFile(db, filePath).map((record) => ({
        name: record.name,
        kind: record.kind
      })),
      routes: listRoutesForFile(db, filePath).map((record) => ({
        method: record.method,
        path: record.path,
        handlerName: record.handlerName,
      })),
      middleware: listMiddlewareForFile(db, filePath).map((record) => ({
        mountPath: record.mountPath,
        middlewareName: record.middlewareName,
      })),
      functionCalls: listFunctionCallsForFile(db, filePath).map((record) => ({
        callee: record.callee,
      })),
      summary: getFileSummary(db, filePath)?.summary ?? null
    };
  } finally {
    db.close();
  }
}

function assertIndexedFile(
  db: Parameters<typeof getFileByPath>[0],
  filePath: string
): NonNullable<ReturnType<typeof getFileByPath>> {
  const file = getFileByPath(db, filePath);

  if (!file) {
    throw new Error(`File is not indexed: ${filePath}`);
  }

  return file;
}
