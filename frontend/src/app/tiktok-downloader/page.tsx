import PlatformLanding from "../platform-landing";
import { platformContent } from "../platform-content";
import { platformMetadata } from "../seo";

const content = platformContent["tiktok-downloader"];
export const metadata = platformMetadata(content);
export default function TikTokDownloaderPage() { return <PlatformLanding content={content} />; }
