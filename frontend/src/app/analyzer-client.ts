export const CLIPBOARD_UNAVAILABLE_MESSAGE = "Unable to access the clipboard. Paste the link manually.";

export type QualityOption = {
  id: "best" | "compatible" | "1080" | "720" | "480" | "audio" | "mp3";
  label: string;
  available: boolean;
  resolution: string | null;
  container: string | null;
  video_codec: string | null;
  estimated_size_bytes: number | null;
};

export type VideoMetadata = {
  media_type: "video";
  title: string | null;
  thumbnail: string | null;
  duration: number | null;
  uploader: string | null;
  platform: "tiktok" | "instagram" | "x" | "reddit" | "facebook";
  webpage_url: string | null;
  max_height: number | null;
  source_audio_codec: string | null;
  source_audio_bitrate_kbps: number | null;
  source_audio_sample_rate_hz: number | null;
  source_audio_channels: number | null;
  quality_options: QualityOption[];
};

export type GalleryItem = {
  index: number;
  type: "image" | "video";
  thumbnail: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  extension: string;
};

export type GalleryMetadata = {
  media_type: "image" | "gallery" | "mixed";
  title: string | null;
  thumbnail: string | null;
  uploader: string | null;
  platform: "tiktok" | "instagram" | "x" | "reddit" | "facebook";
  item_count: number;
  items: GalleryItem[];
};

export type MediaMetadata = VideoMetadata | GalleryMetadata;
export type AnalyzePayload =
  | { kind: "success"; media: MediaMetadata }
  | { kind: "error"; detail?: string; technicalError?: string }
  | { kind: "invalid" };
export type PreparePayload =
  | { kind: "success"; downloadId: string; filename: string; contentType: string }
  | { kind: "error"; detail?: string; technicalError?: string }
  | { kind: "invalid" };

type ClipboardReader = {
  readText?: () => Promise<string>;
};

export async function readClipboardTextSafely(
  clipboard: ClipboardReader | null | undefined,
): Promise<{ ok: true; text: string } | { ok: false }> {
  if (typeof clipboard?.readText !== "function") return { ok: false };
  try {
    return { ok: true, text: await clipboard.readText() };
  } catch {
    return { ok: false };
  }
}

type UnknownRecord = Record<string, unknown>;
const VIDEO_PLATFORMS = ["tiktok", "instagram", "x", "reddit", "facebook"] as const;
const GALLERY_PLATFORMS = ["tiktok", "instagram", "x", "reddit", "facebook"] as const;
const QUALITY_IDS = ["best", "compatible", "1080", "720", "480", "audio", "mp3"] as const;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function oneOf<T extends readonly string[]>(value: unknown, options: T): T[number] | null {
  return typeof value === "string" && options.includes(value as T[number]) ? value as T[number] : null;
}

function normalizeQuality(value: unknown): QualityOption | null {
  if (!isRecord(value)) return null;
  const id = oneOf(value.id, QUALITY_IDS);
  if (!id || typeof value.label !== "string" || typeof value.available !== "boolean") return null;
  return {
    id,
    label: value.label,
    available: value.available,
    resolution: nullableString(value.resolution),
    container: nullableString(value.container),
    video_codec: nullableString(value.video_codec),
    estimated_size_bytes: nullableNumber(value.estimated_size_bytes),
  };
}

function normalizeVideo(value: unknown): VideoMetadata | null {
  if (!isRecord(value) || value.media_type !== "video" || !Array.isArray(value.quality_options)) return null;
  const platform = oneOf(value.platform, VIDEO_PLATFORMS);
  if (!platform) return null;
  const qualityOptions = value.quality_options.map(normalizeQuality).filter((item): item is QualityOption => item !== null);
  if (qualityOptions.length !== value.quality_options.length) return null;
  return {
    media_type: "video",
    title: nullableString(value.title),
    thumbnail: nullableString(value.thumbnail),
    duration: nullableNumber(value.duration),
    uploader: nullableString(value.uploader),
    platform,
    webpage_url: nullableString(value.webpage_url),
    max_height: nullableNumber(value.max_height),
    source_audio_codec: nullableString(value.source_audio_codec),
    source_audio_bitrate_kbps: nullableNumber(value.source_audio_bitrate_kbps),
    source_audio_sample_rate_hz: nullableNumber(value.source_audio_sample_rate_hz),
    source_audio_channels: nullableNumber(value.source_audio_channels),
    quality_options: qualityOptions,
  };
}

function normalizeGalleryItem(value: unknown): GalleryItem | null {
  if (!isRecord(value) || !Number.isInteger(value.index) || (value.type !== "image" && value.type !== "video")) return null;
  return {
    index: value.index as number,
    type: value.type,
    thumbnail: nullableString(value.thumbnail),
    width: nullableNumber(value.width),
    height: nullableNumber(value.height),
    duration: nullableNumber(value.duration),
    extension: typeof value.extension === "string" ? value.extension : "",
  };
}

function normalizeGallery(value: unknown): GalleryMetadata | null {
  if (!isRecord(value) || !["image", "gallery", "mixed"].includes(String(value.media_type)) || !Array.isArray(value.items)) return null;
  const platform = oneOf(value.platform, GALLERY_PLATFORMS);
  if (!platform) return null;
  const items = value.items.map(normalizeGalleryItem).filter((item): item is GalleryItem => item !== null);
  if (items.length !== value.items.length) return null;
  return {
    media_type: value.media_type as GalleryMetadata["media_type"],
    title: nullableString(value.title),
    thumbnail: nullableString(value.thumbnail),
    uploader: nullableString(value.uploader),
    platform,
    item_count: typeof value.item_count === "number" && Number.isInteger(value.item_count) && value.item_count >= 0 ? value.item_count : items.length,
    items,
  };
}

function errorPayload(value: UnknownRecord): { detail?: string; technicalError?: string } {
  return {
    detail: typeof value.detail === "string" ? value.detail : undefined,
    technicalError: typeof value.technical_error === "string" ? value.technical_error : undefined,
  };
}

export function normalizeAnalyzePayload(value: unknown): AnalyzePayload {
  if (!isRecord(value) || typeof value.success !== "boolean") return { kind: "invalid" };
  if (!value.success) return { kind: "error", ...errorPayload(value) };
  const media = normalizeVideo(value.video) ?? normalizeGallery(value.media);
  return media ? { kind: "success", media } : { kind: "invalid" };
}

export function normalizePreparePayload(value: unknown): PreparePayload {
  if (!isRecord(value) || typeof value.success !== "boolean") return { kind: "invalid" };
  if (!value.success) return { kind: "error", ...errorPayload(value) };
  if (typeof value.download_id !== "string" || typeof value.filename !== "string" || typeof value.content_type !== "string") return { kind: "invalid" };
  return {
    kind: "success",
    downloadId: value.download_id,
    filename: value.filename,
    contentType: value.content_type,
  };
}
