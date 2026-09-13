export type DiagnosticError = {
  name: string;
  message: string;
  stack: string;
};

function safeString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

export function normalizeDiagnosticError(value: unknown): DiagnosticError {
  if (value instanceof Error) {
    return {
      name: value.name || "Error",
      message: value.message || "No message",
      stack: value.stack || "No stack available",
    };
  }
  const message = safeString(value);
  return { name: typeof value, message, stack: "No stack available" };
}

export function sanitizeDiagnosticText(value: string, limit = 3000): string {
  return value
    .replace(/https?:\/\/[^\s)]+/gi, (rawUrl) => {
      try {
        return `${new URL(rawUrl).origin}/[redacted]`;
      } catch {
        return "[redacted-url]";
      }
    })
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .slice(0, limit);
}

export function createDiagnosticRequestId(now = Date.now(), random = Math.random()): string {
  const timePart = Math.max(0, now).toString(36).slice(-8);
  const randomPart = Math.max(0, Math.min(random, 0.9999999999))
    .toString(36)
    .slice(2, 10)
    .padEnd(8, "0");
  return `mobile-debug-${timePart}-${randomPart}`;
}

export function responsePreview(value: string): string {
  if (!value.trim()) return "[empty body]";
  return sanitizeDiagnosticText(value.replace(/\s+/g, " ").trim(), 200);
}
