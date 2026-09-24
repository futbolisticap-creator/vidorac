import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist_Mono, Instrument_Serif, Manrope } from "next/font/google";
import "./globals.css";
import SiteHeader from "./site-header";
import { DonationProvider } from "./donation-modal";
import { getSupportUrl } from "./support-config";
import { OG_IMAGE_ALT, OG_IMAGE_PATH, SITE_URL } from "./seo";
import { TelegramTopBar } from "./telegram-promotion";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const homeSans = Manrope({
  variable: "--font-home-sans",
  subsets: ["latin"],
});

const homeSerif = Instrument_Serif({
  variable: "--font-home-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Vidorac — Video Downloader for TikTok, Instagram, Facebook, Reddit & X",
    template: "%s — Vidorac",
  },
  description: "Download videos and media from TikTok, Instagram, Facebook, Reddit and X with Vidorac.",
  applicationName: "Vidorac",
  alternates: { canonical: "/" },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim()
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION.trim() }
    : undefined,
  other: {
    "google-adsense-account": "ca-pub-7538317164806269",
  },
  icons: {
    icon: "/branding/vidorac-icon.svg",
    shortcut: "/branding/vidorac-icon.svg",
  },
  openGraph: {
    title: "Vidorac — Video Downloader for TikTok, Instagram, Facebook, Reddit & X",
    description: "Download videos and media from TikTok, Instagram, Facebook, Reddit and X with Vidorac.",
    url: "/",
    siteName: "Vidorac",
    type: "website",
    images: [{ url: OG_IMAGE_PATH, width: 1200, height: 630, alt: OG_IMAGE_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vidorac — Video Downloader for TikTok, Instagram, Facebook, Reddit & X",
    description: "Download videos and media from TikTok, Instagram, Facebook, Reddit and X with Vidorac.",
    images: [OG_IMAGE_PATH],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistMono.variable} ${homeSans.variable} ${homeSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <DonationProvider supportUrl={getSupportUrl()}>
          <SiteHeader />
          <TelegramTopBar />
          {children}
        </DonationProvider>
      </body>
    </html>
  );
}
