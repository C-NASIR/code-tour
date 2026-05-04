import type { CallGraphNode } from "../graph/callGraphTypes.js";
import { traceRouteFlow } from "../flow/traceRouteFlow.js";
import {
  readIndexedCallGraphNodeById,
  readIndexedCallGraphNodesByQualifiedName,
  readIndexedCallGraphNodesBySimpleName,
  readIndexedCallGraphNodesForFile,
  readIndexedFileSnapshot,
  readIndexedRoutesForFile,
  readTraceIndexData,
} from "../storage/projectQueries.js";
import type { FunctionBehavior, RouteBehavior } from "./behaviorTypes.js";
import { buildRouteBehavior } from "./buildRouteBehavior.js";
import { extractFunctionBehaviorFromSnapshot } from "./extractFunctionBehavior.js";

type ResolvedStepNode = {
  node: CallGraphNode | null;
  unresolvedBehavior: string[];
  confidence: "high" | "medium" | "low";
};

function filterCallableNodes(nodes: CallGraphNode[]): CallGraphNode[] {
  return nodes.filter((node) => node.kind !== "route_handler");
}

function sortNodes(nodes: CallGraphNode[]): CallGraphNode[] {
  return nodes.slice().sort((left, right) => left.filePath.localeCompare(right.filePath) || left.startLine - right.startLine);
}

function resolveNodeForStep(projectRoot: string, step: { label: string; filePath: string | null; line: number | null }): ResolvedStepNode {
  if (!step.filePath || step.line === null) {
    return {
      node: null,
      unresolvedBehavior: [`Could not resolve ${step.label}: missing file or line metadata.`],
      confidence: "low",
    };
  }

  const fileNodes = readIndexedCallGraphNodesForFile(projectRoot, step.filePath);
  const exactMatches = fileNodes.filter((node) => node.startLine === step.line && (node.qualifiedName === step.label || node.name === step.label));

  if (exactMatches.length === 1) {
    return {
      node: exactMatches[0],
      unresolvedBehavior: [],
      confidence: "high",
    };
  }

  if (exactMatches.length > 1) {
    return {
      node: null,
      unresolvedBehavior: [
        `Ambiguous symbol lookup for ${step.label} (${step.filePath}:${step.line}): ${exactMatches
          .map((node) => `${node.qualifiedName} (${node.filePath}:${node.startLine})`)
          .join(", ")}`,
      ],
      confidence: "low",
    };
  }

  const lineMatches = fileNodes.filter((node) => node.startLine === step.line);

  if (lineMatches.length === 1) {
    return {
      node: lineMatches[0],
      unresolvedBehavior: [],
      confidence: "medium",
    };
  }

  if (lineMatches.length > 1) {
    return {
      node: null,
      unresolvedBehavior: [
        `Ambiguous line-only symbol lookup for ${step.label} (${step.filePath}:${step.line}): ${lineMatches
          .map((node) => `${node.qualifiedName} (${node.filePath}:${node.startLine})`)
          .join(", ")}`,
      ],
      confidence: "low",
    };
  }

  return {
    node: null,
    unresolvedBehavior: [`Could not resolve ${step.label} (${step.filePath}:${step.line}) to an indexed local symbol.`],
    confidence: "low",
  };
}

export function buildRouteBehaviorForProject(projectRoot: string, method: string, path: string): RouteBehavior {
  const flow = traceRouteFlow(readTraceIndexData(projectRoot), method, path);

  return buildRouteBehavior({
    flow,
    resolveNodeById: (nodeId: string) => readIndexedCallGraphNodeById(projectRoot, nodeId),
    resolveNodeForStep: (step) => resolveNodeForStep(projectRoot, step),
    readIndexedFileContent: (filePath: string) => readIndexedFileSnapshot(projectRoot, filePath).content,
  });
}

export function resolveFunctionBehaviorCandidates(projectRoot: string, functionName: string): CallGraphNode[] {
  if (functionName.includes(".")) {
    return filterCallableNodes(readIndexedCallGraphNodesByQualifiedName(projectRoot, functionName));
  }

  return filterCallableNodes(readIndexedCallGraphNodesBySimpleName(projectRoot, functionName));
}

export function buildFunctionBehaviorForNode(projectRoot: string, node: CallGraphNode): FunctionBehavior {
  const extraction = extractFunctionBehaviorFromSnapshot(node, readIndexedFileSnapshot(projectRoot, node.filePath).content);

  return extraction.behavior;
}

export function buildFunctionBehaviorForProject(projectRoot: string, functionName: string): {
  behavior: FunctionBehavior;
  candidates: CallGraphNode[];
} {
  const candidates = sortNodes(resolveFunctionBehaviorCandidates(projectRoot, functionName));

  if (candidates.length === 0) {
    throw new Error(`No indexed function matched ${functionName}.`);
  }

  if (!functionName.includes(".") && candidates.length > 1) {
    const lines = candidates.map((candidate) => `- ${candidate.qualifiedName}\t${candidate.filePath}`);
    throw new Error(`Ambiguous function name ${functionName}. Matching candidates:\n${lines.join("\n")}`);
  }

  return {
    behavior: buildFunctionBehaviorForNode(projectRoot, candidates[0]),
    candidates,
  };
}

export function listFileBehaviorRouteTargets(projectRoot: string, filePath: string): Array<{ method: string; path: string }> {
  return readIndexedRoutesForFile(projectRoot, filePath).map((route) => ({
    method: route.method,
    path: route.fullPath,
  }));
}

export function listFileFunctionBehaviorNodes(projectRoot: string, filePath: string): CallGraphNode[] {
  return sortNodes(filterCallableNodes(readIndexedCallGraphNodesForFile(projectRoot, filePath)));
}
