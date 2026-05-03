import type { RouteFlow } from "./flowTypes.js";

export function formatFlow(flow: RouteFlow): string {
  const lines: string[] = [`Trace: ${flow.method} ${flow.path}`];

  for (const step of flow.steps) {
    const location =
      step.filePath && step.line !== null ? ` (${step.filePath}:${step.line})` : step.filePath ? ` (${step.filePath})` : "";
    lines.push(`${step.order}. ${step.kind}\t${step.label}${location}`);
  }

  if (flow.unresolvedCalls.length > 0) {
    lines.push("");
    lines.push("Unresolved external calls:");

    for (const call of flow.unresolvedCalls) {
      lines.push(`- ${call.callee} (${call.filePath}:${call.line})`);
    }
  }

  return lines.join("\n");
}
