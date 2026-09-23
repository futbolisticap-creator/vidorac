import { platformConfigs } from "../platform-config";
import PlatformDownloaderPage from "../platform-downloader-page";
import { platformMetadata } from "../seo";

const config = platformConfigs.facebook;
export const metadata = platformMetadata({ title: "Facebook Video Downloader - Vidorac", description: config.description, slug: "facebook" });
export default function FacebookPage() { return <PlatformDownloaderPage config={config} />; }
