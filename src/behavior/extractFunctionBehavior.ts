import {
  Node,
  Project,
  ScriptKind,
  SyntaxKind,
  type Node as MorphNode,
  type SourceFile,
} from "ts-morph";
import type { CallGraphNode } from "../graph/callGraphTypes.js";
import type {
  ExtractionContext,
  FunctionBehavior,
  FunctionBehaviorExtraction,
  ResolvedFunctionContainer,
  SupportedFunctionLike,
} from "./behaviorTypes.js";
import { extractDataReads } from "./extractDataReads.js";
import { extractErrors } from "./extractErrors.js";
import { extractResponses } from "./extractResponses.js";
import { extractSideEffects } from "./extractSideEffects.js";
import { extractValidations } from "./extractValidations.js";

function getScriptKind(filePath: string): ScriptKind {
  if (filePath.endsWith(".ts") || filePath.endsWith(".mts") || filePath.endsWith(".cts")) {
    return ScriptKind.TS;
  }

  return ScriptKind.JS;
}

function createSnapshotSourceFile(filePath: string, content: string): SourceFile {
  const project = new Project({
    compilerOptions: {
      allowJs: true,
    },
    skipAddingFilesFromTsConfig: true,
    useInMemoryFileSystem: true,
  });

  return project.createSourceFile(filePath, content, {
    overwrite: true,
    scriptKind: getScriptKind(filePath),
  });
}

function isFunctionLikeContainer(node: MorphNode): node is SupportedFunctionLike {
  return (
    Node.isFunctionDeclaration(node) ||
    Node.isArrowFunction(node) ||
    Node.isFunctionExpression(node) ||
    Node.isMethodDeclaration(node) ||
    Node.isGetAccessorDeclaration(node) ||
    Node.isSetAccessorDeclaration(node)
  );
}

function findFunctionContainer(sourceFile: SourceFile, node: CallGraphNode): MorphNode | null {
  if (node.kind === "function") {
    const directFunction = sourceFile
      .getFunctions()
      .find((declaration) => declaration.getName() === node.name && declaration.getStartLineNumber() === node.startLine);

    if (directFunction) {
      return directFunction;
    }

    const variableDeclaration = sourceFile
      .getVariableDeclarations()
      .find((declaration) => declaration.getName() === node.name && declaration.getStartLineNumber() === node.startLine);

    return variableDeclaration?.getInitializer() ?? null;
  }

  if (node.kind === "method") {
    const separatorIndex = node.qualifiedName.lastIndexOf(".");
    const ownerName = node.qualifiedName.slice(0, separatorIndex);
    const methodName = node.qualifiedName.slice(separatorIndex + 1);
    const classDeclaration = sourceFile.getClasses().find((declaration) => declaration.getName() === ownerName);

    return (
      classDeclaration
        ?.getMembers()
        .find((member) => "getName" in member && member.getName() === methodName && member.getStartLineNumber() === node.startLine) ??
      null
    );
  }

  if (node.kind === "object_method") {
    const separatorIndex = node.qualifiedName.lastIndexOf(".");
    const objectName = node.qualifiedName.slice(0, separatorIndex);
    const methodName = node.qualifiedName.slice(separatorIndex + 1);
    const variableDeclaration = sourceFile.getVariableDeclaration(objectName);
    const initializer = variableDeclaration?.getInitializer();

    if (!initializer || !Node.isObjectLiteralExpression(initializer)) {
      return null;
    }

    for (const property of initializer.getProperties()) {
      if (Node.isMethodDeclaration(property) && property.getName() === methodName && property.getStartLineNumber() === node.startLine) {
        return property;
      }

      if (Node.isPropertyAssignment(property) && property.getName() === methodName && property.getStartLineNumber() === node.startLine) {
        return property.getInitializer() ?? null;
      }
    }
  }

  if (node.kind === "route_handler") {
    const candidates: MorphNode[] = [
      ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression),
    ];

    return (
      candidates.find(
        (candidate) =>
          candidate.getStartLineNumber() === node.startLine && candidate.getEndLineNumber() === node.endLine
      ) ?? null
    );
  }

  return null;
}

