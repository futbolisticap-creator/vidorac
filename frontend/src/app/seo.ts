import type { Metadata } from "next";

export const SITE_URL = "https://vidorac.pages.dev";
export const OG_IMAGE_PATH = "/branding/vidorac-og.png";

export type PlatformSlug =
  | "tiktok-downloader"
  | "tiktok-mp3-downloader"
  | "tiktok-slideshow-downloader";

export type InformationSlug = "contact" | "privacy" | "terms";

export const platformLinks: Array<{
  slug: PlatformSlug;
  name: string;
  media: string;
}> = [
  { slug: "tiktok-downloader", name: "TikTok Downloader", media: "Videos, slideshows & MP3" },
  { slug: "tiktok-mp3-downloader", name: "TikTok MP3", media: "Audio extraction" },
  { slug: "tiktok-slideshow-downloader", name: "TikTok Slideshow", media: "Photo posts" },
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
