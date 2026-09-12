import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DEFAULT_MP3_BITRATE,
  MP3_BITRATE_OPTIONS,
} from "../src/app/mp3-options.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("homepage positions Vidorac as a TikTok-only product", async () => {
  const source = await read("src/app/page.tsx");
  assert.match(source, /Download TikTok Videos/);
  assert.match(source, /Slideshows &amp; MP3/);
  for (const platform of ["YouTube", "Instagram", "Reddit", "Facebook", "Twitter"]) assert.doesNotMatch(source, new RegExp(platform));
  assert.doesNotMatch(source, /AdPlaceholder/);
});

test("analyzer presents separate video and MP3 actions", async () => {
  const source = await read("src/app/analyzer.tsx");
  assert.match(source, /Download video/);
  assert.match(source, /Download MP3/);
  assert.match(source, /TikTok Slideshow/);
  assert.doesNotMatch(source, /AdPlaceholder/);
});

test("MP3 bitrate choices are centralized and default to 192 kbps", () => {
  assert.equal(DEFAULT_MP3_BITRATE, 192);
  assert.deepEqual(
    MP3_BITRATE_OPTIONS.map(({ value, label, description }) => ({ value, label, description })),
    [
      { value: 128, label: "128 kbps", description: "Small" },
      { value: 192, label: "192 kbps", description: "Recommended" },
      { value: 320, label: "320 kbps", description: "High" },
    ],
  );
});

test("audio result sends the selected bitrate without re-analysis", async () => {
  const source = await read("src/app/analyzer.tsx");
  assert.match(source, /audio_bitrate: mp3Bitrate/);
  assert.match(source, /aria-pressed=\{selected\}/);
  assert.match(source, /disabled=\{preparing\}/);
  assert.match(source, /Higher bitrate creates a larger MP3 file/);
});

test("primary navigation omits MP3 while keeping the SEO page", async () => {
  const header = await read("src/app/site-header.tsx");
  const mp3Page = await read("src/app/tiktok-mp3-downloader/page.tsx");

  assert.doesNotMatch(header, /href="\/tiktok-mp3-downloader"/);
  assert.match(header, /href="\/tiktok-downloader"/);
  assert.match(header, /href="\/contact"/);
  assert.match(header, /<SupportButton \/>/);
  assert.match(mp3Page, /TikTok MP3 Downloader/);
});

test("legacy platform routes redirect and are absent from sitemap", async () => {
  const redirects = await read("public/_redirects");
  const sitemap = await read("src/app/sitemap.ts");
  for (const route of ["youtube-downloader", "instagram-downloader", "reddit-downloader", "x-downloader", "facebook-downloader"]) {
    assert.match(redirects, new RegExp(`/${route} / 301`));
    assert.doesNotMatch(sitemap, new RegExp(route));
  }
});
