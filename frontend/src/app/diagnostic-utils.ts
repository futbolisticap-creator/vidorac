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
    .replace(/(https?:\/\/[^\s?#]+)[?#][^\s)]+/gi, "$1?[redacted]")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .slice(0, limit);
}
