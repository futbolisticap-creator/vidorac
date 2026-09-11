import type { Metadata } from "next";
import ToolPage from "../../tool-page";

export const metadata: Metadata = { title: "Trim Video" };

export default function TrimPage() {
  return <ToolPage mode="trim" eyebrow="Vidorac Tools" title="Trim Video" description="Create a precise clip by entering the start and end time you need." />;
}
