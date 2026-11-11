import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Goal Tracker",
    short_name: "Goals",
    description: "Turn big goals into numbers, predict your finish date, and stay motivated with AI coaches.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A0A0B",
    theme_color: "#0A0A0B",
    categories: ["productivity", "lifestyle", "health"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Log progress", url: "/log", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Talk to coach", url: "/coach", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
