import { Node, type SourceFile } from "ts-morph";
import type { ObjectMethodRecord } from "../types/records.js";
import { createId } from "../utils/createId.js";

function isFunctionLikeProperty(node: Node | undefined): boolean {
  return Boolean(node && (Node.isArrowFunction(node) || Node.isFunctionExpression(node)));
}

export function extractObjectMethods(sourceFile: SourceFile, filePath: string): ObjectMethodRecord[] {
  const records = new Map<string, ObjectMethodRecord>();

  for (const declaration of sourceFile.getVariableDeclarations()) {
    const objectName = declaration.getName();
    const initializer = declaration.getInitializer();

    if (!objectName || !initializer || !Node.isObjectLiteralExpression(initializer)) {
      continue;
    }

    for (const property of initializer.getProperties()) {
      if (Node.isMethodDeclaration(property)) {
        const methodName = property.getName();
        const record: ObjectMethodRecord = {
          id: createId("object-method", filePath, objectName, methodName, property.getStartLineNumber()),
          objectName,
          name: methodName,
          filePath,
          startLine: property.getStartLineNumber(),
          endLine: property.getEndLineNumber(),
        };

        records.set(record.id, record);
        continue;
      }

      if (!Node.isPropertyAssignment(property)) {
        continue;
      }

      const propertyName = property.getName();
      const propertyInitializer = property.getInitializer();

      if (!propertyName || !isFunctionLikeProperty(propertyInitializer)) {
        continue;
      }

      const record: ObjectMethodRecord = {
        id: createId("object-method", filePath, objectName, propertyName, property.getStartLineNumber()),
        objectName,
        name: propertyName,
        filePath,
        startLine: property.getStartLineNumber(),
        endLine: property.getEndLineNumber(),
      };

      records.set(record.id, record);
    }
  }

  return Array.from(records.values()).sort((left, right) => left.startLine - right.startLine);
}
