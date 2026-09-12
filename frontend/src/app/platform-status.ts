export type PlatformId = "youtube" | "tiktok" | "instagram" | "x" | "reddit" | "facebook";
export type PlatformCapability = "reels" | "posts";

type PlatformStatus = {
  enabled: boolean;
  status: "available" | "partially_available" | "temporarily_unavailable";
  statusLabel?: string;
  capabilities?: Partial<Record<PlatformCapability, boolean>>;
};

export type AnalyzerUrlDecision =
  | { action: "analyze"; platform: PlatformId }
  | { action: "invalid" }
  | { action: "tiktok_only"; platform: PlatformId | null };
export type DiagnosticUrlContext = { platform: PlatformId | "unknown"; type: "reel" | "post" | "other" | "invalid" };

export const platformStatus: Record<PlatformId, PlatformStatus> = {
  youtube: {
    enabled: false,
    status: "temporarily_unavailable",
    statusLabel: "Temporarily unavailable",
  },
  tiktok: { enabled: true, status: "available" },
  instagram: {
    enabled: true,
    status: "partially_available",
    statusLabel: "Photo posts temporarily unavailable",
    capabilities: { reels: true, posts: false },
  },
  x: { enabled: true, status: "available" },
  reddit: { enabled: true, status: "available" },
  facebook: { enabled: true, status: "available" },
};

export const platformHosts: Record<PlatformId, readonly string[]> = {
  youtube: ["youtube.com", "youtu.be"],
  tiktok: ["tiktok.com"],
  instagram: ["instagram.com"],
  x: ["x.com", "twitter.com"],
  reddit: ["reddit.com", "redd.it", "v.redd.it"],
  facebook: ["facebook.com", "fb.watch"],
};

export const platformBySlug: Record<string, PlatformId> = {
  "youtube-downloader": "youtube",
  "tiktok-downloader": "tiktok",
  "instagram-downloader": "instagram",
  "x-downloader": "x",
  "reddit-downloader": "reddit",
  "facebook-downloader": "facebook",
};

export const unavailablePlatformCopy = {
  title: "YouTube is temporarily unavailable",
  text: "YouTube is currently limiting requests from our beta infrastructure. We're working on restoring support as soon as possible.",
  secondary: "TikTok, Instagram, X, Reddit and Facebook remain available.",
  landingText: "YouTube downloads are temporarily unavailable while we improve our beta infrastructure.",
  landingSecondary: "We're working to restore availability. Other supported platforms remain available.",
} as const;

export const instagramAvailabilityCopy = {
  title: "Instagram Reels are currently supported",
  text: "Photo and carousel posts are temporarily unavailable because Instagram is currently restricting anonymous access to this content.",
  secondary: "You can continue to analyze and download supported public Reels.",
} as const;

function matchesHostname(hostname: string, allowedHost: string): boolean {
  return hostname === allowedHost || hostname.endsWith(`.${allowedHost}`);
}

function parsePublicHttpUrl(value: string): URL | null {
  try {
    const parsed = new URL(value.trim());
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return null;
    return parsed;
  } catch {
    return null;
  }
}

function detectPlatform(parsed: URL): PlatformId | null {
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  for (const [platform, hosts] of Object.entries(platformHosts) as [PlatformId, readonly string[]][]) {
    if (hosts.some((host) => matchesHostname(hostname, host))) return platform;
  }
  return null;
}

export function detectPlatformFromUrl(value: string): PlatformId | null {
  const parsed = parsePublicHttpUrl(value);
  return parsed ? detectPlatform(parsed) : null;
}

export function isPlatformEnabled(platform: PlatformId | null): boolean {
  if (platform === null) return true;
  return platformStatus[platform]?.enabled === true;
}

export function isCapabilityEnabled(platform: PlatformId, capability: PlatformCapability): boolean {
  return platformStatus[platform]?.capabilities?.[capability] === true;
}

export function getAnalyzerUrlDecision(value: string): AnalyzerUrlDecision {
  if (!value.trim()) return { action: "invalid" };
  const parsed = parsePublicHttpUrl(value);
  if (!parsed || (parsed.port && !["80", "443"].includes(parsed.port))) return { action: "invalid" };

  const platform = detectPlatform(parsed);
  if (platform !== "tiktok") return { action: "tiktok_only", platform };
  return { action: "analyze", platform };
}

export function describeUrlForDiagnostics(value: string): DiagnosticUrlContext {
  const parsed = parsePublicHttpUrl(value);
  if (!parsed) return { platform: "unknown", type: "invalid" };
  const platform = detectPlatform(parsed) ?? "unknown";
  if (platform !== "instagram") return { platform, type: "other" };
  const firstSegment = parsed.pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  if (firstSegment === "reel" || firstSegment === "reels") return { platform, type: "reel" };
  if (firstSegment === "p") return { platform, type: "post" };
  return { platform, type: "other" };
}
