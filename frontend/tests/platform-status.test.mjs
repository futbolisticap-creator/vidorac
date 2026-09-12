import assert from "node:assert/strict";
import test from "node:test";

import { describeUrlForDiagnostics, getAnalyzerUrlDecision } from "../src/app/platform-status.ts";

test("public TikTok video and short links continue to analysis", () => {
  for (const url of ["https://tiktok.com/@creator/video/123", "https://www.tiktok.com/@creator/video/123", "https://vm.tiktok.com/ABC123/", "https://vt.tiktok.com/ABC123/"]) {
    assert.equal(getAnalyzerUrlDecision(url).action, "analyze");
  }
});

test("non-TikTok platforms are stopped before the API", () => {
  for (const url of ["https://youtu.be/example", "https://www.instagram.com/reel/ABC123/", "https://www.reddit.com/r/videos/comments/example/post/", "https://x.com/user/status/123", "https://www.facebook.com/watch/?v=123"]) {
    assert.equal(getAnalyzerUrlDecision(url).action, "tiktok_only");
  }
});

test("unknown public websites receive the TikTok-only decision", () => {
  assert.deepEqual(getAnalyzerUrlDecision("https://example.com/video"), { action: "tiktok_only", platform: null });
});

test("invalid and unsafe URLs fail without throwing", () => {
  for (const url of ["", "not a URL", "file:///etc/passwd", "https://tiktok.com:444/@creator/video/123"]) {
    assert.doesNotThrow(() => getAnalyzerUrlDecision(url));
    assert.equal(getAnalyzerUrlDecision(url).action, "invalid");
  }
});

test("diagnostic URL context never includes the URL or query", () => {
  assert.deepEqual(describeUrlForDiagnostics("https://www.tiktok.com/@creator/video/123?secret=value"), { platform: "tiktok", type: "other" });
  assert.deepEqual(describeUrlForDiagnostics("bad input"), { platform: "unknown", type: "invalid" });
});
