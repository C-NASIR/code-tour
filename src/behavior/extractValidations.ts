import { Node, SyntaxKind } from "ts-morph";
import type { ExtractionContext, ValidationRule } from "./behaviorTypes.js";
import { createEvidence } from "./classifyBehavior.js";

const COMPARISON_OPERATORS = new Set(["==", "===", "!=", "!==", "<", "<=", ">", ">="]);

function normalizeText(text: string): string {
  return text.replace(/\?\./g, ".");
}

function unwrapExpression(node: Node): Node {
  if (Node.isParenthesizedExpression(node)) {
    return unwrapExpression(node.getExpression());
  }

  return node;
}

function describeRequiredCheck(expressionText: string): string {
  return `Missing value check for ${normalizeText(expressionText)}`;
}

function createValidation(
  context: ExtractionContext,
  kind: ValidationRule["kind"],
  description: string,
  node: Node
): ValidationRule {
  return {
    kind,
    description,
    evidence: createEvidence(context.filePath, node.getStartLineNumber(), node.getText(), context.confidence),
  };
}

function classifyIfCondition(context: ExtractionContext, condition: Node): ValidationRule | null {
  const unwrapped = unwrapExpression(condition);

  if (Node.isPrefixUnaryExpression(unwrapped) && unwrapped.getOperatorToken() === SyntaxKind.ExclamationToken) {
    return createValidation(
      context,
      "required_check",
      describeRequiredCheck(unwrapped.getOperand().getText()),
      condition
    );
  }

  if (Node.isBinaryExpression(unwrapped) && COMPARISON_OPERATORS.has(unwrapped.getOperatorToken().getText())) {
    return createValidation(context, "conditional_check", `Condition ${normalizeText(unwrapped.getText())}`, condition);
  }

  if (Node.isCallExpression(unwrapped)) {
    const calleeText = unwrapped.getExpression().getText();

    if (/\.(safeParse|parse)$/.test(calleeText)) {
      return createValidation(context, "schema_validation", `Schema validation via ${calleeText}`, unwrapped);
    }

    if (/validate|validator/i.test(calleeText)) {
      return createValidation(context, "manual_check", `Manual validation via ${calleeText}`, unwrapped);
    }
  }

  return createValidation(context, "manual_check", `Condition ${normalizeText(unwrapped.getText())}`, condition);
}

/**
 * Extracts direct validation evidence from `if` statements and validator-style
 * calls in one function body.
 */
export function extractValidations(context: ExtractionContext): ValidationRule[] {
  const rules: ValidationRule[] = [];
  const seen = new Set<string>();

  for (const ifStatement of context.directIfStatements) {
    const validation = classifyIfCondition(context, ifStatement.getExpression());

    if (!validation) {
      continue;
    }

    const key = `${validation.kind}:${validation.evidence.line}:${validation.description}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    rules.push(validation);
  }

  for (const callExpression of context.directCallExpressions) {
    const calleeText = callExpression.getExpression().getText();
    let validation: ValidationRule | null = null;

    if (/\.(safeParse|parse)$/.test(calleeText)) {
      validation = createValidation(
        context,
        "schema_validation",
        `Schema validation via ${calleeText}`,
        callExpression
      );
    } else if (/validate|validator/i.test(calleeText)) {
      validation = createValidation(
        context,
        "manual_check",
        `Manual validation via ${calleeText}`,
        callExpression
      );
    }

    if (!validation) {
      continue;
    }

    const key = `${validation.kind}:${validation.evidence.line}:${validation.description}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    rules.push(validation);
  }

  return rules.sort((left, right) =>
    left.evidence.line - right.evidence.line || left.evidence.text.localeCompare(right.evidence.text)
  );
}
