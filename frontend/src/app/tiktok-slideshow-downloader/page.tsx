import { platformMetadata } from "../seo";
import TikTokLanding from "../tiktok-landing";

export const metadata = platformMetadata({ title: "TikTok Slideshow Downloader — Download TikTok Photos | Vidorac", description: "Download images from public TikTok photo posts individually, as a selection or together with Vidorac.", slug: "tiktok-slideshow-downloader" });

export default function TikTokSlideshowDownloaderPage() {
  return <TikTokLanding content={{
    eyebrow: "TikTok Slideshow Downloader",
    h1: "TikTok Slideshow Downloader",
    heroAccent: "for the photos you want to keep",
    intro: "Paste a public TikTok photo-post link to preview and download its available slideshow images.",
    overviewTitle: "Download the slideshow your way",
    overview: ["Vidorac displays all publicly available images in post order. Download a single image directly, select only the images you need, or prepare the complete slideshow together.", "Complete and selected multi-image downloads use the existing ZIP workflow. A single selected item remains a normal image download when possible."],
    benefits: [
      { title: "Every available image", text: "Preview the complete public slideshow instead of showing only its first photo." },
      { title: "Flexible selection", text: "Download one image or choose several with Download Selected." },
      { title: "Download all", text: "Prepare all available images together in a valid ZIP archive." },
    ],
    limitations: ["The photo post must be publicly accessible.", "Deleted, private and login-only slideshows are unsupported.", "Associated MP3 appears only if audio is reliably exposed; no fake option is shown.", "Vidorac is not affiliated with TikTok or ByteDance."],
    faqs: [
      { question: "Can I download every TikTok slideshow image?", answer: "Yes, when TikTok exposes every image publicly. Use Download All Images after analysis." },
      { question: "Can I choose only some images?", answer: "Yes. Select the image cards you want and use Download Selected." },
      { question: "Why is an image missing?", answer: "Vidorac only displays items it can verify from the public post and does not invent unavailable media." },
      { question: "Can slideshows include MP3?", answer: "Only when the extraction pipeline reliably provides usable audio. Otherwise no MP3 action is shown." },
    ],
  }} />;
}
