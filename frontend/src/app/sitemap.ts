import type { MetadataRoute } from "next";
import { SITE_URL } from "./seo";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/contact`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/tiktok-downloader`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/tiktok-mp3-downloader`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/tiktok-slideshow-downloader`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
