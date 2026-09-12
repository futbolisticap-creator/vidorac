"use client";

/* eslint-disable @next/next/no-img-element -- public preview hosts are dynamic extractor metadata */

import { FormEvent, useEffect, useRef, useState } from "react";
import AdPlaceholder from "./ad-placeholder";
import { API_BASE_URL } from "./api-config";
import { CLIPBOARD_UNAVAILABLE_MESSAGE, readClipboardTextSafely } from "./analyzer-client";
import PlatformAvailabilityNotice from "./platform-availability-notice";
import {
  detectPlatformFromUrl,
  getAnalyzerUrlDecision,
  type PlatformId,
} from "./platform-status";
import { SupportCard } from "./support-button";

const IS_DEVELOPMENT = process.env.NODE_ENV === "development";
const ANALYZE_TIMEOUT_MS = IS_DEVELOPMENT ? 60_000 : 120_000;

type AnalysisWaitState =
  | "idle"
  | "analyzing"
  | "starting"
  | "taking-longer"
  | "timed-out";

type QualityOption = {
  id: "best" | "compatible" | "1080" | "720" | "480" | "mp3";
  label: string;
  available: boolean;
  resolution: string | null;
  container: string | null;
  video_codec: string | null;
  estimated_size_bytes: number | null;
};

type VideoMetadata = {
  media_type: "video";
  title: string | null;
  thumbnail: string | null;
  duration: number | null;
  uploader: string | null;
  platform: "youtube" | "tiktok" | "instagram" | "x" | "reddit" | "facebook";
  webpage_url: string | null;
  max_height: number | null;
  quality_options: QualityOption[];
};

type GalleryItem = {
  index: number;
  type: "image" | "video";
  thumbnail: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  extension: string;
};

type GalleryMetadata = {
  media_type: "image" | "gallery" | "mixed";
  title: string | null;
  thumbnail: string | null;
  uploader: string | null;
  platform: "tiktok" | "instagram" | "x" | "reddit" | "facebook";
  item_count: number;
  items: GalleryItem[];
};

type MediaMetadata = VideoMetadata | GalleryMetadata;
type AnalyzeSuccess = { success: true; video?: VideoMetadata; media?: GalleryMetadata };
type ApiError = { success: false; detail: string; technical_error?: string };
type PrepareDownloadSuccess = { success: true; download_id: string; filename: string; content_type: string };
type DownloadPhase = "preparing" | "ready" | "started";
type DownloadBody = { url: string; quality?: QualityOption["id"]; item_indices?: number[]; archive?: boolean };
type LastDownload = { key: string; body: DownloadBody };

function formatDuration(duration: number | null): string | null {
  if (duration === null || !Number.isFinite(duration) || duration < 0) return null;
  const total = Math.round(duration);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0 ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}` : `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function displayPlatform(platform: MediaMetadata["platform"]): string {
  const names: Record<MediaMetadata["platform"], string> = {
    youtube: "YouTube",
    tiktok: "TikTok",
    instagram: "Instagram",
    x: "X",
    reddit: "Reddit",
    facebook: "Facebook",
  };
  return names[platform];
}

function formatEstimatedSize(bytes: number | null): string | null {
  if (bytes === null || !Number.isFinite(bytes) || bytes <= 0) return null;
  const megabytes = bytes / (1024 * 1024);
  return `~${megabytes >= 10 ? Math.round(megabytes) : megabytes.toFixed(1)} MB`;
}

