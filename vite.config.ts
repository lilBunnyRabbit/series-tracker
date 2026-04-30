import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { SvelteKitPWA } from "@vite-pwa/sveltekit";
import { defineConfig } from "vite";

const BASE = process.env.BASE_PATH ?? "";
const SCOPE = `${BASE}/`;

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
    SvelteKitPWA({
      registerType: "autoUpdate",
      strategies: "generateSW",
      injectRegister: "auto",
      includeManifestIcons: true,
      includeAssets: ["favicon.ico", "icon.svg", "icon-maskable.svg", "apple-touch-icon-180x180.png"],
      manifest: {
        name: "Series Tracker",
        short_name: "Tracker",
        description: "Track your TV shows and movies. MyAnimeList-style episode counters, backed by TMDB.",
        lang: "en",
        scope: SCOPE,
        start_url: SCOPE,
        display: "standalone",
        orientation: "portrait",
        background_color: "#141b21",
        theme_color: "#141b21",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["client/**/*.{js,css,ico,png,svg,webp,webmanifest}", "prerendered/**/*.html"],
        navigateFallback: `${SCOPE}404.html`,
      },
      kit: {
        includeVersionFile: true,
      },
      devOptions: {
        enabled: false,
        type: "module",
        navigateFallback: "/",
      },
    }),
  ],
});
