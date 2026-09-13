export function getSupportUrl(): string | null {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPPORT_URL?.trim();
  if (!configuredUrl) return null;

  try {
    const url = new URL(configuredUrl);
    if (url.protocol !== "https:" || url.hostname !== "ko-fi.com") return null;
    return url.toString();
  } catch {
    return null;
  }
}
