import { Node } from "ts-morph";
import type { ExtractionContext, ResponseWrite } from "./behaviorTypes.js";
import { createEvidence } from "./classifyBehavior.js";

type ResponseChain = {
  rootName: string;
  finalKind: ResponseWrite["kind"];
  statusCode?: number;
};

const RESPONSE_KINDS = new Set<ResponseWrite["kind"]>(["json", "send", "status", "redirect", "end"]);

function extractNumericLiteral(node: Node | undefined): number | undefined {
  if (!node) {
    return undefined;
  }

  if (Node.isNumericLiteral(node)) {
    return Number(node.getLiteralValue());
  }

  return undefined;
}

function parseResponseChain(callExpression: Node, responseParamNames: Set<string>): ResponseChain | null {
  if (!Node.isCallExpression(callExpression)) {
    return null;
  }

  const expression = callExpression.getExpression();

  if (!Node.isPropertyAccessExpression(expression)) {
    return null;
  }

  const methodName = expression.getName();

  if (!RESPONSE_KINDS.has(methodName as ResponseWrite["kind"])) {
    return null;
  }

  const baseExpression = expression.getExpression();

  if (Node.isIdentifier(baseExpression) && responseParamNames.has(baseExpression.getText())) {
    return {
      rootName: baseExpression.getText(),
      finalKind: methodName as ResponseWrite["kind"],
      statusCode: methodName === "status" ? extractNumericLiteral(callExpression.getArguments()[0]) : undefined,
    };
  }

  const previousChain = parseResponseChain(baseExpression, responseParamNames);

  if (!previousChain) {
    return null;
  }

  return {
    rootName: previousChain.rootName,
    finalKind: methodName as ResponseWrite["kind"],
    statusCode:
      methodName === "status"
        ? extractNumericLiteral(callExpression.getArguments()[0]) ?? previousChain.statusCode
        : previousChain.statusCode,
  };
}

function isPartOfLongerResponseChain(callExpression: Node): boolean {
  const parent = callExpression.getParent();

  return Boolean(
    parent &&
      Node.isPropertyAccessExpression(parent) &&
      Node.isCallExpression(parent.getParent())
  );
}

function describeResponse(kind: ResponseWrite["kind"], statusCode?: number): string {
  const action =
    kind === "json"
      ? "JSON response"
      : kind === "send"
        ? "send response"
        : kind === "redirect"
          ? "redirect response"
          : kind === "end"
            ? "end response"
            : "status response";

  return statusCode ? `${action} with status ${statusCode}` : action;
}

/**
 * Extracts direct response writes and collapses chained response calls into a
 * single write entry.
 */
export function extractResponses(context: ExtractionContext): ResponseWrite[] {
  const responses: ResponseWrite[] = [];
  const seen = new Set<string>();

  for (const callExpression of context.directCallExpressions) {
    if (isPartOfLongerResponseChain(callExpression)) {
      continue;
    }

    const chain = parseResponseChain(callExpression, context.responseParamNames);

    if (!chain) {
      continue;
    }

    const response: ResponseWrite = {
      kind: chain.finalKind,
      statusCode: chain.statusCode,
      description: describeResponse(chain.finalKind, chain.statusCode),
      evidence: createEvidence(
        context.filePath,
        callExpression.getStartLineNumber(),
        callExpression.getText(),
        context.confidence
      ),
    };
    const key = `${response.kind}:${response.statusCode ?? "none"}:${response.evidence.line}:${response.evidence.text}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    responses.push(response);
  }

  return responses.sort((left, right) =>
    left.evidence.line - right.evidence.line || left.description.localeCompare(right.description)
  );
}
