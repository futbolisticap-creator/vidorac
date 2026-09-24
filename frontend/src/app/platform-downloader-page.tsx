import Link from "next/link";
import AdPlaceholder from "./ad-placeholder";
import Analyzer from "./analyzer";
import AnalyzerBoundary from "./analyzer-boundary";
import { AnalyzerDiagnosticsProvider } from "./analyzer-diagnostics";
import { DownloaderHeroHeading, EditorialSectionHeading } from "./editorial-heading";
import type { PlatformPageConfig } from "./platform-config";
import SiteFooter from "./site-footer";

export default function PlatformDownloaderPage({ config }: { config: PlatformPageConfig }) {
  return (
    <main className="page-shell platform-page min-h-screen text-white">
      <section className="platform-hero mx-auto w-full max-w-[73.75rem] px-4 text-center sm:px-6 lg:px-8">
        <Link className="platform-back-link" href="/"><span aria-hidden="true">←</span><span>All downloaders</span></Link>
        <DownloaderHeroHeading eyebrow={`${config.name} downloader`} title={config.heroTitle} accent={config.heroAccent} />
        <p className="platform-hero-copy">{config.description}</p>
        <AnalyzerDiagnosticsProvider>
          <AnalyzerBoundary>
            <Analyzer expectedPlatform={config.id} placeholder={config.placeholder} />
          </AnalyzerBoundary>
        </AnalyzerDiagnosticsProvider>
      </section>

      <div className="ad-slot-section ad-slot-after-tool"><AdPlaceholder /></div>

      <section className="compact-content-section platform-steps-section" aria-labelledby={`${config.id}-how-title`}>
        <EditorialSectionHeading eyebrow="How Vidorac" title="A clear path" accent="from link to download" id={`${config.id}-how-title`} description={<>This page accepts {config.name} links only.</>} />
        <div className="compact-steps">
          <article><span>1</span><div><h3>Copy the link</h3><p>Use a direct link to compatible public media.</p></div></article>
          <article><span>2</span><div><h3>Analyze</h3><p>Paste it above to check the media and formats.</p></div></article>
          <article><span>3</span><div><h3>Download</h3><p>Choose from the options genuinely available.</p></div></article>
        </div>
      </section>

      <section className="compact-content-section" aria-labelledby={`${config.id}-benefits-title`}>
        <EditorialSectionHeading eyebrow="What is supported" title="Built for" accent={`cleaner ${config.name} downloads`} id={`${config.id}-benefits-title`} />
        <div className="benefit-grid">{config.capabilities.map((item) => <article key={item.title}><span aria-hidden="true">✓</span><div><h3>{item.title}</h3><p>{item.text}</p></div></article>)}</div>
        <p className="compact-trust-note">Public links only. Vidorac does not request platform credentials or bypass access controls. Only download content you own or have permission to use.</p>
      </section>

      <section className="compact-content-section compact-faq-section" aria-labelledby={`${config.id}-faq-title`}>
        <EditorialSectionHeading eyebrow="FAQ" title="Common questions" accent="answered clearly" id={`${config.id}-faq-title`} />
        <div className="faq-list compact-faq-list">{config.faqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div>
      </section>

      <SiteFooter />
    </main>
  );
}
