import Link from "next/link";
import Analyzer from "./analyzer";
import AnalyzerBoundary from "./analyzer-boundary";
import { AnalyzerDiagnosticsProvider } from "./analyzer-diagnostics";
import { DownloaderHeroHeading, EditorialSectionHeading } from "./editorial-heading";
import OtherDownloaders from "./other-downloaders";
import SiteFooter from "./site-footer";
import SupportButton from "./support-button";

export type TikTokLandingContent = {
  eyebrow: string;
  h1: string;
  heroAccent: string;
  intro: string;
  overviewTitle: string;
  overview: string[];
  benefits: Array<{ title: string; text: string }>;
  limitations: string[];
  faqs: Array<{ question: string; answer: string }>;
};

export default function TikTokLanding({ content }: { content: TikTokLandingContent }) {
  return (
    <main className="page-shell platform-page min-h-screen text-white">
      <section className="platform-hero mx-auto w-full max-w-[73.75rem] px-4 pb-12 pt-32 text-center sm:px-6 sm:pt-36 lg:px-8">
        <Link className="platform-back-link" href="/"><span aria-hidden="true">←</span><span className="serif-action-label">Back to Vidorac</span></Link>
        <DownloaderHeroHeading eyebrow={content.eyebrow} title={content.h1} accent={content.heroAccent} />
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-[var(--text-muted)] sm:text-lg">{content.intro}</p>
        <AnalyzerDiagnosticsProvider><AnalyzerBoundary><Analyzer /></AnalyzerBoundary></AnalyzerDiagnosticsProvider>
      </section>

      <section className="seo-section" aria-labelledby="overview-title">
        <div className="seo-copy"><EditorialSectionHeading eyebrow="What you can download" title={content.overviewTitle} accent="with choices kept clear" id="overview-title" layout="seo" />{content.overview.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
        <div className="seo-media-grid">{content.benefits.map((item) => <article key={item.title}><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
      </section>

      <section className="seo-section seo-section-bordered" aria-labelledby="how-title">
        <EditorialSectionHeading eyebrow="How it works" title="Download in" accent="three clear steps" id="how-title" layout="seo" />
        <div className="seo-steps">
          <article><span>01</span><h3>Copy the TikTok link</h3><p>Use the share link for a public video or slideshow.</p></article>
          <article><span>02</span><h3>Analyze it</h3><p>Paste the link above to see media that is genuinely available.</p></article>
          <article><span>03</span><h3>Choose a download</h3><p>Select video, MP3 or slideshow images when offered.</p></article>
        </div>
      </section>

      <section className="seo-section seo-two-column seo-section-bordered" aria-labelledby="limitations-title">
        <div className="seo-copy"><EditorialSectionHeading eyebrow="Public links only" title="Use public media" accent="with care and permission" id="limitations-title" layout="seo" /><p>Vidorac does not request a TikTok login, personal cookies or session tokens. Only download content you own, have permission to use, or are otherwise legally entitled to use.</p><p>Available media depends on what TikTok exposes for that exact public post. Vidorac does not invent resolutions, restore deleted posts or bypass access controls.</p></div>
        <aside className="limitations-card"><h2>Current limitations</h2><ul>{content.limitations.map((item) => <li key={item}>{item}</li>)}</ul></aside>
      </section>

      <section className="seo-section seo-section-bordered" aria-labelledby="faq-title"><EditorialSectionHeading eyebrow="Frequently asked questions" title="Common questions" accent="answered clearly" id="faq-title" layout="seo" /><div className="faq-list">{content.faqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div></section>
      <OtherDownloaders currentPlatform="tiktok" />
      <section className="seo-section seo-donate-section seo-section-bordered"><div><p className="section-label">Keep the beta online</p><h2>Vidorac is free to use.</h2><p>If it helped you, an optional donation can help keep the project online.</p></div><SupportButton label="Donate to Vidorac" variant="card" /></section>
      <SiteFooter />
    </main>
  );
}
