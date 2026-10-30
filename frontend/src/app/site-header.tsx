"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import PlatformBrandIcon from "./platform-brand-icon";
import { platformNames, platformPaths, type PlatformId } from "./platform-status";
import SupportButton from "./support-button";

const menuPlatforms: PlatformId[] = ["tiktok", "instagram", "facebook", "reddit", "x"];

export default function SiteHeader() {
  const [openMenu, setOpenMenu] = useState<"desktop" | "mobile" | null>(null);
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const desktopTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileNavRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!desktopMenuRef.current?.contains(target) && !mobileMenuRef.current?.contains(target)) {
        setOpenMenu(null);
      }
      if (mobileNavRef.current?.open && !mobileNavRef.current.contains(target)) {
        mobileNavRef.current.open = false;
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (openMenu) {
        setOpenMenu(null);
        (openMenu === "desktop" ? desktopTriggerRef : mobileTriggerRef).current?.focus();
      } else if (mobileNavRef.current?.open) {
        mobileNavRef.current.open = false;
        mobileNavRef.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenu]);

  const closeMenus = () => {
    setOpenMenu(null);
    if (mobileNavRef.current) mobileNavRef.current.open = false;
  };

  const platformsMenu = (location: "desktop" | "mobile") => (
    <div className="platforms-menu" ref={location === "desktop" ? desktopMenuRef : mobileMenuRef}>
      <button
        type="button"
        className="header-link platforms-menu-trigger"
        ref={location === "desktop" ? desktopTriggerRef : mobileTriggerRef}
        aria-expanded={openMenu === location}
        onClick={() => setOpenMenu(openMenu === location ? null : location)}
      >
        Platforms
        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
          <path d="m3.5 6 4.5 4 4.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {openMenu === location && (
        <div className="platforms-menu-panel">
          {menuPlatforms.map((platform) => (
            <Link key={platform} href={platformPaths[platform]} className="platforms-menu-link" onClick={closeMenus}>
              <PlatformBrandIcon platform={platform} />
              <span>{platformNames[platform]}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <header className="site-header fixed inset-x-0 top-0 z-30">
      <nav className="mx-auto flex h-[4.5rem] w-full max-w-[73.75rem] items-center gap-4 px-4 sm:px-6 lg:px-8" aria-label="Primary navigation">
        <Link href="/" className="group flex shrink-0 items-center gap-2" aria-label="Vidorac home">
          <Image src="/branding/vidorac-logo.svg" alt="" width={132} height={34} className="brand-logo" priority />
        </Link>

        <div className="primary-nav-desktop ml-auto items-center gap-2 text-sm text-[var(--text-muted)]">
          <Link href="/" className="header-link header-home-link">Home</Link>
          {platformsMenu("desktop")}
          <Link href="/contact" className="header-link header-contact-link">Contact</Link>
          <SupportButton variant="header" />
        </div>

        <details className="primary-nav-mobile ml-auto" ref={mobileNavRef}>
          <summary aria-label="Open navigation menu" onClick={() => setOpenMenu(null)}>
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
              <path d="M4 6.5h12M4 10h12M4 13.5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </summary>
          <div className="mobile-nav-panel">
            <Link href="/" className="header-link" onClick={closeMenus}>Home</Link>
            {platformsMenu("mobile")}
            <Link href="/contact" className="header-link" onClick={closeMenus}>Contact</Link>
            <SupportButton variant="header" />
          </div>
        </details>
      </nav>
    </header>
  );
}
