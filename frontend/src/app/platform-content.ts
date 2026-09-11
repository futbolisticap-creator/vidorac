import type { PlatformSlug } from "./seo";

export type PlatformPageContent = {
  slug: PlatformSlug;
  eyebrow: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  overviewTitle: string;
  overview: string[];
  mediaTypes: Array<{ title: string; text: string }>;
  qualityTitle: string;
  quality: string[];
  limitations: string[];
  faqs: Array<{ question: string; answer: string }>;
};

export const platformContent: Record<PlatformSlug, PlatformPageContent> = {
  "youtube-downloader": {
    slug: "youtube-downloader",
    eyebrow: "YouTube downloader",
    title: "YouTube Video Downloader | Vidorac Beta",
    description: "Analyze public YouTube videos and choose available video quality, a compatible MP4 option or MP3 with Vidorac Beta.",
    h1: "Download public YouTube videos",
    intro: "Paste a public YouTube video URL to inspect the formats the source currently makes available. Vidorac shows the result before preparing a download, so you can choose quality and compatibility without guessing.",
    overviewTitle: "Choose quality with useful context",
    overview: [
      "YouTube often publishes video and audio as separate streams, especially at higher resolutions. Vidorac can combine compatible streams during preparation when the selected format requires it. The choices shown after analysis reflect the source at that moment; they are not a promise that every video has every resolution.",
      "Best Quality prioritizes the highest-quality source combination available, even when that produces MKV with modern codecs such as AV1 and Opus. Best MP4 prioritizes broad playback compatibility by looking for MP4, H.264 and AAC. If that exact combination is unavailable, Vidorac reports what it can actually prepare instead of silently claiming a different format.",
    ],
    mediaTypes: [
      { title: "Video formats", text: "Best Quality, Best MP4 and available 1080p, 720p or 480p choices are presented after analysis." },
      { title: "Audio", text: "MP3 is offered when an audio stream can be extracted and converted from the public source." },
      { title: "Source-aware results", text: "Codec, container, resolution and an estimated size are shown when reliable metadata exists." },
    ],
    qualityTitle: "Why an option may be unavailable",
    quality: [
      "A creator may upload at a lower resolution, YouTube may expose a different codec set, or a format may temporarily be unavailable to the extractor. Vidorac disables choices it cannot substantiate from the analysis.",
      "Size values are estimates and may change after separate audio and video streams are merged. They help compare options but do not block a preparation solely because the estimate is incomplete.",
    ],
    limitations: [
      "Private, members-only, age-restricted or login-only videos are not supported.",
      "Live streams and region-restricted media may not be available.",
      "Vidorac is not affiliated with YouTube. Users should only download content they own or have permission to use.",
    ],
    faqs: [
      { question: "Can I download YouTube audio?", answer: "MP3 appears when Vidorac can access and process an audio stream from the public video." },
      { question: "Why is 1080p sometimes MKV?", answer: "The highest available video and audio streams may use codecs that are better represented in MKV. Choose Best MP4 when compatibility matters more." },
      { question: "Why is a listed quality unavailable?", answer: "The source did not expose a suitable stream for that option during analysis. Vidorac does not invent missing qualities." },
      { question: "Can Vidorac access private videos?", answer: "No. It does not use your account, personal cookies or login session." },
      { question: "Why can the first analysis take longer?", answer: "The free backend can sleep after inactivity. Its first request may take up to about a minute while the service starts." },
    ],
  },
  "tiktok-downloader": {
    slug: "tiktok-downloader",
    eyebrow: "TikTok downloader",
    title: "TikTok Video & Slideshow Downloader | Vidorac Beta",
    description: "Download accessible public TikTok videos, photo posts and slideshows individually or together with Vidorac Beta.",
    h1: "Download public TikTok videos & slideshows",
    intro: "Use a public TikTok post URL to analyze a video, photo post or slideshow. Vidorac adapts the result view to the media it finds and keeps every download choice tied to the original public post.",
    overviewTitle: "Video and photo-post workflows",
    overview: [
      "For a standard video, Vidorac displays the resolution, container and codec reported by the source, then offers only the preparation choices that apply. For a slideshow or photo post, the page displays the available images as individual items so you can review the complete set before downloading anything.",
      "Photo posts support downloading one image, selecting several items with Download Selected, or preparing Download All when the full gallery is available. Mixed media is represented item by item rather than being flattened into one misleading video result. The quality of every image or clip depends on what TikTok exposes publicly.",
    ],
    mediaTypes: [
      { title: "Public videos", text: "Analyze accessible video posts and choose from the formats Vidorac can verify." },
      { title: "Slideshows", text: "See the images included in a public photo post before choosing individual or grouped downloads." },
      { title: "Selections", text: "Use Download Selected for specific images or Download All for the complete available post." },
    ],
    qualityTitle: "Availability can change",
    quality: [
      "TikTok changes its public delivery systems frequently. Platform changes can occasionally cause temporary availability issues even when a post opens normally in the TikTok app or website.",
      "Vidorac does not ask for login credentials, personal cookies or session tokens. If a public post cannot be analyzed safely, try again later rather than attempting to bypass the platform's access controls.",
    ],
    limitations: [
      "Private, friends-only, removed, restricted or login-only posts are not supported.",
      "Some videos may offer only one source resolution, and photo metadata may vary between posts.",
      "Vidorac is not affiliated with TikTok. Download and use media only when you have permission.",
    ],
    faqs: [
      { question: "Can I download a TikTok slideshow?", answer: "Yes, when its images are publicly accessible. Vidorac shows the available items and provides individual, selected and complete-gallery actions." },
      { question: "Can I choose individual images?", answer: "Yes. Select the images you want and use Download Selected, or use each item's Download button." },
      { question: "Why did analysis suddenly stop working?", answer: "A post may have changed visibility, been removed, or become temporarily unavailable after a platform change." },
      { question: "Does Vidorac need my TikTok login?", answer: "No. Private and login-only content is intentionally unsupported." },
      { question: "Why can the first request be slow?", answer: "Vidorac uses a free backend that may need to wake after inactivity. The page shows progress while it starts." },
    ],
  },
  "instagram-downloader": {
    slug: "instagram-downloader",
    eyebrow: "Instagram downloader",
    title: "Instagram Video, Image & Carousel Downloader | Vidorac Beta",
    description: "Analyze accessible public Instagram Reels, images and carousel posts without authentication using Vidorac Beta.",
    h1: "Download public Instagram media",
    intro: "Paste the URL of a publicly accessible Instagram post or Reel. Vidorac identifies whether the post contains a video, one image, a carousel or mixed media and presents the available items clearly.",
    overviewTitle: "A result that matches the post",
    overview: [
      "Single-image posts receive a direct image action. Reels and other video posts use the video result flow. Carousels display every accessible item in order, including mixed photo and video posts, so you can download one item, a selection, or all available media without repeating the analysis.",
      "Instagram may provide different representations of the same media depending on the post. Vidorac relies on the public, unauthenticated source and reports the dimensions, extension or video information it can verify. It does not claim access to an original file that Instagram has not exposed.",
    ],
    mediaTypes: [
      { title: "Reels and videos", text: "Publicly accessible video posts use the existing video analysis and preparation flow." },
      { title: "Images", text: "Single public images can be previewed and prepared directly." },
      { title: "Carousels", text: "Photos and videos appear in post order with individual, selected and complete-post actions." },
    ],
    qualityTitle: "Public access is required",
    quality: [
      "A post must be accessible without authentication. Private profiles, close-friends posts, stories that require login and other gated media cannot be analyzed by Vidorac.",
      "An accessible post may still become unavailable if it is deleted, archived, region-limited or changed by its owner. Retrying cannot restore content that is no longer public.",
    ],
    limitations: [
      "Private or login-only content is not supported.",
      "Stories, disappearing media and profile-wide downloads are outside the current beta scope.",
      "Vidorac is not affiliated with Instagram or Meta. Trademarks belong to their respective owners.",
    ],
    faqs: [
      { question: "Can I download every item in a carousel?", answer: "Yes, when each item is publicly available. You can inspect the gallery and choose Download All Media." },
      { question: "Can I download only two carousel images?", answer: "Yes. Mark those items and use Download Selected." },
      { question: "Does Vidorac work with private profiles?", answer: "No. Vidorac does not authenticate as you or import personal browser sessions." },
      { question: "Why are image dimensions sometimes missing?", answer: "Instagram does not always expose complete metadata consistently. The download can still be offered when the media URL is verifiable." },
      { question: "Are files stored permanently?", answer: "No. Prepared files use temporary storage and are cleaned according to the existing download lifecycle." },
    ],
  },
  "x-downloader": {
    slug: "x-downloader",
    eyebrow: "X video downloader",
    title: "X (Twitter) Video Downloader | Vidorac Beta",
    description: "Analyze and download accessible public videos from X, formerly Twitter, with source-aware quality options in Vidorac Beta.",
    h1: "Download public videos from X",
    intro: "Paste the URL of a public post on X (formerly Twitter) that contains video. Vidorac analyzes the post and displays only the media choices it can access from the public source.",
    overviewTitle: "Use the original public post",
    overview: [
      "The original post URL gives the extractor the context needed to identify the embedded video and its available variants. Vidorac uses that information to show real resolution and format details before preparing a file. It does not manufacture higher resolutions or claim a format that the post does not expose.",
      "When several video representations exist, the result can offer quality choices based on those variants. Some posts expose only one practical stream. In that case, fewer options are expected and accurately reflect the source rather than a limitation hidden by the interface.",
    ],
    mediaTypes: [
      { title: "Public post video", text: "Analyze video attached to an accessible public post on X." },
      { title: "Available variants", text: "Choose among the resolutions and containers the source actually exposes." },
      { title: "Audio option", text: "MP3 may appear when Vidorac can extract and process the video's public audio stream." },
    ],
    qualityTitle: "Source visibility matters",
    quality: [
      "Protected accounts, deleted posts, age-gated media and posts that require a logged-in session are not supported. A public-looking link may also stop working after its author changes visibility.",
      "Platform delivery changes can cause temporary analysis failures. Vidorac keeps the public error simple and does not request credentials or suggest bypassing an access restriction.",
    ],
    limitations: [
      "Only accessible public post media is supported; private and login-only content is excluded.",
      "Posts without downloadable video will not receive invented media options.",
      "Vidorac is not affiliated with X Corp. or Twitter. Users remain responsible for permission and use.",
    ],
    faqs: [
      { question: "Should I paste an X or Twitter URL?", answer: "Either current X links or compatible historical Twitter post links may work when they resolve to an accessible public post." },
      { question: "Can Vidorac download images from X?", answer: "The current X landing focuses on the public video capability that Vidorac supports reliably." },
      { question: "Why is only one quality available?", answer: "That may be the only usable video representation exposed for the post." },
      { question: "Can I access a protected account?", answer: "No. Vidorac does not use login sessions or personal cookies." },
      { question: "What happens to prepared files?", answer: "They are temporary, delivered through a one-time download flow and cleaned by the backend lifecycle." },
    ],
  },
  "reddit-downloader": {
    slug: "reddit-downloader",
    eyebrow: "Reddit downloader",
    title: "Reddit Video Downloader | Vidorac Beta",
    description: "Analyze accessible public Reddit post videos from the original post URL and download available source formats with Vidorac Beta.",
    h1: "Download public Reddit videos",
    intro: "For the most reliable result, paste the original public Reddit post URL. That page contains the context Vidorac needs to identify Reddit-hosted video and the audio or quality variants associated with it.",
    overviewTitle: "Why the post URL works best",
    overview: [
      "A direct media URL often points to one specific video representation. It may omit the separate audio stream, alternative resolutions and the post metadata needed to assemble a complete result. The original Reddit post URL lets Vidorac inspect the media relationship rather than treating one CDN file as the whole post.",
      "After analysis, Vidorac presents only the qualities supported by the actual Reddit source. It can combine separate media streams when appropriate, but it does not invent missing resolutions. If the post links to another website instead of hosting media on Reddit, support depends on that destination and may be outside this page's scope.",
    ],
    mediaTypes: [
      { title: "Reddit-hosted video", text: "Use the original post to discover compatible public video and audio streams." },
      { title: "Available qualities", text: "Resolution choices are based on the variants Reddit exposes for that specific post." },
      { title: "Complete context", text: "Post URLs provide better results than a direct link to one CDN rendition." },
    ],
    qualityTitle: "Direct media links are incomplete",
    quality: [
      "A v.redd.it or other direct file URL may represent only one resolution and may not include audio. Vidorac recommends the canonical Reddit post URL so the extractor can discover the full public media description.",
      "Removed posts, quarantined communities, mature-content gates and login requirements can prevent analysis. Vidorac does not sign in or carry community permissions on a user's behalf.",
    ],
    limitations: [
      "Private, removed, gated or login-only Reddit content is not supported.",
      "Externally hosted links are not guaranteed to behave like Reddit-hosted video.",
      "Vidorac is not affiliated with Reddit. Download only media you own or are permitted to use.",
    ],
    faqs: [
      { question: "Which Reddit URL should I paste?", answer: "Paste the original post URL, not a direct video file URL, for the best chance of finding video, audio and quality variants." },
      { question: "Why does a direct URL have no audio?", answer: "Reddit can deliver video and audio separately. A single direct rendition may contain video only." },
      { question: "Does Vidorac create extra qualities?", answer: "No. It reports and prepares variants supported by the public source." },
      { question: "Can it access private communities?", answer: "No. Vidorac works without Reddit authentication and cannot inherit your account access." },
      { question: "Why can analysis fail temporarily?", answer: "The post can change, Reddit delivery can be unavailable, or the free Vidorac backend may still be waking." },
    ],
  },
  "facebook-downloader": {
    slug: "facebook-downloader",
    eyebrow: "Facebook downloader",
    title: "Facebook Video Downloader | Vidorac Beta",
    description: "Analyze and download video that Facebook makes publicly accessible without authentication using Vidorac Beta.",
    h1: "Download public Facebook videos",
    intro: "Paste a Facebook video or post URL that is publicly accessible without signing in. Vidorac checks the source and shows the formats it can verify before preparing any file.",
    overviewTitle: "Designed for genuinely public media",
    overview: [
      "Facebook visibility is more complex than whether a link can be copied. A post may appear for its owner or logged-in audience while remaining unavailable to an unauthenticated service. Vidorac supports only media Facebook exposes publicly, without asking you to share cookies, credentials or account access.",
      "When analysis succeeds, the available choices reflect the streams delivered for that specific post. Resolution, container and codec details appear when they can be determined. Vidorac does not promise HD, MP4 or audio when the public source does not provide a compatible representation.",
    ],
    mediaTypes: [
      { title: "Public video posts", text: "Analyze video pages and posts that open publicly without an account session." },
      { title: "Source qualities", text: "Choose only from the resolutions and formats confirmed during analysis." },
      { title: "Prepared delivery", text: "A temporary one-time download is created after you select an available option." },
    ],
    qualityTitle: "Public does not mean every shared link",
    quality: [
      "Group privacy, audience selection, regional rules, age gates and login prompts can all make a copied URL inaccessible to Vidorac. If the post requires any account context, it is outside the supported public workflow.",
      "Facebook can change media delivery details over time. A previously working public post may need to be analyzed again or may become unavailable after its owner changes visibility.",
    ],
    limitations: [
      "Private, friends-only, group-restricted, login-only and otherwise restricted content is not supported.",
      "Vidorac never asks for Facebook credentials or imports a browser session.",
      "Vidorac is not affiliated with Facebook or Meta. Users are responsible for lawful, permitted use.",
    ],
    faqs: [
      { question: "Can I download a private Facebook video?", answer: "No. Vidorac only analyzes content available publicly without authentication." },
      { question: "Why does a link work for me but not here?", answer: "Your browser may be using a logged-in session or group membership that Vidorac intentionally does not access." },
      { question: "Which qualities are available?", answer: "The result shows only the streams Facebook exposes publicly for that exact post." },
      { question: "Does Vidorac store my Facebook login?", answer: "No. It does not request or use Facebook login information." },
      { question: "Why can the first analysis take longer?", answer: "The Render Free service may cold-start after inactivity. Vidorac displays a waiting state and allows a retry if needed." },
    ],
  },
};
