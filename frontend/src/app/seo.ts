import type { Metadata } from "next";

export const SITE_URL = "https://vidorac.pages.dev";
export const OG_IMAGE_PATH = "/branding/vidorac-og.png";

export type PlatformSlug =
  | "youtube-downloader"
  | "tiktok-downloader"
  | "instagram-downloader"
  | "x-downloader"
  | "reddit-downloader"
  | "facebook-downloader";

export type InformationSlug = "contact" | "privacy" | "terms";

export const platformLinks: Array<{
  slug: PlatformSlug;
  name: string;
  media: string;
}> = [
  { slug: "youtube-downloader", name: "YouTube", media: "Videos & audio" },
  { slug: "tiktok-downloader", name: "TikTok", media: "Videos & slideshows" },
  { slug: "instagram-downloader", name: "Instagram", media: "Reels" },
  { slug: "x-downloader", name: "X", media: "Public videos" },
  { slug: "reddit-downloader", name: "Reddit", media: "Public videos" },
  { slug: "facebook-downloader", name: "Facebook", media: "Public videos" },
];

export function platformMetadata({
  title,
  description,
  slug,
}: {
  title: string;
  description: string;
  slug: PlatformSlug;
}): Metadata {
  const url = `${SITE_URL}/${slug}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Vidorac",
      type: "website",
      images: [{ url: OG_IMAGE_PATH, width: 1200, height: 630, alt: "Vidorac public beta" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE_PATH],
    },
  };
}

export function informationMetadata({
  title,
  description,
  slug,
}: {
  title: string;
  description: string;
  slug: InformationSlug;
}): Metadata {
  const url = `${SITE_URL}/${slug}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Vidorac",
      type: "website",
      images: [{ url: OG_IMAGE_PATH, width: 1200, height: 630, alt: "Vidorac public beta" }],
    },
  };
}
