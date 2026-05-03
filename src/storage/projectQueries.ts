import type { CallGraphEdge, CallGraphNode } from "../graph/callGraphTypes.js";
import type { ExpressMountRecord, RouteHandlerRef } from "../types/records.js";
import { listCallGraphEdgesBySourceNodeIds, listCallGraphNodes } from "./callGraphRepository.js";
import { listExpressMounts, listExpressMountsByRouterFilePath, toExpressMountRecord } from "./expressMountRepository.js";
import { listFunctionCallsForFile } from "./functionCallRepository.js";
import { openIndexedProjectDatabase } from "./db.js";
import { listExportsForFile } from "./exportRepository.js";
import { getFileByPath, listFiles } from "./fileRepository.js";
import { listImportsForFile } from "./importRepository.js";
import { listMiddleware, listMiddlewareForFile } from "./middlewareRepository.js";
import { listRouteHandlers, listRoutes, listRoutesForFile, toRouteHandlerRef } from "./routeRepository.js";
import { getFileSummary } from "./summaryRepository.js";
import { listSymbols, listSymbolsForFile } from "./symbolRepository.js";

type IndexedRoute = {
  id: string;
  method: string;
  path: string;
  fullPath: string;
  fullPathConfidence: string;
  filePath: string;
  handlers: RouteHandlerRef[];
};

function loadRoutesWithHandlers(
  db: ReturnType<typeof openIndexedProjectDatabase>,
  routes: ReturnType<typeof listRoutes>
): IndexedRoute[] {
  const handlersByRouteId = new Map<string, RouteHandlerRef[]>();

  for (const row of listRouteHandlers(
    db,
    routes.map((route) => route.id)
  )) {
    const routeHandlers = handlersByRouteId.get(row.routeId) ?? [];
    routeHandlers.push(toRouteHandlerRef(row));
    handlersByRouteId.set(row.routeId, routeHandlers);
  }

  return routes.map((route) => ({
    id: route.id,
    method: route.method,
    path: route.path,
    fullPath: route.fullPath,
    fullPathConfidence: route.fullPathConfidence,
    filePath: route.filePath,
    handlers: handlersByRouteId.get(route.id) ?? [],
  }));
}

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
  id: string;
  method: string;
  path: string;
  fullPath: string;
  fullPathConfidence: string;
  handlers: RouteHandlerRef[];
  filePath: string;
}> {
  const db = openIndexedProjectDatabase(projectRoot);

  try {
    return loadRoutesWithHandlers(db, listRoutes(db));
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

export function readIndexedExpressMounts(projectRoot: string): ExpressMountRecord[] {
  const db = openIndexedProjectDatabase(projectRoot);

  try {
    return listExpressMounts(db).map(toExpressMountRecord);
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
  routes: Array<{
    method: string;
    path: string;
    fullPath: string;
    fullPathConfidence: string;
    handlers: RouteHandlerRef[];
  }>;
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
      routes: loadRoutesWithHandlers(db, listRoutesForFile(db, filePath)).map((record) => ({
        method: record.method,
        path: record.path,
        fullPath: record.fullPath,
        fullPathConfidence: record.fullPathConfidence,
        handlers: record.handlers,
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

export function readTraceIndexData(projectRoot: string): {
  routes: IndexedRoute[];
  mounts: ExpressMountRecord[];
  callGraphNodes: CallGraphNode[];
  callGraphEdges: CallGraphEdge[];
} {
  const db = openIndexedProjectDatabase(projectRoot);

  try {
    const routes = loadRoutesWithHandlers(db, listRoutes(db));
    const mounts = listExpressMounts(db).map(toExpressMountRecord);
    const callGraphNodes = listCallGraphNodes(db);
    const callGraphEdges = listCallGraphEdgesBySourceNodeIds(
      db,
      callGraphNodes.map((node) => node.id)
    );

    return {
      routes,
      mounts,
      callGraphNodes,
      callGraphEdges,
    };
  } finally {
    db.close();
  }
}

export function readMountsForRouterFile(projectRoot: string, routerFilePath: string): ExpressMountRecord[] {
  const db = openIndexedProjectDatabase(projectRoot);

  try {
    return listExpressMountsByRouterFilePath(db, routerFilePath).map(toExpressMountRecord);
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
