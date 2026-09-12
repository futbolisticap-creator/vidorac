import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeAnalyzePayload,
  normalizePreparePayload,
  readClipboardTextSafely,
} from "../src/app/analyzer-client.ts";

test("clipboard rejection becomes a safe result", async () => {
  const result = await readClipboardTextSafely({
    readText: async () => { throw new Error("permission denied"); },
  });
  assert.deepEqual(result, { ok: false });
});

test("missing clipboard API becomes a safe result", async () => {
  assert.deepEqual(await readClipboardTextSafely(undefined), { ok: false });
});

test("clipboard text is returned without transformation", async () => {
  assert.deepEqual(
    await readClipboardTextSafely({ readText: async () => " https://instagram.com/reel/ABC/ " }),
    { ok: true, text: " https://instagram.com/reel/ABC/ " },
  );
});

test("unexpected analyze response shapes are rejected", () => {
  assert.deepEqual(normalizeAnalyzePayload({ success: true, video: { media_type: "video" } }), { kind: "invalid" });
  assert.deepEqual(normalizeAnalyzePayload({ success: true, media: { media_type: "gallery", items: null } }), { kind: "invalid" });
  assert.deepEqual(normalizeAnalyzePayload(undefined), { kind: "invalid" });
});

test("unexpected download response shapes are rejected", () => {
  assert.deepEqual(normalizePreparePayload({ success: true, download_id: 42 }), { kind: "invalid" });
  assert.deepEqual(normalizePreparePayload("not-json-data"), { kind: "invalid" });
});
