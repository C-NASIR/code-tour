import { Node, SyntaxKind, type Node as MorphNode, type SourceFile } from "ts-morph";
import type { ParsedFile } from "../types/parsedFile.js";
import type { RouteHandlerRef } from "../types/records.js";
import type { CallGraphEdge, CallGraphNode } from "./callGraphTypes.js";
import { createId } from "../utils/createId.js";
import { createResolutionContext, resolveCallTarget, resolveCallableReference } from "./resolveCallTarget.js";

type GraphNodeWithContainer = {
  node: CallGraphNode;
  container: MorphNode;
};

function getNodeRangeKey(startLine: number, endLine: number): string {
  return `${startLine}:${endLine}`;
}

function findFunctionContainer(sourceFile: SourceFile, name: string, startLine: number): MorphNode | null {
  const directFunction = sourceFile
    .getFunctions()
    .find((declaration) => declaration.getName() === name && declaration.getStartLineNumber() === startLine);

  if (directFunction) {
    return directFunction;
  }

  const variableDeclaration = sourceFile
    .getVariableDeclarations()
    .find((declaration) => declaration.getName() === name && declaration.getStartLineNumber() === startLine);

  return variableDeclaration?.getInitializer() ?? null;
}

function findMethodContainer(sourceFile: SourceFile, qualifiedName: string, startLine: number): MorphNode | null {
  const separatorIndex = qualifiedName.lastIndexOf(".");
  const ownerName = qualifiedName.slice(0, separatorIndex);
  const methodName = qualifiedName.slice(separatorIndex + 1);
  const classDeclaration = sourceFile
    .getClasses()
    .find((declaration) => declaration.getName() === ownerName);

  return (
    classDeclaration
      ?.getMembers()
      .find((member) => "getName" in member && member.getName() === methodName && member.getStartLineNumber() === startLine) ??
    null
  );
}

function findObjectMethodContainer(sourceFile: SourceFile, qualifiedName: string, startLine: number): MorphNode | null {
  const separatorIndex = qualifiedName.lastIndexOf(".");
  const objectName = qualifiedName.slice(0, separatorIndex);
  const methodName = qualifiedName.slice(separatorIndex + 1);
  const variableDeclaration = sourceFile.getVariableDeclaration(objectName);
  const initializer = variableDeclaration?.getInitializer();

  if (!initializer || !Node.isObjectLiteralExpression(initializer)) {
    return null;
  }

  for (const property of initializer.getProperties()) {
    if (Node.isMethodDeclaration(property) && property.getName() === methodName && property.getStartLineNumber() === startLine) {
      return property;
    }

    if (Node.isPropertyAssignment(property) && property.getName() === methodName && property.getStartLineNumber() === startLine) {
      return property.getInitializer() ?? null;
    }
  }

  return null;
}

function findInlineHandlerContainer(sourceFile: SourceFile, handler: RouteHandlerRef): MorphNode | null {
  const candidates: MorphNode[] = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression),
  ];

  return (
    candidates.find(
      (candidate) =>
        candidate.getStartLineNumber() === handler.startLine && candidate.getEndLineNumber() === handler.endLine
    ) ?? null
  );
}

function collectGraphNodes(parsedFile: ParsedFile): GraphNodeWithContainer[] {
  const graphNodes: GraphNodeWithContainer[] = [];
  const seenRangeKeys = new Set<string>();

  for (const record of parsedFile.functions) {
    const container = findFunctionContainer(parsedFile.sourceFile, record.name, record.startLine);

    if (!container) {
      continue;
    }

    graphNodes.push({
      node: {
        id: createId("call-graph-node", parsedFile.filePath, "function", record.name, record.startLine),
        filePath: parsedFile.filePath,
        kind: "function",
        name: record.name,
        qualifiedName: record.name,
        startLine: record.startLine,
        endLine: record.endLine,
      },
      container,
    });
    seenRangeKeys.add(getNodeRangeKey(record.startLine, record.endLine));
  }

  for (const record of parsedFile.methods) {
    const qualifiedName = `${record.className}.${record.name}`;
    const container = findMethodContainer(parsedFile.sourceFile, qualifiedName, record.startLine);

    if (!container) {
      continue;
    }

    graphNodes.push({
      node: {
        id: createId("call-graph-node", parsedFile.filePath, "method", qualifiedName, record.startLine),
        filePath: parsedFile.filePath,
        kind: "method",
        name: record.name,
        qualifiedName,
        startLine: record.startLine,
        endLine: record.endLine,
      },
      container,
    });
    seenRangeKeys.add(getNodeRangeKey(record.startLine, record.endLine));
  }

  for (const record of parsedFile.objectMethods) {
    const qualifiedName = `${record.objectName}.${record.name}`;
    const container = findObjectMethodContainer(parsedFile.sourceFile, qualifiedName, record.startLine);

    if (!container) {
      continue;
    }

    graphNodes.push({
      node: {
        id: createId("call-graph-node", parsedFile.filePath, "object_method", qualifiedName, record.startLine),
        filePath: parsedFile.filePath,
        kind: "object_method",
        name: record.name,
        qualifiedName,
        startLine: record.startLine,
        endLine: record.endLine,
      },
      container,
    });
    seenRangeKeys.add(getNodeRangeKey(record.startLine, record.endLine));
  }

  for (const route of parsedFile.routes) {
    for (const handler of route.handlers.filter((candidate) => candidate.kind === "inline")) {
      if (handler.startLine === null || handler.endLine === null) {
        continue;
      }

      const rangeKey = getNodeRangeKey(handler.startLine, handler.endLine);

      if (seenRangeKeys.has(rangeKey)) {
        continue;
      }

      const container = findInlineHandlerContainer(parsedFile.sourceFile, handler);

      if (!container) {
        continue;
      }

      graphNodes.push({
        node: {
          id: createId("call-graph-node", parsedFile.filePath, "route_handler", route.method, route.fullPath, handler.startLine),
          filePath: parsedFile.filePath,
          kind: "route_handler",
          name: `${route.method} ${route.fullPath}`,
          qualifiedName: `${route.method} ${route.fullPath}`,
          startLine: handler.startLine,
          endLine: handler.endLine,
        },
        container,
      });
      seenRangeKeys.add(rangeKey);
    }
  }

  return graphNodes.sort((left, right) => left.node.startLine - right.node.startLine);
}

