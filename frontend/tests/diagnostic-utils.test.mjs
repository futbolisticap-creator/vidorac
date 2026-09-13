import assert from "node:assert/strict";
import test from "node:test";

import {
  createDiagnosticRequestId,
  normalizeDiagnosticError,
  responsePreview,
  sanitizeDiagnosticText,
} from "../src/app/diagnostic-utils.ts";

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
  assert.equal(sanitized.includes("/reel/ABC"), false);
  assert.equal(sanitized.includes("[redacted]"), true);
});

test("diagnostic request ids are harmless and stable in shape", () => {
  assert.equal(createDiagnosticRequestId(123456, 0.5), "mobile-debug-2n9c-i0000000");
  assert.match(createDiagnosticRequestId(), /^mobile-debug-[a-z0-9]+-[a-z0-9]{8}$/);
});

test("response previews are bounded, whitespace-normalized, and redact URLs", () => {
  const preview = responsePreview(`  <html>  https://www.tiktok.com/@secret/video/123?token=x ${"a".repeat(300)}</html>`);
  assert.ok(preview.length <= 200);
  assert.equal(preview.includes("@secret"), false);
  assert.equal(preview.includes("token=x"), false);
  assert.equal(responsePreview("  \n "), "[empty body]");
});
