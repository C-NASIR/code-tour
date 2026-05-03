import type { CallGraphEdge, CallGraphNode } from "../graph/callGraphTypes.js";
import type { RouteFlow, RouteFlowStep, RouteFlowStepKind } from "./flowTypes.js";
import type { ExpressMountRecord, RouteHandlerRef } from "../types/records.js";
import { normalizeRoutePath } from "../utils/routePaths.js";

type TraceIndexData = {
  routes: Array<{
    id: string;
    method: string;
    path: string;
    fullPath: string;
    fullPathConfidence: string;
    filePath: string;
    handlers: RouteHandlerRef[];
  }>;
  mounts: ExpressMountRecord[];
  callGraphNodes: CallGraphNode[];
  callGraphEdges: CallGraphEdge[];
};

const REPOSITORY_PATH_SEGMENTS = ["repo", "repository", "db", "prisma", "model"];

function classifyNodeStep(filePath: string | null): RouteFlowStepKind {
  if (!filePath) {
    return "unknown_call";
  }

  const lowered = filePath.toLowerCase();

  if (lowered.includes("service")) {
    return "service_call";
  }

  if (REPOSITORY_PATH_SEGMENTS.some((segment) => lowered.includes(segment))) {
    return "repository_call";
  }

  return "function_call";
}

function buildMountLineage(filePath: string, mountsByRouterFile: Map<string, ExpressMountRecord[]>): ExpressMountRecord[] {
  const lineage: ExpressMountRecord[] = [];
  const visited = new Set<string>();
  let currentFilePath: string | null = filePath;

  while (currentFilePath) {
    if (visited.has(currentFilePath)) {
      break;
    }

    visited.add(currentFilePath);
    const parentMount: ExpressMountRecord | undefined = (mountsByRouterFile.get(currentFilePath) ?? [])
      .slice()
      .sort((left, right) => left.mountPath.localeCompare(right.mountPath))[0];

    if (!parentMount) {
      break;
    }

    lineage.unshift(parentMount);
    currentFilePath = parentMount.filePath;
  }

  return lineage;
}

function createHandlerStep(order: number, kind: RouteFlowStepKind, handler: RouteHandlerRef): RouteFlowStep {
  return {
    order,
    kind,
    label: handler.name ?? (handler.kind === "inline" ? "[inline]" : "(anonymous)"),
    filePath: handler.targetFilePath ?? handler.filePath,
    line: handler.startLine,
    confidence: handler.confidence,
  };
}

export function traceRouteFlow(
  indexData: TraceIndexData,
  method: string,
  path: string,
  maxDepth = 4
): RouteFlow {
  const normalizedMethod = method.trim().toUpperCase();
  const normalizedPath = normalizeRoutePath(path);
  const matchedRoute = indexData.routes.find(
    (route) => route.method === normalizedMethod && route.fullPath === normalizedPath
  );

  if (!matchedRoute) {
    throw new Error(`No indexed route matched ${normalizedMethod} ${normalizedPath}.`);
  }

  const mountsByRouterFile = new Map<string, ExpressMountRecord[]>();

  for (const mount of indexData.mounts) {
    if (!mount.routerFilePath) {
      continue;
    }

    const records = mountsByRouterFile.get(mount.routerFilePath) ?? [];
    records.push(mount);
    mountsByRouterFile.set(mount.routerFilePath, records);
  }

  const nodeById = new Map(indexData.callGraphNodes.map((node) => [node.id, node]));
  const edgesBySourceNodeId = new Map<string, CallGraphEdge[]>();

  for (const edge of indexData.callGraphEdges) {
    const edges = edgesBySourceNodeId.get(edge.sourceNodeId) ?? [];
    edges.push(edge);
    edgesBySourceNodeId.set(edge.sourceNodeId, edges);
  }

  const steps: RouteFlowStep[] = [];
  const unresolvedCalls: RouteFlow["unresolvedCalls"] = [];
  let stepOrder = 1;

  steps.push({
    order: stepOrder,
    kind: "route",
    label: `${matchedRoute.method} ${matchedRoute.fullPath}`,
    filePath: matchedRoute.filePath,
    line: null,
    confidence: matchedRoute.fullPathConfidence as RouteFlowStep["confidence"],
  });
  stepOrder += 1;

  for (const mount of buildMountLineage(matchedRoute.filePath, mountsByRouterFile)) {
    for (const handler of mount.middleware.sort((left, right) => left.order - right.order)) {
      steps.push(createHandlerStep(stepOrder, "middleware", { ...handler, routeId: matchedRoute.id }));
      stepOrder += 1;
    }
  }

  for (const handler of matchedRoute.handlers.sort((left, right) => left.order - right.order)) {
    steps.push(createHandlerStep(stepOrder, handler.kind === "middleware" ? "middleware" : "handler", handler));
    stepOrder += 1;
  }

  const finalHandler = matchedRoute.handlers.at(-1);
  const visitedNodeIds = new Set<string>();

  function expandFromNode(nodeId: string, depth: number): void {
    if (depth >= maxDepth || visitedNodeIds.has(nodeId)) {
      return;
    }

    visitedNodeIds.add(nodeId);
    const edges = (edgesBySourceNodeId.get(nodeId) ?? []).sort(
      (left, right) => left.evidenceLine - right.evidenceLine || left.calleeText.localeCompare(right.calleeText)
    );

    for (const edge of edges) {
      if (!edge.targetNodeId) {
        if (edge.resolutionKind === "external") {
          unresolvedCalls.push({
            callee: edge.calleeText,
            filePath: edge.evidenceFilePath,
            line: edge.evidenceLine,
            evidenceText: edge.evidenceText,
            confidence: edge.confidence,
            reason: edge.resolutionKind,
          });
          continue;
        }

        steps.push({
          order: stepOrder,
          kind: "unknown_call",
          label: edge.calleeText,
          filePath: edge.evidenceFilePath,
          line: edge.evidenceLine,
          confidence: edge.confidence,
          evidence: {
            filePath: edge.evidenceFilePath,
            line: edge.evidenceLine,
            text: edge.evidenceText,
          },
        });
        stepOrder += 1;
        continue;
      }

      const targetNode = nodeById.get(edge.targetNodeId);

      if (!targetNode || visitedNodeIds.has(targetNode.id)) {
        continue;
      }

      steps.push({
        order: stepOrder,
        kind: classifyNodeStep(targetNode.filePath),
        label: targetNode.qualifiedName,
        filePath: targetNode.filePath,
        line: targetNode.startLine,
        confidence: edge.confidence,
        evidence: {
          filePath: edge.evidenceFilePath,
          line: edge.evidenceLine,
          text: edge.evidenceText,
        },
      });
      stepOrder += 1;
      expandFromNode(targetNode.id, depth + 1);
    }
  }

  if (finalHandler?.targetNodeId) {
    expandFromNode(finalHandler.targetNodeId, 0);
  }

  return {
    method: normalizedMethod,
    path: normalizedPath,
    matchedRoute: {
      filePath: matchedRoute.filePath,
      rawPath: matchedRoute.path,
      fullPath: matchedRoute.fullPath,
      confidence: matchedRoute.fullPathConfidence as RouteFlow["matchedRoute"]["confidence"],
      handlers: matchedRoute.handlers,
    },
    steps,
    unresolvedCalls,
  };
}
