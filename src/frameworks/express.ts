import { Node, SyntaxKind, type Expression, type SourceFile } from "ts-morph";
import type { MiddlewareRecord, RouteMethod, RouteRecord } from "../types/records.js";
import { createId } from "../utils/createId.js";

type ExpressAnalysis = {
  routes: RouteRecord[];
  middleware: MiddlewareRecord[];
};

const ROUTE_METHODS = new Map<string, RouteMethod>([
  ["get", "GET"],
  ["post", "POST"],
  ["put", "PUT"],
  ["patch", "PATCH"],
  ["delete", "DELETE"],
]);

function getStringLiteralValue(node: Node | undefined): string | undefined {
  if (!node) {
    return undefined;
  }

  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralText();
  }

  return undefined;
}

function getNamedExpression(node: Expression | undefined): string | undefined {
  if (!node) {
    return undefined;
  }

  if (Node.isIdentifier(node) || Node.isPropertyAccessExpression(node)) {
    return node.getText();
  }

  return undefined;
}

function collectExpressTargets(sourceFile: SourceFile): Set<string> {
  const targets = new Set<string>(["app", "router"]);

  for (const declaration of sourceFile.getVariableDeclarations()) {
    const initializer = declaration.getInitializer();
    if (!initializer || !Node.isCallExpression(initializer)) {
      continue;
    }

    const expressionText = initializer.getExpression().getText();
    if (expressionText === "express" || expressionText === "Router" || expressionText.endsWith(".Router")) {
      targets.add(declaration.getName());
    }
  }

  return targets;
}

/**
 * Extracts Express routes and middleware from a source file when the file
 * appears to use Express primitives.
 */
export function analyzeExpress(sourceFile: SourceFile, filePath: string): ExpressAnalysis {
  const targets = collectExpressTargets(sourceFile);
  const routes: RouteRecord[] = [];
  const middleware: MiddlewareRecord[] = [];

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

    if (methodName === "use") {
      const args = callExpression.getArguments();
      const mountPath = getStringLiteralValue(args[0]);
      const middlewareNode = mountPath ? (args[1] as Expression | undefined) : (args[0] as Expression | undefined);

      middleware.push({
        id: createId("middleware", filePath, callExpression.getStartLineNumber(), callExpression.getText()),
        filePath,
        mountPath,
        middlewareName: getNamedExpression(middlewareNode),
        startLine: callExpression.getStartLineNumber(),
        endLine: callExpression.getEndLineNumber(),
      });

      continue;
    }

    const method = ROUTE_METHODS.get(methodName);
    const path = getStringLiteralValue(callExpression.getArguments()[0]);
    if (!method || !path) {
      continue;
    }

    const handlerArgument = callExpression.getArguments()[callExpression.getArguments().length - 1] as
      | Expression
      | undefined;

    routes.push({
      id: createId("route", filePath, method, path, callExpression.getStartLineNumber()),
      filePath,
      method,
      path,
      handlerName: getNamedExpression(handlerArgument),
      startLine: callExpression.getStartLineNumber(),
      endLine: callExpression.getEndLineNumber(),
    });
  }

  return {
    routes: routes.sort((left, right) => left.startLine - right.startLine),
    middleware: middleware.sort((left, right) => left.startLine - right.startLine),
  };
}
