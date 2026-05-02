import type { Command } from "commander";
import { readExplainData } from "../../storage/projectQueries.js";
import { formatExplain } from "../formatters.js";
import { resolveReadProjectRoot } from "../options.js";

/**
 * Registers the `explain` command for showing the stored summary and extracted
 * facts for one indexed file.
 */
export function registerExplainCommand(program: Command): void {
  program
    .command("explain")
    .argument("<filePath>", "Indexed file path")
    .description("Show summary and extracted facts for a file")
    .option("--project <path>", "Indexed project root")
    .action((filePath: string, options: { project?: string }) => {
      const projectRoot = resolveReadProjectRoot(options.project);
      const explanation = readExplainData(projectRoot, filePath);
      console.log(formatExplain(explanation));
    });
}
