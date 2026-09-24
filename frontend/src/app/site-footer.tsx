import Image from "next/image";
import Link from "next/link";
import { platformConfigs, platformOrder } from "./platform-config";
import { TELEGRAM_URL, TelegramIcon } from "./telegram-promotion";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="mx-auto w-full max-w-[73.75rem] px-4 py-10 sm:px-6 lg:px-8">
        <div className="footer-main">
          <div className="max-w-sm">
            <div className="footer-brand">
              <Image src="/branding/vidorac-logo.svg" alt="Vidorac" width={124} height={32} className="footer-brand-logo" />
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">Focused public-media downloaders for TikTok, Instagram, Facebook, Reddit and X.</p>
          </div>
          <div className="footer-navigation-groups">
            <nav aria-label="Footer navigation" className="footer-links">
              {platformOrder.map((id) => <Link key={id} href={platformConfigs[id].path}>{platformConfigs[id].name}</Link>)}
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/contact">Contact</Link>
            </nav>
            <div className="footer-community">
              <p>Community</p>
              <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label="Join Vidorac Telegram channel">
                <TelegramIcon />
                <span>Telegram Updates</span>
              </a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Vidorac</p>
          <p>Only download content you own or have permission to use.</p>
        </div>
        <p className="footer-legal">Vidorac is an independent service and is not affiliated with, endorsed by, or sponsored by TikTok, Instagram, Facebook, Reddit, or X. Their trademarks belong to their respective owners. Users are responsible for ensuring they have permission to download and use content.</p>
      </div>
    </footer>
  );
}
