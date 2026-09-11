import PlatformLanding from "../platform-landing";
import { platformContent } from "../platform-content";
import { platformMetadata } from "../seo";

const content = platformContent["facebook-downloader"];
export const metadata = platformMetadata(content);
export default function FacebookDownloaderPage() { return <PlatformLanding content={content} />; }
