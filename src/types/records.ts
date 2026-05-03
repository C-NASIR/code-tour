export type ImportRecord = {
  id: string;
  sourceFile: string;
  importedFrom: string;
  importedNames: string[];
  startLine: number;
  endLine: number;
};

export type ExportKind = "named" | "default" | "reexport";

export type ExportRecord = {
  id: string;
  filePath: string;
  exportedNames: string[];
  exportKind: ExportKind;
  startLine: number;
  endLine: number;
};

export type FunctionRecord = {
  id: string;
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
};

export type ClassRecord = {
  id: string;
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
};

export type MethodRecord = {
  id: string;
  name: string;
  className: string;
  filePath: string;
  startLine: number;
  endLine: number;
};

export type SymbolKind = "function" | "class" | "method" | "export";

export type SymbolRecord = {
  id: string;
  filePath: string;
  name: string;
  kind: SymbolKind;
  startLine: number | null;
  endLine: number | null;
};

export type RouteMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type Confidence = "high" | "medium" | "low";

export type RouteHandlerKind = "named" | "inline" | "middleware";

export type RouteHandlerRef = {
  id: string;
  routeId: string;
  order: number;
  kind: RouteHandlerKind;
  name: string | null;
  filePath: string;
  targetFilePath?: string | null;
  targetNodeId?: string | null;
  confidence: Confidence;
  startLine: number | null;
  endLine: number | null;
};

export type RouteRecord = {
  id: string;
  filePath: string;
  method: RouteMethod;
  path: string;
  fullPath: string;
  fullPathConfidence: Confidence;
  handlers: RouteHandlerRef[];
  startLine: number;
  endLine: number;
};

export type ExpressMountRecord = {
  id: string;
  filePath: string;
  mountPath: string;
  routerName: string | null;
  routerFilePath: string | null;
  confidence: Confidence;
  middleware: Omit<RouteHandlerRef, "routeId">[];
  startLine: number;
  endLine: number;
};

export type MiddlewareRecord = {
  id: string;
  filePath: string;
  mountPath?: string;
  middlewareName?: string;
  startLine: number;
  endLine: number;
};

export type FunctionCallRecord = {
  id: string;
  filePath: string;
  callee: string;
  startLine: number;
  endLine: number;
};

export type ObjectMethodRecord = {
  id: string;
  objectName: string;
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
};
