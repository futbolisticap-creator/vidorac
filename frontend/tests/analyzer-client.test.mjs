import assert from "node:assert/strict";
import test from "node:test";

import { readClipboardTextSafely } from "../src/app/analyzer-client.ts";

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
