import Image from "next/image";
import Link from "next/link";
import SupportButton from "./support-button";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="mx-auto w-full max-w-[73.75rem] px-4 py-10 sm:px-6 lg:px-8">
        <div className="footer-main">
          <div className="max-w-sm">
            <div className="footer-brand">
              <Image src="/branding/vidorac-logo.svg" alt="Vidorac" width={124} height={32} className="footer-brand-logo" />
              <span className="footer-beta">Public Beta</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">A simple way to save public videos, images and carousels.</p>
          </div>
          <nav aria-label="Footer navigation" className="footer-links">
            <span aria-disabled="true">Privacy</span>
            <span aria-disabled="true">Terms</span>
            <span aria-disabled="true">Contact</span>
            <Link href="/#supported-sites">Supported sites</Link>
            <SupportButton label="Donate" variant="footer" />
          </nav>
        </div>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Vidorac</p>
          <p>Only download content you own or have permission to use.</p>
        </div>
        <p className="footer-legal">Vidorac is not affiliated with YouTube, TikTok, Instagram, X, Reddit or Facebook. Trademarks belong to their respective owners. Users are responsible for ensuring they have permission to download and use content.</p>
      </div>
    </footer>
  );
}
