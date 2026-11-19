import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hugo",
    short_name: "Hugo",
    description: "Habits, academics and health.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // On a computer, let the app draw into the window's title bar: no strip with the app's name, only the window's
    // own buttons floating over the page. (Chrome and Edge; ignored on phones and in Safari.)
    display_override: ["window-controls-overlay", "standalone"],
    orientation: "portrait",
    background_color: "#070b14",
    theme_color: "#070b14",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
