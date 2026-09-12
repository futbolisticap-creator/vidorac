import Image from "next/image";
import Link from "next/link";
import SupportButton from "./support-button";

export default function SiteHeader() {
  return (
    <header className="site-header fixed inset-x-0 top-0 z-30">
      <nav className="mx-auto flex h-[4.5rem] w-full max-w-[73.75rem] items-center gap-4 px-4 sm:px-6 lg:px-8" aria-label="Primary navigation">
        <Link href="/" className="group flex shrink-0 items-center gap-2" aria-label="Vidorac home">
          <Image src="/branding/vidorac-logo.svg" alt="" width={132} height={34} className="brand-logo" priority />
          <span className="beta-badge">Beta</span>
        </Link>

        <div className="ml-auto flex items-center gap-1 text-sm text-[var(--text-muted)]">
          <Link href="/" className="header-link header-home-link">Home</Link>
          <Link href="/tiktok-downloader" className="header-link header-tiktok-link">TikTok Downloader</Link>
          <Link href="/tiktok-mp3-downloader" className="header-link header-mp3-link">MP3</Link>
          <Link href="/contact" className="header-link header-contact-link">Contact</Link>
          <SupportButton />
        </div>
      </nav>
    </header>
  );
}
