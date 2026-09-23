import { platformConfigs } from "../platform-config";
import PlatformDownloaderPage from "../platform-downloader-page";
import { platformMetadata } from "../seo";

const config = platformConfigs.reddit;
export const metadata = platformMetadata({ title: "Reddit Video Downloader - Vidorac", description: config.description, slug: "reddit" });
export default function RedditPage() { return <PlatformDownloaderPage config={config} />; }
