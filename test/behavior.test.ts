import { describe, expect, it } from "vitest";
import { answerBehaviorQuestion, parseBehaviorQuestion } from "../src/behavior/answerBehaviorQuestion.js";
import { buildRouteBehavior } from "../src/behavior/buildRouteBehavior.js";
import { extractFunctionBehaviorFromSnapshot } from "../src/behavior/extractFunctionBehavior.js";
import { resolveParsedExpressArtifacts } from "../src/frameworks/express/index.js";
import { extractCallGraph } from "../src/graph/extractCallGraph.js";
import { traceRouteFlow } from "../src/flow/traceRouteFlow.js";
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

function buildParsedFiles(fileMap: Record<string, string>): ParsedFile[] {
  const project = createParserProject();
  const parsedFiles: ParsedFile[] = [];

  for (const [filePath, content] of Object.entries(fileMap)) {
    const parsedFile = parseSourceFile(project, createSourceFileRecord(filePath, content));

    if (!parsedFile) {
      throw new Error(`Expected parsed file for ${filePath}`);
    }

    parsedFiles.push(parsedFile);
  }

  resolveParsedExpressArtifacts(parsedFiles);
  extractCallGraph(parsedFiles);

  return parsedFiles;
}

function buildFunctionBehavior(
  filePath: string,
  content: string,
  qualifiedName: string
) {
  const parsedFiles = buildParsedFiles({ [filePath]: content });
  const node = parsedFiles
    .flatMap((file) => file.callGraphNodes)
    .find((candidate) => candidate.qualifiedName === qualifiedName);

  if (!node) {
    throw new Error(`Expected call-graph node for ${qualifiedName}`);
  }

  return extractFunctionBehaviorFromSnapshot(node, content).behavior;
}

