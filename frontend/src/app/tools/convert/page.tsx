import type { Metadata } from "next";
import ToolPage from "../../tool-page";

export const metadata: Metadata = { title: "Convert Video" };

export default function ConvertPage() {
  return <ToolPage mode="convert" eyebrow="Vidorac Tools" title="Convert Video" description="Turn your video into MP4, WEBM or a high-quality MP3 in a few simple steps." />;
}
