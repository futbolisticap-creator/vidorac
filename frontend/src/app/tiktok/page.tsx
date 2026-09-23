import { platformConfigs } from "../platform-config";
import PlatformDownloaderPage from "../platform-downloader-page";
import { platformMetadata } from "../seo";

const config = platformConfigs.tiktok;
export const metadata = platformMetadata({ title: "TikTok Video Downloader - Vidorac", description: config.description, slug: "tiktok" });
export default function TikTokPage() { return <PlatformDownloaderPage config={config} />; }
