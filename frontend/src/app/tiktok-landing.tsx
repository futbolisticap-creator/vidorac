import Link from "next/link";
import Analyzer from "./analyzer";
import AnalyzerBoundary from "./analyzer-boundary";
import { AnalyzerDiagnosticsProvider } from "./analyzer-diagnostics";
import SiteFooter from "./site-footer";
import SupportButton from "./support-button";

export type TikTokLandingContent = {
  eyebrow: string;
  h1: string;
  intro: string;
  overviewTitle: string;
  overview: string[];
  benefits: Array<{ title: string; text: string }>;
  limitations: string[];
  faqs: Array<{ question: string; answer: string }>;
};

export default function TikTokLanding({ content }: { content: TikTokLandingContent }) {
  return (
    <main className="page-shell min-h-screen text-white">
      <section className="platform-hero mx-auto w-full max-w-[73.75rem] px-4 pb-12 pt-32 text-center sm:px-6 sm:pt-36 lg:px-8">
        <Link className="platform-back-link" href="/"><span aria-hidden="true">←</span><span>Back to Vidorac</span></Link>
        <p className="section-label">{content.eyebrow}</p>
        <h1 className="mx-auto mt-4 w-full max-w-4xl text-balance text-[clamp(2.35rem,6vw,4rem)] font-semibold leading-[1.04] tracking-[-0.055em]">{content.h1}</h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-[var(--text-muted)] sm:text-lg">{content.intro}</p>
        <AnalyzerDiagnosticsProvider><AnalyzerBoundary><Analyzer /></AnalyzerBoundary></AnalyzerDiagnosticsProvider>
      </section>

      <section className="seo-section" aria-labelledby="overview-title">
        <div className="seo-copy"><p className="section-label">What you can download</p><h2 id="overview-title">{content.overviewTitle}</h2>{content.overview.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
        <div className="seo-media-grid">{content.benefits.map((item) => <article key={item.title}><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
      </section>

      <section className="seo-section seo-section-bordered" aria-labelledby="how-title">
        <p className="section-label">How it works</p><h2 id="how-title" className="seo-section-title">Download in three steps.</h2>
        <div className="seo-steps">
          <article><span>01</span><h3>Copy the TikTok link</h3><p>Use the share link for a public video or slideshow.</p></article>
          <article><span>02</span><h3>Analyze it</h3><p>Paste the link above to see media that is genuinely available.</p></article>
          <article><span>03</span><h3>Choose a download</h3><p>Select video, MP3 or slideshow images when offered.</p></article>
        </div>
      </section>

      <section className="seo-section seo-two-column seo-section-bordered" aria-labelledby="limitations-title">
        <div className="seo-copy"><p className="section-label">Public links only</p><h2 id="limitations-title">Respect access and ownership.</h2><p>Vidorac does not request a TikTok login, personal cookies or session tokens. Only download content you own, have permission to use, or are otherwise legally entitled to use.</p><p>Available media depends on what TikTok exposes for that exact public post. Vidorac does not invent resolutions, restore deleted posts or bypass access controls.</p></div>
        <aside className="limitations-card"><h2>Current limitations</h2><ul>{content.limitations.map((item) => <li key={item}>{item}</li>)}</ul></aside>
      </section>

      <section className="seo-section seo-section-bordered" aria-labelledby="faq-title"><p className="section-label">Frequently asked questions</p><h2 id="faq-title" className="seo-section-title">Useful answers before you download</h2><div className="faq-list">{content.faqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div></section>
      <section className="seo-section seo-donate-section seo-section-bordered"><div><p className="section-label">Keep the beta online</p><h2>Vidorac is free to use.</h2><p>If it helped you, an optional donation can help keep the project online.</p></div><SupportButton label="Donate to Vidorac" variant="card" /></section>
      <SiteFooter />
    </main>
  );
}
