import Link from "next/link";
import type { ReactNode } from "react";
import AdPlaceholder from "./ad-placeholder";
import Analyzer from "./analyzer";
import AnalyzerBoundary from "./analyzer-boundary";
import { AnalyzerDiagnosticsProvider } from "./analyzer-diagnostics";
import { platformBySlug, platformStatus, type PlatformId } from "./platform-status";
import SiteFooter from "./site-footer";
import { platformLinks, SITE_URL } from "./seo";

type IconProps = { className?: string };

function YoutubeIcon({ className = "" }: IconProps) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" /></svg>;
}

function TikTokIcon({ className = "" }: IconProps) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 2c.3 2.1 1.5 3.4 3.4 3.6v3.2a8.3 8.3 0 0 1-3.4-.8v6.5A7.5 7.5 0 1 1 10.1 7v3.3a4.2 4.2 0 1 0 3.2 4.1V2h3.3Z" /></svg>;
}

function InstagramIcon({ className = "" }: IconProps) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.6" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>;
}

function XIcon({ className = "" }: IconProps) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2H22l-6.8 7.8L23.2 22H17l-4.9-6.4L6.5 22H3.4l7.2-8.2L.8 2h6.4l4.4 5.8L18.9 2Zm-1.1 17.9h1.7L6.3 4H4.5l13.3 15.9Z" /></svg>;
}

function RedditIcon({ className = "" }: IconProps) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M14.1 3.4 12.9 8c2 .1 3.8.7 5.1 1.6a2.4 2.4 0 1 1 1.4 4.3v.5c0 3.4-3.3 6.1-7.4 6.1s-7.4-2.7-7.4-6.1v-.5A2.4 2.4 0 1 1 6 9.6c1.3-.9 3-1.5 5-1.6l1.5-6.3 4.7 1.1a1.8 1.8 0 1 1-.3 1.5l-2.8-.9ZM8.2 13.2a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Zm7.6 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Zm-7.3 3.9c.9.8 2.1 1.1 3.5 1.1s2.6-.3 3.5-1.1a.6.6 0 0 0-.8-.9c-.7.6-1.6.8-2.7.8s-2-.2-2.7-.8a.6.6 0 1 0-.8.9Z" /></svg>;
}

function FacebookIcon({ className = "" }: IconProps) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M13.7 22v-9h3l.5-3.5h-3.5V7.3c0-1 .3-1.7 1.8-1.7h1.9V2.5c-.3 0-1.5-.1-2.8-.1-2.8 0-4.7 1.7-4.7 4.8v2.3H6.8V13h3.1v9h3.8Z" /></svg>;
}

