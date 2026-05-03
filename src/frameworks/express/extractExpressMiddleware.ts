import { Node, SyntaxKind, type Expression, type SourceFile } from "ts-morph";
import type { ExpressMountRecord, MiddlewareRecord, RouteHandlerRef } from "../../types/records.js";
import { createId } from "../../utils/createId.js";
import { normalizeRoutePath } from "../../utils/routePaths.js";

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
        Node.isFunctionExpression(node) ||
        Node.isCallExpression(node))
  );
}

function getReferenceName(node: Expression): string | undefined {
  if (Node.isIdentifier(node) || Node.isPropertyAccessExpression(node)) {
    return node.getText();
  }

  return undefined;
}

function createMountMiddlewareRef(
  mountId: string,
  filePath: string,
  order: number,
  expression: Expression
): Omit<RouteHandlerRef, "routeId"> {
  return {
    id: createId("mount-middleware", mountId, order, expression.getStartLineNumber()),
    order,
    kind: "middleware",
    name: getReferenceName(expression) ?? null,
    filePath,
    targetFilePath:
      Node.isArrowFunction(expression) || Node.isFunctionExpression(expression) ? filePath : null,
    targetNodeId: null,
    confidence: "high",
    startLine: expression.getStartLineNumber(),
    endLine: expression.getEndLineNumber(),
  };
}

export function extractExpressMiddleware(
  sourceFile: SourceFile,
  filePath: string,
  targets: Set<string>
): {
  middleware: MiddlewareRecord[];
  mounts: ExpressMountRecord[];
} {
  const middleware: MiddlewareRecord[] = [];
  const mounts: ExpressMountRecord[] = [];

  for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = callExpression.getExpression();

    if (!Node.isPropertyAccessExpression(expression)) {
      continue;
    }

    if (expression.getName().toLowerCase() !== "use") {
      continue;
    }

    const target = expression.getExpression().getText();

    if (!targets.has(target)) {
      continue;
    }

    const args = callExpression.getArguments() as Expression[];
    const mountPath = getStringLiteralValue(args[0]);
    const callableArgs = (mountPath ? args.slice(1) : args).filter(isCallableExpression);
    const routerCandidate = callableArgs.at(-1);

    for (const argument of callableArgs) {
      middleware.push({
        id: createId("middleware", filePath, argument.getText(), argument.getStartLineNumber()),
        filePath,
        mountPath: mountPath ? normalizeRoutePath(mountPath) : undefined,
        middlewareName: getReferenceName(argument),
        startLine: argument.getStartLineNumber(),
        endLine: argument.getEndLineNumber(),
      });
    }

    if (!mountPath || !routerCandidate || !getReferenceName(routerCandidate)) {
      continue;
    }

    mounts.push({
      id: createId("express-mount", filePath, mountPath, callExpression.getStartLineNumber()),
      filePath,
      mountPath: normalizeRoutePath(mountPath),
      routerName: getReferenceName(routerCandidate) ?? null,
      routerFilePath: null,
      confidence: "low",
      middleware: callableArgs
        .slice(0, -1)
        .map((argument, index) => createMountMiddlewareRef(createId("express-mount", filePath, mountPath, callExpression.getStartLineNumber()), filePath, index, argument)),
      startLine: callExpression.getStartLineNumber(),
      endLine: callExpression.getEndLineNumber(),
    });
  }

  return {
    middleware: middleware.sort((left, right) => left.startLine - right.startLine),
    mounts: mounts.sort((left, right) => left.startLine - right.startLine),
  };
}
