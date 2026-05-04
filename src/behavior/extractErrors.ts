import type { ErrorPath, ExtractionContext, ResponseWrite } from "./behaviorTypes.js";
import { createEvidence } from "./classifyBehavior.js";

function createError(context: ExtractionContext, kind: ErrorPath["kind"], description: string, line: number, text: string): ErrorPath {
  return {
    kind,
    description,
    evidence: createEvidence(context.filePath, line, text, context.confidence),
  };
}

/**
 * Extracts direct throw paths, `next(error)` forwarding, catch blocks, and
 * explicit 4xx/5xx response paths.
 */
export function extractErrors(context: ExtractionContext, responses: ResponseWrite[]): ErrorPath[] {
  const errors: ErrorPath[] = [];
  const seen = new Set<string>();

  for (const throwStatement of context.directThrowStatements) {
    const error = createError(
      context,
      "throw",
      `Throws ${throwStatement.getExpression()?.getText() ?? "error"}`,
      throwStatement.getStartLineNumber(),
      throwStatement.getText()
    );
    const key = `${error.kind}:${error.evidence.line}:${error.description}`;

    if (!seen.has(key)) {
      seen.add(key);
      errors.push(error);
    }
  }

  for (const callExpression of context.directCallExpressions) {
    const calleeText = callExpression.getExpression().getText();

    if (!context.nextParamNames.has(calleeText)) {
      continue;
    }

    if (callExpression.getArguments().length === 0) {
      continue;
    }

    const error = createError(
      context,
      "next_error",
      `Forwards error via ${calleeText}`,
      callExpression.getStartLineNumber(),
      callExpression.getText()
    );
    const key = `${error.kind}:${error.evidence.line}:${error.description}`;

    if (!seen.has(key)) {
      seen.add(key);
      errors.push(error);
    }
  }

  for (const catchClause of context.directCatchClauses) {
    const variableName = catchClause.getVariableDeclaration()?.getName() ?? "error";
    const error = createError(
      context,
      "catch_block",
      `Catch block for ${variableName}`,
      catchClause.getStartLineNumber(),
      catchClause.getText()
    );
    const key = `${error.kind}:${error.evidence.line}:${error.description}`;

    if (!seen.has(key)) {
      seen.add(key);
      errors.push(error);
    }
  }

  for (const response of responses) {
    if ((response.statusCode ?? 0) < 400) {
      continue;
    }

    const error = createError(
      context,
      "status_error_response",
      `Error response with status ${response.statusCode}`,
      response.evidence.line,
      response.evidence.text
    );
    const key = `${error.kind}:${error.evidence.line}:${error.description}`;

    if (!seen.has(key)) {
      seen.add(key);
      errors.push(error);
    }
  }

  return errors.sort((left, right) =>
    left.evidence.line - right.evidence.line || left.description.localeCompare(right.description)
  );
}