function publicAnalyzeError(detail?: string): string {
  if (detail === "Invalid URL.") return "Please paste a valid URL.";
  if (detail?.startsWith("Instagram photo and carousel posts are temporarily unavailable")) return detail;
  if (detail?.startsWith("Instagram is taking too long")) return detail;
  if (detail?.startsWith("TikTok temporarily") || detail?.startsWith("This TikTok")) return detail;
  if (detail?.startsWith("YouTube ")) return detail;
  if (detail?.startsWith("Unsupported URL.")) return "Vidorac supports YouTube, TikTok, Instagram, X, Reddit and Facebook.";
  if (detail?.includes("individual posts")) return "Paste a link to one individual post, not a profile or feed.";
  if (detail?.includes("too many")) return "This post contains too many files.";
  if (detail?.includes("authentication")) return "This post requires authentication and isn't publicly accessible.";
  return "We couldn't analyze this post. It may be private, removed, or temporarily unavailable.";
}

function publicDownloadError(detail?: string): string {
  if (!detail) return "We couldn't prepare this download. Please try again.";
  if (detail.startsWith("Instagram photo and carousel posts are temporarily unavailable")) return detail;
  if (detail.startsWith("TikTok temporarily") || detail.startsWith("This TikTok")) return detail;
  if (detail.includes("temporarily")) return "The source temporarily rejected the request. Please try again later.";
  if (detail.includes("authentication")) return "This post requires authentication and isn't publicly accessible.";
  if (detail.includes("selected media")) return "That item is no longer available in this post. Analyze it again.";
  if (detail.includes("not available")) return "This media is no longer available.";
  if (detail.includes("format")) return "This format is not available for this video.";
  if (detail.includes("1 GB") || detail.includes("too large")) return "This download exceeds Vidorac's 1 GB limit.";
  if (detail.includes("3-hour")) return "This video is longer than Vidorac's 3-hour limit.";
  if (detail.includes("FFmpeg")) return "Vidorac needs FFmpeg to prepare this format.";
  return "We couldn't prepare this download. Please try again.";
}

function technicalMessage(endpoint: string, status: number | "NETWORK", detail?: string): string {
  const safeDetail = (detail || "No public detail").replace(/[\r\n\t]+/g, " ").slice(0, 240);
  return `${endpoint} · ${status === "NETWORK" ? "Network error" : `HTTP ${status}`} · ${safeDetail}`;
}

function LinkIcon() {
  return <svg aria-hidden="true" className="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M10.6 13.4a4 4 0 0 0 5.7 0l2.1-2.1a4 4 0 0 0-5.7-5.7l-1.2 1.2m1.9 3.8a4 4 0 0 0-5.7 0l-2.1 2.1a4 4 0 0 0 5.7 5.7l1.2-1.2" /></svg>;
}

function SearchIcon() {
  return <svg aria-hidden="true" className="size-[1.1rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.9"><circle cx="11" cy="11" r="6.5" /><path strokeLinecap="round" d="m16 16 4 4" /></svg>;
}

function MediaFallback({ video = false }: { video?: boolean }) {
  return <div className="flex size-full items-center justify-center bg-[radial-gradient(circle_at_50%_45%,rgba(31,132,255,0.16),transparent_65%)] text-[#42c7ff]">{video ? <svg aria-hidden="true" className="size-10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.8v12.4a1 1 0 0 0 1.5.86l9.3-6.2a1 1 0 0 0 0-1.72l-9.3-6.2A1 1 0 0 0 8 5.8Z" /></svg> : <svg aria-hidden="true" className="size-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3.5" y="4" width="17" height="16" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="m5 17 4-4 3 3 2-2 5 4"/></svg>}</div>;
}

