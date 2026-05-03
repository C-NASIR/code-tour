import type { Command } from "commander";
import { createOpenAIRouteFlowExplainer } from "../../ai/explainRouteFlow.js";
import { formatFlow } from "../../flow/formatFlow.js";
import { traceRouteFlow } from "../../flow/traceRouteFlow.js";
import { readTraceIndexData } from "../../storage/projectQueries.js";
import { resolveReadProjectRoot } from "../options.js";

export type TraceCommandDependencies = {
  createExplainer?: typeof createOpenAIRouteFlowExplainer;
};

export function registerTraceCommand(program: Command, dependencies: TraceCommandDependencies = {}): void {
  const createExplainer = dependencies.createExplainer ?? createOpenAIRouteFlowExplainer;

  program
    .command("trace")
    .argument("<method>", "HTTP method")
    .argument("<path>", "Normalized indexed route pattern")
    .description("Trace one indexed Express route through handlers and local calls")
    .option("--project <path>", "Indexed project root")
    .option("--explain", "Explain the deterministic trace with AI")
    .action(async (method: string, path: string, options: { project?: string; explain?: boolean }) => {
      const projectRoot = resolveReadProjectRoot(options.project);
      const flow = traceRouteFlow(readTraceIndexData(projectRoot), method, path);

      console.log(formatFlow(flow));

      if (!options.explain) {
        return;
      }

      try {
        const { explainRouteFlow } = createExplainer();
        const explanation = await explainRouteFlow(flow);
        console.log("");
        console.log("Explanation:");
        console.log(explanation);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log("");
        console.log(`Explanation error: ${message}`);
      }
    });
}
