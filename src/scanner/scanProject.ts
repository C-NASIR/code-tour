import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { createId } from "../utils/createId.js";
import { resolveProjectRoot, toRelativeProjectPath } from "../utils/pathUtils.js";
import { hashFile } from "./hashFile.js";
import { isSupportedSourceFile, shouldIgnoreBySize, shouldIgnorePath } from "./ignoreRules.js";
import type { ScanProjectResult, SourceFileRecord, SourceLanguage } from "../types/sourceFile.js";

const SOURCE_GLOB = "**/*.{ts,js,mts,cts,mjs,cjs}";

function getLanguageForExtension(filePath: string): SourceLanguage {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".ts" || extension === ".mts" || extension === ".cts") {
    return "ts";
  }

  return "js";
}

/**
 * Scans a project directory for supported source files and returns normalized
 * in-memory file records for downstream parsing and storage.
 *
 * Files that are unreadable, unsupported, or too large are skipped and counted
 * rather than aborting the scan.
 */
export async function scanProject(projectPath: string): Promise<ScanProjectResult> {
  const projectRoot = resolveProjectRoot(projectPath);
  const stats = await fs.stat(projectRoot).catch(() => null);

  if (!stats || !stats.isDirectory()) {
    throw new Error(`Project path is not a directory: ${projectRoot}`);
  }

  const relativePaths = await fg(SOURCE_GLOB, {
    cwd: projectRoot,
    dot: false,
    onlyFiles: true,
    unique: true,
    followSymbolicLinks: false,
    ignore: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.git/**",
      "**/.next/**",
      "**/.vite/**"
    ]
  });

  const files: SourceFileRecord[] = [];
  let skippedFiles = 0;

  for (const relativePath of relativePaths) {
    if (!isSupportedSourceFile(relativePath) || shouldIgnorePath(relativePath)) {
      skippedFiles += 1;
      continue;
    }

    const absolutePath = path.join(projectRoot, relativePath);
    const fileStats = await fs.stat(absolutePath).catch(() => null);

    if (!fileStats || !fileStats.isFile() || shouldIgnoreBySize(fileStats.size)) {
      skippedFiles += 1;
      continue;
    }

    const content = await fs.readFile(absolutePath, "utf8").catch(() => null);

    if (content === null) {
      skippedFiles += 1;
      continue;
    }

    const normalizedPath = toRelativeProjectPath(projectRoot, absolutePath);

    files.push({
      id: createId("file", normalizedPath),
      path: normalizedPath,
      absolutePath,
      language: getLanguageForExtension(relativePath),
      content,
      hash: hashFile(content),
      size: Buffer.byteLength(content, "utf8")
    });
  }

  files.sort((left, right) => left.path.localeCompare(right.path));

  return {
    files,
    skippedFiles
  };
}
