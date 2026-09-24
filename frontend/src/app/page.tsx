import Link from "next/link";
import AdPlaceholder from "./ad-placeholder";
import PlatformBrandIcon from "./platform-brand-icon";
import { platformConfigs, platformOrder } from "./platform-config";
import SiteFooter from "./site-footer";
import { SITE_URL } from "./seo";

const reasons = [
  ["Focused by platform", "Every downloader accepts only its matching links, keeping the experience clear."],
  ["Real available formats", "Vidorac shows media and quality choices exposed by the public post."],
  ["No account required", "Analyze compatible public links without sharing platform credentials or cookies."],
];

const faqs = [
  ["Which platforms does Vidorac support?", "TikTok, Instagram, Facebook, Reddit and X / Twitter through five focused downloader pages."],
  ["Can Vidorac download private content?", "No. Private, deleted, restricted and login-only posts are not supported."],
  ["Does Vidorac store downloads permanently?", "No. Prepared media uses temporary storage and the existing automatic cleanup lifecycle."],
];

export default function Home() {
  const description = "Download videos and media from TikTok, Instagram, Facebook, Reddit and X with Vidorac.";
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", name: "Vidorac", url: `${SITE_URL}/`, description },
      { "@type": "WebApplication", name: "Vidorac", url: `${SITE_URL}/`, applicationCategory: "MultimediaApplication", operatingSystem: "Any modern web browser", description, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } },
    ],
  };

  return (
    <main className="page-shell min-h-screen text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />

      <section className="hub-hero mx-auto flex w-full max-w-[73.75rem] flex-col items-center px-4 text-center sm:px-6 lg:px-8">
        <p className="section-label">Five platforms. One clean experience.</p>
        <h1>Download public media, <span className="hero-accent">simply.</span></h1>
        <p className="hub-hero-copy">Choose a platform, paste a compatible public link and download the formats that are genuinely available.</p>
      </section>

      <section className="hub-platform-section mx-auto w-full max-w-[73.75rem] px-4 sm:px-6 lg:px-8" aria-labelledby="platforms-title">
        <div className="compact-section-heading">
          <div><p className="section-label">Downloaders</p><h2 id="platforms-title">Choose your platform</h2></div>
          <p>Each page is limited to its own platform.</p>
        </div>
        <div className="hub-platform-grid">
          {platformOrder.map((id) => {
            const platform = platformConfigs[id];
            return (
              <article key={id} className={`hub-platform-card hub-platform-${id}`}>
                <PlatformBrandIcon platform={id} />
                <div><p className="section-label">{platform.name}</p><h3>{platform.title}</h3><p>{platform.cardDescription}</p></div>
                <Link href={platform.path} aria-label={`Open ${platform.name} Downloader`}><span>Open downloader</span><span aria-hidden="true">↗</span></Link>
              </article>
            );
          })}
        </div>
      </section>

      <div className="ad-slot-section"><AdPlaceholder /></div>

      <section className="compact-content-section" aria-labelledby="why-title">
        <div className="compact-section-heading"><div><p className="section-label">Why Vidorac</p><h2 id="why-title">Useful, focused and transparent.</h2></div><p>Built for public media without unnecessary steps.</p></div>
        <div className="benefit-grid">{reasons.map(([title, text]) => <article key={title}><span aria-hidden="true">✓</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
      </section>

      <section className="compact-content-section compact-faq-section" aria-labelledby="home-faq-title">
        <div className="compact-section-heading"><div><p className="section-label">FAQ</p><h2 id="home-faq-title">Good to know</h2></div></div>
        <div className="faq-list compact-faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
      </section>

      <SiteFooter />
    </main>
  );
}
