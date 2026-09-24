import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { DEFAULT_MP3_BITRATE, MP3_BITRATE_OPTIONS } from "../src/app/mp3-options.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("homepage is a five-platform Vidorac hub without unfinished product promotion", async () => {
  const source = await read("src/app/page.tsx");
  const icons = await read("src/app/platform-brand-icon.tsx");
  const config = await read("src/app/platform-config.ts");
  assert.match(source, /Download public media/);
  for (const platform of ["TikTok", "Instagram", "Facebook", "Reddit", "X \/ Twitter"]) assert.match(config, new RegExp(platform.replace("/", "\\/")));
  for (const forbidden of ["Vidorac Desktop", "Vidorac Mobile", "Chrome extension", "Pro subscription"]) assert.doesNotMatch(source, new RegExp(forbidden));
  assert.doesNotMatch(source, /YouTube/);
  assert.match(source, /<PlatformBrandIcon platform=\{id\} \/>/);
  assert.doesNotMatch(source, /platform\.name\.slice/);
  for (const platform of ["tiktok", "instagram", "facebook", "reddit", "x"]) assert.match(icons, new RegExp(`platform === "${platform}"`));
});

test("refined layout is compact, ad-ready and removes the header Beta badge", async () => {
  const home = await read("src/app/page.tsx");
  const platformPage = await read("src/app/platform-downloader-page.tsx");
  const header = await read("src/app/site-header.tsx");
  const ad = await read("src/app/ad-placeholder.tsx");
  assert.match(home, /<AdPlaceholder/);
  assert.match(platformPage, /ad-slot-after-tool/);
  assert.match(platformPage, /compact-steps/);
  assert.doesNotMatch(platformPage, /related-platforms/);
  assert.doesNotMatch(header, /beta-badge|>Beta</);
  assert.match(ad, /Reserved for future advertising/);
  assert.doesNotMatch(ad, /googlesyndication|ca-pub-/);
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

test("global navigation stays compact while the sitemap keeps all five routes", async () => {
  const header = await read("src/app/site-header.tsx");
  const sitemap = await read("src/app/sitemap.ts");
  const redirects = await read("public/_redirects");
  assert.doesNotMatch(header, /platformOrder|platformConfigs|\/tiktok|\/instagram|\/facebook|\/reddit|href="\/x"/);
  assert.match(header, /href="\/"/);
  assert.match(header, /href="\/contact"/);
  assert.match(header, /<SupportButton variant="header" \/>/);
  for (const route of ["tiktok", "instagram", "facebook", "reddit", "x"]) assert.ok(sitemap.includes(`\${SITE_URL}/${route}`));
  assert.match(redirects, /\/twitter \/x 301/);
});

test("legal pages and safe donation implementation remain intact", async () => {
  const footer = await read("src/app/site-footer.tsx");
  const modal = await read("src/app/donation-modal.tsx");
  for (const route of ["privacy", "terms", "contact"]) assert.match(footer, new RegExp(`href="/${route}"`));
  assert.match(modal, /role="dialog"/);
  assert.doesNotMatch(modal, /dangerouslySetInnerHTML/);
  assert.match(footer, /not affiliated with, endorsed by, or sponsored by TikTok, Instagram, Facebook, Reddit, or X/);
});

test("public contact email and mailto use the Vidorac address", async () => {
  const config = await read("src/app/contact-config.ts");
  assert.match(config, /CONTACT_EMAIL = "vidorac\.ai@gmail\.com"/);
  assert.match(config, /CONTACT_MAILTO = `mailto:\$\{CONTACT_EMAIL\}`/);
  assert.doesNotMatch(config, /footyhub/i);
});
