import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getDatabasePath } from "../src/storage/db.js";
import {
  readExplainData,
  readIndexedFiles,
  readIndexedMiddleware,
  readIndexedRoutes
} from "../src/storage/projectQueries.js";
import { indexProject } from "../src/indexer/indexProject.js";
import { createOpenAIFileSummarizer } from "../src/ai/openaiClient.js";
import type { FileSummarizer } from "../src/ai/summarizeFile.js";
import { createTempExampleCopy } from "./helpers.js";

function createMockSummarizer(): { model: string; summarizeFile: FileSummarizer } {
  return {
    model: "test-model",
    summarizeFile: async ({ filePath }) => ({
      purpose: `Summary for ${filePath}`,
      mainExports: ["default"],
      importantFunctions: ["listUsers"],
      importantClasses: ["UserService"],
      externalDependencies: [],
      sideEffects: []
    })
  };
}

describe("indexer", () => {
  it("indexes a fixture project into SQLite", async () => {
    const projectRoot = await createTempExampleCopy("express-basic");
    const mock = createMockSummarizer();
    const report = await indexProject({
      projectPath: projectRoot,
      summarizeFile: mock.summarizeFile,
      summaryModel: mock.model
    });

    expect(report.filesScanned).toBe(5);
    expect(report.filesParsed).toBe(5);
    expect(report.classesFound).toBe(1);
    expect(report.methodsFound).toBe(2);
    expect(report.routesFound).toBe(3);
    expect(report.middlewareFound).toBe(2);
    expect(report.summariesCreated).toBe(5);

    const indexedFiles = readIndexedFiles(projectRoot);
    expect(indexedFiles).toContain("src/app.ts");
    expect(indexedFiles).toContain("src/routes/users.ts");

    const routes = readIndexedRoutes(projectRoot);
    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "GET", path: "/health" }),
        expect.objectContaining({ method: "GET", path: "/" }),
        expect.objectContaining({ method: "POST", path: "/" })
      ])
    );

    const middleware = readIndexedMiddleware(projectRoot);
    expect(middleware).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ mountPath: "/users", middlewareName: "usersRouter" })
      ])
    );

    const explained = readExplainData(projectRoot, "src/routes/users.ts");
    expect(explained.summary?.purpose).toBe("Summary for src/routes/users.ts");
    expect(explained.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: "GET",
          path: "/"
        })
      ])
    );
    expect(explained.functionCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          callee: "Router"
        })
      ])
    );

    const databasePath = getDatabasePath(projectRoot);
    await expect(fs.stat(databasePath)).resolves.toBeDefined();
  });

  it("counts malformed files as skipped without failing the run", async () => {
    const projectRoot = await createTempExampleCopy("express-basic");
    await fs.writeFile(path.join(projectRoot, "src", "broken.ts"), "export const broken = (", "utf8");
    const mock = createMockSummarizer();

    const report = await indexProject({
      projectPath: projectRoot,
      summarizeFile: mock.summarizeFile,
      summaryModel: mock.model
    });

    expect(report.filesScanned).toBe(6);
    expect(report.filesParsed).toBe(5);
    expect(report.skippedFiles).toBe(1);
  });

  it("fails fast when summary env vars are missing", () => {
    expect(() => createOpenAIFileSummarizer({})).toThrow("OPENAI_API_KEY is required");
  });
});
