import type { DataRead, ErrorPath, FunctionBehavior, ResponseWrite, RouteBehavior, SideEffect, ValidationRule } from "./behaviorTypes.js";

function formatEvidence(item: { evidence: { filePath: string; line: number; text: string } }): string {
  return `(${item.evidence.filePath}:${item.evidence.line}) ${item.evidence.text}`;
}

function formatDataRead(read: DataRead): string {
  const name =
    read.name === "*"
      ? read.source === "req_body"
        ? "req.body"
        : read.source === "req_params"
          ? "req.params"
          : read.source === "req_query"
            ? "req.query"
            : read.source === "req_headers"
              ? "req.headers"
              : read.source === "env"
                ? "process.env"
                : read.name
      : read.source === "req_body"
        ? `req.body.${read.name}`
        : read.source === "req_params"
          ? `req.params.${read.name}`
          : read.source === "req_query"
            ? `req.query.${read.name}`
            : read.source === "req_headers"
              ? `req.headers.${read.name}`
              : read.source === "env"
                ? `process.env.${read.name}`
                : read.name;

  return `${name} [${read.source}] ${formatEvidence(read)}`;
}

function formatValidation(rule: ValidationRule): string {
  return `${rule.kind}: ${rule.description} ${formatEvidence(rule)}`;
}

function formatSideEffect(effect: SideEffect): string {
  return `${effect.kind}: ${effect.operation}${effect.target ? ` target=${effect.target}` : ""} ${formatEvidence(effect)}`;
}

function formatResponse(response: ResponseWrite): string {
  return `${response.kind}${response.statusCode ? ` status=${response.statusCode}` : ""}: ${response.description} ${formatEvidence(response)}`;
}

function formatError(error: ErrorPath): string {
  return `${error.kind}: ${error.description} ${formatEvidence(error)}`;
}

function pushSection(lines: string[], title: string, items: string[]): void {
  lines.push("");
  lines.push(`${title}:`);
  lines.push(items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "(none)");
}

function formatFunctionHeader(behavior: FunctionBehavior): string {
  return `Behavior: function ${behavior.name}`;
}

function formatRouteHeader(behavior: RouteBehavior): string {
  return `Behavior: route ${behavior.method} ${behavior.path}`;
}

function buildCommonSections(lines: string[], behavior: FunctionBehavior | RouteBehavior): void {
  const dataReads = "combinedDataReads" in behavior ? behavior.combinedDataReads : behavior.dataReads;
  const validations = "combinedValidations" in behavior ? behavior.combinedValidations : behavior.validations;
  const sideEffects = "combinedSideEffects" in behavior ? behavior.combinedSideEffects : behavior.sideEffects;
  const responses = "combinedResponses" in behavior ? behavior.combinedResponses : behavior.responses;
  const errors = "combinedErrors" in behavior ? behavior.combinedErrors : behavior.errors;

  pushSection(lines, "Request Inputs", dataReads.map(formatDataRead));
  pushSection(lines, "Validations", validations.map(formatValidation));
  pushSection(lines, "Side Effects", sideEffects.map(formatSideEffect));
  pushSection(lines, "Responses", responses.map(formatResponse));
  pushSection(lines, "Errors", errors.map(formatError));

  if ("filesInvolved" in behavior) {
    pushSection(lines, "Files Involved", behavior.filesInvolved);
    pushSection(lines, "Unresolved Behavior", behavior.unresolvedBehavior);
  } else {
    pushSection(lines, "Files Involved", [behavior.filePath]);
  }

  lines.push("");
  lines.push(`Confidence: ${behavior.confidence}`);
}

/**
 * Formats deterministic behavior output for both route-level and
 * direct-function analysis.
 */
export function formatBehaviorReport(behavior: FunctionBehavior | RouteBehavior): string {
  const lines: string[] = ["method" in behavior ? formatRouteHeader(behavior) : formatFunctionHeader(behavior)];

  buildCommonSections(lines, behavior);

  return lines.join("\n");
}
