import Link from "next/link";
import Analyzer from "./analyzer";
import PlatformAvailabilityNotice from "./platform-availability-notice";
import type { PlatformPageContent } from "./platform-content";
import { platformBySlug, platformStatus } from "./platform-status";
import { platformLinks } from "./seo";
import SiteFooter from "./site-footer";
import SupportButton from "./support-button";

const steps = [
  ["01", "Paste the public post URL", "Use the original post address whenever possible."],
  ["02", "Review the detected media", "Vidorac shows the formats and items it can actually verify."],
  ["03", "Choose and download", "Prepare one quality, selected items or the complete available post."],
];

export default function PlatformLanding({ content }: { content: PlatformPageContent }) {
  const platform = platformBySlug[content.slug];
  return (
    <main className="page-shell min-h-screen text-white">
      <section className="platform-hero mx-auto w-full max-w-[73.75rem] px-4 pb-12 pt-32 text-center sm:px-6 sm:pt-36 lg:px-8">
        <p className="section-label">{content.eyebrow}</p>
        <h1 className="mx-auto mt-4 w-full max-w-4xl text-balance text-[clamp(2.35rem,6vw,4rem)] font-semibold leading-[1.04] tracking-[-0.055em]">{content.h1}</h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-[var(--text-muted)] sm:text-lg">{content.intro}</p>
        <PlatformAvailabilityNotice platform={platform} context="landing" />
        <Analyzer />
      </section>

      <section className="seo-section" aria-labelledby="overview-title">
        <div className="seo-copy">
          <p className="section-label">What you can download</p>
          <h2 id="overview-title">{content.overviewTitle}</h2>
          {content.overview.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
        <div className="seo-media-grid">
          {content.mediaTypes.map((item) => <article key={item.title}><h3>{item.title}</h3><p>{item.text}</p></article>)}
        </div>
      </section>

      <section className="seo-section seo-section-bordered" aria-labelledby="how-title">
        <div className="section-heading">
          <div><p className="section-label">How it works</p><h2 id="how-title">Three clear steps.</h2></div>
          <p className="trust-line">No sign-up required.</p>
        </div>
        <div className="seo-steps">
          {steps.map(([number, title, text]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </section>

      <section className="seo-section seo-two-column seo-section-bordered" aria-labelledby="quality-title">
        <div className="seo-copy">
          <p className="section-label">Quality & availability</p>
          <h2 id="quality-title">{content.qualityTitle}</h2>
          {content.quality.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
        <aside className="limitations-card">
          <h2>Current limitations</h2>
          <ul>{content.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
        </aside>
      </section>

      <section className="seo-section seo-section-bordered" aria-labelledby="faq-title">
        <p className="section-label">Frequently asked questions</p>
        <h2 id="faq-title" className="seo-section-title">Useful answers before you download</h2>
        <div className="faq-list">
          {content.faqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}
        </div>
      </section>

      <section className="seo-section seo-donate-section seo-section-bordered">
        <div><p className="section-label">Keep the beta online</p><h2>Vidorac is free to use.</h2><p>If you find it useful, you can donate to help keep the project free and online.</p></div>
        <SupportButton label="Donate to Vidorac" variant="card" />
      </section>

      <nav className="seo-section related-platforms seo-section-bordered" aria-label="Other supported platforms">
        <h2>Explore other supported sites</h2>
        <div>{platformLinks.filter((item) => item.slug !== content.slug).map((item) => <Link key={item.slug} href={`/${item.slug}`}>{item.name}<span>{item.media}</span>{!platformStatus[platformBySlug[item.slug]].enabled && <span className="platform-status-badge">Temporarily unavailable</span>}</Link>)}</div>
      </nav>
      <SiteFooter />
    </main>
  );
}
