import type { BehaviorConfidence, EvidenceRef, SideEffect } from "./behaviorTypes.js";

type SideEffectMatch = Omit<SideEffect, "evidence">;

const DATABASE_OBJECT_PATTERNS = [
  /(^|\.)(repo|repository|db|database|prisma|model|collection|pool)(\.|$)/i,
  /^[A-Z][A-Za-z0-9_]*\.(find|findOne|findMany|findById|create|update|delete|save)\b/,
];

const DATABASE_METHOD_PATTERNS = [
  /\.(find|findOne|findMany|findById|findAll|list|getById|create|insertOne|update|updateOne|delete|deleteOne|save|query)\b/i,
];

const EXTERNAL_HTTP_PATTERNS = [/^fetch\b/, /^axios\./i, /\.request\b/i];
const EMAIL_PATTERNS = [/sendEmail\b/i, /\.sendMail\b/i, /emailService\.send\b/i, /mailer\.sendMail\b/i];
const FILESYSTEM_PATTERNS = [/^fs\./i, /^fs\.promises\./i, /\.(readFile|writeFile|unlink)\b/i];
const QUEUE_PATTERNS = [/queue\.add\b/i, /sendToQueue\b/i, /\.publish\b/i];
const AUTH_PATTERNS = [/^jwt\.(sign|verify)\b/i, /^bcrypt\.(hash|compare)\b/i, /\bsession\b/i];
const LOGGING_PATTERNS = [/^console\.(log|info|warn|error)\b/i, /^logger\.(debug|info|warn|error|log)\b/i];

function getTargetFromCallee(calleeText: string): string | undefined {
  const lastDot = calleeText.lastIndexOf(".");

  if (lastDot === -1) {
    return undefined;
  }

  return calleeText.slice(0, lastDot);
}

export function createEvidence(
  filePath: string,
  line: number,
  text: string,
  confidence: BehaviorConfidence
): EvidenceRef {
  return {
    filePath,
    line,
    text,
    confidence,
  };
}

export function classifySideEffect(calleeText: string): SideEffectMatch | null {
  const normalized = calleeText.trim();

  if (!normalized) {
    return null;
  }

  if (
    DATABASE_OBJECT_PATTERNS.some((pattern) => pattern.test(normalized)) ||
    DATABASE_METHOD_PATTERNS.some((pattern) => pattern.test(normalized))
  ) {
    return {
      kind: "database",
      operation: normalized,
      target: getTargetFromCallee(normalized),
    };
  }

  if (EXTERNAL_HTTP_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return {
      kind: "external_http",
      operation: normalized,
      target: getTargetFromCallee(normalized),
    };
  }

  if (EMAIL_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return {
      kind: "email",
      operation: normalized,
      target: getTargetFromCallee(normalized),
    };
  }

  if (FILESYSTEM_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return {
      kind: "filesystem",
      operation: normalized,
      target: getTargetFromCallee(normalized),
    };
  }

  if (QUEUE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return {
      kind: "queue",
      operation: normalized,
      target: getTargetFromCallee(normalized),
    };
  }

  if (AUTH_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return {
      kind: "auth",
      operation: normalized,
      target: getTargetFromCallee(normalized),
    };
  }

  if (LOGGING_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return {
      kind: "logging",
      operation: normalized,
      target: getTargetFromCallee(normalized),
    };
  }

  return null;
}
