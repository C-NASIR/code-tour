import { Project, ScriptKind, type SourceFile } from "ts-morph";
import { analyzeExpress } from "../frameworks/express/index.js";
import { extractClasses } from "./extractClasses.js";
import { extractExports } from "./extractExports.js";
import { extractFunctionCalls } from "./extractFunctionCalls.js";
import { extractFunctions } from "./extractFunctions.js";
import { extractImports } from "./extractImports.js";
import { extractObjectMethods } from "./extractObjectMethods.js";
import type { ParsedFile } from "../types/parsedFile.js";
import type { SourceFileRecord } from "../types/sourceFile.js";
import type { SymbolRecord } from "../types/records.js";
import { createId } from "../utils/createId.js";

function getScriptKind(filePath: string): ScriptKind {
  if (filePath.endsWith(".ts") || filePath.endsWith(".mts") || filePath.endsWith(".cts")) {
    return ScriptKind.TS;
  }

  return ScriptKind.JS;
}

export function createParserProject(): Project {
  return new Project({
    compilerOptions: {
      allowJs: true,
    },
    skipAddingFilesFromTsConfig: true,
    useInMemoryFileSystem: true
  });
}

function hasParseErrors(sourceFile: SourceFile): boolean {
  const compilerNode = sourceFile.compilerNode as { parseDiagnostics?: unknown[] };
  return (compilerNode.parseDiagnostics?.length ?? 0) > 0;
}

/**
 * Parses one source file into the normalized structural records stored by the
 * index.
 *
 * Files with parse diagnostics return `null` so the indexer can skip them
 * without failing the rest of the run.
 */
export function parseSourceFile(project: Project, file: SourceFileRecord): ParsedFile | null {
  const sourceFile = project.createSourceFile(file.path, file.content, {
    overwrite: true,
    scriptKind: getScriptKind(file.path)
  });

  if (hasParseErrors(sourceFile)) {
    return null;
  }

  const imports = extractImports(sourceFile, file.path);
  const exports = extractExports(sourceFile, file.path);
  const functions = extractFunctions(sourceFile, file.path);
  const { classes, methods } = extractClasses(sourceFile, file.path);
  const objectMethods = extractObjectMethods(sourceFile, file.path);
  const functionCalls = extractFunctionCalls(sourceFile, file.path);
  const parsedFile: ParsedFile = {
    filePath: file.path,
    sourceFile,
    imports,
    exports,
    functions,
    classes,
    methods,
    objectMethods,
    functionCalls,
    routes: [],
    middleware: [],
    expressMounts: [],
    callGraphNodes: [],
    callGraphEdges: [],
    symbols: [],
  };

  analyzeExpress(parsedFile);

  const symbols: SymbolRecord[] = [
    ...functions.map((record) => ({
      id: createId("symbol", file.path, "function", record.name, record.startLine),
      filePath: file.path,
      name: record.name,
      kind: "function" as const,
      startLine: record.startLine,
      endLine: record.endLine
    })),
    ...classes.map((record) => ({
      id: createId("symbol", file.path, "class", record.name, record.startLine),
      filePath: file.path,
      name: record.name,
      kind: "class" as const,
      startLine: record.startLine,
      endLine: record.endLine
    })),
    ...methods.map((record) => ({
      id: createId("symbol", file.path, "method", `${record.className}.${record.name}`, record.startLine),
      filePath: file.path,
        name: `${record.className}.${record.name}`,
        kind: "method" as const,
        startLine: record.startLine,
        endLine: record.endLine,
      })),
    ...objectMethods.map((record) => ({
      id: createId("symbol", file.path, "method", `${record.objectName}.${record.name}`, record.startLine),
      filePath: file.path,
      name: `${record.objectName}.${record.name}`,
      kind: "method" as const,
      startLine: record.startLine,
      endLine: record.endLine,
    })),
    ...exports.flatMap((record) =>
      record.exportedNames.map((name) => ({
        id: createId("symbol", file.path, "export", name, record.startLine),
        filePath: file.path,
        name,
        kind: "export" as const,
        startLine: record.startLine,
        endLine: record.endLine
      }))
    )
  ];

  parsedFile.symbols = symbols;

  return parsedFile;
}
