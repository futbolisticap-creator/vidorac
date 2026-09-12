import { platformMetadata } from "../seo";
import TikTokLanding from "../tiktok-landing";

export const metadata = platformMetadata({ title: "TikTok MP3 Downloader — Download TikTok Audio | Vidorac", description: "Paste a public TikTok video link and download its available audio as an MP3 file with Vidorac.", slug: "tiktok-mp3-downloader" });

export default function TikTokMp3DownloaderPage() {
  return <TikTokLanding content={{
    eyebrow: "TikTok MP3 Downloader",
    h1: "TikTok MP3 Downloader",
    intro: "Paste a public TikTok video link and download its available audio as an MP3 file.",
    overviewTitle: "A simple MP3 option for eligible TikToks",
    overview: ["After analysis, Vidorac shows a dedicated Audio section when the public TikTok contains a usable audio stream. Choose 128 kbps for a smaller file, 192 kbps for the recommended balance, or 320 kbps for a larger output file.", "The selected bitrate controls MP3 output encoding and file size. It cannot restore detail that was not present in TikTok's compressed source."],
    benefits: [
      { title: "Dedicated audio action", text: "Download MP3 is separated from video qualities so it is easy to find." },
      { title: "Clean filename", text: "Unsafe characters are removed before the MP3 filename is returned." },
      { title: "Private delivery", text: "Prepared files use temporary storage and a one-time download identifier." },
    ],
    limitations: ["Audio must be present and publicly accessible.", "Converting to MP3 cannot improve the source audio.", "Music ownership and reuse permissions are not granted by Vidorac.", "Vidorac is not affiliated with TikTok or ByteDance."],
    faqs: [
      { question: "How do I download TikTok audio?", answer: "Paste the public TikTok link, choose Analyze, then use Download MP3 in the Audio section if it appears." },
      { question: "Why is Download MP3 missing?", answer: "The post may not expose a usable audio stream, or TikTok may be temporarily restricting access." },
      { question: "Is the MP3 lossless?", answer: "No. TikTok audio is already compressed and MP3 conversion cannot restore information absent from the source." },
      { question: "Does 320 kbps improve TikTok audio quality?", answer: "No. The MP3 bitrate controls the output encoding quality and file size. It cannot restore audio quality that was not present in the original TikTok source." },
      { question: "Can I use the music anywhere?", answer: "Vidorac does not grant rights. Only use audio you own, have permission to use, or are otherwise legally entitled to use." },
    ],
  }} />;
}
