import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
