import Link from "next/link";
import AdPlaceholder from "./ad-placeholder";
import Analyzer from "./analyzer";
import AnalyzerBoundary from "./analyzer-boundary";
import { AnalyzerDiagnosticsProvider } from "./analyzer-diagnostics";
import type { PlatformPageConfig } from "./platform-config";
import SiteFooter from "./site-footer";

export default function PlatformDownloaderPage({ config }: { config: PlatformPageConfig }) {
  return (
    <main className="page-shell min-h-screen text-white">
      <section className="platform-hero mx-auto w-full max-w-[73.75rem] px-4 text-center sm:px-6 lg:px-8">
        <Link className="platform-back-link" href="/"><span aria-hidden="true">←</span><span>All downloaders</span></Link>
        <p className="section-label">{config.name} downloader</p>
        <h1>{config.title}</h1>
        <p className="platform-hero-copy">{config.description}</p>
        <AnalyzerDiagnosticsProvider>
          <AnalyzerBoundary>
            <Analyzer expectedPlatform={config.id} placeholder={config.placeholder} />
          </AnalyzerBoundary>
        </AnalyzerDiagnosticsProvider>
      </section>

      <div className="ad-slot-section ad-slot-after-tool"><AdPlaceholder /></div>

      <section className="compact-content-section platform-steps-section" aria-labelledby={`${config.id}-how-title`}>
        <div className="compact-section-heading"><div><p className="section-label">How it works</p><h2 id={`${config.id}-how-title`}>Three quick steps</h2></div><p>This page accepts {config.name} links only.</p></div>
        <div className="compact-steps">
          <article><span>1</span><div><h3>Copy the link</h3><p>Use a direct link to compatible public media.</p></div></article>
          <article><span>2</span><div><h3>Analyze</h3><p>Paste it above to check the media and formats.</p></div></article>
          <article><span>3</span><div><h3>Download</h3><p>Choose from the options genuinely available.</p></div></article>
        </div>
      </section>

      <section className="compact-content-section" aria-labelledby={`${config.id}-benefits-title`}>
        <div className="compact-section-heading"><div><p className="section-label">What is supported</p><h2 id={`${config.id}-benefits-title`}>{config.supported}</h2></div></div>
        <div className="benefit-grid">{config.capabilities.map((item) => <article key={item.title}><span aria-hidden="true">✓</span><div><h3>{item.title}</h3><p>{item.text}</p></div></article>)}</div>
        <p className="compact-trust-note">Public links only. Vidorac does not request platform credentials or bypass access controls. Only download content you own or have permission to use.</p>
      </section>

      <section className="compact-content-section compact-faq-section" aria-labelledby={`${config.id}-faq-title`}>
        <div className="compact-section-heading"><div><p className="section-label">FAQ</p><h2 id={`${config.id}-faq-title`}>Before you download</h2></div></div>
        <div className="faq-list compact-faq-list">{config.faqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div>
      </section>

      <SiteFooter />
    </main>
  );
}
