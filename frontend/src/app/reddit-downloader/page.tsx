import PlatformLanding from "../platform-landing";
import { platformContent } from "../platform-content";
import { platformMetadata } from "../seo";

const content = platformContent["reddit-downloader"];
export const metadata = platformMetadata(content);
export default function RedditDownloaderPage() { return <PlatformLanding content={content} />; }
