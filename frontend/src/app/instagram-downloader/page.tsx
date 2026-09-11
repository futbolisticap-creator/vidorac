import PlatformLanding from "../platform-landing";
import { platformContent } from "../platform-content";
import { platformMetadata } from "../seo";

const content = platformContent["instagram-downloader"];
export const metadata = platformMetadata(content);
export default function InstagramDownloaderPage() { return <PlatformLanding content={content} />; }
