export type PlatformId = "youtube" | "tiktok" | "instagram" | "x" | "reddit" | "facebook";

type PlatformStatus = {
  enabled: boolean;
  status: "available" | "partially_available" | "temporarily_unavailable";
  statusLabel?: string;
  capabilities?: {
    reels: boolean;
    posts: boolean;
  };
};

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

export function detectPlatformFromUrl(value: string): PlatformId | null {
  try {
    const parsed = new URL(value.trim());
    const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return null;
    for (const [platform, hosts] of Object.entries(platformHosts) as [PlatformId, readonly string[]][]) {
      if (hosts.some((host) => matchesHostname(hostname, host))) return platform;
    }
  } catch {
    return null;
  }
  return null;
}

export function isPlatformEnabled(platform: PlatformId | null): boolean {
  return platform === null || platformStatus[platform].enabled;
}

export function isInstagramPostCapabilityDisabled(value: string): boolean {
  if (platformStatus.instagram.capabilities?.posts !== false) return false;
  try {
    const parsed = new URL(value.trim());
    const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
    const isInstagram = platformHosts.instagram.some((host) => matchesHostname(hostname, host));
    return isInstagram && /^\/p\/[^/]+\/?$/.test(parsed.pathname);
  } catch {
    return false;
  }
}
