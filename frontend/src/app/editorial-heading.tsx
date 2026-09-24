import type { ReactNode } from "react";

type DownloaderHeroHeadingProps = {
  eyebrow: string;
  title: string;
  accent: string;
};

type EditorialSectionHeadingProps = {
  eyebrow: string;
  title: string;
  accent: string;
  id: string;
  description?: ReactNode;
  layout?: "compact" | "seo";
};

export function DownloaderHeroHeading({ eyebrow, title, accent }: DownloaderHeroHeadingProps) {
  return (
    <div className="downloader-hero-heading">
      <p className="section-label">{eyebrow}</p>
      <h1><span>{title}</span><em>{accent}</em></h1>
    </div>
  );
}

export function EditorialSectionHeading({
  eyebrow,
  title,
  accent,
  id,
  description,
  layout = "compact",
}: EditorialSectionHeadingProps) {
  return (
    <div className={`editorial-section-heading editorial-section-heading-${layout}`}>
      <div>
        <p className="section-label">{eyebrow}</p>
        <h2 id={id}><span>{title}</span><em>{accent}</em></h2>
      </div>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
