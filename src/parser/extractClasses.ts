import { Node, type SourceFile } from "ts-morph";
import type { ClassRecord, MethodRecord } from "../types/records.js";
import { createId } from "../utils/createId.js";

/**
 * Extracts top-level class declarations and easy-to-identify methods from a
 * source file.
 */
export function extractClasses(sourceFile: SourceFile, filePath: string): {
  classes: ClassRecord[];
  methods: MethodRecord[];
} {
  const classes: ClassRecord[] = [];
  const methods: MethodRecord[] = [];

  for (const declaration of sourceFile.getClasses()) {
    const className = declaration.getName();

    if (!className) {
      continue;
    }

    classes.push({
      id: createId("class", filePath, className, declaration.getStartLineNumber()),
      name: className,
      filePath,
      startLine: declaration.getStartLineNumber(),
      endLine: declaration.getEndLineNumber(),
    });

    for (const member of declaration.getMembers()) {
      if (!Node.isMethodDeclaration(member) && !Node.isGetAccessorDeclaration(member) && !Node.isSetAccessorDeclaration(member)) {
        continue;
      }

      const methodName = member.getName();

      methods.push({
        id: createId("method", filePath, className, methodName, member.getStartLineNumber()),
        name: methodName,
        className,
        filePath,
        startLine: member.getStartLineNumber(),
        endLine: member.getEndLineNumber(),
      });
    }
  }

  return {
    classes,
    methods,
  };
}