function detectParameterNames(
  functionLike: SupportedFunctionLike
): Pick<ExtractionContext, "requestParamNames" | "responseParamNames" | "nextParamNames"> {
  const requestParamNames = new Set<string>();
  const responseParamNames = new Set<string>();
  const nextParamNames = new Set<string>();

  for (const parameter of functionLike.getParameters()) {
    const name = parameter.getName();
    const typeText = parameter.getTypeNode()?.getText() ?? "";

    if (/\bRequest\b/.test(typeText)) {
      requestParamNames.add(name);
      continue;
    }

    if (/\bResponse\b/.test(typeText)) {
      responseParamNames.add(name);
      continue;
    }

    if (/\bNext(Function)?\b/.test(typeText)) {
      nextParamNames.add(name);
      continue;
    }
  }

  if (requestParamNames.size === 0) {
    for (const fallback of ["req", "request"]) {
      if (functionLike.getParameters().some((parameter) => parameter.getName() === fallback)) {
        requestParamNames.add(fallback);
      }
    }
  }

  if (responseParamNames.size === 0) {
    for (const fallback of ["res", "response"]) {
      if (functionLike.getParameters().some((parameter) => parameter.getName() === fallback)) {
        responseParamNames.add(fallback);
      }
    }
  }

  if (nextParamNames.size === 0 && functionLike.getParameters().some((parameter) => parameter.getName() === "next")) {
    nextParamNames.add("next");
  }

  return {
    requestParamNames,
    responseParamNames,
    nextParamNames,
  };
}

function isDirectBodyNode(functionLike: SupportedFunctionLike, node: MorphNode): boolean {
  const nestedAncestor = node.getFirstAncestor((ancestor) => ancestor !== functionLike && isFunctionLikeContainer(ancestor));
  return !nestedAncestor;
}

function buildExtractionContext(resolved: ResolvedFunctionContainer): ExtractionContext {
  const parameterNames = detectParameterNames(resolved.functionLike);
  const directCallExpressions = resolved.functionLike
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((callExpression) => isDirectBodyNode(resolved.functionLike, callExpression))
    .sort((left, right) => left.getStart() - right.getStart());
  const directIfStatements = resolved.functionLike
    .getDescendantsOfKind(SyntaxKind.IfStatement)
    .filter((ifStatement) => isDirectBodyNode(resolved.functionLike, ifStatement));
  const directThrowStatements = resolved.functionLike
    .getDescendantsOfKind(SyntaxKind.ThrowStatement)
    .filter((throwStatement) => isDirectBodyNode(resolved.functionLike, throwStatement));
  const directCatchClauses = resolved.functionLike
    .getDescendantsOfKind(SyntaxKind.CatchClause)
    .filter((catchClause) => isDirectBodyNode(resolved.functionLike, catchClause));

  return {
    filePath: resolved.node.filePath,
    sourceFile: resolved.sourceFile,
    container: resolved.container,
    functionLike: resolved.functionLike,
    functionName: resolved.node.qualifiedName,
    confidence: "high",
    requestParamNames: parameterNames.requestParamNames,
    responseParamNames: parameterNames.responseParamNames,
    nextParamNames: parameterNames.nextParamNames,
    directCallExpressions,
    directIfStatements,
    directThrowStatements,
    directCatchClauses,
    aliases: new Map(),
  };
}

/**
 * Resolves one indexed call-graph node back to its function-like AST container
 * using only the persisted indexed file snapshot.
 */
export function resolveFunctionContainerFromSnapshot(node: CallGraphNode, content: string): ResolvedFunctionContainer | null {
  const sourceFile = createSnapshotSourceFile(node.filePath, content);
  const container = findFunctionContainer(sourceFile, node);

  if (!container || !isFunctionLikeContainer(container)) {
    return null;
  }

  return {
    node,
    sourceFile,
    container,
    functionLike: container,
  };
}

/**
 * Extracts direct-body behavior facts for one resolved function or method.
 */
export function extractFunctionBehavior(resolved: ResolvedFunctionContainer): FunctionBehavior {
  const context = buildExtractionContext(resolved);
  const dataReads = extractDataReads(context);
  const validations = extractValidations(context);
  const sideEffects = extractSideEffects(context);
  const responses = extractResponses(context);
  const errors = extractErrors(context, responses);
  const calls = context.directCallExpressions.map((callExpression) => callExpression.getExpression().getText());

  return {
    symbolId: resolved.node.id,
    name: resolved.node.qualifiedName,
    filePath: resolved.node.filePath,
    startLine: resolved.node.startLine,
    endLine: resolved.node.endLine,
    dataReads,
    validations,
    sideEffects,
    responses,
    errors,
    calls,
    confidence: "high",
  };
}

export function extractFunctionBehaviorFromSnapshot(node: CallGraphNode, content: string): FunctionBehaviorExtraction {
  const resolved = resolveFunctionContainerFromSnapshot(node, content);

  if (!resolved) {
    return {
      behavior: {
        symbolId: node.id,
        name: node.qualifiedName,
        filePath: node.filePath,
        startLine: node.startLine,
        endLine: node.endLine,
        dataReads: [],
        validations: [],
        sideEffects: [],
        responses: [],
        errors: [],
        calls: [],
        confidence: "low",
      },
      unresolvedBehavior: [`Could not locate function body for ${node.qualifiedName} (${node.filePath}:${node.startLine}).`],
    };
  }

  return {
    behavior: extractFunctionBehavior(resolved),
    unresolvedBehavior: [],
  };
}
