import type { ExtractionContext, SideEffect } from "./behaviorTypes.js";
import { classifySideEffect, createEvidence } from "./classifyBehavior.js";

/**
 * Extracts direct side-effecting operations proven by call-site patterns in
 * the current function body.
 */
export function extractSideEffects(context: ExtractionContext): SideEffect[] {
  const effects: SideEffect[] = [];
  const seen = new Set<string>();

  for (const callExpression of context.directCallExpressions) {
    const calleeText = callExpression.getExpression().getText();
    const match = classifySideEffect(calleeText);

    if (!match) {
      continue;
    }

    const effect: SideEffect = {
      ...match,
      evidence: createEvidence(
        context.filePath,
        callExpression.getStartLineNumber(),
        callExpression.getText(),
        context.confidence
      ),
    };
    const key = `${effect.kind}:${effect.operation}:${effect.evidence.line}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    effects.push(effect);
  }

  return effects.sort((left, right) =>
    left.evidence.line - right.evidence.line || left.operation.localeCompare(right.operation)
  );
}
