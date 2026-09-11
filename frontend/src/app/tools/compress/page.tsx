import type { Metadata } from "next";
import ToolPage from "../../tool-page";

export const metadata: Metadata = { title: "Compress Video" };

export default function CompressPage() {
  return <ToolPage mode="compress" eyebrow="Vidorac Tools" title="Compress Video" description="Reduce video size while keeping a clean, compatible MP4 ready to share." />;
}
