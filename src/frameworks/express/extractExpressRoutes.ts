import { Node, SyntaxKind, type Expression, type SourceFile } from "ts-morph";
import type { RouteHandlerRef, RouteMethod, RouteRecord } from "../../types/records.js";
import { createId } from "../../utils/createId.js";
import { normalizeRoutePath } from "../../utils/routePaths.js";

const ROUTE_METHODS = new Map<string, RouteMethod>([
  ["get", "GET"],
  ["post", "POST"],
  ["put", "PUT"],
  ["patch", "PATCH"],
  ["delete", "DELETE"],
]);

function getStringLiteralValue(node: Expression | undefined): string | undefined {
  if (!node) {
    return undefined;
  }

  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralText();
  }

  return undefined;
}

function isCallableExpression(node: Expression | undefined): node is Expression {
  return Boolean(
    node &&
      (Node.isIdentifier(node) ||
        Node.isPropertyAccessExpression(node) ||
        Node.isArrowFunction(node) ||
        Node.isFunctionExpression(node))
  );
}

function createHandlerRef(
  routeId: string,
  filePath: string,
  order: number,
  kind: RouteHandlerRef["kind"],
  expression: Expression
): RouteHandlerRef {
  const isInline = Node.isArrowFunction(expression) || Node.isFunctionExpression(expression);
  const name = isInline ? null : expression.getText();

  return {
    id: createId("route-handler", routeId, order, kind, expression.getStartLineNumber()),
    routeId,
    order,
    kind,
    name,
    filePath,
    targetFilePath: isInline ? filePath : null,
    targetNodeId: null,
    confidence: "high",
    startLine: expression.getStartLineNumber(),
    endLine: expression.getEndLineNumber(),
  };
}

export function extractExpressRoutes(sourceFile: SourceFile, filePath: string, targets: Set<string>): RouteRecord[] {
  const routes: RouteRecord[] = [];

  for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = callExpression.getExpression();

    if (!Node.isPropertyAccessExpression(expression)) {
      continue;
    }

    const target = expression.getExpression().getText();

    if (!targets.has(target)) {
      continue;
    }

    const methodName = expression.getName().toLowerCase();
    const method = ROUTE_METHODS.get(methodName);
    const path = getStringLiteralValue(callExpression.getArguments()[0] as Expression | undefined);

    if (!method || !path) {
      continue;
    }

    const callableArgs = callExpression
      .getArguments()
      .slice(1)
      .filter((argument): argument is Expression => isCallableExpression(argument as Expression | undefined));

    if (callableArgs.length === 0) {
      continue;
    }

    const routeId = createId("route", filePath, method, path, callExpression.getStartLineNumber());
    const handlers = callableArgs.map((argument, index) =>
      createHandlerRef(
        routeId,
        filePath,
        index,
        index === callableArgs.length - 1
          ? Node.isIdentifier(argument) || Node.isPropertyAccessExpression(argument)
            ? "named"
            : "inline"
          : "middleware",
        argument
      )
    );

    routes.push({
      id: routeId,
      filePath,
      method,
      path: normalizeRoutePath(path),
      fullPath: normalizeRoutePath(path),
      fullPathConfidence: targets.has("app") ? "high" : "low",
      handlers,
      startLine: callExpression.getStartLineNumber(),
      endLine: callExpression.getEndLineNumber(),
    });
  }

  return routes.sort((left, right) => left.startLine - right.startLine);
}
