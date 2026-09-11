import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SiteHeader from "./site-header";
import { OG_IMAGE_PATH, SITE_URL } from "./seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Vidorac Beta — Video, Image & Carousel Downloader",
    template: "%s — Vidorac",
  },
  description: "Download public videos, images and carousels from supported platforms with Vidorac.",
  applicationName: "Vidorac",
  alternates: { canonical: "/" },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim()
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION.trim() }
    : undefined,
  icons: {
    icon: "/branding/vidorac-icon.svg",
    shortcut: "/branding/vidorac-icon.svg",
  },
  openGraph: {
    title: "Vidorac Beta — Video, Image & Carousel Downloader",
    description: "Download public videos, images and carousels from supported platforms with Vidorac.",
    url: "/",
    siteName: "Vidorac",
    type: "website",
    images: [{ url: OG_IMAGE_PATH, width: 1200, height: 630, alt: "Vidorac public beta" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vidorac Beta — Video, Image & Carousel Downloader",
    description: "Download public videos, images and carousels from supported platforms with Vidorac.",
    images: [OG_IMAGE_PATH],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
