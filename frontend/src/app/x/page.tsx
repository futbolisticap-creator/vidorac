import { platformConfigs } from "../platform-config";
import PlatformDownloaderPage from "../platform-downloader-page";
import { platformMetadata } from "../seo";

const config = platformConfigs.x;
export const metadata = platformMetadata({ title: "X / Twitter Video Downloader - Vidorac", description: config.description, slug: "x" });
export default function XPage() { return <PlatformDownloaderPage config={config} />; }
