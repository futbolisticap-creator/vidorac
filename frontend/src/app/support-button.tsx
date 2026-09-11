type SupportButtonProps = {
  label?: string;
  variant?: "header" | "footer" | "card";
};

function getSupportUrl(): string | null {
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

export default function SupportButton({
  label = "Support",
  variant = "header",
}: SupportButtonProps) {
  const supportUrl = getSupportUrl();
  if (!supportUrl) return null;

  return (
    <a
      href={supportUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-event="support_click"
      aria-label="Support Vidorac on Ko-fi (opens in a new tab)"
      className={`support-button support-button-${variant}`}
    >
      <span aria-hidden="true" className="support-heart">♥</span>
      <span>{label}</span>
    </a>
  );
}

export function SupportCard() {
  if (!getSupportUrl()) return null;

  return (
    <aside className="support-card" aria-labelledby="support-card-title">
      <div>
        <h3 id="support-card-title">Enjoying Vidorac?</h3>
        <p>
          Vidorac is free to use. If it helped you, consider supporting the
          project and helping us keep it online.
        </p>
      </div>
      <SupportButton label="Support Vidorac" variant="card" />
    </aside>
  );
}
