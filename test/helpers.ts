import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function createTempExampleCopy(exampleName: string): Promise<string> {
  const fixtureRoot = path.resolve("examples", exampleName);
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "code-tour-"));
  await fs.cp(fixtureRoot, tempRoot, {
    recursive: true
  });
  await fs.rm(path.join(tempRoot, ".code-tour"), {
    recursive: true,
    force: true,
  });
  return tempRoot;
}

export function stripAnsi(output: string): string {
  return output.replace(/\u001B\[[0-9;]*m/g, "");
}
