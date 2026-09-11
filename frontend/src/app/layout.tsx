import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SiteHeader from "./site-header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Vidorac Beta — Video, Image & Carousel Downloader",
    template: "%s — Vidorac",
  },
  description: "Download public videos, images and carousels from YouTube, TikTok, Instagram, X, Reddit and Facebook.",
  applicationName: "Vidorac",
  icons: {
    icon: "/branding/vidorac-icon.svg",
    shortcut: "/branding/vidorac-icon.svg",
  },
  openGraph: {
    title: "Vidorac Beta — Video, Image & Carousel Downloader",
    description: "Download public videos, images and carousels from YouTube, TikTok, Instagram, X, Reddit and Facebook.",
    siteName: "Vidorac",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Vidorac Beta — Video, Image & Carousel Downloader",
    description: "Download public videos, images and carousels from YouTube, TikTok, Instagram, X, Reddit and Facebook.",
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
