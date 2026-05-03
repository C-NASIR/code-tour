import { describe, expect, it } from "vitest";
import { extractCallGraph } from "../src/graph/extractCallGraph.js";
import { resolveParsedExpressArtifacts } from "../src/frameworks/express/index.js";
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
    size: Buffer.byteLength(content, "utf8")
  };
}

function parseFiles(files: Array<{ filePath: string; content: string }>): ParsedFile[] {
  const project = createParserProject();
  const parsedFiles = files
    .map((file) => parseSourceFile(project, createSourceFileRecord(file.filePath, file.content)))
    .filter((file): file is ParsedFile => file !== null);

  resolveParsedExpressArtifacts(parsedFiles);
  extractCallGraph(parsedFiles);
  return parsedFiles;
}

describe("parser", () => {
  it("extracts route handler chains, mounts, and function calls", () => {
    const content = `
      const express = require("express");
      import { Router } from "express";
      import { listUsers } from "./controller";
      import { validateUser } from "./middleware";

      export const helper = () => listUsers();

      export class UserService {
        static list() {
          return helper();
        }
      }

      const app = express();
      const router = Router();
      app.use("/users", router);
      router.post("/login", validateUser, listUsers);
    `;
    const project = createParserProject();
    const parsedFile = parseSourceFile(project, createSourceFileRecord("src/example.ts", content));

    expect(parsedFile).not.toBeNull();
    expect(parsedFile?.imports).toHaveLength(4);
    expect(parsedFile?.exports.some((record) => record.exportedNames.includes("helper"))).toBe(true);
    expect(parsedFile?.functions.map((record) => record.name)).toContain("helper");
    expect(parsedFile?.classes.map((record) => record.name)).toContain("UserService");
    expect(parsedFile?.methods.map((record) => record.name)).toContain("list");
    expect(parsedFile?.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: "POST",
          path: "/login"
        })
      ])
    );
    expect(parsedFile?.routes[0]?.handlers.map((handler) => `${handler.kind}:${handler.name ?? "inline"}`)).toEqual([
      "middleware:validateUser",
      "named:listUsers",
    ]);
    expect(parsedFile?.middleware).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mountPath: "/users"
        })
      ])
    );
    expect(parsedFile?.expressMounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mountPath: "/users",
          routerName: "router",
        }),
      ])
    );
    expect(parsedFile?.functionCalls.map((record) => record.callee)).toEqual(
      expect.arrayContaining(["listUsers", "express", "Router", "app.use", "router.post", "helper"])
    );
  });

  it("skips malformed files", () => {
    const project = createParserProject();
    const parsedFile = parseSourceFile(project, createSourceFileRecord("src/broken.ts", "export const broken = ("));

    expect(parsedFile).toBeNull();
  });

  it("builds a conservative call graph for same-file, imported, and property-access calls", () => {
    const parsedFiles = parseFiles([
      {
        filePath: "src/handler.ts",
        content: `
          import { importedHelper } from "./helpers";
          import { UserService } from "./services/userService";
          import { usersRepo } from "./db/usersRepo";

          export function localHelper() {
            return "ok";
          }

          export function handle() {
            localHelper();
            importedHelper();
            UserService.listUsers();
            usersRepo.list();
            duplicate();
          }
        `,
      },
      {
        filePath: "src/helpers.ts",
        content: `
          export function importedHelper() {
            return "imported";
          }
        `,
      },
      {
        filePath: "src/services/userService.ts",
        content: `
          export class UserService {
            static listUsers() {
              return [];
            }
          }
        `,
      },
      {
        filePath: "src/db/usersRepo.ts",
        content: `
          export const usersRepo = {
            list() {
              return [];
            }
          };
        `,
      },
      {
        filePath: "src/a.ts",
        content: `export function duplicate() { return "a"; }`,
      },
      {
        filePath: "src/b.ts",
        content: `export function duplicate() { return "b"; }`,
      },
    ]);

    const handlerFile = parsedFiles.find((file) => file.filePath === "src/handler.ts");
    const handleNode = handlerFile?.callGraphNodes.find((node) => node.qualifiedName === "handle");
    const handleEdges = handlerFile?.callGraphEdges.filter((edge) => edge.sourceNodeId === handleNode?.id) ?? [];

    expect(handleEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ calleeText: "localHelper", resolutionKind: "same_file_named", confidence: "high" }),
        expect.objectContaining({ calleeText: "importedHelper", resolutionKind: "imported_named", confidence: "high" }),
        expect.objectContaining({ calleeText: "UserService.listUsers", resolutionKind: "imported_property", confidence: "medium" }),
        expect.objectContaining({ calleeText: "usersRepo.list", resolutionKind: "imported_property", confidence: "medium" }),
        expect.objectContaining({ calleeText: "duplicate", resolutionKind: "ambiguous", confidence: "low" }),
      ])
    );
  });
});
