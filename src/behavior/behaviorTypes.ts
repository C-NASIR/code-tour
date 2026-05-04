import type {
  ArrowFunction,
  CallExpression,
  CatchClause,
  FunctionDeclaration,
  FunctionExpression,
  GetAccessorDeclaration,
  IfStatement,
  MethodDeclaration,
  Node,
  SourceFile,
  SetAccessorDeclaration,
  ThrowStatement,
} from "ts-morph";
import type { CallGraphNode } from "../graph/callGraphTypes.js";
import type { RouteFlow, RouteFlowStep } from "../flow/flowTypes.js";

export type BehaviorConfidence = "high" | "medium" | "low";

export type EvidenceRef = {
  filePath: string;
  line: number;
  text: string;
  confidence: BehaviorConfidence;
};

export type DataRead = {
  source: "req_body" | "req_params" | "req_query" | "req_headers" | "env" | "local_variable" | "unknown";
  name: string;
  evidence: EvidenceRef;
};

export type ValidationRule = {
  kind: "required_check" | "schema_validation" | "conditional_check" | "manual_check" | "unknown";
  description: string;
  evidence: EvidenceRef;
};

export type SideEffect = {
  kind: "database" | "external_http" | "email" | "filesystem" | "queue" | "auth" | "logging" | "unknown";
  operation: string;
  target?: string;
  evidence: EvidenceRef;
};

export type ResponseWrite = {
  kind: "json" | "send" | "status" | "redirect" | "end" | "unknown";
  statusCode?: number;
  description: string;
  evidence: EvidenceRef;
};

export type ErrorPath = {
  kind: "throw" | "next_error" | "status_error_response" | "catch_block" | "unknown";
  description: string;
  evidence: EvidenceRef;
};

export type FunctionBehavior = {
  symbolId?: string;
  name: string;
  filePath: string;
  startLine?: number;
  endLine?: number;
  dataReads: DataRead[];
  validations: ValidationRule[];
  sideEffects: SideEffect[];
  responses: ResponseWrite[];
  errors: ErrorPath[];
  calls: string[];
  confidence: BehaviorConfidence;
};

export type RouteBehavior = {
  method: string;
  path: string;
  routeFilePath: string;
  flowSteps: RouteFlowStep[];
  functionBehaviors: FunctionBehavior[];
  combinedDataReads: DataRead[];
  combinedValidations: ValidationRule[];
  combinedSideEffects: SideEffect[];
  combinedResponses: ResponseWrite[];
  combinedErrors: ErrorPath[];
  filesInvolved: string[];
  unresolvedBehavior: string[];
  confidence: BehaviorConfidence;
};

export type AliasBinding = {
  localName: string;
  origin: DataRead;
};

export type ExtractionContext = {
  filePath: string;
  sourceFile: SourceFile;
  container: Node;
  functionLike: SupportedFunctionLike;
  functionName: string;
  confidence: BehaviorConfidence;
  requestParamNames: Set<string>;
  responseParamNames: Set<string>;
  nextParamNames: Set<string>;
  directCallExpressions: CallExpression[];
  directIfStatements: IfStatement[];
  directThrowStatements: ThrowStatement[];
  directCatchClauses: CatchClause[];
  aliases: Map<string, AliasBinding>;
};

export type ResolvedFunctionContainer = {
  node: CallGraphNode;
  sourceFile: SourceFile;
  container: Node;
  functionLike: SupportedFunctionLike;
};

export type FunctionBehaviorExtraction = {
  behavior: FunctionBehavior;
  unresolvedBehavior: string[];
};

export type RouteBehaviorBuildContext = {
  flow: RouteFlow;
  resolveNodeById: (nodeId: string) => CallGraphNode | null;
  resolveNodeForStep: (step: RouteFlowStep) => {
    node: CallGraphNode | null;
    unresolvedBehavior: string[];
    confidence: BehaviorConfidence;
  };
  readIndexedFileContent: (filePath: string) => string;
};

export type SupportedFunctionLike =
  | FunctionDeclaration
  | ArrowFunction
  | FunctionExpression
  | MethodDeclaration
  | GetAccessorDeclaration
  | SetAccessorDeclaration;
