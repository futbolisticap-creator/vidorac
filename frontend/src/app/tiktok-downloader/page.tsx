import { platformMetadata } from "../seo";
import TikTokLanding from "../tiktok-landing";

export const metadata = platformMetadata({
  title: "TikTok Video, Slideshow & MP3 Downloader | Vidorac",
  description: "Download public TikTok videos, photo slideshows and available audio as MP3 with Vidorac.",
  slug: "tiktok-downloader",
});

export default function TikTokDownloaderPage() {
  return <TikTokLanding content={{
    eyebrow: "TikTok Downloader",
    h1: "TikTok Video, Slideshow & MP3 Downloader",
    heroAccent: "with every available option in one place",
    intro: "Paste a public TikTok link to download its available video, photo slideshow or audio as MP3.",
    overviewTitle: "One TikTok link, clear download choices",
    overview: [
      "Vidorac inspects the public TikTok post and shows only media it can verify. A normal video receives real quality options and an MP3 action when audio is available.",
      "Photo posts appear as a slideshow gallery with individual, selected and complete download actions. Private, deleted, restricted and login-only posts are not supported.",
    ],
    benefits: [
      { title: "TikTok video", text: "Choose from the real video qualities exposed for that public post." },
      { title: "MP3 audio", text: "Extract the available audio from an eligible TikTok video as MP3." },
      { title: "Photo slideshows", text: "Download one image, a selection, or all available slideshow images." },
    ],
    limitations: ["Public individual posts only.", "Quality and audio availability vary by source.", "A maximum prepared download size applies.", "Vidorac is not affiliated with TikTok or ByteDance."],
    faqs: [
      { question: "Which TikTok links are supported?", answer: "Public tiktok.com video links and compatible TikTok short links can be analyzed when the existing secure validator accepts them." },
      { question: "Can I download TikTok audio?", answer: "Yes. Download MP3 appears for eligible videos when Vidorac can access an audio stream and safely convert it." },
      { question: "Can I download a slideshow?", answer: "Yes, when its public images are available. You can download them individually, select several, or download all." },
      { question: "Does Vidorac remove watermarks?", answer: "Vidorac does not implement or advertise watermark removal." },
    ],
  }} />;
}
