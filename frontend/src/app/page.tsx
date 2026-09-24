import type { Metadata } from "next";
import Link from "next/link";
import AdPlaceholder from "./ad-placeholder";
import HomeFaq from "./home-faq";
import PlatformBrandIcon from "./platform-brand-icon";
import { platformConfigs, platformOrder } from "./platform-config";
import SiteFooter from "./site-footer";
import { OG_IMAGE_ALT, OG_IMAGE_PATH, SITE_URL } from "./seo";
import { TelegramHomepageCard } from "./telegram-promotion";

export const metadata: Metadata = {
  title: { absolute: "Vidorac — Video Downloader for TikTok, Instagram, Facebook, Reddit & X" },
  description: "Choose a supported platform and download compatible public videos, audio and media with Vidorac — directly in your browser.",
  alternates: { canonical: `${SITE_URL}/` },
  openGraph: {
    title: "Vidorac — Video Downloader for TikTok, Instagram, Facebook, Reddit & X",
    description: "Choose a supported platform and download compatible public videos, audio and media with Vidorac — directly in your browser.",
    url: `${SITE_URL}/`,
    siteName: "Vidorac",
    type: "website",
    images: [{ url: OG_IMAGE_PATH, width: 1200, height: 630, alt: OG_IMAGE_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vidorac — Video Downloader for TikTok, Instagram, Facebook, Reddit & X",
    description: "Choose a supported platform and download compatible public videos, audio and media with Vidorac — directly in your browser.",
    images: [OG_IMAGE_PATH],
  },
};

const steps = [
  ["01", "Paste a link", "Copy a public media URL from a supported platform."],
  ["02", "Choose your format", "Select from the video, audio or media options available for that post."],
  ["03", "Download", "Prepare and download the file you selected."],
];

const features = [
  ["Multiple platforms", "Choose from five focused social-platform downloaders."],
  ["Quality options", "Select from the formats and qualities genuinely available."],
  ["Mobile friendly", "Use a clear, responsive interface across screen sizes."],
  ["No installation", "Open Vidorac directly in a modern browser."],
  ["Audio options", "Use audio-only choices when the source supports them."],
  ["Platform isolation", "Each downloader accepts links from its matching platform only."],
];

const ctaNames = {
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  reddit: "Reddit",
  x: "X",
} as const;

export default function Home() {
  const description = "Choose a supported platform and download compatible public videos, audio and media with Vidorac.";
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", name: "Vidorac", url: `${SITE_URL}/`, description },
      { "@type": "WebApplication", name: "Vidorac", url: `${SITE_URL}/`, applicationCategory: "MultimediaApplication", operatingSystem: "Any modern web browser", description, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } },
    ],
  };

  return (
    <main className="page-shell home-page min-h-screen text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />

      <div className="home-desktop-layout">
        <div className="home-ad-rail home-ad-rail-left">
          <AdPlaceholder placement="left-rail" format="sidebar" />
        </div>

        <div className="home-main-content">
          <section className="hub-hero" aria-labelledby="home-title">
            <p className="home-eyebrow">Fast <span>•</span> Simple <span>•</span> Multi-platform</p>
            <h1 id="home-title">
              <span>Download videos</span>
              <em>from your favorite platforms</em>
            </h1>
            <p className="hub-hero-copy">Download public videos and media from supported platforms. Choose a platform below to get started.</p>
          </section>

          <section id="tools" className="hub-platform-section home-section" aria-labelledby="platforms-title">
            <div className="home-section-heading">
              <div><p className="section-label">Supported platforms</p><h2 id="platforms-title">Choose where your link comes from</h2></div>
              <p>Every downloader is kept focused on its own platform.</p>
            </div>
            <div className="hub-platform-grid">
              {platformOrder.map((id) => {
                const platform = platformConfigs[id];
                return (
                  <article key={id} className={`hub-platform-card hub-platform-${id}`}>
                    <div className="platform-card-header">
                      <PlatformBrandIcon platform={id} />
                      <p className="section-label">{platform.name}</p>
                    </div>
                    <div className="platform-card-copy"><h3>{platform.title}</h3><p>{platform.cardDescription}</p></div>
                    <Link className="platform-card-cta secondary-card-cta" href={platform.path} aria-label={`Open ${ctaNames[id]} Downloader`}>
                      <span className="serif-action-label">Open {ctaNames[id]} Downloader</span><span className="platform-card-arrow" aria-hidden="true">→</span>
                    </Link>
                  </article>
                );
              })}
            </div>
          </section>

          <div className="home-inline-ad"><AdPlaceholder placement="home-inline-1" /></div>

          <section id="how-it-works" className="home-section home-how-section" aria-labelledby="how-title">
            <div className="home-section-heading"><div><p className="section-label">How it works</p><h2 id="how-title">From public link to download in three steps</h2></div></div>
            <div className="home-steps-grid">
              {steps.map(([number, title, text]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}
            </div>
          </section>

          <section id="about" className="home-section" aria-labelledby="why-title">
            <div className="home-section-heading"><div><p className="section-label">Why Vidorac</p><h2 id="why-title">Built for simple media downloads</h2></div><p>A focused interface that shows what is actually available.</p></div>
            <div className="home-feature-grid">
              {features.map(([title, text], index) => <article key={title}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}
            </div>
          </section>

          <section className="home-section home-editorial" aria-labelledby="editorial-title">
            <div><p className="section-label">Made to stay clear</p><h2 id="editorial-title">A simpler way to handle public media links</h2></div>
            <div className="home-editorial-copy">
              <p>Vidorac brings supported public-media tools into one straightforward hub. Start by choosing the platform that matches your link, then paste the direct URL on that platform&apos;s dedicated downloader page. Keeping each tool separate makes it easier to understand which links belong where and helps prevent a request from being sent to the wrong service.</p>
              <p>The formats you see depend on the original post. One source may offer several video qualities, while another may expose only a single file, a gallery, or an audio option. Vidorac presents the compatible choices it can verify instead of promising formats that are not available. No desktop software or browser extension is required; the experience runs in a modern browser and is designed to remain comfortable on phones, tablets and larger screens.</p>
              <p>Public access does not automatically grant permission to reuse media. Only download content you own, have permission to use, or are otherwise legally entitled to access. Private, deleted, restricted and login-only posts may not be available.</p>
            </div>
          </section>

          <div className="home-inline-ad"><AdPlaceholder placement="home-inline-2" /></div>

          <section id="faq" className="home-section home-faq-section" aria-labelledby="home-faq-title">
            <div className="home-section-heading"><div><p className="section-label">FAQ</p><h2 id="home-faq-title">Good to know before you start</h2></div></div>
            <HomeFaq />
          </section>

          <div className="telegram-home-section"><TelegramHomepageCard /></div>
        </div>

        <div className="home-ad-rail home-ad-rail-right">
          <AdPlaceholder placement="right-rail" format="sidebar" />
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
