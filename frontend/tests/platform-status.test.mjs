import assert from "node:assert/strict";
import test from "node:test";

import {
  describeUrlForDiagnostics,
  getAnalyzerUrlDecision,
  isCapabilityEnabled,
} from "../src/app/platform-status.ts";

test("Instagram post URLs enter the disabled-post branch", () => {
  for (const url of [
    "https://instagram.com/p/ABC123/",
    "https://www.instagram.com/p/ABC123/",
    "https://www.instagram.com/p/ABC123/?igsh=share",
  ]) {
    assert.equal(getAnalyzerUrlDecision(url).action, "instagram_posts_unavailable");
  }
});

test("Instagram Reel URLs continue to analysis", () => {
  assert.equal(getAnalyzerUrlDecision("https://www.instagram.com/reel/ABC123/").action, "analyze");
  assert.equal(getAnalyzerUrlDecision("https://www.instagram.com/reels/ABC123/").action, "analyze");
});

test("invalid and incomplete URLs fail without throwing", () => {
  for (const url of ["", "not a URL", "https://www.instagram.com/p/", "https://instagram.com:444/p/ABC/"]) {
    assert.doesNotThrow(() => getAnalyzerUrlDecision(url));
    assert.notEqual(getAnalyzerUrlDecision(url).action, "instagram_posts_unavailable");
  }
});

test("missing capability values fail safely", () => {
  assert.equal(isCapabilityEnabled("tiktok", "posts"), false);
  assert.equal(isCapabilityEnabled("reddit", "reels"), false);
});

test("diagnostic URL context never includes the URL or query", () => {
  assert.deepEqual(describeUrlForDiagnostics("https://www.instagram.com/reel/ABC/?igsh=secret"), { platform: "instagram", type: "reel" });
  assert.deepEqual(describeUrlForDiagnostics("https://www.instagram.com/p/ABC/?igsh=secret"), { platform: "instagram", type: "post" });
  assert.deepEqual(describeUrlForDiagnostics("bad input"), { platform: "unknown", type: "invalid" });
});
