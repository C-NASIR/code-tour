import { Node, type Expression } from "ts-morph";
import type { ParsedFile } from "../types/parsedFile.js";
import type { CallGraphEdge, CallGraphNode } from "./callGraphTypes.js";
import { resolveRelativeModulePath } from "../utils/moduleResolution.js";

type ImportBinding = {
  kind: "default" | "named" | "namespace";
  localName: string;
  importedName: string | null;
  resolvedFilePath: string | null;
};

export type ResolutionContext = {
  parsedFilesByPath: Map<string, ParsedFile>;
  nodesByFile: Map<string, CallGraphNode[]>;
  nodesBySimpleName: Map<string, CallGraphNode[]>;
  nodesByQualifiedName: Map<string, CallGraphNode[]>;
  importBindingsByFile: Map<string, Map<string, ImportBinding>>;
};

type Resolution = Pick<
  CallGraphEdge,
  "targetNodeId" | "targetFilePath" | "targetName" | "confidence" | "resolutionKind"
>;

function collectImportBindings(parsedFile: ParsedFile, projectFiles: Set<string>): Map<string, ImportBinding> {
  const bindings = new Map<string, ImportBinding>();

  for (const declaration of parsedFile.sourceFile.getImportDeclarations()) {
    const importedFrom = declaration.getModuleSpecifierValue();
    const resolvedFilePath = resolveRelativeModulePath(parsedFile.filePath, importedFrom, projectFiles);
    const defaultImport = declaration.getDefaultImport();

    if (defaultImport) {
      bindings.set(defaultImport.getText(), {
        kind: "default",
        localName: defaultImport.getText(),
        importedName: "default",
        resolvedFilePath,
      });
    }

    const namespaceImport = declaration.getNamespaceImport();

    if (namespaceImport) {
      bindings.set(namespaceImport.getText(), {
        kind: "namespace",
        localName: namespaceImport.getText(),
        importedName: null,
        resolvedFilePath,
      });
    }

    for (const namedImport of declaration.getNamedImports()) {
      const aliasNode = namedImport.getAliasNode();
      const localName = aliasNode?.getText() ?? namedImport.getNameNode().getText();

      bindings.set(localName, {
        kind: "named",
        localName,
        importedName: namedImport.getNameNode().getText(),
        resolvedFilePath,
      });
    }
  }

  return bindings;
}

export function createResolutionContext(parsedFiles: ParsedFile[], nodes: CallGraphNode[]): ResolutionContext {
  const projectFiles = new Set(parsedFiles.map((file) => file.filePath));
  const parsedFilesByPath = new Map(parsedFiles.map((file) => [file.filePath, file]));
  const nodesByFile = new Map<string, CallGraphNode[]>();
  const nodesBySimpleName = new Map<string, CallGraphNode[]>();
  const nodesByQualifiedName = new Map<string, CallGraphNode[]>();

  for (const node of nodes) {
    const fileNodes = nodesByFile.get(node.filePath) ?? [];
    fileNodes.push(node);
    nodesByFile.set(node.filePath, fileNodes);

    const simpleNameNodes = nodesBySimpleName.get(node.name) ?? [];
    simpleNameNodes.push(node);
    nodesBySimpleName.set(node.name, simpleNameNodes);

    const qualifiedNameNodes = nodesByQualifiedName.get(node.qualifiedName) ?? [];
    qualifiedNameNodes.push(node);
    nodesByQualifiedName.set(node.qualifiedName, qualifiedNameNodes);
  }

  const importBindingsByFile = new Map<string, Map<string, ImportBinding>>();

  for (const parsedFile of parsedFiles) {
    importBindingsByFile.set(parsedFile.filePath, collectImportBindings(parsedFile, projectFiles));
  }

  return {
    parsedFilesByPath,
    nodesByFile,
    nodesBySimpleName,
    nodesByQualifiedName,
    importBindingsByFile,
  };
}

function findSingleNode(nodes: CallGraphNode[] | undefined): CallGraphNode | null {
  if (!nodes || nodes.length !== 1) {
    return null;
  }

  return nodes[0];
}

function toResolution(
  node: CallGraphNode | null,
  resolutionKind: Resolution["resolutionKind"],
  confidence: Resolution["confidence"]
): Resolution {
  return {
    targetNodeId: node?.id ?? null,
    targetFilePath: node?.filePath ?? null,
    targetName: node?.qualifiedName ?? null,
    confidence,
    resolutionKind,
  };
}

