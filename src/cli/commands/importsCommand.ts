import type { Command } from "commander";
import { readImportsForFile } from "../../storage/projectQueries.js";
import { formatImports } from "../formatters.js";
import { resolveReadProjectRoot } from "../options.js";

/**
 * Registers the `imports` command for inspecting the imports of one indexed
 * file.
 */
export function registerImportsCommand(program: Command): void {
  program
    .command("imports")
    .argument("<filePath>", "Indexed file path")
    .description("Show imports for a file")
    .option("--project <path>", "Indexed project root")
    .action((filePath: string, options: { project?: string }) => {
      const projectRoot = resolveReadProjectRoot(options.project);
      const imports = readImportsForFile(projectRoot, filePath);
      console.log(formatImports(imports));
    });
}
