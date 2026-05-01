// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

/// <reference types="@vite-pwa/sveltekit" />
/// <reference types="vite-plugin-pwa/info" />
/// <reference types="vite-plugin-pwa/client" />

declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }

  // Injected by vite.config.ts `define` from static/version.json (built by
  // scripts/gen-version.ts). Available everywhere as a constant — Vite inlines
  // it at build time. See src/lib/version.svelte.ts for the consumer.
  const __VERSION_MANIFEST__: {
    version: string;
    commit: string;
    branch: string;
    buildTime: string;
    buildTimestamp: number;
  };
}

export {};
