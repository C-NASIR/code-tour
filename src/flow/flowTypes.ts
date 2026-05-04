import type { Confidence, RouteHandlerRef } from "../types/records.js";

export type RouteFlowStepKind =
  | "route"
  | "middleware"
  | "handler"
  | "service_call"
  | "repository_call"
  | "function_call"
  | "unknown_call";

export type RouteFlowStep = {
  order: number;
  kind: RouteFlowStepKind;
  label: string;
  filePath: string | null;
  line: number | null;
  targetNodeId?: string | null;
  confidence: Confidence;
  evidence?: {
    filePath: string;
    line: number;
    text: string;
  };
};

export type RouteFlow = {
  method: string;
  path: string;
  matchedRoute: {
    filePath: string;
    rawPath: string;
    fullPath: string;
    confidence: Confidence;
    handlers: RouteHandlerRef[];
  };
  steps: RouteFlowStep[];
  unresolvedCalls: Array<{
    callee: string;
    filePath: string;
    line: number;
    evidenceText: string;
    confidence: Confidence;
    reason: string;
  }>;
};
