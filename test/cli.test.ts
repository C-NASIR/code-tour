import { afterEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../src/cli/program.js";
import type { FileSummarizer } from "../src/ai/summarizeFile.js";
import { createTempExampleCopy, stripAnsi } from "./helpers.js";

function createMockSummarizer(): { model: string; summarizeFile: FileSummarizer } {
  return {
    model: "test-model",
    summarizeFile: async ({ filePath }) => ({
      purpose: `Summary for ${filePath}`,
      mainExports: ["default"],
      importantFunctions: ["listUsers"],
      importantClasses: ["UserService"],
      externalDependencies: ["express"],
      sideEffects: []
    })
  };
}

async function runCli(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const logs: string[] = [];
  const errors: string[] = [];
  const logSpy = vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
    logs.push(String(message ?? ""));
  });
  const errorSpy = vi.spyOn(console, "error").mockImplementation((message?: unknown) => {
    errors.push(String(message ?? ""));
  });

  try {
    const program = createProgram({
      behaviorCommand: {
        createExplainer: () => ({
          model: "test-model",
          explainBehavior: async () => "Mocked behavior explanation",
        }),
      },
      indexCommand: {
        createSummarizer: () => createMockSummarizer()
      },
      traceCommand: {
        createExplainer: () => ({
          model: "test-model",
          explainRouteFlow: async () => "Mocked explanation",
        }),
      },
    });
    try {
      await program.parseAsync(["node", "code-tour", ...args]);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  } finally {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  }

  return {
    stdout: stripAnsi(logs.join("\n")),
    stderr: stripAnsi(errors.join("\n"))
  };
}

