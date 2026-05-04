import type { RouteFlowStep } from "../flow/flowTypes.js";
import type { BehaviorConfidence, DataRead, ErrorPath, FunctionBehavior, ResponseWrite, RouteBehavior, SideEffect, ValidationRule } from "./behaviorTypes.js";
import type { RouteBehaviorBuildContext } from "./behaviorTypes.js";
import { extractFunctionBehaviorFromSnapshot } from "./extractFunctionBehavior.js";

const EXECUTABLE_STEP_KINDS = new Set<RouteFlowStep["kind"]>([
  "middleware",
  "handler",
  "service_call",
  "repository_call",
  "function_call",
]);

function mergeUniqueByEvidence<T extends { evidence: { filePath: string; line: number; text: string } }>(
  target: T[],
  source: T[]
): void {
  const seen = new Set(target.map((item) => `${item.evidence.filePath}:${item.evidence.line}:${item.evidence.text}`));

  for (const item of source) {
    const key = `${item.evidence.filePath}:${item.evidence.line}:${item.evidence.text}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    target.push(item);
  }
}

function addUniqueValue(values: string[], nextValue: string): void {
  if (!values.includes(nextValue)) {
    values.push(nextValue);
  }
}

/**
 * Builds route-level behavior by replaying the traced Phase 2 flow and
 * extracting direct behavior from each resolved local step.
 */
export function buildRouteBehavior(context: RouteBehaviorBuildContext): RouteBehavior {
  const functionBehaviors: FunctionBehavior[] = [];
  const combinedDataReads: DataRead[] = [];
  const combinedValidations: ValidationRule[] = [];
  const combinedSideEffects: SideEffect[] = [];
  const combinedResponses: ResponseWrite[] = [];
  const combinedErrors: ErrorPath[] = [];
  const filesInvolved: string[] = [];
  const unresolvedBehavior: string[] = [];
  let hasMediumConfidence = false;
  let hasLowConfidence = false;

  addUniqueValue(filesInvolved, context.flow.matchedRoute.filePath);

  for (const step of context.flow.steps) {
    if (step.filePath) {
      addUniqueValue(filesInvolved, step.filePath);
    }

    if (step.confidence === "medium") {
      hasMediumConfidence = true;
    } else if (step.confidence === "low") {
      hasLowConfidence = true;
    }

    if (step.kind === "unknown_call") {
      unresolvedBehavior.push(
        `Unresolved call ${step.label} (${step.filePath ?? "unknown"}:${step.line ?? 0}).`
      );
      hasLowConfidence = true;
      continue;
    }

    if (!EXECUTABLE_STEP_KINDS.has(step.kind)) {
      continue;
    }

    const resolved = step.targetNodeId
      ? {
          node: context.resolveNodeById(step.targetNodeId),
          unresolvedBehavior: [] as string[],
          confidence: step.confidence as BehaviorConfidence,
        }
      : context.resolveNodeForStep(step);

    if (resolved.confidence === "medium") {
      hasMediumConfidence = true;
    } else if (resolved.confidence === "low") {
      hasLowConfidence = true;
    }

    if (resolved.unresolvedBehavior.length > 0) {
      unresolvedBehavior.push(...resolved.unresolvedBehavior);
    }

    if (!resolved.node) {
      hasLowConfidence = true;
      continue;
    }

    const extraction = extractFunctionBehaviorFromSnapshot(
      resolved.node,
      context.readIndexedFileContent(resolved.node.filePath)
    );

    functionBehaviors.push(extraction.behavior);
    mergeUniqueByEvidence(combinedDataReads, extraction.behavior.dataReads);
    mergeUniqueByEvidence(combinedValidations, extraction.behavior.validations);
    mergeUniqueByEvidence(combinedSideEffects, extraction.behavior.sideEffects);
    mergeUniqueByEvidence(combinedResponses, extraction.behavior.responses);
    mergeUniqueByEvidence(combinedErrors, extraction.behavior.errors);

    if (extraction.behavior.filePath) {
      addUniqueValue(filesInvolved, extraction.behavior.filePath);
    }

    if (extraction.behavior.confidence === "low" || extraction.unresolvedBehavior.length > 0) {
      hasLowConfidence = true;
    }

    if (extraction.unresolvedBehavior.length > 0) {
      unresolvedBehavior.push(...extraction.unresolvedBehavior);
    }
  }

  for (const unresolvedCall of context.flow.unresolvedCalls) {
    unresolvedBehavior.push(
      `Unresolved external call ${unresolvedCall.callee} (${unresolvedCall.filePath}:${unresolvedCall.line}) reason=${unresolvedCall.reason}.`
    );

    if (unresolvedCall.confidence === "low") {
      hasLowConfidence = true;
    } else if (unresolvedCall.confidence === "medium") {
      hasMediumConfidence = true;
    }
  }

  const confidence: BehaviorConfidence = hasLowConfidence ? "low" : hasMediumConfidence ? "medium" : "high";

  return {
    method: context.flow.method,
    path: context.flow.path,
    routeFilePath: context.flow.matchedRoute.filePath,
    flowSteps: context.flow.steps,
    functionBehaviors,
    combinedDataReads,
    combinedValidations,
    combinedSideEffects,
    combinedResponses,
    combinedErrors,
    filesInvolved,
    unresolvedBehavior,
    confidence,
  };
}
