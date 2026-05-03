import type { ParsedFile } from "../../types/parsedFile.js";
import type { Confidence, ExpressMountRecord, RouteRecord } from "../../types/records.js";
import { resolveRelativeModulePath } from "../../utils/moduleResolution.js";
import { joinRoutePaths } from "../../utils/routePaths.js";

type ImportBinding = {
  localName: string;
  resolvedFilePath: string | null;
};

function collectImportBindings(parsedFile: ParsedFile, projectFiles: Set<string>): Map<string, ImportBinding> {
  const bindings = new Map<string, ImportBinding>();

  for (const declaration of parsedFile.sourceFile.getImportDeclarations()) {
    const importedFrom = declaration.getModuleSpecifierValue();
    const resolvedFilePath = resolveRelativeModulePath(parsedFile.filePath, importedFrom, projectFiles);
    const defaultImport = declaration.getDefaultImport();

    if (defaultImport) {
      bindings.set(defaultImport.getText(), {
        localName: defaultImport.getText(),
        resolvedFilePath,
      });
    }

    const namespaceImport = declaration.getNamespaceImport();

    if (namespaceImport) {
      bindings.set(namespaceImport.getText(), {
        localName: namespaceImport.getText(),
        resolvedFilePath,
      });
    }

    for (const namedImport of declaration.getNamedImports()) {
      const aliasNode = namedImport.getAliasNode();
      const localName = aliasNode?.getText() ?? namedImport.getNameNode().getText();

      bindings.set(localName, {
        localName,
        resolvedFilePath,
      });
    }
  }

  return bindings;
}

function resolveMountRouterFilePath(
  mount: ExpressMountRecord,
  parsedFile: ParsedFile,
  projectFiles: Set<string>
): { routerFilePath: string | null; confidence: Confidence } {
  if (!mount.routerName) {
    return {
      routerFilePath: null,
      confidence: "low",
    };
  }

  const bindings = collectImportBindings(parsedFile, projectFiles);
  const binding = bindings.get(mount.routerName);

  if (binding?.resolvedFilePath) {
    return {
      routerFilePath: binding.resolvedFilePath,
      confidence: "high",
    };
  }

  const sameFileHasRouter = parsedFile.sourceFile.getVariableDeclaration(mount.routerName);

  if (sameFileHasRouter) {
    return {
      routerFilePath: parsedFile.filePath,
      confidence: "high",
    };
  }

  return {
    routerFilePath: null,
    confidence: "low",
  };
}

function chooseBestConfidence(confidences: Confidence[]): Confidence {
  if (confidences.includes("low")) {
    return "low";
  }

  if (confidences.includes("medium")) {
    return "medium";
  }

  return "high";
}

function computeMountedPrefixes(
  filePath: string,
  mountsByRouterFile: Map<string, ExpressMountRecord[]>,
  parsedFilesByPath: Map<string, ParsedFile>,
  visited: Set<string>
): Array<{ path: string; confidence: Confidence; lineage: ExpressMountRecord[] }> {
  if (visited.has(filePath)) {
    return [];
  }

  visited.add(filePath);
  const incomingMounts = mountsByRouterFile.get(filePath) ?? [];

  if (incomingMounts.length === 0) {
    const directFile = parsedFilesByPath.get(filePath);
    const hasAppTarget = directFile?.sourceFile.getVariableDeclaration("app");

    visited.delete(filePath);
    return [
      {
        path: "",
        confidence: hasAppTarget ? "high" : "low",
        lineage: [],
      },
    ];
  }

  const prefixes: Array<{ path: string; confidence: Confidence; lineage: ExpressMountRecord[] }> = [];

  for (const mount of incomingMounts) {
    const parentPrefixes = computeMountedPrefixes(
      mount.filePath,
      mountsByRouterFile,
      parsedFilesByPath,
      visited
    );

    for (const parentPrefix of parentPrefixes) {
      prefixes.push({
        path: parentPrefix.path ? joinRoutePaths(parentPrefix.path, mount.mountPath) : mount.mountPath,
        confidence: chooseBestConfidence([parentPrefix.confidence, mount.confidence]),
        lineage: [...parentPrefix.lineage, mount],
      });
    }
  }

  visited.delete(filePath);
  return prefixes;
}

function chooseCanonicalPrefix(
  prefixes: Array<{ path: string; confidence: Confidence; lineage: ExpressMountRecord[] }>
): { path: string; confidence: Confidence; lineage: ExpressMountRecord[] } {
  return prefixes.sort((left, right) => left.path.localeCompare(right.path))[0] ?? {
    path: "",
    confidence: "low",
    lineage: [],
  };
}

export function resolveExpressMounts(parsedFiles: ParsedFile[]): void {
  const projectFiles = new Set(parsedFiles.map((file) => file.filePath));
  const parsedFilesByPath = new Map(parsedFiles.map((file) => [file.filePath, file]));

  for (const parsedFile of parsedFiles) {
    parsedFile.expressMounts = parsedFile.expressMounts.map((mount) => {
      const resolved = resolveMountRouterFilePath(mount, parsedFile, projectFiles);

      return {
        ...mount,
        routerFilePath: resolved.routerFilePath,
        confidence: resolved.confidence,
      };
    });
  }

  const mountsByRouterFile = new Map<string, ExpressMountRecord[]>();

  for (const parsedFile of parsedFiles) {
    for (const mount of parsedFile.expressMounts) {
      if (!mount.routerFilePath) {
        continue;
      }

      const records = mountsByRouterFile.get(mount.routerFilePath) ?? [];
      records.push(mount);
      mountsByRouterFile.set(mount.routerFilePath, records);
    }
  }

  for (const parsedFile of parsedFiles) {
    const prefixes = chooseCanonicalPrefix(
      computeMountedPrefixes(parsedFile.filePath, mountsByRouterFile, parsedFilesByPath, new Set<string>())
    );

    parsedFile.routes = parsedFile.routes.map((route): RouteRecord => ({
      ...route,
      fullPath: prefixes.path ? joinRoutePaths(prefixes.path, route.path) : route.path,
      fullPathConfidence: prefixes.confidence,
    }));
  }
}
