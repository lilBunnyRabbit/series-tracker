import { browser, dev } from "$app/environment";
import { base } from "$app/paths";

export type VersionInfo = {
  version: string;
  commit: string;
  branch: string;
  buildTime: string;
  buildTimestamp: number;
};

const POLL_INTERVAL_MS = 30 * 60 * 1000;
const VISIBILITY_THROTTLE_MS = 60 * 1000;

// `current` is the manifest bundled into THIS JS at build time — it's the
// version actually running in this tab, regardless of what the server has
// since deployed. Comparing it against the freshly-fetched `latest` is the
// whole detection mechanism.
const BUILT_IN: VersionInfo = __VERSION_MANIFEST__;

const state = $state<{
  current: VersionInfo;
  latest: VersionInfo | null;
  swReady: boolean;
  lastCheck: number;
  checking: boolean;
  dismissedTimestamp: number | null;
  initialized: boolean;
}>({
  current: BUILT_IN,
  latest: null,
  swReady: false,
  lastCheck: 0,
  checking: false,
  dismissedTimestamp: null,
  initialized: false,
});

let updateSWFn: ((reload?: boolean) => Promise<void>) | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

export const version = state;

async function fetchVersion(): Promise<VersionInfo | null> {
  try {
    // `cache: "no-store"` for the browser cache; `?t=` defeats any
    // intermediary CDN that ignores the header.
    const res = await fetch(`${base}/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<VersionInfo>;
    if (typeof data?.buildTimestamp !== "number" || typeof data?.version !== "string") return null;
    return data as VersionInfo;
  } catch {
    return null;
  }
}

export async function checkForUpdate(): Promise<"updated" | "current" | "error"> {
  if (!browser) return "current";
  if (state.checking) return "current";
  state.checking = true;
  try {
    const info = await fetchVersion();
    state.lastCheck = Date.now();
    if (!info) return "error";
    state.latest = info;
    return info.buildTimestamp !== state.current.buildTimestamp ? "updated" : "current";
  } finally {
    state.checking = false;
  }
}

function onVisibility(): void {
  if (document.visibilityState !== "visible") return;
  if (Date.now() - state.lastCheck < VISIBILITY_THROTTLE_MS) return;
  void checkForUpdate();
}

export function init(): void {
  if (!browser || state.initialized) return;
  state.initialized = true;
  // Strip the cache-bust query param applyUpdate added on the previous load.
  // Done with replaceState so the URL stays clean without re-fetching.
  if (typeof location !== "undefined" && location.search.includes("__upd=")) {
    try {
      const u = new URL(location.href);
      u.searchParams.delete("__upd");
      history.replaceState(null, "", u.pathname + u.search + u.hash);
    } catch {
      // ignore
    }
  }
  // In `vite dev`, the bundled manifest is the "dev" sentinel and there's no
  // deploy to detect — skip polling entirely so console isn't spammed with
  // 404s for /version.json.
  if (dev) return;
  void checkForUpdate();
  pollTimer = setInterval(() => void checkForUpdate(), POLL_INTERVAL_MS);
  document.addEventListener("visibilitychange", onVisibility);
}

export function wireSW(updateSW: (reload?: boolean) => Promise<void>): void {
  updateSWFn = updateSW;
}

export function markSWReady(): void {
  state.swReady = true;
}

export async function applyUpdate(): Promise<void> {
  // Happy path: SW reported a waiting worker via onNeedRefresh. Let the
  // plugin-pwa updater swap the SW and reload — it handles skipWaiting +
  // controllerchange races correctly.
  if (updateSWFn && state.swReady) {
    try {
      await updateSWFn(true);
      // updateSW(true) reloads on success; if we're still here after a beat,
      // the controllerchange race lost — fall through to the hard-refresh path.
      await new Promise((r) => setTimeout(r, 800));
    } catch {
      // fall through to hard refresh
    }
  }

  // Hard-refresh fallback. Used when:
  //   - version.json reports a new build but the SW hasn't installed it yet,
  //     so updateSWFn would be a no-op; or
  //   - updateSW(true) didn't reload for whatever reason (browser quirk,
  //     blocked controllerchange event, etc.).
  // Unregistering forces the next page load to bootstrap from the network
  // and re-register a fresh SW, which is the only reliable way to escape
  // a stale precache when the install cycle hasn't completed.
  if ("serviceWorker" in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch {
      // best-effort
    }
  }
  if ("caches" in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {
      // best-effort
    }
  }

  // Cache-bust the navigation itself: some browsers will replay the old
  // navigation request from disk cache on a vanilla reload, even with the SW
  // gone. A query-param swap forces a fresh document fetch.
  try {
    const u = new URL(location.href);
    u.searchParams.set("__upd", String(Date.now()));
    location.replace(u.toString());
  } catch {
    location.reload();
  }
}

export function dismiss(): void {
  state.dismissedTimestamp = state.latest?.buildTimestamp ?? null;
}

export function isUpdateAvailable(): boolean {
  // SW signal trumps version.json: it means a new SW is installed and waiting,
  // even if the user hasn't visited /version.json yet.
  if (state.swReady) {
    const target = state.latest?.buildTimestamp ?? -1;
    return state.dismissedTimestamp !== target;
  }
  if (!state.latest) return false;
  if (state.current.buildTimestamp === state.latest.buildTimestamp) return false;
  return state.dismissedTimestamp !== state.latest.buildTimestamp;
}
