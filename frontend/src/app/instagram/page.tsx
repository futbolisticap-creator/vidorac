import { platformConfigs } from "../platform-config";
import PlatformDownloaderPage from "../platform-downloader-page";
import { platformMetadata } from "../seo";

const config = platformConfigs.instagram;
export const metadata = platformMetadata({ title: "Instagram Video & Reels Downloader - Vidorac", description: config.description, slug: "instagram" });
export default function InstagramPage() { return <PlatformDownloaderPage config={config} />; }
