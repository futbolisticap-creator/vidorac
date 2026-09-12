import Analyzer from "./analyzer";
import AnalyzerBoundary from "./analyzer-boundary";
import { AnalyzerDiagnosticsProvider } from "./analyzer-diagnostics";
import SiteFooter from "./site-footer";
import { SITE_URL } from "./seo";

const steps = [
  ["01", "Copy the TikTok link", "Copy the link to a public TikTok video or slideshow."],
  ["02", "Paste it into Vidorac", "Vidorac analyzes the available video, images and audio."],
  ["03", "Download", "Choose video, MP3 or slideshow images."],
];

const features = [
  ["Video downloads", "Download the real video qualities available for a public TikTok."],
  ["MP3 audio", "Extract audio from supported TikTok videos and download it as MP3."],
  ["Slideshows", "Download TikTok photo slideshows individually, as a selection or together."],
];

export default function Home() {
  const description = "Download public TikTok videos, photo slideshows and audio as MP3 with Vidorac. Fast, simple and no sign-up required.";
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
      <section className="hero-section relative mx-auto flex w-full max-w-[73.75rem] flex-col items-center px-4 pb-20 pt-32 text-center sm:px-6 sm:pt-36 lg:px-8">
        <p className="section-label">TikTok Video, Slideshow &amp; MP3 Downloader</p>
        <h1 className="mt-5 w-full min-w-0 max-w-5xl text-balance text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.06em]">Download TikTok Videos, <span className="hero-accent">Slideshows &amp; MP3</span></h1>
        <p className="mt-6 w-full min-w-0 max-w-2xl text-pretty text-base leading-7 text-[var(--text-muted)] sm:text-lg">Download public TikTok videos, photo slideshows and audio in seconds. No sign-up required.</p>
        <p className="mt-2.5 text-sm text-[var(--text-faint)]">Paste a public TikTok link to get started.</p>
        <AnalyzerDiagnosticsProvider><AnalyzerBoundary><Analyzer /></AnalyzerBoundary></AnalyzerDiagnosticsProvider>
      </section>

      <section id="how-it-works" aria-labelledby="how-it-works-title" className="how-section mx-auto w-full max-w-[73.75rem] scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8">
        <div className="section-heading"><div><p className="section-label">How it works</p><h2 id="how-it-works-title" className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">Three simple steps.</h2></div><p className="trust-line">Public TikTok links only.</p></div>
        <div className="steps-grid mt-10">{steps.map(([number, title, text]) => <article key={number} className="step-card"><span className="step-number">{number}</span><h3 className="mt-6 text-base font-semibold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{text}</p></article>)}</div>
      </section>

      <section aria-labelledby="features-title" className="seo-section seo-section-bordered">
        <p className="section-label">Built for TikTok</p><h2 id="features-title" className="seo-section-title">One focused downloader. Three useful formats.</h2>
        <div className="seo-media-grid">{features.map(([title, text]) => <article key={title}><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section aria-labelledby="home-faq-title" className="seo-section seo-section-bordered">
        <p className="section-label">Frequently asked questions</p><h2 id="home-faq-title" className="seo-section-title">What to know before you download</h2>
        <div className="faq-list">
          <details><summary>What TikTok content can Vidorac download?</summary><p>Vidorac supports compatible public TikTok videos and photo slideshows. MP3 appears when an audio stream can be extracted reliably.</p></details>
          <details><summary>Can I download private TikToks?</summary><p>No. Private, restricted and login-only content is not supported, and Vidorac does not request personal cookies or account credentials.</p></details>
          <details><summary>Can I download all slideshow images?</summary><p>Yes, when the post is publicly accessible. You can download individual images, a selection, or all available images together.</p></details>
          <details><summary>Is Vidorac affiliated with TikTok?</summary><p>No. Vidorac is an independent service and is not affiliated with TikTok or ByteDance.</p></details>
          <details><summary>Does Vidorac store downloads permanently?</summary><p>No. Prepared media uses temporary storage and is removed through the one-time download and automatic cleanup lifecycle.</p></details>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