function collectNodeEdges(
  sourceNode: GraphNodeWithContainer,
  containerSet: Set<MorphNode>,
  parsedFile: ParsedFile,
  context: ReturnType<typeof createResolutionContext>
): CallGraphEdge[] {
  const edges: CallGraphEdge[] = [];
  const callExpressions = sourceNode.container.getDescendantsOfKind(SyntaxKind.CallExpression);

  for (const callExpression of callExpressions) {
    const nearestContainer = callExpression.getFirstAncestor((ancestor) => containerSet.has(ancestor));

    if (nearestContainer !== sourceNode.container) {
      continue;
    }

    const expression = callExpression.getExpression();

    if (!Node.isIdentifier(expression) && !Node.isPropertyAccessExpression(expression)) {
      continue;
    }

    const resolution = resolveCallTarget(context, parsedFile.filePath, expression);

    edges.push({
      id: createId(
        "call-graph-edge",
        sourceNode.node.id,
        expression.getText(),
        callExpression.getStartLineNumber()
      ),
      sourceNodeId: sourceNode.node.id,
      targetNodeId: resolution.targetNodeId,
      targetFilePath: resolution.targetFilePath,
      targetName: resolution.targetName,
      calleeText: expression.getText(),
      confidence: resolution.confidence,
      resolutionKind: resolution.resolutionKind,
      evidenceFilePath: parsedFile.filePath,
      evidenceLine: callExpression.getStartLineNumber(),
      evidenceText: callExpression.getText(),
    });
  }

  return edges.sort((left, right) => left.evidenceLine - right.evidenceLine);
}

export function extractCallGraph(parsedFiles: ParsedFile[]): void {
  const graphNodesByFile = new Map<string, GraphNodeWithContainer[]>();
  const allNodes: CallGraphNode[] = [];

  for (const parsedFile of parsedFiles) {
    const fileNodes = collectGraphNodes(parsedFile);
    graphNodesByFile.set(parsedFile.filePath, fileNodes);
    parsedFile.callGraphNodes = fileNodes.map((record) => record.node);
    allNodes.push(...parsedFile.callGraphNodes);
  }

  const context = createResolutionContext(parsedFiles, allNodes);

  for (const parsedFile of parsedFiles) {
    const fileNodes = graphNodesByFile.get(parsedFile.filePath) ?? [];
    const containerSet = new Set(fileNodes.map((record) => record.container));

    parsedFile.callGraphEdges = fileNodes.flatMap((record) =>
      collectNodeEdges(record, containerSet, parsedFile, context)
    );

    for (const route of parsedFile.routes) {
      route.handlers = route.handlers.map((handler) => {
        if (handler.kind === "inline") {
          const targetNode = parsedFile.callGraphNodes.find(
            (node) =>
              node.kind === "route_handler" &&
              node.startLine === handler.startLine &&
              node.endLine === handler.endLine
          );

          return {
            ...handler,
            targetNodeId: targetNode?.id ?? null,
            targetFilePath: targetNode?.filePath ?? parsedFile.filePath,
          };
        }

        if (!handler.name) {
          return handler;
        }

        const target = resolveCallableReference(context, parsedFile.filePath, handler.name);

        return {
          ...handler,
          targetNodeId: target.targetNodeId,
          targetFilePath: target.targetFilePath,
          confidence: target.confidence,
        };
      });
    }

    parsedFile.expressMounts = parsedFile.expressMounts.map((mount) => ({
      ...mount,
      middleware: mount.middleware.map((handler) => {
        if (!handler.name) {
          return handler;
        }

        const target = resolveCallableReference(context, parsedFile.filePath, handler.name);

        return {
          ...handler,
          targetNodeId: target.targetNodeId,
          targetFilePath: target.targetFilePath,
          confidence: target.confidence,
        };
      }),
    }));
  }
}