describe("cli", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs index and the read commands against the generated database", async () => {
    const projectRoot = await createTempExampleCopy("express-basic");

    const indexResult = await runCli(["index", projectRoot]);
    expect(indexResult.stdout).toContain("Indexed project:");
    expect(indexResult.stdout).toContain("Files scanned: 6");
    expect(indexResult.stdout).toContain("Routes found: 4");
    expect(indexResult.stdout).toContain("Mounts found: 1");
    expect(indexResult.stdout).toContain("Call graph nodes found:");

    const filesResult = await runCli(["files", "--project", projectRoot]);
    expect(filesResult.stdout).toContain("src/app.ts");
    expect(filesResult.stdout).toContain("src/routes/users.ts");
    expect(filesResult.stdout).toContain("src/middleware/validateUser.ts");

    const symbolsResult = await runCli(["symbols", "--project", projectRoot]);
    expect(symbolsResult.stdout).toContain("UserService\tclass\tsrc/services/userService.ts");
    expect(symbolsResult.stdout).toContain("UserService.createUser\tmethod\tsrc/services/userService.ts");

    const importsResult = await runCli(["imports", "src/routes/users.ts", "--project", projectRoot]);
    expect(importsResult.stdout).toContain("express\tRouter");
    expect(importsResult.stdout).toContain("../controllers/userController\tcreateUser, getUserById, listUsers");

    const routesResult = await runCli(["routes", "--project", projectRoot]);
    expect(routesResult.stdout).toContain("GET\t/users\tlistUsers\tsrc/routes/users.ts");
    expect(routesResult.stdout).toContain("GET\t/users/:id\tgetUserById\tsrc/routes/users.ts");
    expect(routesResult.stdout).toContain("POST\t/users\tcreateUser\tsrc/routes/users.ts");

    const middlewareResult = await runCli(["middleware", "--project", projectRoot]);
    expect(middlewareResult.stdout).toContain("/users\tusersRouter\tsrc/app.ts");

    const explainResult = await runCli(["explain", "src/routes/users.ts", "--project", projectRoot]);
    expect(explainResult.stdout).toContain("Summary for src/routes/users.ts");
    expect(explainResult.stdout).toContain("Important classes: UserService");
    expect(explainResult.stdout).toContain("Routes:");
    expect(explainResult.stdout).toContain("handlers=listUsers");

    const traceResult = await runCli(["trace", "POST", "/users", "--project", projectRoot]);
    expect(traceResult.stdout).toContain("Trace: POST /users");
    expect(traceResult.stdout).toContain("handler\tcreateUser");
    expect(traceResult.stdout).toContain("service_call\tUserService.createUser");
    expect(traceResult.stdout).toContain("repository_call\tusersRepo.create");

    const explainTraceResult = await runCli(["trace", "GET", "/users/:id", "--project", projectRoot, "--explain"]);
    expect(explainTraceResult.stdout).toContain("Trace: GET /users/:id");
    expect(explainTraceResult.stdout).toContain("Explanation:");
    expect(explainTraceResult.stdout).toContain("Mocked explanation");

    const behaviorRouteResult = await runCli(["behavior", "route", "GET", "/users", "--project", projectRoot]);
    expect(behaviorRouteResult.stdout).toContain("Behavior: route GET /users");
    expect(behaviorRouteResult.stdout).toContain("req.query.limit");
    expect(behaviorRouteResult.stdout).toContain("usersRepo.findAll");

    const ambiguousFunctionResult = await runCli(["behavior", "function", "createUser", "--project", projectRoot]);
    expect(ambiguousFunctionResult.stderr).toContain("Ambiguous function name createUser");
    expect(ambiguousFunctionResult.stderr).toContain("UserService.createUser");

    const behaviorQualifiedFunctionResult = await runCli([
      "behavior",
      "function",
      "UserService.createUser",
      "--project",
      projectRoot,
    ]);
    expect(behaviorQualifiedFunctionResult.stdout).toContain("Behavior: function UserService.createUser");
    expect(behaviorQualifiedFunctionResult.stdout).toContain("usersRepo.create");

    const behaviorFileResult = await runCli([
      "behavior",
      "file",
      "src/controllers/userController.ts",
      "--project",
      projectRoot,
    ]);
    expect(behaviorFileResult.stdout).toContain("Function Behavior:");
    expect(behaviorFileResult.stdout).toContain("Behavior: function createUser");
    expect(behaviorFileResult.stdout).toContain("req.body.email");

    const askSummaryResult = await runCli(["ask", "What does POST /users do?", "--project", projectRoot]);
    expect(askSummaryResult.stdout).toContain("POST /users");
    expect(askSummaryResult.stdout).toContain("Inputs:");

    const askInputResult = await runCli(["ask", "What input does POST /users read?", "--project", projectRoot]);
    expect(askInputResult.stdout).toContain("Inputs for POST /users:");
    expect(askInputResult.stdout).toContain("req_body email");

    const askDatabaseResult = await runCli([
      "ask",
      "What database operations happen in GET /users?",
      "--project",
      projectRoot,
    ]);
    expect(askDatabaseResult.stdout).toContain("Database operations for GET /users:");
    expect(askDatabaseResult.stdout).toContain("usersRepo.findAll");

    const explainBehaviorRouteResult = await runCli([
      "behavior",
      "route",
      "POST",
      "/users",
      "--project",
      projectRoot,
      "--explain",
    ]);
    expect(explainBehaviorRouteResult.stdout).toContain("Behavior: route POST /users");
    expect(explainBehaviorRouteResult.stdout).toContain("Mocked behavior explanation");

    const explainBehaviorFunctionResult = await runCli([
      "behavior",
      "function",
      "UserService.createUser",
      "--project",
      projectRoot,
      "--explain",
    ]);
    expect(explainBehaviorFunctionResult.stdout).toContain("Behavior: function UserService.createUser");
    expect(explainBehaviorFunctionResult.stdout).toContain("Mocked behavior explanation");
  });

  it("returns a clear error when the database is missing", async () => {
    const projectRoot = await createTempExampleCopy("express-basic");
    const result = await runCli(["files", "--project", projectRoot]);

    expect(result.stderr).toContain("No index database found");
  });
});
