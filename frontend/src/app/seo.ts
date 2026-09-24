import type { Metadata } from "next";

export const SITE_URL = "https://vidorac.com";
export const OG_IMAGE_PATH = "/branding/vidorac-og.png";
export const OG_IMAGE_ALT = "Vidorac video downloader for supported social platforms";

export type PlatformSlug =
  | "tiktok"
  | "instagram"
  | "facebook"
  | "reddit"
  | "x"
  | "tiktok-downloader"
  | "tiktok-mp3-downloader"
  | "tiktok-slideshow-downloader";

export type InformationSlug = "contact" | "privacy" | "terms";

export const platformLinks: Array<{
  slug: PlatformSlug;
  name: string;
  media: string;
}> = [
  { slug: "tiktok", name: "TikTok", media: "Videos, slideshows & MP3" },
  { slug: "instagram", name: "Instagram", media: "Reels, videos, photos & carousels" },
  { slug: "facebook", name: "Facebook", media: "Public videos & Reels" },
  { slug: "reddit", name: "Reddit", media: "Videos & post media" },
  { slug: "x", name: "X / Twitter", media: "Public post videos" },
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
      images: [{ url: OG_IMAGE_PATH, width: 1200, height: 630, alt: OG_IMAGE_ALT }],
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
      images: [{ url: OG_IMAGE_PATH, width: 1200, height: 630, alt: OG_IMAGE_ALT }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE_PATH],
    },
  };
}
