import assert from "node:assert/strict";
import test from "node:test";

import { normalizeDiagnosticError, sanitizeDiagnosticText } from "../src/app/diagnostic-utils.ts";

test("unknown rejection values cannot crash diagnostics", () => {
  for (const value of ["error", undefined, { message: "x" }]) {
    assert.doesNotThrow(() => normalizeDiagnosticError(value));
    assert.equal(typeof normalizeDiagnosticError(value).message, "string");
  }
  const circular = {};
  circular.self = circular;
  assert.doesNotThrow(() => normalizeDiagnosticError(circular));
});

test("diagnostics remove URL query values", () => {
  const sanitized = sanitizeDiagnosticText("at https://instagram.com/reel/ABC/?igsh=secret-token");
  assert.equal(sanitized.includes("secret-token"), false);
  assert.equal(sanitized.includes("[redacted]"), true);
});
