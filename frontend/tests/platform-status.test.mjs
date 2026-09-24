import assert from "node:assert/strict";
import test from "node:test";

import { describeUrlForDiagnostics, getAnalyzerUrlDecision } from "../src/app/platform-status.ts";

test("every downloader accepts its own approved host family", () => {
  const cases = [
    ["tiktok", "https://vm.tiktok.com/ABC123/"],
    ["instagram", "https://www.instagram.com/reel/ABC123/"],
    ["facebook", "https://m.facebook.com/watch/?v=123"],
    ["reddit", "https://old.reddit.com/r/videos/comments/abc/post/"],
    ["x", "https://mobile.twitter.com/user/status/123"],
  ];
  for (const [platform, url] of cases) assert.deepEqual(getAnalyzerUrlDecision(url, platform), { action: "analyze", platform });
});

test("Reddit share permalinks reach the backend resolver", () => {
  assert.deepEqual(
    getAnalyzerUrlDecision("https://www.reddit.com/r/RateMyTortilla/s/M51X9cZ9Ud", "reddit"),
    { action: "analyze", platform: "reddit" },
  );
});

test("cross-platform links are stopped before the API and identify the correct downloader", () => {
  assert.deepEqual(getAnalyzerUrlDecision("https://www.tiktok.com/@creator/video/123", "reddit"), { action: "wrong_platform", platform: "tiktok" });
  assert.deepEqual(getAnalyzerUrlDecision("https://www.instagram.com/reel/ABC/", "facebook"), { action: "wrong_platform", platform: "instagram" });
  assert.deepEqual(getAnalyzerUrlDecision("https://twitter.com/user/status/123", "tiktok"), { action: "wrong_platform", platform: "x" });
});

test("unknown public websites are unsupported", () => {
  assert.deepEqual(getAnalyzerUrlDecision("https://example.com/video", "reddit"), { action: "unsupported" });
  assert.deepEqual(getAnalyzerUrlDecision("https://reddit.com.example.com/post", "reddit"), { action: "unsupported" });
});

test("invalid and unsafe URLs fail without throwing", () => {
  for (const url of ["", "not a URL", "file:///etc/passwd", "https://tiktok.com:444/@creator/video/123", "https://user:pass@reddit.com/post"]) {
    assert.doesNotThrow(() => getAnalyzerUrlDecision(url, "tiktok"));
    assert.equal(getAnalyzerUrlDecision(url, "tiktok").action, "invalid");
  }
});

test("diagnostic URL context never includes the URL or query", () => {
  assert.deepEqual(describeUrlForDiagnostics("https://www.instagram.com/reel/ABC?secret=value"), { platform: "instagram", type: "reel" });
  assert.deepEqual(describeUrlForDiagnostics("bad input"), { platform: "unknown", type: "invalid" });
});
