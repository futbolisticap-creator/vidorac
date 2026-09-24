import Link from "next/link";
import { EditorialSectionHeading } from "./editorial-heading";
import PlatformBrandIcon from "./platform-brand-icon";
import { platformConfigs, platformOrder } from "./platform-config";
import type { PlatformId } from "./platform-status";

const ctaNames: Record<PlatformId, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  reddit: "Reddit",
  x: "X",
};

export default function OtherDownloaders({ currentPlatform }: { currentPlatform: PlatformId }) {
  const alternatives = platformOrder.filter((platform) => platform !== currentPlatform);
  const headingId = `other-downloaders-${currentPlatform}`;

  return (
    <section className="other-downloaders-section" aria-labelledby={headingId}>
      <EditorialSectionHeading
        eyebrow="Other downloaders"
        title="Keep downloading"
        accent="across your favorite platforms"
        id={headingId}
        description="Explore Vidorac tools for other supported platforms."
      />

      <div className="other-downloaders-grid">
        {alternatives.map((platformId) => {
          const platform = platformConfigs[platformId];
          return (
            <article key={platformId} className={`other-downloader-card other-downloader-${platformId}`}>
              <div className="other-downloader-heading">
                <PlatformBrandIcon platform={platformId} />
                <h3>{platform.name}</h3>
              </div>
              <p>{platform.cardDescription}</p>
              <Link className="secondary-card-cta" href={platform.path} aria-label={`Open ${ctaNames[platformId]} Downloader`}>
                <span className="serif-action-label">Open {ctaNames[platformId]} Downloader</span>
                <span className="other-downloader-arrow" aria-hidden="true">→</span>
              </Link>
            </article>
          );
        })}
      </div>

      <Link href="/" className="platform-back-link other-downloaders-all">
        <span className="serif-action-label">View all downloaders</span>
        <span className="other-downloader-arrow" aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
