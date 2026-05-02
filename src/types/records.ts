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

export type RouteRecord = {
  id: string;
  filePath: string;
  method: RouteMethod;
  path: string;
  handlerName?: string;
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