function resolveIdentifier(context: ResolutionContext, sourceFilePath: string, identifierText: string): Resolution {
  const sameFileNodes = (context.nodesByFile.get(sourceFilePath) ?? []).filter((node) => node.name === identifierText);
  const sameFileNode = findSingleNode(sameFileNodes);

  if (sameFileNode) {
    return toResolution(sameFileNode, "same_file_named", "high");
  }

  const binding = context.importBindingsByFile.get(sourceFilePath)?.get(identifierText);

  if (binding) {
    if (!binding.resolvedFilePath) {
      return {
        targetNodeId: null,
        targetFilePath: null,
        targetName: identifierText,
        confidence: "low",
        resolutionKind: "external",
      };
    }

    const candidates = (context.nodesByFile.get(binding.resolvedFilePath) ?? []).filter(
      (node) => node.name === (binding.importedName === "default" ? identifierText : binding.importedName ?? identifierText)
    );
    const resolvedNode = findSingleNode(candidates);

    if (resolvedNode) {
      return toResolution(resolvedNode, "imported_named", "high");
    }
  }

  const globalCandidates = context.nodesBySimpleName.get(identifierText) ?? [];

  if (globalCandidates.length > 1) {
    return {
      targetNodeId: null,
      targetFilePath: null,
      targetName: identifierText,
      confidence: "low",
      resolutionKind: "ambiguous",
    };
  }

  return {
    targetNodeId: null,
    targetFilePath: null,
    targetName: identifierText,
    confidence: "low",
    resolutionKind: "unresolved",
  };
}

function resolvePropertyAccess(
  context: ResolutionContext,
  sourceFilePath: string,
  expressionText: string
): Resolution {
  const separatorIndex = expressionText.lastIndexOf(".");

  if (separatorIndex <= 0) {
    return resolveIdentifier(context, sourceFilePath, expressionText);
  }

  const baseText = expressionText.slice(0, separatorIndex);
  const propertyName = expressionText.slice(separatorIndex + 1);
  const sameFileQualified = findSingleNode(
    (context.nodesByFile.get(sourceFilePath) ?? []).filter((node) => node.qualifiedName === expressionText)
  );

  if (sameFileQualified) {
    return toResolution(sameFileQualified, "same_file_property", "medium");
  }

  const binding = context.importBindingsByFile.get(sourceFilePath)?.get(baseText);

  if (binding) {
    if (!binding.resolvedFilePath) {
      return {
        targetNodeId: null,
        targetFilePath: null,
        targetName: expressionText,
        confidence: "low",
        resolutionKind: "external",
      };
    }

    if (binding.kind === "namespace") {
      const namespaceNode = findSingleNode(
        (context.nodesByFile.get(binding.resolvedFilePath) ?? []).filter((node) => node.name === propertyName)
      );

      if (namespaceNode) {
        return toResolution(namespaceNode, "namespace_property", "medium");
      }
    }

    const importedPropertyNode = findSingleNode(
      (context.nodesByFile.get(binding.resolvedFilePath) ?? []).filter(
        (node) => node.qualifiedName === expressionText || node.qualifiedName === `${binding.importedName ?? baseText}.${propertyName}`
      )
    );

    if (importedPropertyNode) {
      return toResolution(importedPropertyNode, "imported_property", "medium");
    }
  }

  return {
    targetNodeId: null,
    targetFilePath: null,
    targetName: expressionText,
    confidence: "low",
    resolutionKind: "external",
  };
}

export function resolveCallableReference(
  context: ResolutionContext,
  sourceFilePath: string,
  referenceText: string
): Resolution {
  if (referenceText.includes(".")) {
    return resolvePropertyAccess(context, sourceFilePath, referenceText);
  }

  return resolveIdentifier(context, sourceFilePath, referenceText);
}

export function resolveCallTarget(
  context: ResolutionContext,
  sourceFilePath: string,
  expression: Expression
): Resolution {
  if (Node.isIdentifier(expression)) {
    return resolveIdentifier(context, sourceFilePath, expression.getText());
  }

  if (Node.isPropertyAccessExpression(expression)) {
    return resolvePropertyAccess(context, sourceFilePath, expression.getText());
  }

  return {
    targetNodeId: null,
    targetFilePath: null,
    targetName: expression.getText(),
    confidence: "low",
    resolutionKind: "unresolved",
  };
}
