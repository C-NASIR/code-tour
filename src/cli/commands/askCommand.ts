import type { Command } from "commander";
import { answerBehaviorQuestion, parseBehaviorQuestion } from "../../behavior/answerBehaviorQuestion.js";
import { buildRouteBehaviorForProject } from "../../behavior/projectBehavior.js";
import { resolveReadProjectRoot } from "../options.js";

/**
 * Registers the deterministic Phase 3 `ask` command.
 */
export function registerAskCommand(program: Command): void {
  program
    .command("ask")
    .argument("<question>", "Supported deterministic route behavior question")
    .description("Answer one supported route-scoped behavior question")
    .option("--project <path>", "Indexed project root")
    .action((question: string, options: { project?: string }) => {
      const projectRoot = resolveReadProjectRoot(options.project);
      const parsed = parseBehaviorQuestion(question);
      const behavior = buildRouteBehaviorForProject(projectRoot, parsed.method, parsed.path);

      console.log(answerBehaviorQuestion(question, behavior));
    });
}
