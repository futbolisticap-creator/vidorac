import Link from "next/link";
import { platformConfigs, platformOrder } from "./platform-config";
import SiteFooter from "./site-footer";
import { SITE_URL } from "./seo";

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
      <section className="hub-hero relative mx-auto flex w-full max-w-[73.75rem] flex-col items-center px-4 pb-14 pt-32 text-center sm:px-6 sm:pt-36 lg:px-8">
        <p className="section-label">One place. Five focused downloaders.</p>
        <h1 className="mt-5 w-full max-w-5xl text-balance text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.06em]">Download media from your <span className="hero-accent">favorite platforms</span></h1>
        <p className="mt-6 w-full max-w-2xl text-pretty text-base leading-7 text-[var(--text-muted)] sm:text-lg">Choose a platform to analyze compatible public videos, audio, photos and post media with Vidorac.</p>
        <p className="mt-2.5 text-sm text-[var(--text-faint)]">No sign-up required. Public links only.</p>
      </section>

      <section className="hub-platform-section mx-auto w-full max-w-[73.75rem] px-4 pb-24 sm:px-6 lg:px-8" aria-labelledby="platforms-title">
        <h2 id="platforms-title" className="sr-only">Choose a Vidorac downloader</h2>
        <div className="hub-platform-grid">
          {platformOrder.map((id, index) => {
            const platform = platformConfigs[id];
            return (
              <article key={id} className={`hub-platform-card hub-platform-${id}`}>
                <div className="hub-platform-mark" aria-hidden="true">{index + 1}</div>
                <p className="section-label">{platform.name}</p>
                <h2>{platform.title}</h2>
                <p>{platform.cardDescription}</p>
                <Link href={platform.path}>Open {platform.name} Downloader<span aria-hidden="true"> →</span></Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="seo-section seo-section-bordered" aria-labelledby="hub-how-title">
        <p className="section-label">Simple by design</p>
        <h2 id="hub-how-title" className="seo-section-title">The right tool for every link.</h2>
        <div className="seo-steps">
          <article><span>01</span><h3>Choose a platform</h3><p>Open the downloader that matches the link you want to use.</p></article>
          <article><span>02</span><h3>Paste a public link</h3><p>Each page validates its own platform before contacting the shared service.</p></article>
          <article><span>03</span><h3>Download available media</h3><p>Choose from the formats genuinely exposed by the public post.</p></article>
        </div>
      </section>

      <section className="seo-section seo-two-column seo-section-bordered" aria-labelledby="hub-trust-title">
        <div className="seo-copy"><p className="section-label">Built around public access</p><h2 id="hub-trust-title">One Vidorac experience, clearly separated by platform.</h2><p>Every downloader uses the same carefully maintained backend and media-processing pipeline. The pages remain isolated, so a link is only processed by its matching downloader.</p><p>Vidorac does not request your platform password, personal cookies or account session. Private, deleted and login-only content is not supported.</p></div>
        <aside className="limitations-card"><h2>Supported platforms</h2><ul>{platformOrder.map((id) => <li key={id}>{platformConfigs[id].supported}</li>)}</ul></aside>
      </section>
      <SiteFooter />
    </main>
  );
}
