import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import type { FunctionCallRecord } from "../types/records.js";
import { createId } from "../utils/createId.js";

/**
 * Extracts simple function call sites using textual callee names.
 */
export function extractFunctionCalls(sourceFile: SourceFile, filePath: string): FunctionCallRecord[] {
  const records: FunctionCallRecord[] = [];

  for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = callExpression.getExpression();
    const callee = expression.getText();

    if (!callee) {
      continue;
    }

    records.push({
      id: createId("function-call", filePath, callee, callExpression.getStartLineNumber()),
      filePath,
      callee,
      startLine: callExpression.getStartLineNumber(),
      endLine: callExpression.getEndLineNumber(),
    });
  }

  return records.sort((left, right) => left.startLine - right.startLine);
}
