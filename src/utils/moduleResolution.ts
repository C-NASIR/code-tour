import path from "node:path";
import { normalizeProjectPath } from "./pathUtils.js";

const FILE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"] as const;

export function resolveRelativeModulePath(
  fromFilePath: string,
  importedFrom: string,
  projectFiles: Set<string>
): string | null {
  if (!importedFrom.startsWith(".")) {
    return null;
  }

  const basePath = normalizeProjectPath(path.posix.join(path.posix.dirname(fromFilePath), importedFrom));
  const candidates = new Set<string>([basePath]);

  for (const extension of FILE_EXTENSIONS) {
    candidates.add(`${basePath}${extension}`);
    candidates.add(normalizeProjectPath(path.posix.join(basePath, `index${extension}`)));
  }

  for (const candidate of candidates) {
    if (projectFiles.has(candidate)) {
      return candidate;
    }
  }

  return null;
}
