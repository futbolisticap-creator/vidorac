import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { DEFAULT_MP3_BITRATE, MP3_BITRATE_OPTIONS } from "../src/app/mp3-options.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("homepage is a five-platform Vidorac hub without unfinished product promotion", async () => {
  const source = await read("src/app/page.tsx");
  const config = await read("src/app/platform-config.ts");
  assert.match(source, /Download media from your/);
  for (const platform of ["TikTok", "Instagram", "Facebook", "Reddit", "X \/ Twitter"]) assert.match(config, new RegExp(platform.replace("/", "\\/")));
  for (const forbidden of ["Vidorac Desktop", "Vidorac Mobile", "Chrome extension", "Pro subscription"]) assert.doesNotMatch(source, new RegExp(forbidden));
  assert.doesNotMatch(source, /YouTube/);
});

test("all public downloader routes reuse the shared platform page", async () => {
  for (const route of ["tiktok", "instagram", "facebook", "reddit", "x"]) {
    const page = await read(`src/app/${route}/page.tsx`);
    assert.match(page, /PlatformDownloaderPage/);
    assert.match(page, new RegExp(`platformConfigs\\.${route}`));
  }
});

test("analyzer sends expected platform for analysis and download preparation", async () => {
  const source = await read("src/app/analyzer.tsx");
  assert.match(source, /platform: expectedPlatform/);
  assert.match(source, /getAnalyzerUrlDecision\(url, expectedPlatform\)/);
  assert.match(source, /Open \{platformNames\[suggestedPlatform\]\} Downloader/);
  assert.match(source, /Download video/);
  assert.match(source, /Download MP3/);
});

test("MP3 bitrate choices remain centralized and default to 192 kbps", () => {
  assert.equal(DEFAULT_MP3_BITRATE, 192);
  assert.deepEqual(MP3_BITRATE_OPTIONS.map(({ value, label, description }) => ({ value, label, description })), [
    { value: 128, label: "128 kbps", description: "Small" },
    { value: 192, label: "192 kbps", description: "Recommended" },
    { value: 320, label: "320 kbps", description: "High" },
  ]);
});

test("navigation and sitemap expose the five clean routes", async () => {
  const header = await read("src/app/site-header.tsx");
  const sitemap = await read("src/app/sitemap.ts");
  const redirects = await read("public/_redirects");
  assert.match(header, /platformOrder\.map/);
  for (const route of ["tiktok", "instagram", "facebook", "reddit", "x"]) assert.ok(sitemap.includes(`\${SITE_URL}/${route}`));
  assert.match(redirects, /\/twitter \/x 301/);
});

test("legal pages and safe donation implementation remain intact", async () => {
  const footer = await read("src/app/site-footer.tsx");
  const modal = await read("src/app/donation-modal.tsx");
  for (const route of ["privacy", "terms", "contact"]) assert.match(footer, new RegExp(`href="/${route}"`));
  assert.match(modal, /role="dialog"/);
  assert.doesNotMatch(modal, /dangerouslySetInnerHTML/);
});
