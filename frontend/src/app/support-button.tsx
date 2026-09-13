"use client";

import { type MouseEvent } from "react";
import { useDonationModal } from "./donation-modal";
import { getSupportUrl } from "./support-config";

type SupportButtonProps = {
  label?: string;
  variant?: "header" | "footer" | "card";
};

export default function SupportButton({
  label = "Donate",
  variant = "header",
}: SupportButtonProps) {
  const supportUrl = getSupportUrl();
  const { openDonationModal } = useDonationModal();
  if (!supportUrl) return null;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    openDonationModal(event.currentTarget);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      data-event="donate_click"
      aria-label="Open the Vidorac donation panel"
      className={`support-button support-button-${variant}`}
    >
      <span aria-hidden="true" className="support-heart">♥</span>
      <span>{label}</span>
    </button>
  );
}

export function ResultSupportCard() {
  if (!getSupportUrl()) return null;

  return (
    <aside className="support-card" aria-labelledby="support-card-title" data-testid="analyze-result-support">
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
