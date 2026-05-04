import type { Command } from "commander";
import { createOpenAIBehaviorExplainer } from "../../ai/explainBehavior.js";
import {
  buildFunctionBehaviorForNode,
  buildFunctionBehaviorForProject,
  buildRouteBehaviorForProject,
  listFileBehaviorRouteTargets,
  listFileFunctionBehaviorNodes,
} from "../../behavior/projectBehavior.js";
import { formatBehaviorReport } from "../../behavior/formatBehaviorReport.js";
import { resolveReadProjectRoot } from "../options.js";

export type BehaviorCommandDependencies = {
  createExplainer?: typeof createOpenAIBehaviorExplainer;
};

async function printExplanation(
  createExplainer: typeof createOpenAIBehaviorExplainer,
  behavior: Parameters<ReturnType<typeof createOpenAIBehaviorExplainer>["explainBehavior"]>[0]
): Promise<void> {
  try {
    const { explainBehavior } = createExplainer();
    const explanation = await explainBehavior(behavior);
    console.log("");
    console.log("Explanation:");
    console.log(explanation);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log("");
    console.log(`Explanation error: ${message}`);
  }
}

/**
 * Registers the Phase 3 `behavior` command group.
 */
export function registerBehaviorCommand(program: Command, dependencies: BehaviorCommandDependencies = {}): void {
  const createExplainer = dependencies.createExplainer ?? createOpenAIBehaviorExplainer;
  const behavior = program.command("behavior").description("Inspect deterministic route and function behavior");

  behavior
    .command("route")
    .argument("<method>", "HTTP method")
    .argument("<path>", "Normalized indexed route pattern")
    .description("Build route behavior from the indexed Phase 2 flow")
    .option("--project <path>", "Indexed project root")
    .option("--explain", "Explain the deterministic behavior with AI")
    .action(async (method: string, path: string, options: { project?: string; explain?: boolean }) => {
      const projectRoot = resolveReadProjectRoot(options.project);
      const behaviorReport = buildRouteBehaviorForProject(projectRoot, method, path);

      console.log(formatBehaviorReport(behaviorReport));

      if (options.explain) {
        await printExplanation(createExplainer, behaviorReport);
      }
    });

  behavior
    .command("function")
    .argument("<functionName>", "Exact simple name or exact qualified name")
    .description("Build direct-body behavior for one indexed function or method")
    .option("--project <path>", "Indexed project root")
    .option("--explain", "Explain the deterministic behavior with AI")
    .action(async (functionName: string, options: { project?: string; explain?: boolean }) => {
      const projectRoot = resolveReadProjectRoot(options.project);
      const { behavior: behaviorReport } = buildFunctionBehaviorForProject(projectRoot, functionName);

      console.log(formatBehaviorReport(behaviorReport));

      if (options.explain) {
        await printExplanation(createExplainer, behaviorReport);
      }
    });

  behavior
    .command("file")
    .argument("<filePath>", "Indexed file path")
    .description("Show route and direct function behavior for one indexed file")
    .option("--project <path>", "Indexed project root")
    .action((filePath: string, options: { project?: string }) => {
      const projectRoot = resolveReadProjectRoot(options.project);
      const routeTargets = listFileBehaviorRouteTargets(projectRoot, filePath);
      const functionNodes = listFileFunctionBehaviorNodes(projectRoot, filePath);
      const sections: string[] = [];

      if (routeTargets.length > 0) {
        sections.push("Route Behavior:");
        sections.push(
          routeTargets.map((routeTarget) => formatBehaviorReport(buildRouteBehaviorForProject(projectRoot, routeTarget.method, routeTarget.path))).join("\n\n")
        );
      }

      if (functionNodes.length > 0) {
        sections.push("Function Behavior:");
        sections.push(
          functionNodes.map((node) => formatBehaviorReport(buildFunctionBehaviorForNode(projectRoot, node))).join("\n\n")
        );
      }

      console.log(sections.length > 0 ? sections.join("\n\n") : `No indexed routes or functions found for ${filePath}.`);
    });
}
