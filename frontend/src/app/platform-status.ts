export type PlatformId = "tiktok" | "instagram" | "facebook" | "reddit" | "x";

export type AnalyzerUrlDecision =
  | { action: "analyze"; platform: PlatformId }
  | { action: "invalid" }
  | { action: "wrong_platform"; platform: PlatformId }
  | { action: "unsupported" };

export type DiagnosticUrlContext = {
  platform: PlatformId | "unknown";
  type: "reel" | "post" | "other" | "invalid";
};

export const platformHosts: Record<PlatformId, readonly string[]> = {
  tiktok: ["tiktok.com"],
  instagram: ["instagram.com"],
  facebook: ["facebook.com", "fb.watch"],
  reddit: ["reddit.com", "redd.it", "v.redd.it"],
  x: ["x.com", "twitter.com"],
};

export const platformNames: Record<PlatformId, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  reddit: "Reddit",
  x: "X / Twitter",
};

export const platformPaths: Record<PlatformId, string> = {
  tiktok: "/tiktok",
  instagram: "/instagram",
  facebook: "/facebook",
  reddit: "/reddit",
  x: "/x",
};

function matchesHostname(hostname: string, allowedHost: string): boolean {
  return hostname === allowedHost || hostname.endsWith(`.${allowedHost}`);
}

function parsePublicHttpUrl(value: string): URL | null {
  try {
    const parsed = new URL(value.trim());
    if (
      !["http:", "https:"].includes(parsed.protocol)
      || parsed.username
      || parsed.password
      || (parsed.port && !["80", "443"].includes(parsed.port))
    ) return null;
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

export function getAnalyzerUrlDecision(value: string, expectedPlatform: PlatformId): AnalyzerUrlDecision {
  if (!value.trim()) return { action: "invalid" };
  const parsed = parsePublicHttpUrl(value);
  if (!parsed) return { action: "invalid" };

  const platform = detectPlatform(parsed);
  if (!platform) return { action: "unsupported" };
  if (platform !== expectedPlatform) return { action: "wrong_platform", platform };
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
