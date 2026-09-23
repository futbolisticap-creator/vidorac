import Link from "next/link";
import Analyzer from "./analyzer";
import AnalyzerBoundary from "./analyzer-boundary";
import { AnalyzerDiagnosticsProvider } from "./analyzer-diagnostics";
import { platformConfigs, platformOrder, type PlatformPageConfig } from "./platform-config";
import SiteFooter from "./site-footer";

export default function PlatformDownloaderPage({ config }: { config: PlatformPageConfig }) {
  return (
    <main className="page-shell min-h-screen text-white">
      <section className="platform-hero mx-auto w-full max-w-[73.75rem] px-4 pb-12 pt-32 text-center sm:px-6 sm:pt-36 lg:px-8">
        <Link className="platform-back-link" href="/"><span aria-hidden="true">←</span><span>All downloaders</span></Link>
        <p className="section-label">{config.name} downloader</p>
        <h1 className="mx-auto mt-4 w-full max-w-4xl text-balance text-[clamp(2.35rem,6vw,4rem)] font-semibold leading-[1.04] tracking-[-0.055em]">{config.title}</h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-[var(--text-muted)] sm:text-lg">{config.description}</p>
        <AnalyzerDiagnosticsProvider>
          <AnalyzerBoundary>
            <Analyzer expectedPlatform={config.id} placeholder={config.placeholder} />
          </AnalyzerBoundary>
        </AnalyzerDiagnosticsProvider>
      </section>

      <section className="seo-section" aria-labelledby={`${config.id}-overview-title`}>
        <div className="seo-copy">
          <p className="section-label">What you can download</p>
          <h2 id={`${config.id}-overview-title`}>{config.supported}</h2>
          <p>{config.overview}</p>
        </div>
        <div className="seo-media-grid">{config.capabilities.map((item) => <article key={item.title}><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
      </section>

      <section className="seo-section seo-section-bordered" aria-labelledby={`${config.id}-how-title`}>
        <p className="section-label">How it works</p>
        <h2 id={`${config.id}-how-title`} className="seo-section-title">Download in three steps.</h2>
        <div className="seo-steps">
          <article><span>01</span><h3>Copy the {config.name} link</h3><p>Use a direct link to compatible public media.</p></article>
          <article><span>02</span><h3>Analyze it</h3><p>Paste the link above. This page accepts {config.name} URLs only.</p></article>
          <article><span>03</span><h3>Choose a download</h3><p>Select from the media and formats that are genuinely available.</p></article>
        </div>
      </section>

      <section className="seo-section seo-two-column seo-section-bordered" aria-labelledby={`${config.id}-limits-title`}>
        <div className="seo-copy"><p className="section-label">Public links only</p><h2 id={`${config.id}-limits-title`}>Respect access and ownership.</h2><p>Vidorac does not request platform credentials, personal cookies or session tokens. Only download content you own, have permission to use, or are otherwise legally entitled to use.</p><p>Available media depends on what the source exposes for that exact public post. Vidorac does not restore deleted posts or bypass access controls.</p></div>
        <aside className="limitations-card"><h2>Current limitations</h2><ul>{config.limitations.map((item) => <li key={item}>{item}</li>)}</ul></aside>
      </section>

      <section className="seo-section seo-section-bordered" aria-labelledby={`${config.id}-faq-title`}><p className="section-label">Frequently asked questions</p><h2 id={`${config.id}-faq-title`} className="seo-section-title">Useful answers before you download</h2><div className="faq-list">{config.faqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div></section>

      <section className="seo-section related-platforms seo-section-bordered" aria-labelledby={`${config.id}-related-title`}>
        <p className="section-label">Other Vidorac tools</p><h2 id={`${config.id}-related-title`}>Choose another downloader</h2>
        <div>{platformOrder.filter((id) => id !== config.id).map((id) => { const item = platformConfigs[id]; return <Link key={id} href={item.path}>{item.name}<span>{item.cardDescription}</span></Link>; })}</div>
      </section>
      <SiteFooter />
    </main>
  );
}
