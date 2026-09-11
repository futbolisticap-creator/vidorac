import PlatformLanding from "../platform-landing";
import { platformContent } from "../platform-content";
import { platformMetadata } from "../seo";

const content = platformContent["youtube-downloader"];
export const metadata = platformMetadata(content);
export default function YouTubeDownloaderPage() { return <PlatformLanding content={content} />; }
