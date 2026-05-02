import { Node, type SourceFile } from "ts-morph";
import type { FunctionRecord } from "../types/records.js";
import { createId } from "../utils/createId.js";

function isNamedFunctionInitializer(node: Node | undefined): boolean {
  return Boolean(node && (Node.isArrowFunction(node) || Node.isFunctionExpression(node)));
}

/**
 * Extracts named functions from declarations and variable-assigned function
 * expressions.
 *
 * Anonymous callbacks are ignored so the symbol index stays focused on named,
 * reusable code units.
 */
export function extractFunctions(sourceFile: SourceFile, filePath: string): FunctionRecord[] {
  const records = new Map<string, FunctionRecord>();

  for (const declaration of sourceFile.getFunctions()) {
    const name = declaration.getName();

    if (!name) {
      continue;
    }

    const record: FunctionRecord = {
      id: createId("function", filePath, name, declaration.getStartLineNumber()),
      name,
      filePath,
      startLine: declaration.getStartLineNumber(),
      endLine: declaration.getEndLineNumber()
    };

    records.set(record.id, record);
  }

  for (const declaration of sourceFile.getVariableDeclarations()) {
    const name = declaration.getName();
    const initializer = declaration.getInitializer();

    if (!name || !isNamedFunctionInitializer(initializer)) {
      continue;
    }

    const record: FunctionRecord = {
      id: createId("function", filePath, name, declaration.getStartLineNumber()),
      name,
      filePath,
      startLine: declaration.getStartLineNumber(),
      endLine: declaration.getEndLineNumber()
    };

    records.set(record.id, record);
  }

  return Array.from(records.values()).sort((left, right) => left.startLine - right.startLine);
}
