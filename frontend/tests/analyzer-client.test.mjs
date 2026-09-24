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

test("source audio metadata remains distinct from output choices", () => {
  const result = normalizeAnalyzePayload({
    success: true,
    video: {
      media_type: "video",
      title: "Test",
      thumbnail: null,
      duration: 30,
      uploader: "Creator",
      platform: "tiktok",
      webpage_url: "https://www.tiktok.com/@creator/video/123",
      max_height: 720,
      source_audio_codec: "AAC",
      source_audio_bitrate_kbps: 128,
      source_audio_sample_rate_hz: 44100,
      source_audio_channels: 2,
      quality_options: [
        { id: "audio", label: "Original / Best Audio", available: true, resolution: null, container: "M4A", video_codec: null, estimated_size_bytes: 500000 },
        { id: "mp3", label: "MP3", available: true, resolution: null, container: "MP3", video_codec: null, estimated_size_bytes: 720000 },
      ],
    },
  });
  assert.equal(result.kind, "success");
  assert.equal(result.media.source_audio_bitrate_kbps, 128);
  assert.equal(result.media.quality_options.find((option) => option.id === "mp3")?.container, "MP3");
});
