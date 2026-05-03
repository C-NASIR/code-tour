import { describe, expect, it } from "vitest";
import { traceRouteFlow } from "../src/flow/traceRouteFlow.js";
import { resolveParsedExpressArtifacts } from "../src/frameworks/express/index.js";
import { extractCallGraph } from "../src/graph/extractCallGraph.js";
import { createParserProject, parseSourceFile } from "../src/parser/parseSourceFile.js";
import { hashFile } from "../src/scanner/hashFile.js";
import type { ParsedFile } from "../src/types/parsedFile.js";
import type { SourceFileRecord } from "../src/types/sourceFile.js";

function createSourceFileRecord(filePath: string, content: string): SourceFileRecord {
  return {
    id: filePath,
    path: filePath,
    absolutePath: filePath,
    language: filePath.endsWith(".js") ? "js" : "ts",
    content,
    hash: hashFile(content),
    size: Buffer.byteLength(content, "utf8"),
  };
}

function buildTraceIndexData(filePath: string, content: string) {
  const project = createParserProject();
  const parsedFile = parseSourceFile(project, createSourceFileRecord(filePath, content));

  if (!parsedFile) {
    throw new Error("Expected parsed file");
  }

  const parsedFiles: ParsedFile[] = [parsedFile];
  resolveParsedExpressArtifacts(parsedFiles);
  extractCallGraph(parsedFiles);

  return {
    routes: parsedFiles.flatMap((file) =>
      file.routes.map((route) => ({
        id: route.id,
        method: route.method,
        path: route.path,
        fullPath: route.fullPath,
        fullPathConfidence: route.fullPathConfidence,
        filePath: route.filePath,
        handlers: route.handlers,
      }))
    ),
    mounts: parsedFiles.flatMap((file) => file.expressMounts),
    callGraphNodes: parsedFiles.flatMap((file) => file.callGraphNodes),
    callGraphEdges: parsedFiles.flatMap((file) => file.callGraphEdges),
  };
}

describe("traceRouteFlow", () => {
  it("caps traversal depth and avoids cycles", () => {
    const indexData = buildTraceIndexData(
      "src/app.ts",
      `
        import express from "express";

        const app = express();

        function alpha() {
          beta();
        }

        function beta() {
          alpha();
          gamma();
        }

        function gamma() {
          return "done";
        }

        app.get("/", alpha);
      `
    );

    const flow = traceRouteFlow(indexData, "GET", "/", 1);

    expect(flow.steps.map((step) => `${step.kind}:${step.label}`)).toEqual(
      expect.arrayContaining(["route:GET /", "handler:alpha", "function_call:beta"])
    );
    expect(flow.steps.filter((step) => step.label === "alpha")).toHaveLength(1);
    expect(flow.steps.some((step) => step.label === "gamma")).toBe(false);
  });
});
