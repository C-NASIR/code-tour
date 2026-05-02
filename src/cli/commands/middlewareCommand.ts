import type { Command } from "commander";
import { readIndexedMiddleware } from "../../storage/projectQueries.js";
import { formatMiddlewareList } from "../formatters.js";
import { resolveReadProjectRoot } from "../options.js";

/**
 * Registers the `middleware` command for rendering Express middleware
 * registrations.
 */
export function registerMiddlewareCommand(program: Command): void {
  program
    .command("middleware")
    .description("Show indexed Express middleware")
    .option("--project <path>", "Indexed project root")
    .action((options: { project?: string }) => {
      const projectRoot = resolveReadProjectRoot(options.project);
      const middleware = readIndexedMiddleware(projectRoot);
      console.log(formatMiddlewareList(middleware));
    });
}
