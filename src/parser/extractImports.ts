import { Node, type SourceFile } from "ts-morph";
import type { ImportRecord } from "../types/records.js";
import { createId } from "../utils/createId.js";

/**
 * Extracts ES module import declarations with their module source, imported
 * names, and line ranges.
 */
export function extractImports(sourceFile: SourceFile, filePath: string): ImportRecord[] {
  const records = sourceFile.getImportDeclarations().map((declaration) => {
    const importedNames: string[] = [];
    const defaultImport = declaration.getDefaultImport();
    const namespaceImport = declaration.getNamespaceImport();

    if (defaultImport) {
      importedNames.push(defaultImport.getText());
    }

    if (namespaceImport) {
      importedNames.push(`* as ${namespaceImport.getText()}`);
    }

    for (const namedImport of declaration.getNamedImports()) {
      importedNames.push(namedImport.getNameNode().getText());
    }

    return {
      id: createId("import", filePath, declaration.getStartLineNumber(), declaration.getText()),
      sourceFile: filePath,
      importedFrom: declaration.getModuleSpecifierValue(),
      importedNames,
      startLine: declaration.getStartLineNumber(),
      endLine: declaration.getEndLineNumber()
    };
  });

  for (const declaration of sourceFile.getVariableDeclarations()) {
    const initializer = declaration.getInitializer();

    if (!initializer || !Node.isCallExpression(initializer)) {
      continue;
    }

    if (initializer.getExpression().getText() !== "require") {
      continue;
    }

    const requiredFrom = initializer.getArguments()[0];
    if (!requiredFrom || !Node.isStringLiteral(requiredFrom)) {
      continue;
    }

    records.push({
      id: createId("import", filePath, declaration.getStartLineNumber(), declaration.getText()),
      sourceFile: filePath,
      importedFrom: requiredFrom.getLiteralText(),
      importedNames: [declaration.getName()],
      startLine: declaration.getStartLineNumber(),
      endLine: declaration.getEndLineNumber(),
    });
  }

  return records.sort((left, right) => left.startLine - right.startLine);
}
