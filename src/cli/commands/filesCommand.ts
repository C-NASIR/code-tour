import type { Command } from "commander";
import { readIndexedFiles } from "../../storage/projectQueries.js";
import { formatFileList } from "../formatters.js";
import { resolveReadProjectRoot } from "../options.js";

/**
 * Registers the `files` command for listing indexed file paths from the stored
 * project snapshot.
 */
export function registerFilesCommand(program: Command): void {
  program
    .command("files")
    .description("Show indexed files")
    .option("--project <path>", "Indexed project root")
    .action((options: { project?: string }) => {
      const projectRoot = resolveReadProjectRoot(options.project);
      const files = readIndexedFiles(projectRoot);
      console.log(formatFileList(files));
    });
}