export default function Analyzer() {
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [technicalError, setTechnicalError] = useState<string | null>(null);
  const [copiedError, setCopiedError] = useState(false);
  const [media, setMedia] = useState<MediaMetadata | null>(null);
  const [analyzedUrl, setAnalyzedUrl] = useState<string | null>(null);
  const [downloadPhases, setDownloadPhases] = useState<Record<string, DownloadPhase>>({});
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [lastDownload, setLastDownload] = useState<LastDownload | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [failedPreviews, setFailedPreviews] = useState<Set<number>>(new Set());
  const [analysisWaitState, setAnalysisWaitState] = useState<AnalysisWaitState>("idle");
  const [retryUrl, setRetryUrl] = useState<string | null>(null);
  const [unavailablePlatform, setUnavailablePlatform] = useState<PlatformId | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const analysisTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const analysisController = useRef<AbortController | null>(null);
  const analysisRequestId = useRef(0);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    analysisTimers.current.forEach(clearTimeout);
    analysisRequestId.current += 1;
    analysisController.current?.abort();
  }, []);

  function clearAnalysisTimers() {
    analysisTimers.current.forEach(clearTimeout);
    analysisTimers.current = [];
  }

  function updatePhase(key: string, phase: DownloadPhase | null) {
    setDownloadPhases((current) => {
      const next = { ...current };
      if (phase) next[key] = phase;
      else delete next[key];
      return next;
    });
  }

  async function runAnalysis(requestedUrl: string) {
    const requestId = analysisRequestId.current + 1;
    analysisRequestId.current = requestId;
    analysisController.current?.abort();
    clearAnalysisTimers();

    const controller = new AbortController();
    analysisController.current = controller;
    let didTimeout = false;

    setIsAnalyzing(true);
    setUnavailablePlatform(null);
    setAnalysisWaitState("analyzing");
    setRetryUrl(requestedUrl);
    setError(null);
    setTechnicalError(null);
    setMedia(null);
    setAnalyzedUrl(null);
    setDownloadError(null);
    setLastDownload(null);
    setSelectedItems(new Set());
    setFailedPreviews(new Set());
    setDownloadPhases({});

    analysisTimers.current = [
      setTimeout(() => {
        if (analysisRequestId.current === requestId) setAnalysisWaitState("starting");
      }, 3_000),
      setTimeout(() => {
        if (analysisRequestId.current === requestId) setAnalysisWaitState("taking-longer");
      }, 15_000),
      setTimeout(() => {
        if (analysisRequestId.current !== requestId) return;
        didTimeout = true;
        setAnalysisWaitState("timed-out");
        setIsAnalyzing(false);
        controller.abort("timeout");
      }, ANALYZE_TIMEOUT_MS),
    ];

    try {
      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: requestedUrl }),
        signal: controller.signal,
      });
      if (analysisRequestId.current !== requestId) return;
      clearAnalysisTimers();
      setAnalysisWaitState("idle");

      let data: AnalyzeSuccess | ApiError;
      try {
        data = (await response.json()) as AnalyzeSuccess | ApiError;
      } catch {
        setError("Vidorac received an invalid response from the service.");
        setTechnicalError(technicalMessage("POST /api/analyze", response.status, "Invalid JSON response"));
        return;
      }
      if (!response.ok || !data.success) {
        const detail = "detail" in data ? data.detail : undefined;
        setError(publicAnalyzeError(detail));
        const backendTechnicalError = "technical_error" in data ? data.technical_error : undefined;
        setTechnicalError(backendTechnicalError ?? technicalMessage("POST /api/analyze", response.status, detail));
        return;
      }
      const analyzed = data.video ?? data.media;
      if (!analyzed) {
        setError("Vidorac received an invalid response from the service.");
        setTechnicalError(technicalMessage("POST /api/analyze", response.status, "Missing media payload"));
        return;
      }
      setMedia(analyzed);
      setAnalyzedUrl(requestedUrl);
    } catch {
      if (analysisRequestId.current !== requestId || didTimeout) return;
      clearAnalysisTimers();
      setAnalysisWaitState("idle");
      setError("We couldn't reach Vidorac's service. Please try again.");
      setTechnicalError(technicalMessage("POST /api/analyze", "NETWORK"));
    } finally {
      if (analysisRequestId.current === requestId) {
        clearAnalysisTimers();
        if (!didTimeout) setAnalysisWaitState("idle");
        setIsAnalyzing(false);
        analysisController.current = null;
      }
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUnavailablePlatform(null);
    const decision = getAnalyzerUrlDecision(url);
    if (decision.action === "invalid" || decision.action === "unsupported") {
      setMedia(null);
      setError(decision.action === "invalid" ? "Please paste a valid URL." : "Vidorac supports YouTube, TikTok, Instagram, X, Reddit and Facebook.");
      return;
    }
    if (decision.action === "instagram_posts_unavailable") {
      analysisRequestId.current += 1;
      analysisController.current?.abort();
      clearAnalysisTimers();
      setIsAnalyzing(false);
      setAnalysisWaitState("idle");
      setUnavailablePlatform(null);
      setError("Instagram photo and carousel posts are temporarily unavailable. Instagram is currently restricting anonymous access to some public posts. Reels are still supported.");
      setTechnicalError(null);
      setMedia(null);
      setAnalyzedUrl(null);
      setDownloadError(null);
      setLastDownload(null);
      setSelectedItems(new Set());
      setDownloadPhases({});
      setRetryUrl(null);
      return;
    }
    if (decision.action === "platform_unavailable") {
      analysisRequestId.current += 1;
      analysisController.current?.abort();
      clearAnalysisTimers();
      setIsAnalyzing(false);
      setAnalysisWaitState("idle");
      setUnavailablePlatform(decision.platform);
      setError(null);
      setTechnicalError(null);
      setMedia(null);
      setAnalyzedUrl(null);
      setDownloadError(null);
      setLastDownload(null);
      setSelectedItems(new Set());
      setDownloadPhases({});
      setRetryUrl(null);
      return;
    }
    void runAnalysis(url.trim());
  }

  function retryAnalysis() {
    if (!retryUrl) return;
    setUrl(retryUrl);
    void runAnalysis(retryUrl);
  }

  async function prepareDownload(body: DownloadBody, key: string) {
    if (downloadPhases[key] === "preparing") return;
    updatePhase(key, "preparing");
    setDownloadError(null);
    setTechnicalError(null);
    setCopiedError(false);
    try {
      const response = await fetch(`${API_BASE_URL}/api/download/prepare`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await response.json()) as PrepareDownloadSuccess | ApiError;
      if (!response.ok || !data.success) {
        const detail = "detail" in data ? data.detail : undefined;
        setDownloadError(publicDownloadError(detail));
        setTechnicalError(technicalMessage("POST /api/download/prepare", response.status, detail));
        updatePhase(key, null);
        return;
      }
      updatePhase(key, "ready");
      timers.current.push(setTimeout(() => {
        const anchor = document.createElement("a");
        anchor.href = `${API_BASE_URL}/api/download/${encodeURIComponent(data.download_id)}`;
        anchor.download = data.filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        updatePhase(key, "started");
        setLastDownload({ key, body });
        timers.current.push(setTimeout(() => updatePhase(key, null), 2400));
      }, 350));
    } catch {
      setDownloadError("We couldn't reach Vidorac's local service. Please try again.");
      setTechnicalError(technicalMessage("POST /api/download/prepare", "NETWORK"));
      updatePhase(key, null);
    }
  }

  function handleQuality(quality: QualityOption["id"]) { if (analyzedUrl) void prepareDownload({ url: analyzedUrl, quality }, `quality:${quality}`); }
  function handleItem(index: number) { if (analyzedUrl) void prepareDownload({ url: analyzedUrl, item_indices: [index] }, `item:${index}`); }
  function handleAll() { if (analyzedUrl) void prepareDownload({ url: analyzedUrl }, "all"); }
  function handleSelected() {
    if (!analyzedUrl || selectedItems.size === 0) return;
    const indices = [...selectedItems].sort((a, b) => a - b);
    void prepareDownload({ url: analyzedUrl, item_indices: indices, archive: true }, `selected:${indices.join(",")}`);
  }
  function toggleSelected(index: number) {
    setSelectedItems((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  }
  async function copyTechnicalError() {
    if (!technicalError) return;
    try {
      await navigator.clipboard.writeText(technicalError);
      setCopiedError(true);
      timers.current.push(setTimeout(() => setCopiedError(false), 1800));
    } catch { setCopiedError(false); }
  }
  async function handlePaste() {
    const result = await readClipboardTextSafely(typeof navigator === "undefined" ? undefined : navigator.clipboard);
    if (!result.ok) {
      setError(CLIPBOARD_UNAVAILABLE_MESSAGE);
      inputRef.current?.focus();
      return;
    }
    if (result.text.trim()) { setUrl(result.text.trim()); setError(null); }
  }
  function clearAnalyzer() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    clearAnalysisTimers();
    analysisRequestId.current += 1;
    analysisController.current?.abort();
    analysisController.current = null;
    setUrl(""); setMedia(null); setAnalyzedUrl(null); setError(null); setTechnicalError(null); setDownloadError(null); setDownloadPhases({}); setLastDownload(null); setSelectedItems(new Set()); setFailedPreviews(new Set()); setAnalysisWaitState("idle"); setRetryUrl(null); setUnavailablePlatform(null); setIsAnalyzing(false);
    const focusInput = () => inputRef.current?.focus();
    if (typeof window === "undefined") focusInput();
    else window.requestAnimationFrame(focusInput);
  }

  const isVideo = media?.media_type === "video";
  const gallery = media && media.media_type !== "video" ? media : null;
  const anyPreparing = Object.values(downloadPhases).includes("preparing");
  const metadata = media ? isVideo ? [displayPlatform(media.platform), formatDuration(media.duration), media.max_height ? `${media.max_height}p max` : null].filter(Boolean) : [displayPlatform(media.platform), media.media_type === "image" ? "1 image" : `${media.item_count} ${media.media_type === "gallery" ? "images" : "media items"}`] : [];
  const timedOutPlatform = retryUrl ? detectPlatformFromUrl(retryUrl) : null;
  const instagramPostUnavailable = error?.startsWith("Instagram photo and carousel posts are temporarily unavailable") ?? false;
  const waitCopy = analysisWaitState === "starting"
    ? { title: "Analyzing your link…", text: "Checking the public post and its available media." }
    : analysisWaitState === "taking-longer"
      ? { title: "This is taking longer than usual…", text: "The source platform may be responding slowly. Please keep this tab open." }
      : analysisWaitState === "timed-out"
        ? {
            title: timedOutPlatform === "instagram" ? "Instagram is taking too long to respond." : "The source platform is taking too long to respond.",
            text: timedOutPlatform === "instagram" ? "Please try again in a moment or try another public post." : "Please try again in a moment.",
          }
        : null;

  return (
    <div className="downloader-shell mt-8 w-full max-w-5xl text-left">
      <form onSubmit={handleSubmit} noValidate className="mx-auto max-w-4xl">
        <div className={`analyzer-form rounded-xl border bg-[var(--surface)] p-2 sm:flex sm:min-h-[4.25rem] sm:items-center sm:gap-2 ${error ? "border-red-400/30" : "border-[var(--border)]"}`}>
          <label htmlFor="media-url" className="sr-only">Public media URL</label>
          <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-white/30 sm:py-0"><LinkIcon /><input ref={inputRef} id="media-url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Paste a video or post URL" className="min-w-0 w-full bg-transparent text-base text-white outline-none placeholder:text-white/25 disabled:cursor-not-allowed disabled:opacity-60" autoComplete="url" disabled={isAnalyzing} aria-describedby={error ? "analyze-error" : undefined} aria-invalid={Boolean(error)} /><button type="button" onClick={handlePaste} disabled={isAnalyzing} className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#80d4ff]/80 transition hover:bg-[#1682ff]/10 hover:text-[#a9e4ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#65c9ff] disabled:opacity-40" aria-label="Paste URL from clipboard">Paste</button></div>
          <button type="submit" disabled={isAnalyzing} className="analyze-button flex w-full items-center justify-center gap-2 rounded-[10px] bg-[var(--blue)] px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--blue-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cyan)] active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 sm:min-h-[3.25rem] sm:w-auto">{isAnalyzing ? <span aria-hidden="true" className="analysis-wait-spinner !m-0 !size-[1.1rem] !border-white/25 !border-t-white" /> : <SearchIcon />}{isAnalyzing ? "Analyzing..." : "Analyze"}</button>
        </div>
        <div aria-live="polite" aria-atomic="true">
          {waitCopy && <div id="analysis-status" className="analysis-wait-card" role="status">
            {analysisWaitState !== "timed-out" && <><span aria-hidden="true" className="analysis-wait-spinner" /><span className="sr-only">Vidorac is still analyzing the link.</span></>}
            <div><h2>{waitCopy.title}</h2><p>{waitCopy.text}</p></div>
            {analysisWaitState === "timed-out" && <button type="button" onClick={retryAnalysis} className="analysis-retry-button">Try again</button>}
          </div>}
          {instagramPostUnavailable ? (
            <div id="analyze-error" className="analysis-wait-card" role="alert">
              <div>
                <h2>Instagram photo posts are temporarily unavailable</h2>
                <p>Instagram is currently restricting anonymous access to some photo and carousel posts. Instagram Reels are still supported.</p>
              </div>
              <button type="button" onClick={clearAnalyzer} className="analysis-retry-button">Try another link</button>
            </div>
          ) : error ? <p id="analyze-error" className="error-message mt-3 text-sm">{error}</p> : null}
          {error?.startsWith("Instagram is taking too long") && retryUrl && (
            <button type="button" onClick={retryAnalysis} className="analysis-retry-button mt-3">Try again</button>
          )}
          {unavailablePlatform && <PlatformAvailabilityNotice platform={unavailablePlatform} />}
          {IS_DEVELOPMENT && technicalError && error && <button type="button" onClick={copyTechnicalError} className="ml-2 mt-2 text-xs text-white/35 underline decoration-white/20 underline-offset-4 transition hover:text-white/65">{copiedError ? "Copied" : "Copy technical error"}</button>}
        </div>
      </form>

      {media && <section className="result-card mt-6 overflow-hidden rounded-xl border p-3 sm:p-5" aria-label={`Analyzed ${media.media_type}`}>
        <div className={`grid gap-5 ${isVideo || gallery?.media_type === "image" ? "md:grid-cols-[16rem_1fr] md:items-center" : ""}`}>
          {(isVideo || gallery?.media_type === "image") && <div className="relative aspect-video overflow-hidden rounded-xl border border-white/[0.07] bg-[#090b12]">{media.thumbnail && !failedPreviews.has(-1) ? <img src={media.thumbnail} alt={media.title ? `Preview for ${media.title}` : "Media preview"} className="size-full object-cover" referrerPolicy="no-referrer" onError={() => setFailedPreviews((current) => new Set(current).add(-1))} /> : <MediaFallback video={isVideo} />}</div>}
          <div className="min-w-0 px-1 py-1"><span className="inline-flex items-center gap-1.5 rounded-full border border-[#258cff]/20 bg-[#1682ff]/10 px-2.5 py-1 text-xs font-medium text-[#74cfff]"><span className="size-1.5 rounded-full bg-[#35c5ff]" />Analyzed</span><h2 className="mt-3 line-clamp-2 text-lg font-semibold leading-snug tracking-[-0.025em] text-white sm:text-xl">{media.title || (isVideo ? "Untitled video" : "Untitled post")}</h2><p className="mt-1 truncate text-sm text-white/45">{media.uploader || "Unknown creator"}</p><div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/60">{metadata.map((item, index) => <span key={`${String(item)}-${index}`} className="flex items-center gap-2">{index > 0 && <span className="size-1 rounded-full bg-white/20" />}{item}</span>)}</div></div>
        </div>

        <div className="mt-4 border-t border-white/[0.07] px-1 pb-1 pt-4">
          {isVideo ? <><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-white/85">Choose quality</h3><span className="text-xs text-[#65bfff]/65">Original quality or compatible MP4</span></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{media.quality_options.map((quality, index) => {
            const key = `quality:${quality.id}`;
            const phase = downloadPhases[key];
            const size = formatEstimatedSize(quality.estimated_size_bytes);
            const details = quality.available ? quality.id === "mp3" ? ["MP3", "192 kbps", size].filter(Boolean) : [quality.id === "best" ? "Highest quality" : quality.id === "compatible" ? "Most compatible" : null, quality.resolution, quality.container, quality.video_codec, size].filter(Boolean) : ["Unavailable"];
            return <button key={quality.id} type="button" disabled={phase === "preparing" || !quality.available} onClick={() => handleQuality(quality.id)} title={!quality.available ? `${quality.label} is not available for this video` : undefined} className={`flex min-h-16 items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#65c9ff] disabled:cursor-not-allowed ${phase ? "border-[#34a5ff]/40 bg-[#1682ff]/20 text-[#9bdcff]" : index < 2 ? "border-[#2389ff]/30 bg-[#1682ff]/10 text-[#84ceff] hover:border-[#45a6ff]/50 hover:bg-[#1682ff]/15 disabled:opacity-40" : "border-white/[0.09] bg-white/[0.035] text-white/65 hover:border-white/20 hover:bg-white/[0.07] disabled:opacity-35"}`}>{phase === "preparing" && <span className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-[#88d5ff]/25 border-t-[#88d5ff]" />}<span className="flex min-w-0 flex-col gap-0.5"><span>{phase === "preparing" ? "Preparing..." : phase === "ready" ? "Download ready" : phase === "started" ? "Download started" : quality.label}</span>{!phase && <span className="truncate text-xs font-normal text-white/35">{details.join(" · ")}</span>}</span></button>;
          })}</div></> : gallery?.media_type === "image" ? <button type="button" disabled={downloadPhases.all === "preparing"} onClick={handleAll} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1478ff] to-[#1e56f5] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(20,120,255,0.2)] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#65c9ff] disabled:cursor-wait disabled:opacity-70 sm:w-auto">{downloadPhases.all === "preparing" && <span className="size-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />}{downloadPhases.all === "preparing" ? "Preparing..." : downloadPhases.all === "ready" ? "Download ready" : downloadPhases.all === "started" ? "Download started" : "Download Image"}</button> : gallery ? <>
            <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-sm font-semibold text-white/90">{gallery.media_type === "mixed" ? "Media in this post" : "Images in this post"}</h3><p className="mt-1 text-xs text-white/40">Download one item, select several, or get the complete post.</p></div>{selectedItems.size > 0 && <button type="button" onClick={() => setSelectedItems(new Set())} className="text-xs text-white/45 hover:text-white">Clear selection</button>}</div>
            <div className="mt-4 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">{gallery.items.map((item) => {
              const key = `item:${item.index}`;
              const phase = downloadPhases[key];
              const dimensions = item.width && item.height ? `${item.width} × ${item.height}` : null;
              return <article key={item.index} className="gallery-item overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.025]"><div className="relative aspect-[4/5] overflow-hidden bg-[#080b12]">{item.thumbnail && !failedPreviews.has(item.index) ? <img src={item.thumbnail} alt={`${item.type === "image" ? "Image" : "Video"} ${item.index + 1}`} className="size-full object-cover" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedPreviews((current) => new Set(current).add(item.index))} /> : <MediaFallback video={item.type === "video"} />}<label className="absolute left-2.5 top-2.5 flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 bg-[#070a12]/80 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-md"><input type="checkbox" checked={selectedItems.has(item.index)} onChange={() => toggleSelected(item.index)} className="size-4 accent-[#1682ff]" aria-label={`Select ${item.type} ${item.index + 1}`} /> Select</label><span className="absolute right-2.5 top-2.5 rounded-md bg-[#070a12]/75 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#8bd8ff] backdrop-blur-md">{item.type}</span></div><div className="p-3"><div className="mb-3 flex items-center justify-between gap-2"><span className="text-sm font-medium text-white/80">{item.type === "image" ? "Image" : "Video"} {item.index + 1}</span><span className="text-[0.65rem] text-white/35">{[dimensions, item.extension].filter(Boolean).join(" · ")}</span></div><button type="button" disabled={phase === "preparing"} onClick={() => handleItem(item.index)} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#2389ff]/30 bg-[#1682ff]/10 px-3 py-2 text-sm font-semibold text-[#8bd4ff] transition hover:border-[#45a6ff]/50 hover:bg-[#1682ff]/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#65c9ff] disabled:cursor-wait disabled:opacity-70">{phase === "preparing" && <span className="size-3.5 animate-spin rounded-full border-2 border-[#88d5ff]/25 border-t-[#88d5ff]" />}{phase === "preparing" ? "Preparing..." : phase === "ready" ? "Download ready" : phase === "started" ? "Download started" : "Download"}</button></div></article>;
            })}</div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={selectedItems.size === 0 || anyPreparing} onClick={handleSelected} className="min-h-11 rounded-xl border border-white/10 bg-white/[0.045] px-5 py-2.5 text-sm font-semibold text-white/70 transition hover:border-white/20 hover:bg-white/[0.075] disabled:cursor-not-allowed disabled:opacity-35">{Object.entries(downloadPhases).some(([key, value]) => key.startsWith("selected:") && value === "preparing") ? "Preparing selection..." : `Download Selected (${selectedItems.size})`}</button><button type="button" disabled={downloadPhases.all === "preparing"} onClick={handleAll} className="min-h-11 rounded-xl bg-gradient-to-r from-[#1478ff] to-[#1e56f5] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(20,120,255,0.2)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70">{downloadPhases.all === "preparing" ? "Preparing gallery..." : downloadPhases.all === "ready" ? "Download ready" : downloadPhases.all === "started" ? "Download started" : gallery.media_type === "mixed" ? "Download All Media" : "Download All Images"}</button></div>
          </> : null}
          <div className="mt-3 min-h-5" aria-live="polite" aria-atomic="true">{downloadError && <p className="text-xs text-red-300/90">{downloadError}</p>}{IS_DEVELOPMENT && technicalError && downloadError && <button type="button" onClick={copyTechnicalError} className="mt-1 text-xs text-white/35 underline decoration-white/20 underline-offset-4 transition hover:text-white/65">{copiedError ? "Copied" : "Copy technical error"}</button>}</div>
          {lastDownload && !anyPreparing && <button type="button" onClick={() => void prepareDownload(lastDownload.body, lastDownload.key)} className="mt-1 text-xs font-medium text-[#71c9ff]/75 underline decoration-[#71c9ff]/25 underline-offset-4 transition hover:text-[#9bdcff]">Download again</button>}
          {lastDownload && !anyPreparing && <SupportCard />}
          <p className="mt-2 text-xs leading-5 text-white/30">Only download content you own or have permission to use.</p>
          <button type="button" onClick={clearAnalyzer} disabled={anyPreparing} className="mt-4 rounded-lg border border-white/[0.09] bg-white/[0.025] px-3.5 py-2 text-sm font-medium text-white/55 transition hover:border-white/15 hover:bg-white/[0.055] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#65c9ff] disabled:cursor-not-allowed disabled:opacity-40">Download another</button>
        </div>
      </section>}
      {media && <AdPlaceholder format="banner" className="mt-8" />}
    </div>
  );
}