function StepIcon({ step }: { step: string }) {
  const paths: Record<string, ReactNode> = {
    "01": <path strokeLinecap="round" strokeLinejoin="round" d="M10.4 13.6a4 4 0 0 0 5.7 0l2.1-2.1a4 4 0 0 0-5.7-5.7l-1.1 1.1m2.2 3.5a4 4 0 0 0-5.7 0l-2.1 2.1a4 4 0 0 0 5.7 5.7l1.1-1.1" />,
    "02": <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h10M18 7h2M4 17h2m4 0h10M14 4v6M7 14v6" />,
    "03": <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" />,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">{paths[step]}</svg>;
}

const platforms: Array<{ id: PlatformId; name: string; icon: typeof YoutubeIcon; color: string }> = [
  { id: "youtube", name: "YouTube", icon: YoutubeIcon, color: "platform-youtube" },
  { id: "tiktok", name: "TikTok", icon: TikTokIcon, color: "platform-tiktok" },
  { id: "instagram", name: "Instagram", icon: InstagramIcon, color: "platform-instagram" },
  { id: "x", name: "X", icon: XIcon, color: "platform-x" },
  { id: "reddit", name: "Reddit", icon: RedditIcon, color: "platform-reddit" },
  { id: "facebook", name: "Facebook", icon: FacebookIcon, color: "platform-facebook" },
];

const steps = [
  { number: "01", title: "Paste your link", text: "Copy a public post URL." },
  { number: "02", title: "Choose a format", text: "Pick the quality or media you want." },
  { number: "03", title: "Download", text: "Save it directly to your device." },
];

export default function Home() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", name: "Vidorac", url: `${SITE_URL}/` },
      {
        "@type": "WebApplication",
        name: "Vidorac",
        url: `${SITE_URL}/`,
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Any modern web browser",
        description: "Analyze and download accessible public videos, images and carousels from supported platforms.",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
    ],
  };
  return (
    <main className="page-shell min-h-screen text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <section className="hero-section relative mx-auto flex w-full max-w-[73.75rem] flex-col items-center px-4 pb-12 pt-32 text-center sm:px-6 sm:pt-36 lg:px-8">
        <h1 className="w-full min-w-0 max-w-4xl text-balance text-[clamp(2.55rem,6vw,4.25rem)] font-semibold leading-[1.02] tracking-[-0.06em]">
          Download videos, <span className="hero-accent">images &amp; carousels.</span>
        </h1>
        <p className="mt-6 w-full min-w-0 max-w-2xl text-pretty text-base leading-7 text-[var(--text-muted)] sm:text-lg">
          Download public media from YouTube, TikTok, Instagram, X, Reddit and Facebook.
        </p>
        <p className="mt-2.5 w-full min-w-0 max-w-2xl text-pretty text-xs leading-5 text-[var(--text-faint)] sm:text-sm">
          Public beta — we&apos;re continuously improving reliability and platform support.
        </p>

        <AnalyzerDiagnosticsProvider>
          <AnalyzerBoundary><Analyzer /></AnalyzerBoundary>
        </AnalyzerDiagnosticsProvider>

        <div className="platform-strip mt-5" aria-label="Supported platforms">
          {platforms.map(({ id, name, icon: Icon, color }) => (
            <span
              key={name}
              className="platform-item"
              title={id === "instagram" ? "Instagram Reels supported. Photo posts temporarily unavailable." : undefined}
              aria-label={id === "instagram" ? "Instagram: Reels supported. Photo posts temporarily unavailable." : name}
            >
              <Icon className={`size-[1.05rem] ${color}`} />
              {name}
              {!platformStatus[id].enabled && <span className="platform-status-badge">Unavailable</span>}
            </span>
          ))}
        </div>

        <AdPlaceholder format="banner" className="mt-12" />
      </section>

      <section id="supported-sites" aria-labelledby="supported-sites-title" className="supported-sites-section mx-auto w-full max-w-[73.75rem] scroll-mt-24 px-4 pb-16 pt-12 sm:px-6 lg:px-8">
        <div className="section-heading">
          <div><p className="section-label">Supported sites</p><h2 id="supported-sites-title" className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">Guides for every supported platform.</h2></div>
          <p className="trust-line">Public media only.</p>
        </div>
        <div className="supported-sites-grid mt-8">
          {platformLinks.map((item) => (
            <Link key={item.slug} href={`/${item.slug}`} className="supported-site-card">
              <span className="supported-site-heading">
                <span className="supported-site-name">{item.name}</span>
                {platformStatus[platformBySlug[item.slug]].status !== "available" && (
                  <span className="platform-status-badge">
                    {platformStatus[platformBySlug[item.slug]].statusLabel}
                  </span>
                )}
              </span>
              <span>{item.media}</span>
              <span className="supported-site-cta">Learn more →</span>
            </Link>
          ))}
        </div>
      </section>

      <section id="how-it-works" aria-labelledby="how-it-works-title" className="how-section mx-auto w-full max-w-[73.75rem] scroll-mt-24 px-4 pb-24 pt-12 sm:px-6 lg:px-8">
        <div className="section-heading">
          <div>
            <p className="section-label">How it works</p>
            <h2 id="how-it-works-title" className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">Three steps. One clean download.</h2>
          </div>
          <p className="trust-line">No sign-up required.</p>
        </div>

        <div className="steps-grid mt-10">
          {steps.map((step) => (
            <article key={step.number} className="step-card">
              <div className="step-topline">
                <span className="step-number">{step.number}</span>
                <StepIcon step={step.number} />
              </div>
              <h3 className="mt-6 text-base font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="home-faq-title" className="seo-section seo-section-bordered">
        <p className="section-label">Frequently asked questions</p>
        <h2 id="home-faq-title" className="seo-section-title">What to know about Vidorac</h2>
        <div className="faq-list">
          <details><summary>Is Vidorac free?</summary><p>Yes. Vidorac is currently a free public beta. Donations are optional and help keep the project online.</p></details>
          <details><summary>Which platforms does Vidorac support?</summary><p>Vidorac currently analyzes compatible public media from YouTube, TikTok, Instagram, X, Reddit and Facebook.</p></details>
          <details><summary>Can I download private posts?</summary><p>No. Private, restricted and login-only media is not supported, and Vidorac does not request personal cookies or account credentials.</p></details>
          <details><summary>Why is a quality unavailable?</summary><p>Available resolutions, containers and codecs depend on what the original public source exposes. Vidorac does not invent missing formats.</p></details>
          <details><summary>Why can the first analysis take longer?</summary><p>The Render Free backend may sleep after inactivity and need up to about a minute to start. The page keeps you informed while it wakes.</p></details>
          <details><summary>Does Vidorac store downloaded files?</summary><p>Prepared files use temporary storage and are cleaned automatically according to the existing one-time download lifecycle.</p></details>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
