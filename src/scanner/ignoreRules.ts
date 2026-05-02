import path from "node:path";

const ALLOWED_EXTENSIONS = new Set([".ts", ".js", ".mts", ".cts", ".mjs", ".cjs"]);
const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".git",
  ".next",
  ".vite"
]);
const IGNORED_FILES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb"
]);
const MAX_SOURCE_FILE_SIZE_BYTES = 300 * 1024;

export function isSupportedSourceFile(filePath: string): boolean {
  return ALLOWED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function shouldIgnorePath(relativePath: string): boolean {
  const normalized = relativePath.split(path.sep);

  if (normalized.some((segment) => IGNORED_DIRECTORIES.has(segment))) {
    return true;
  }

  return IGNORED_FILES.has(path.basename(relativePath));
}

export function shouldIgnoreBySize(size: number): boolean {
  return size > MAX_SOURCE_FILE_SIZE_BYTES;
}

export function getMaxSourceFileSizeBytes(): number {
  return MAX_SOURCE_FILE_SIZE_BYTES;
}
