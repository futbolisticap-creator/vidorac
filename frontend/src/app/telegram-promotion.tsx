export const TELEGRAM_URL = "https://t.me/Vidoracc";

export function TelegramIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className={className}
    >
      <circle cx="12" cy="12" r="10" fill="#229ED9" />
      <path
        fill="#fff"
        d="m17.82 7.05-2.1 10.02c-.16.71-.58.89-1.17.55l-3.2-2.36-1.55 1.49c-.17.17-.31.31-.64.31l.23-3.26 5.93-5.36c.26-.23-.06-.36-.4-.13l-7.33 4.62-3.16-.99c-.69-.21-.7-.69.14-1.02l12.36-4.76c.57-.21 1.07.14.89.89Z"
      />
    </svg>
  );
}

const telegramLinkProps = {
  href: TELEGRAM_URL,
  target: "_blank",
  rel: "noopener noreferrer",
  "aria-label": "Join Vidorac Telegram channel",
} as const;

export function TelegramTopBar() {
  return (
    <aside className="telegram-topbar" aria-label="Vidorac Telegram updates">
      <div className="telegram-topbar-inner">
        <TelegramIcon className="telegram-topbar-icon" />
        <div className="telegram-topbar-copy">
          <strong>Stay updated with Vidorac</strong>
          <span>New features, fixes and important service updates.</span>
        </div>
        <a {...telegramLinkProps} className="telegram-topbar-link">
          <span className="telegram-join-desktop">Join Telegram</span>
          <span className="telegram-join-mobile">Join</span>
        </a>
      </div>
    </aside>
  );
}

export function TelegramHomepageCard() {
  return (
    <section className="telegram-home-card" aria-labelledby="telegram-home-title">
      <div className="telegram-home-heading">
        <TelegramIcon className="telegram-home-icon" />
        <div>
          <p className="section-label">Vidorac Updates</p>
          <h2 id="telegram-home-title">Keep up with what changes.</h2>
        </div>
      </div>
      <ul aria-label="Telegram channel updates">
        <li>New features</li>
        <li>Supported functionality</li>
        <li>Fixes</li>
        <li>Important service announcements</li>
      </ul>
      <a {...telegramLinkProps} className="telegram-home-link">
        Join Vidorac on Telegram
        <span aria-hidden="true">↗</span>
      </a>
    </section>
  );
}
