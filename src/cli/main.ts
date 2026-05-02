#!/usr/bin/env node
import { createProgram } from "./program.js";

async function main(): Promise<void> {
  const program = createProgram();
  await program.parseAsync();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
