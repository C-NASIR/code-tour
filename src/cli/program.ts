import { Command } from "commander";
import { registerExplainCommand } from "./commands/explainCommand.js";
import { registerFilesCommand } from "./commands/filesCommand.js";
import { registerImportsCommand } from "./commands/importsCommand.js";
import { registerMiddlewareCommand } from "./commands/middlewareCommand.js";
import { registerRoutesCommand } from "./commands/routesCommand.js";
import { registerTraceCommand, type TraceCommandDependencies } from "./commands/traceCommand.js";
import {
  registerIndexCommand,
  type IndexCommandDependencies,
} from "./commands/indexCommand.js";
import { registerSymbolsCommand } from "./commands/symbolsCommand.js";

export type ProgramDependencies = {
  indexCommand?: IndexCommandDependencies;
  traceCommand?: TraceCommandDependencies;
};

/**
 * Creates the top-level Commander program and registers all Phase 1 commands.
 *
 * Dependencies are injectable so tests can replace the production summarizer
 * with deterministic mocks.
 */
export function createProgram(dependencies: ProgramDependencies = {}): Command {
  const program = new Command();

  program
    .name("code-tour")
    .description(
      "Build a searchable structural map of a JavaScript or TypeScript codebase",
    )
    .showHelpAfterError();

  registerIndexCommand(program, dependencies.indexCommand);
  registerFilesCommand(program);
  registerSymbolsCommand(program);
  registerRoutesCommand(program);
  registerTraceCommand(program, dependencies.traceCommand);
  registerMiddlewareCommand(program);
  registerExplainCommand(program);
  registerImportsCommand(program);

  return program;
}
