import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/AppProviders";
import { CookieConsent } from "@/components/CookieConsent";

const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  preload: true,
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: "Moonlit Garden",
    template: "%s · Moonlit Garden",
  },
  description:
    "A private, gentle companion for understanding your cycle, noticing patterns, and preparing for what's ahead.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://lanternforher.netlify.app"),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Moonlit Garden",
    title: "Moonlit Garden — A private space for your rhythm",
    description:
      "A private, gentle companion for understanding your cycle, noticing patterns, and preparing for what's ahead.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Moonlit Garden" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Moonlit Garden — A private space for your rhythm",
    description:
      "A private, gentle companion for understanding your cycle, noticing patterns, and preparing for what's ahead.",
    images: ["/opengraph-image"],
  },
  applicationName: "Moonlit Garden",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Moonlit Garden" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#1a1730",
  width: "device-width",
  initialScale: 1,
  userScalable: true,
  viewportFit: "cover",
};

const themeInitScript = `(function(){try{var t=localStorage.getItem('lantern:theme')||'system';var m=t==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;document.documentElement.setAttribute('data-theme',m);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
        <CookieConsent />
      </body>
    </html>
  );
}