describe("behavior extraction", () => {
  it("extracts request, header, env, destructured, and alias-backed reads", () => {
    const behavior = buildFunctionBehavior(
      "src/controller.ts",
      `
        import type { Request, Response } from "express";

        export function createUser(req: Request, res: Response) {
          const auth = req.get("authorization");
          const payload = req.body;
          const { email } = req.body;
          const limit = req.query.limit;
          const id = req.params.id;
          const secret = process.env.JWT_SECRET;
          const name = payload.name;
          return res.json({ auth, email, limit, id, secret, name });
        }
      `,
      "createUser"
    );

    expect(behavior.dataReads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "req_headers", name: "authorization" }),
        expect.objectContaining({ source: "req_body", name: "*" }),
        expect.objectContaining({ source: "local_variable", name: "payload" }),
        expect.objectContaining({ source: "req_body", name: "email" }),
        expect.objectContaining({ source: "local_variable", name: "email" }),
        expect.objectContaining({ source: "req_query", name: "limit" }),
        expect.objectContaining({ source: "req_params", name: "id" }),
        expect.objectContaining({ source: "env", name: "JWT_SECRET" }),
        expect.objectContaining({ source: "req_body", name: "name" }),
      ])
    );
  });

  it("classifies required, conditional, schema, and manual validations", () => {
    const behavior = buildFunctionBehavior(
      "src/controller.ts",
      `
        import type { Request, Response } from "express";

        const schema = {
          safeParse(input: unknown) {
            return input;
          }
        };

        function validateUser(_input: unknown) {
          return true;
        }

        export function createUser(req: Request, res: Response) {
          const { email, password, confirmPassword } = req.body;

          if (!email) {
            return res.status(400).json({ error: "missing email" });
          }

          if (email.length < 3) {
            return res.status(400).json({ error: "short email" });
          }

          if (password !== confirmPassword) {
            return res.status(400).json({ error: "password mismatch" });
          }

          schema.safeParse(req.body);
          validateUser(req.body);
          return res.end();
        }
      `,
      "createUser"
    );

    expect(behavior.validations.map((item) => item.kind)).toEqual(
      expect.arrayContaining(["required_check", "conditional_check", "schema_validation", "manual_check"])
    );
  });

  it("classifies direct side effects across supported categories", () => {
    const behavior = buildFunctionBehavior(
      "src/effects.ts",
      `
        import type { Request, Response } from "express";

        const usersRepo = { create() {} };
        const queue = { add() {} };
        const jwt = { sign() {} };
        const fs = { writeFile() {} };

        export function createUser(_req: Request, res: Response) {
          usersRepo.create();
          console.log("created");
          jwt.sign("token");
          fs.writeFile("file.txt", "data");
          fetch("https://example.com");
          queue.add("welcome-email");
          return res.end();
        }
      `,
      "createUser"
    );

    expect(behavior.sideEffects.map((item) => item.kind)).toEqual(
      expect.arrayContaining(["database", "logging", "auth", "filesystem", "external_http", "queue"])
    );
  });

  it("collapses chained responses and extracts explicit error paths", () => {
    const behavior = buildFunctionBehavior(
      "src/controller.ts",
      `
        import type { NextFunction, Request, Response } from "express";

        export function createUser(_req: Request, res: Response, next: NextFunction) {
          try {
            next(new Error("bad"));
            throw new Error("boom");
          } catch (error) {
            res.status(404).json({ error: "missing" });
          }

          return res.status(201).json({ ok: true });
        }
      `,
      "createUser"
    );

    expect(behavior.responses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "json", statusCode: 404 }),
        expect.objectContaining({ kind: "json", statusCode: 201 }),
      ])
    );
    expect(behavior.responses.some((item) => item.kind === "status")).toBe(false);
    expect(behavior.errors.map((item) => item.kind)).toEqual(
      expect.arrayContaining(["next_error", "throw", "catch_block", "status_error_response"])
    );
  });

  it("keeps standalone function behavior scoped to the direct body", () => {
    const behavior = buildFunctionBehavior(
      "src/controller.ts",
      `
        import type { Request, Response } from "express";

        const usersRepo = {
          create() {}
        };

        export function createUser(_req: Request, res: Response) {
          function inner() {
            usersRepo.create();
          }

          return res.end();
        }
      `,
      "createUser"
    );

    expect(behavior.sideEffects).toHaveLength(0);
    expect(behavior.responses).toEqual([expect.objectContaining({ kind: "end" })]);
  });

  it("merges route behavior in flow order and propagates unresolved calls", () => {
    const fileMap = {
      "src/app.ts": `
        import express from "express";
        import { listUsers } from "./controller";

        const app = express();
        app.get("/users", listUsers);
      `,
      "src/controller.ts": `
        import type { Request, Response } from "express";
        import { UserService } from "./service";

        export function listUsers(req: Request, res: Response) {
          const limit = req.query.limit;
          fetch("https://example.com");
          return res.json(UserService.listUsers(Number(limit)));
        }
      `,
      "src/service.ts": `
        import { usersRepo } from "./repo";

        export class UserService {
          static listUsers(limit: number) {
            return usersRepo.findAll(limit);
          }
        }
      `,
      "src/repo.ts": `
        export const usersRepo = {
          findAll(limit: number) {
            return db.query(limit);
          }
        };
      `,
    };
    const parsedFiles = buildParsedFiles(fileMap);
    const flow = traceRouteFlow(
      {
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
      },
      "GET",
      "/users"
    );
    const contents = new Map(Object.entries(fileMap));
    const nodes = new Map(parsedFiles.flatMap((file) => file.callGraphNodes).map((node) => [node.id, node]));
    const behavior = buildRouteBehavior({
      flow,
      resolveNodeById: (nodeId) => nodes.get(nodeId) ?? null,
      resolveNodeForStep: (step) => {
        const match = parsedFiles
          .flatMap((file) => file.callGraphNodes)
          .find((node) => node.filePath === step.filePath && node.startLine === step.line);

        return {
          node: match ?? null,
          unresolvedBehavior: match ? [] : [`Could not resolve ${step.label}`],
          confidence: match ? "medium" : "low",
        };
      },
      readIndexedFileContent: (filePath) => contents.get(filePath) ?? "",
    });

    expect(behavior.functionBehaviors.map((item) => item.name)).toEqual([
      "listUsers",
      "UserService.listUsers",
      "usersRepo.findAll",
    ]);
    expect(behavior.combinedDataReads).toEqual(
      expect.arrayContaining([expect.objectContaining({ source: "req_query", name: "limit" })])
    );
    expect(behavior.combinedSideEffects.map((item) => item.kind)).toEqual(
      expect.arrayContaining(["external_http", "database"])
    );
    expect(behavior.unresolvedBehavior.join("\n")).toContain("fetch");
    expect(behavior.filesInvolved).toEqual([
      "src/app.ts",
      "src/controller.ts",
      "src/service.ts",
      "src/repo.ts",
    ]);
    expect(behavior.confidence).toBe("low");
  });

  it("parses supported ask intents and rejects unsupported questions", () => {
    expect(parseBehaviorQuestion("What input does POST /users read?")).toEqual({
      method: "POST",
      path: "/users",
      intent: "input_reads",
    });

    expect(() => parseBehaviorQuestion("How does auth work?")).toThrow("Unsupported question");
  });

  it("answers supported ask questions from route behavior only", () => {
    const behavior = {
      method: "POST",
      path: "/users",
      routeFilePath: "src/routes/users.ts",
      flowSteps: [],
      functionBehaviors: [],
      combinedDataReads: [
        {
          source: "req_body" as const,
          name: "email",
          evidence: { filePath: "src/controller.ts", line: 4, text: "req.body.email", confidence: "high" as const },
        },
      ],
      combinedValidations: [],
      combinedSideEffects: [],
      combinedResponses: [],
      combinedErrors: [],
      filesInvolved: ["src/routes/users.ts"],
      unresolvedBehavior: [],
      confidence: "high" as const,
    };

    expect(answerBehaviorQuestion("What input does POST /users read?", behavior)).toContain("req_body email");
  });
});
