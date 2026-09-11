import PlatformLanding from "../platform-landing";
import { platformContent } from "../platform-content";
import { platformMetadata } from "../seo";

const content = platformContent["x-downloader"];
export const metadata = platformMetadata(content);
export default function XDownloaderPage() { return <PlatformLanding content={content} />; }
