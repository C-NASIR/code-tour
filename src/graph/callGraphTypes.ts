import type { Confidence } from "../types/records.js";

export type CallGraphNodeKind = "function" | "method" | "object_method" | "route_handler";

export type CallGraphNode = {
  id: string;
  filePath: string;
  kind: CallGraphNodeKind;
  name: string;
  qualifiedName: string;
  startLine: number;
  endLine: number;
};

export type CallGraphResolutionKind =
  | "same_file_named"
  | "imported_named"
  | "imported_property"
  | "namespace_property"
  | "same_file_property"
  | "ambiguous"
  | "unresolved"
  | "external";

export type CallGraphEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string | null;
  targetFilePath: string | null;
  targetName: string | null;
  calleeText: string;
  confidence: Confidence;
  resolutionKind: CallGraphResolutionKind;
  evidenceFilePath: string;
  evidenceLine: number;
  evidenceText: string;
};
