import type { Command } from "commander";
import { readIndexedRoutes } from "../../storage/projectQueries.js";
import { formatRouteList } from "../formatters.js";
import { resolveReadProjectRoot } from "../options.js";

/**
 * Registers the `routes` command for rendering Express route registrations.
 */
export function registerRoutesCommand(program: Command): void {
  program
    .command("routes")
    .description("Show indexed Express routes")
    .option("--project <path>", "Indexed project root")
    .action((options: { project?: string }) => {
      const projectRoot = resolveReadProjectRoot(options.project);
      const routes = readIndexedRoutes(projectRoot);
      console.log(formatRouteList(routes));
    });
}
