export const CLIPBOARD_UNAVAILABLE_MESSAGE = "Unable to access the clipboard. Paste the link manually.";

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
