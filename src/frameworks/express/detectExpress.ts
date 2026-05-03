import { Node, type SourceFile } from "ts-morph";

export function collectExpressTargets(sourceFile: SourceFile): Set<string> {
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
