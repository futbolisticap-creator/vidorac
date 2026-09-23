import Image from "next/image";
import Link from "next/link";
import { platformConfigs, platformOrder } from "./platform-config";

export default function SiteHeader() {
  return (
    <header className="site-header fixed inset-x-0 top-0 z-30">
      <nav className="mx-auto flex h-[4.5rem] w-full max-w-[73.75rem] items-center gap-4 px-4 sm:px-6 lg:px-8" aria-label="Primary navigation">
        <Link href="/" className="group flex shrink-0 items-center gap-2" aria-label="Vidorac home">
          <Image src="/branding/vidorac-logo.svg" alt="" width={132} height={34} className="brand-logo" priority />
        </Link>

        <div className="primary-nav-desktop ml-auto items-center gap-1 text-sm text-[var(--text-muted)]">
          <Link href="/" className="header-link header-home-link">Home</Link>
          {platformOrder.map((id) => <Link key={id} href={platformConfigs[id].path} className="header-link">{platformConfigs[id].name}</Link>)}
          <Link href="/contact" className="header-link header-contact-link">Contact</Link>
        </div>

        <details className="primary-nav-mobile ml-auto">
          <summary aria-label="Open navigation menu">
            <span>Menu</span>
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
              <path d="M4 6.5h12M4 10h12M4 13.5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </summary>
          <div className="mobile-nav-panel">
            <Link href="/" className="header-link">Home</Link>
            {platformOrder.map((id) => <Link key={id} href={platformConfigs[id].path} className="header-link">{platformConfigs[id].name}</Link>)}
            <Link href="/contact" className="header-link">Contact</Link>
          </div>
        </details>
      </nav>
    </header>
  );
}
