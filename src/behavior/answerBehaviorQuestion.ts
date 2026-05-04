import type { RouteBehavior } from "./behaviorTypes.js";

export type AskIntent =
  | "route_summary"
  | "input_reads"
  | "validations"
  | "database_side_effects"
  | "side_effects"
  | "errors";

export type ParsedBehaviorQuestion = {
  method: string;
  path: string;
  intent: AskIntent;
};

function summarizeList(items: string[]): string {
  return items.length > 0 ? items.join(", ") : "(none)";
}

function describeRouteSummary(behavior: RouteBehavior): string {
  const inputs = behavior.combinedDataReads.map((item) =>
    item.name === "*"
      ? item.source === "req_body"
        ? "req.body"
        : item.source === "req_params"
          ? "req.params"
          : item.source === "req_query"
            ? "req.query"
            : item.source === "req_headers"
              ? "req.headers"
              : "process.env"
      : item.source === "req_body"
        ? `req.body.${item.name}`
        : item.source === "req_params"
          ? `req.params.${item.name}`
          : item.source === "req_query"
            ? `req.query.${item.name}`
            : item.source === "req_headers"
              ? `req.headers.${item.name}`
              : item.source === "env"
                ? `process.env.${item.name}`
                : item.name
  );
  const validations = behavior.combinedValidations.map((item) => item.description);
  const sideEffects = behavior.combinedSideEffects.map((item) => `${item.kind}:${item.operation}`);
  const responses = behavior.combinedResponses.map((item) =>
    item.statusCode ? `${item.kind} ${item.statusCode}` : item.kind
  );
  const errors = behavior.combinedErrors.map((item) => item.description);

  return [
    `${behavior.method} ${behavior.path}`,
    `Inputs: ${summarizeList(inputs)}`,
    `Validations: ${summarizeList(validations)}`,
    `Side effects: ${summarizeList(sideEffects)}`,
    `Responses: ${summarizeList(responses)}`,
    `Errors: ${summarizeList(errors)}`,
  ].join("\n");
}

function formatEvidenceList<T extends { evidence: { filePath: string; line: number; text: string } }>(
  items: T[],
  render: (item: T) => string
): string {
  if (items.length === 0) {
    return "(none)";
  }

  return items
    .map((item) => `- ${render(item)} (${item.evidence.filePath}:${item.evidence.line})`)
    .join("\n");
}

/**
 * Parses the limited deterministic `ask` question forms supported in Phase 3.
 */
export function parseBehaviorQuestion(question: string): ParsedBehaviorQuestion {
  const trimmed = question.trim();
  const routeMatch = trimmed.match(/\b(GET|POST|PUT|PATCH|DELETE)\b\s+([/][^\s?"]*)/i);

  if (!routeMatch) {
    throw new Error("Unsupported question: include exactly one route as METHOD /path.");
  }

  const normalizedQuestion = trimmed.toLowerCase();
  let intent: AskIntent | null = null;

  if (/what does\b/.test(normalizedQuestion)) {
    intent = "route_summary";
  } else if (/what input\b/.test(normalizedQuestion)) {
    intent = "input_reads";
  } else if (/what validation\b/.test(normalizedQuestion)) {
    intent = "validations";
  } else if (/what database\b/.test(normalizedQuestion)) {
    intent = "database_side_effects";
  } else if (/what side effects?\b/.test(normalizedQuestion)) {
    intent = "side_effects";
  } else if (/what errors?\b/.test(normalizedQuestion)) {
    intent = "errors";
  }

  if (!intent) {
    throw new Error(
      "Unsupported question: only route-scoped 'what does', 'what input', 'what validation', 'what database', 'what side effects', and 'what errors' prompts are supported."
    );
  }

  return {
    method: routeMatch[1].toUpperCase(),
    path: routeMatch[2],
    intent,
  };
}

/**
 * Answers the supported deterministic `ask` intents from one RouteBehavior.
 */
export function answerBehaviorQuestion(question: string, behavior: RouteBehavior): string {
  const parsed = parseBehaviorQuestion(question);

  if (parsed.intent === "route_summary") {
    return describeRouteSummary(behavior);
  }

  if (parsed.intent === "input_reads") {
    return [
      `Inputs for ${behavior.method} ${behavior.path}:`,
      formatEvidenceList(behavior.combinedDataReads, (item) => `${item.source} ${item.name}`),
    ].join("\n");
  }

  if (parsed.intent === "validations") {
    return [
      `Validations for ${behavior.method} ${behavior.path}:`,
      formatEvidenceList(behavior.combinedValidations, (item) => `${item.kind} ${item.description}`),
    ].join("\n");
  }

  if (parsed.intent === "database_side_effects") {
    const databaseEffects = behavior.combinedSideEffects.filter((item) => item.kind === "database");

    return [
      `Database operations for ${behavior.method} ${behavior.path}:`,
      formatEvidenceList(databaseEffects, (item) => item.operation),
    ].join("\n");
  }

  if (parsed.intent === "side_effects") {
    return [
      `Side effects for ${behavior.method} ${behavior.path}:`,
      formatEvidenceList(behavior.combinedSideEffects, (item) => `${item.kind} ${item.operation}`),
    ].join("\n");
  }

  return [
    `Errors for ${behavior.method} ${behavior.path}:`,
    formatEvidenceList(behavior.combinedErrors, (item) => `${item.kind} ${item.description}`),
  ].join("\n");
}
