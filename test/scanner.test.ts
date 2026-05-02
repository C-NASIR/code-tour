import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hashFile } from "../src/scanner/hashFile.js";
import {
  getMaxSourceFileSizeBytes,
  isSupportedSourceFile,
  shouldIgnoreBySize,
  shouldIgnorePath
} from "../src/scanner/ignoreRules.js";
import { scanProject } from "../src/scanner/scanProject.js";

describe("scanner", () => {
  it("filters supported source files and ignore rules", () => {
    expect(isSupportedSourceFile("src/app.ts")).toBe(true);
    expect(isSupportedSourceFile("src/server.cjs")).toBe(true);
    expect(isSupportedSourceFile("src/App.tsx")).toBe(false);
    expect(isSupportedSourceFile("src/logo.svg")).toBe(false);
    expect(shouldIgnorePath("node_modules/pkg/index.ts")).toBe(true);
    expect(shouldIgnorePath("src/package-lock.json")).toBe(true);
    expect(shouldIgnoreBySize(getMaxSourceFileSizeBytes() + 1)).toBe(true);
  });

  it("hashes file content deterministically", () => {
    expect(hashFile("hello world")).toBe(hashFile("hello world"));
    expect(hashFile("hello world")).not.toBe(hashFile("different"));
  });

  it("normalizes scanned files to relative project paths", async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "code-tour-scan-"));
    const nestedDir = path.join(projectRoot, "src", "nested");
    await fs.mkdir(nestedDir, {
      recursive: true
    });
    await fs.writeFile(path.join(nestedDir, "example.ts"), "export const value = 1;\n", "utf8");

    const result = await scanProject(projectRoot);

    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.path).toBe("src/nested/example.ts");
  });
});
