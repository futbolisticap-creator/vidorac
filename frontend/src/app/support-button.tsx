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
  label = "Donate",
  variant = "header",
}: SupportButtonProps) {
  const supportUrl = getSupportUrl();
  if (!supportUrl) return null;

  return (
    <a
      href={supportUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-event="donate_click"
      aria-label="Donate to Vidorac on Ko-fi (opens in a new tab)"
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
    <aside className="support-card" aria-labelledby="support-card-title" data-testid="post-download-support">
      <div>
        <h3 id="support-card-title">Enjoying Vidorac?</h3>
        <p>
          Vidorac is free to use. If it helped you, consider supporting the
          project so we can keep improving speed, reliability and new features.
        </p>
      </div>
      <SupportButton label="Support Vidorac" variant="card" />
    </aside>
  );
}

export function HomepageSupportCard() {
  if (!getSupportUrl()) return null;

  return (
    <section
      className="seo-section seo-donate-section seo-section-bordered home-support-section"
      aria-labelledby="home-support-title"
      data-testid="home-support-cta"
    >
      <div>
        <p className="section-label">Optional support</p>
        <h2 id="home-support-title">Help Vidorac grow</h2>
        <p>
          Your support helps us improve the service, keep it running and build
          new features.
        </p>
      </div>
      <SupportButton label="Donate" variant="card" />
    </section>
  );
}
