import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { DEFAULT_MP3_BITRATE, MP3_BITRATE_OPTIONS } from "../src/app/mp3-options.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("homepage is a five-platform Vidorac hub without unfinished product promotion", async () => {
  const source = await read("src/app/page.tsx");
  const icons = await read("src/app/platform-brand-icon.tsx");
  const config = await read("src/app/platform-config.ts");
  assert.match(source, /Download videos/);
  assert.match(source, /from your favorite platforms/);
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
  for (const placement of ["left-rail", "right-rail", "home-inline-1", "home-inline-2"]) assert.match(home, new RegExp(`placement="${placement}"`));
  assert.match(platformPage, /ad-slot-after-tool/);
  assert.match(platformPage, /compact-steps/);
  assert.doesNotMatch(platformPage, /related-platforms/);
  assert.doesNotMatch(header, /beta-badge|>Beta</);
  assert.match(ad, /process\.env\.NODE_ENV !== "production"/);
  assert.match(ad, /Reserved ad space/);
  assert.doesNotMatch(ad, /googlesyndication|ca-pub-/);
});

test("homepage redesign keeps premium CTAs and accessible FAQ controls", async () => {
  const home = await read("src/app/page.tsx");
  const faq = await read("src/app/home-faq.tsx");
  const layout = await read("src/app/layout.tsx");
  const styles = await read("src/app/globals.css");
  for (const [id, label] of [["tiktok", "TikTok"], ["instagram", "Instagram"], ["facebook", "Facebook"], ["reddit", "Reddit"], ["x", "X"]]) assert.match(home, new RegExp(`${id}: "${label}"`));
  assert.match(home, /Open \{ctaNames\[id\]\} Downloader/);
  assert.match(home, /How Vidorac works|How it works/);
  assert.match(home, /Built for simple media downloads/);
  assert.match(faq, /aria-expanded=\{isOpen\}/);
  assert.match(faq, /aria-controls=\{panelId\}/);
  assert.match(layout, /Instrument_Serif/);
  assert.match(styles, /@media \(min-width: 1680px\)/);
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

test("MP3 output bitrate choices remain centralized and default to 192 kbps", () => {
  assert.equal(DEFAULT_MP3_BITRATE, 192);
  assert.deepEqual(MP3_BITRATE_OPTIONS.map(({ value, label, description }) => ({ value, label, description })), [
    { value: 128, label: "128 kbps", description: "Small" },
    { value: 192, label: "192 kbps", description: "Balanced" },
    { value: 256, label: "256 kbps", description: "Larger" },
    { value: 320, label: "320 kbps", description: "High" },
  ]);
});

test("audio source quality and MP3 output bitrate stay visibly separate", async () => {
  const analyzer = await read("src/app/analyzer.tsx");
  const client = await read("src/app/analyzer-client.ts");
  assert.match(analyzer, /Source audio:/);
  assert.match(analyzer, /Unknown source bitrate/);
  assert.match(analyzer, /MP3 output bitrate/);
  assert.match(analyzer, /cannot restore quality/);
  assert.match(analyzer, /Original \/ Best Audio/);
  assert.match(client, /source_audio_bitrate_kbps/);
  assert.doesNotMatch(analyzer, /Audio quality<\/legend>/);
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

test("footer uses four balanced columns and preserves every destination", async () => {
  const footer = await read("src/app/site-footer.tsx");
  const styles = await read("src/app/globals.css");
  assert.match(footer, /footer-columns/);
  for (const heading of ["Downloaders", "Legal", "Community"]) assert.match(footer, new RegExp(`>${heading}<`));
  for (const route of ["privacy", "terms", "contact"]) assert.match(footer, new RegExp(`href="/${route}"`));
  assert.match(footer, /platformOrder\.map/);
  assert.match(styles, /grid-template-columns: minmax\(0, 2fr\) repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /grid-template-columns: minmax\(0, 1\.4fr\) minmax\(0, 1fr\)/);
  assert.match(styles, /\.footer-columns \{ grid-template-columns: 1fr;/);
});

test("public contact email and mailto use the Vidorac address", async () => {
  const config = await read("src/app/contact-config.ts");
  assert.match(config, /CONTACT_EMAIL = "vidorac\.ai@gmail\.com"/);
  assert.match(config, /CONTACT_MAILTO = `mailto:\$\{CONTACT_EMAIL\}`/);
  assert.doesNotMatch(config, /footyhub/i);
});

test("Telegram promotion is visible, safe and limited to normal links", async () => {
  const layout = await read("src/app/layout.tsx");
  const home = await read("src/app/page.tsx");
  const footer = await read("src/app/site-footer.tsx");
  const telegram = await read("src/app/telegram-promotion.tsx");
  assert.match(layout, /<TelegramTopBar \/>/);
  assert.match(home, /<TelegramHomepageCard \/>/);
  assert.match(footer, /Telegram Updates/);
  assert.match(telegram, /TELEGRAM_URL = "https:\/\/t\.me\/Vidoracc"/);
  assert.match(telegram, /target: "_blank"/);
  assert.match(telegram, /rel: "noopener noreferrer"/);
  assert.doesNotMatch(telegram, /script|iframe|analytics/i);
});
