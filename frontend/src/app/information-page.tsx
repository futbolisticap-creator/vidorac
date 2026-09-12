import type { ReactNode } from "react";
import Link from "next/link";
import SiteFooter from "./site-footer";

export default function InformationPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main className="information-page min-h-screen text-white">
      <article className="information-shell">
        <header className="information-header">
          <p className="section-label">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{intro}</p>
        </header>
        <div className="information-content">{children}</div>
        <nav className="information-links" aria-label="Related information">
          <Link href="/contact">Contact</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </article>
      <SiteFooter />
    </main>
  );
}
