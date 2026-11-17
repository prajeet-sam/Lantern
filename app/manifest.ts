import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Moonlit Garden — Cycle & Wellness Companion",
    short_name: "Moonlit Garden",
    description:
      "A private, gentle companion for understanding your cycle, noticing patterns, and preparing for what's ahead.",
    start_url: "/",
    id: "/",
    scope: "/",
    display: "standalone",
    background_color: "#1a1730",
    theme_color: "#8a6bbf",
    lang: "en",
    orientation: "portrait",
    categories: ["health", "lifestyle", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}