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

test("primary navigation contains only Home, Contact and Donate", async () => {
  const header = await read("src/app/site-header.tsx");

  assert.match(header, /href="\/"/);
  assert.match(header, /href="\/contact"/);
  assert.match(header, /<SupportButton \/>/);
  assert.doesNotMatch(header, /href="\/tiktok-downloader"/);
  assert.doesNotMatch(header, /href="\/tiktok-mp3-downloader"/);
  assert.doesNotMatch(header, /href="\/tiktok-slideshow-downloader"/);
});

test("footer keeps only legal, contact and donation navigation", async () => {
  const footer = await read("src/app/site-footer.tsx");

  for (const route of ["privacy", "terms", "contact"]) assert.match(footer, new RegExp(`href="/${route}"`));
  assert.match(footer, /<SupportButton label="Donate" variant="footer" \/>/);
  for (const route of ["tiktok-downloader", "tiktok-mp3-downloader", "tiktok-slideshow-downloader"]) {
    assert.doesNotMatch(footer, new RegExp(`href="/${route}"`));
  }
});

test("homepage links naturally to every TikTok SEO guide", async () => {
  const home = await read("src/app/page.tsx");

  for (const route of ["tiktok-downloader", "tiktok-mp3-downloader", "tiktok-slideshow-downloader"]) {
    assert.match(home, new RegExp(`"/${route}"`));
  }
});

test("support CTAs reuse the safe Ko-fi component with distinct copy", async () => {
  const home = await read("src/app/page.tsx");
  const support = await read("src/app/support-button.tsx");
  const analyzer = await read("src/app/analyzer.tsx");

  assert.match(home, /<HomepageSupportCard \/>/);
  assert.match(support, /Help Vidorac grow/);
  assert.match(support, /Your support helps us improve the service/);
  assert.match(support, /Enjoying Vidorac\?/);
  assert.match(support, /project so we can keep improving speed, reliability and new features/);
  assert.match(support, /<SupportButton label="Support Vidorac" variant="card" \/>/);
  assert.match(support, /target="_blank"/);
  assert.match(support, /rel="noopener noreferrer"/);
  assert.match(support, /data-event="donate_click"/);
  assert.match(analyzer, /media && <>/);
  assert.match(analyzer, /<\/section><ResultSupportCard \/><\/>/);
  assert.doesNotMatch(analyzer, /lastDownload && !anyPreparing \? <ResultSupportCard/);
});

test("TikTok SEO pages remain published and listed in sitemap", async () => {
  const sitemap = await read("src/app/sitemap.ts");
  const pages = [
    ["tiktok-downloader", "TikTok Video, Slideshow & MP3 Downloader"],
    ["tiktok-mp3-downloader", "TikTok MP3 Downloader"],
    ["tiktok-slideshow-downloader", "TikTok Slideshow Downloader"],
  ];

  for (const [route, heading] of pages) {
    const page = await read(`src/app/${route}/page.tsx`);
    assert.match(page, new RegExp(heading));
    assert.match(page, new RegExp(`slug: "${route}"`));
    assert.match(sitemap, new RegExp(route));
  }
});

test("legacy platform routes redirect and are absent from sitemap", async () => {
  const redirects = await read("public/_redirects");
  const sitemap = await read("src/app/sitemap.ts");
  for (const route of ["youtube-downloader", "instagram-downloader", "reddit-downloader", "x-downloader", "facebook-downloader"]) {
    assert.match(redirects, new RegExp(`/${route} / 301`));
    assert.doesNotMatch(sitemap, new RegExp(route));
  }
});
