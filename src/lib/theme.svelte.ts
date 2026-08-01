import { browser } from "$app/environment";
import { store } from "./store.svelte";
import type { Theme } from "./types";

/** localStorage key the inline boot script in `src/app.html` reads to stamp
 *  the html class before first paint. Mirror of `Preferences.theme` so the
 *  initial paint isn't blocked on the async IDB load. */
const LS_KEY = "series-tracker:theme";
/** Hex paint colours for the meta theme-color tag. These are the brand
 *  `background` token in each mode — the same value `--brand-page` resolves
 *  to — so the PWA browser chrome blends with the page bg on iOS / Android.
 *  Hardcoded because <meta> can't read CSS vars; mirror of the boot script
 *  in `src/app.html`, keep the two in sync. */
const THEME_COLOR = { dark: "#17252c", light: "#f5ecdc" } as const;

/** Resolve the user's saved preference into a concrete theme. "auto"
 *  consults the system; explicit picks pass through. Used both at startup
 *  and on every preference change. */
function resolve(pref: Theme): "light" | "dark" {
  if (pref === "auto") {
    return browser && window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }
  return pref;
}

function applyClass(resolved: "light" | "dark"): void {
  const html = document.documentElement;
  html.classList.toggle("theme-light", resolved === "light");
  html.classList.toggle("theme-dark", resolved === "dark");
}

/** Update (or create) the `<meta name="theme-color">` tag. iOS / Android
 *  PWAs use this to colour the browser chrome around the app — without an
 *  update on theme switch the chrome stays at whichever value app.html
 *  shipped with. */
function applyMeta(resolved: "light" | "dark"): void {
  let tag = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement("meta");
    tag.name = "theme-color";
    document.head.appendChild(tag);
  }
  tag.content = THEME_COLOR[resolved];
}

function createTheme() {
  // `pref` is what the user picked. `resolved` is what's actually applied —
  // they diverge for "auto" (and re-resolve when the system pref flips).
  // Default is "dark" rather than "auto" because dark IS the brand — light is
  // a product-UI twin, held to the same contrast contract but not an identity
  // palette. New users shouldn't be flipped out of the brand just because
  // their OS is on light. They opt in explicitly via Settings.
  let pref = $state<Theme>("dark");
  let resolved = $state<"light" | "dark">("dark");

  let mediaQuery: MediaQueryList | null = null;
  let mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

  function apply(): void {
    const next = resolve(pref);
    resolved = next;
    if (browser) {
      applyClass(next);
      applyMeta(next);
    }
  }

  return {
    get pref() {
      return pref;
    },
    get resolved() {
      return resolved;
    },

    /** Initialise from the saved preference. Called once from
     *  `+layout.svelte`'s onMount. The boot script in app.html has already
     *  stamped the html class for the first paint based on localStorage —
     *  this fills in the in-memory state, syncs from IDB once it loads,
     *  and wires the system-pref listener for "auto" mode. */
    init(): void {
      if (!browser) return;
      // Seed from localStorage immediately so `theme.pref` matches what the
      // boot script applied — no flash from "auto" → "dark" while IDB
      // catches up.
      try {
        const cached = localStorage.getItem(LS_KEY);
        if (cached === "light" || cached === "dark" || cached === "auto") {
          pref = cached;
        }
      } catch {
        // ignore — private mode / quota issues fall through to the default
      }
      apply();

      // System-pref listener — only meaningful for "auto" mode but kept
      // wired permanently so toggling pref to "auto" later picks up the
      // current system state without a reload.
      mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
      mediaListener = () => {
        if (pref === "auto") apply();
      };
      mediaQuery.addEventListener("change", mediaListener);

      // IDB sync — when the store finishes loading, prefer the saved
      // Preferences.theme over whatever localStorage had (in case the user
      // imported a backup from another device with a different override).
      $effect.root(() => {
        $effect(() => {
          if (!store.loaded) return;
          const saved = store.preferences.theme;
          if (saved && saved !== pref) {
            pref = saved;
            try {
              localStorage.setItem(LS_KEY, saved);
            } catch {
              // ignore
            }
            apply();
          }
        });
      });
    },

    set(next: Theme): void {
      if (next === pref) return;
      pref = next;
      store.setPreference("theme", next);
      if (browser) {
        try {
          localStorage.setItem(LS_KEY, next);
        } catch {
          // ignore
        }
        apply();
      }
    },

    /** Cleanup — only used in tests. The system-pref listener is otherwise
     *  bound for the lifetime of the page. */
    destroy(): void {
      if (mediaQuery && mediaListener) {
        mediaQuery.removeEventListener("change", mediaListener);
        mediaQuery = null;
        mediaListener = null;
      }
    },
  };
}

export const theme = createTheme();
