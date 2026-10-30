import { platformConfigs } from "../platform-config";
import PlatformDownloaderPage from "../platform-downloader-page";
import { platformMetadata } from "../seo";

const config = platformConfigs.youtube;
export const metadata = platformMetadata({ title: "YouTube Video & MP3 Downloader - Vidorac", description: config.description, slug: "youtube" });
export default function YouTubePage() { return <PlatformDownloaderPage config={config} />; }
