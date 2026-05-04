import { existsSync, readFileSync } from "node:fs";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { SvelteKitPWA } from "@vite-pwa/sveltekit";
import { defineConfig } from "vite";

const BASE = process.env.BASE_PATH ?? "";
const SCOPE = `${BASE}/`;

// Read the manifest written by scripts/gen-version.ts (chained before `vite build`).
// Bundled into the client so version.svelte.ts can know the *running* version
// without needing to fetch — the network fetch only tells us what's *deployed*.
const VERSION_MANIFEST = (() => {
  const path = "./static/version.json";
  if (existsSync(path)) {
    try {
      return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    } catch {
      // fall through
    }
  }
  return { version: "dev", commit: "dev", branch: "dev", buildTime: "", buildTimestamp: 0 };
})();

export default defineConfig({
  define: {
    __VERSION_MANIFEST__: JSON.stringify(VERSION_MANIFEST),
  },
  plugins: [
    tailwindcss(),
    sveltekit(),
    SvelteKitPWA({
      // "prompt" — we surface updates via UpdateToast + Settings instead of
      // silently swapping the SW under the user. See src/lib/version.svelte.ts.
      registerType: "prompt",
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
        // Lets the OS / other apps surface "Series Tracker" in the system
        // share sheet. Method=GET keeps the route prerenderable: the receiver
        // route reads query params on the client and routes to the matching
        // show/movie page (or falls back to a search). Android has full
        // support; iOS/Safari is partial today.
        share_target: {
          action: `${SCOPE}share/`,
          method: "GET",
          params: {
            title: "title",
            text: "text",
            url: "url",
          },
        },
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
