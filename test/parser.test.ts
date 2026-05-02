import { describe, expect, it } from "vitest";
import { createParserProject, parseSourceFile } from "../src/parser/parseSourceFile.js";
import { hashFile } from "../src/scanner/hashFile.js";
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

describe("parser", () => {
  it("extracts imports, exports, functions, classes, routes, middleware, and function calls", () => {
    const content = `
      const express = require("express");
      import { Router } from "express";
      import { listUsers } from "./controller";

      export const helper = () => listUsers();

      export class UserService {
        static list() {
          return helper();
        }
      }

      const app = express();
      const router = Router();
      app.use("/users", router);
      router.post("/login", listUsers);
    `;
    const project = createParserProject();
    const parsedFile = parseSourceFile(project, createSourceFileRecord("src/example.ts", content));

    expect(parsedFile).not.toBeNull();
    expect(parsedFile?.imports).toHaveLength(3);
    expect(parsedFile?.exports.some((record) => record.exportedNames.includes("helper"))).toBe(true);
    expect(parsedFile?.functions.map((record) => record.name)).toContain("helper");
    expect(parsedFile?.classes.map((record) => record.name)).toContain("UserService");
    expect(parsedFile?.methods.map((record) => record.name)).toContain("list");
    expect(parsedFile?.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: "POST",
          path: "/login",
          handlerName: "listUsers"
        })
      ])
    );
    expect(parsedFile?.middleware).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mountPath: "/users"
        })
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
});
