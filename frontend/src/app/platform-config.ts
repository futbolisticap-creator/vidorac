import type { PlatformId } from "./platform-status";

export type PlatformPageConfig = {
  id: PlatformId;
  path: string;
  name: string;
  title: string;
  description: string;
  placeholder: string;
  cardDescription: string;
  supported: string;
  overview: string;
  capabilities: Array<{ title: string; text: string }>;
  limitations: string[];
  faqs: Array<{ question: string; answer: string }>;
};

export const platformConfigs: Record<PlatformId, PlatformPageConfig> = {
  tiktok: {
    id: "tiktok", path: "/tiktok", name: "TikTok", title: "TikTok Video Downloader",
    description: "Download public TikTok videos, photo slideshows and available audio with Vidorac.",
    placeholder: "Paste a TikTok link...", cardDescription: "Download public videos, slideshows and audio.",
    supported: "Videos, photo posts and available MP3 audio",
    overview: "Vidorac checks the exact public TikTok post and only shows formats that the source makes available.",
    capabilities: [
      { title: "Video qualities", text: "Choose from the real video qualities available for the post." },
      { title: "MP3 audio", text: "Extract audio from compatible public videos when an audio stream is available." },
      { title: "Photo slideshows", text: "Download one image, a selection, or the complete public slideshow." },
    ],
    limitations: ["Private and login-only posts are not supported.", "Deleted or region-restricted media may be unavailable.", "Available quality depends on the original post."],
    faqs: [
      { question: "Can Vidorac download private TikToks?", answer: "No. Vidorac supports compatible public posts and does not use personal cookies or account credentials." },
      { question: "Can I download TikTok slideshows?", answer: "Yes, when the public post exposes its images. You can download individual items, a selection, or all items." },
      { question: "Is Vidorac affiliated with TikTok?", answer: "No. Vidorac is an independent service and is not affiliated with TikTok or ByteDance." },
    ],
  },
  instagram: {
    id: "instagram", path: "/instagram", name: "Instagram", title: "Instagram Video & Reels Downloader",
    description: "Download compatible public Instagram Reels, videos, photos and carousel media with Vidorac.",
    placeholder: "Paste an Instagram link...", cardDescription: "Download public Reels, videos, photos and carousels.",
    supported: "Reels, videos, photos and carousels where publicly accessible",
    overview: "Vidorac uses one shared extraction service to inspect a public Instagram post without asking for your login or personal cookies.",
    capabilities: [
      { title: "Reels and videos", text: "Analyze compatible public Reels and video posts, then choose an available format." },
      { title: "Photos", text: "Save a public photo post when Instagram permits anonymous access." },
      { title: "Carousels", text: "Download selected carousel items or package the available media together." },
    ],
    limitations: ["Private profiles and login-only posts are not supported.", "Instagram may temporarily restrict anonymous access to photo and carousel posts.", "Stories and profile feeds are not supported."],
    faqs: [
      { question: "Which Instagram links can I use?", answer: "Use a direct public Reel, post or Instagram TV link. Profile, feed and private links are not supported." },
      { question: "Why might a public photo fail?", answer: "Instagram sometimes restricts anonymous access to photos and carousels. Vidorac reports that temporary limitation rather than asking for your account." },
      { question: "Does Vidorac need my Instagram login?", answer: "No. Vidorac does not request account credentials or personal session cookies." },
    ],
  },
  facebook: {
    id: "facebook", path: "/facebook", name: "Facebook", title: "Facebook Video Downloader",
    description: "Download compatible publicly accessible Facebook videos with Vidorac.",
    placeholder: "Paste a Facebook video link...", cardDescription: "Download compatible public Facebook videos.",
    supported: "Public videos, Reels and fb.watch links where available",
    overview: "Vidorac analyzes direct public Facebook media links through the same secure backend used by every Vidorac downloader.",
    capabilities: [
      { title: "Public videos", text: "Analyze direct Facebook video links that work without an account." },
      { title: "Facebook Reels", text: "Download compatible public Reel media when the source exposes it." },
      { title: "fb.watch links", text: "Short fb.watch links are accepted and resolved by the shared extractor." },
    ],
    limitations: ["Private, friends-only and login-only media is not supported.", "Deleted and region-restricted videos may be unavailable.", "Only direct post or media links are accepted."],
    faqs: [
      { question: "Can Vidorac download private Facebook videos?", answer: "No. Only media that is publicly accessible without authentication can be processed." },
      { question: "Does fb.watch work?", answer: "Compatible public fb.watch links are accepted and processed by the same shared backend." },
      { question: "Why does a visible video sometimes require login?", answer: "Facebook can show a page in your signed-in browser while blocking anonymous server access. Vidorac does not bypass that restriction." },
    ],
  },
  reddit: {
    id: "reddit", path: "/reddit", name: "Reddit", title: "Reddit Video Downloader",
    description: "Download compatible public Reddit-hosted videos and post media with Vidorac.",
    placeholder: "Paste a Reddit post link...", cardDescription: "Download public Reddit videos and post media.",
    supported: "Reddit posts, galleries, redd.it and v.redd.it links",
    overview: "Vidorac supports direct public Reddit post and media links and can merge available video and audio streams through its existing media pipeline.",
    capabilities: [
      { title: "Reddit videos", text: "Download compatible Reddit-hosted video from a direct public post." },
      { title: "Video with audio", text: "When Reddit separates streams, the existing FFmpeg pipeline prepares the final file." },
      { title: "Gallery media", text: "Save available items from compatible public Reddit galleries." },
    ],
    limitations: ["Subreddit feeds, user profiles and collections are not supported.", "Private or quarantined communities may require authentication.", "Externally hosted media depends on extractor support."],
    faqs: [
      { question: "Can Vidorac include Reddit video audio?", answer: "Yes, when separate audio is publicly available and the existing processing pipeline can merge it." },
      { question: "Which Reddit links work?", answer: "Use a direct post, gallery, redd.it or v.redd.it link rather than a subreddit or profile page." },
      { question: "Does Vidorac store Reddit downloads?", answer: "Prepared files use temporary storage and are removed by the existing one-time download cleanup process." },
    ],
  },
  x: {
    id: "x", path: "/x", name: "X / Twitter", title: "X / Twitter Video Downloader",
    description: "Download compatible public videos and media from X or legacy Twitter post links.",
    placeholder: "Paste an X or Twitter link...", cardDescription: "Download public video from X and Twitter links.",
    supported: "Public x.com and twitter.com status links",
    overview: "Vidorac accepts both current X links and legacy Twitter links, while limiting this page strictly to those two host families.",
    capabilities: [
      { title: "X video posts", text: "Analyze compatible public x.com status links and choose an available format." },
      { title: "Legacy Twitter links", text: "twitter.com and mobile.twitter.com status URLs remain supported." },
      { title: "Post media", text: "Download available media items from compatible public posts." },
    ],
    limitations: ["Private accounts and login-only posts are not supported.", "Profiles, timelines and search pages are not accepted.", "Availability depends on anonymous access from X."],
    faqs: [
      { question: "Do old Twitter links work?", answer: "Yes. This downloader accepts both x.com and twitter.com status links." },
      { question: "Can Vidorac download private X posts?", answer: "No. Only compatible public posts that are anonymously accessible can be processed." },
      { question: "Will an X link work on another Vidorac page?", answer: "No. Each downloader is isolated to its own platform; use this page for X and Twitter links." },
    ],
  },
};

export const platformOrder: PlatformId[] = ["tiktok", "instagram", "facebook", "reddit", "x"];
