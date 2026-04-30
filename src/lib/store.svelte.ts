import { browser } from "$app/environment";
import { idbDelete, idbGet, idbSet } from "./idb";
import type { Entry, Status, Store, TvEntry } from "./types";

const IDB_KEY = "state";
const LEGACY_LS_KEY = "series-tracker:v1";
const SCHEMA_VERSION = 2;
const SEARCH_HISTORY_LIMIT = 8;
const SAVE_DEBOUNCE_MS = 300;

type PersistedV1 = { apiKey?: string | null; library?: Record<string, Entry> };
type PersistedV2 = PersistedV1 & {
  version?: number;
  searchHistory?: string[];
};

const empty: Store = {
  apiKey: null,
  library: {},
  searchHistory: [],
  version: SCHEMA_VERSION,
};

function migrate(parsed: PersistedV2): Store {
  return {
    apiKey: parsed.apiKey ?? null,
    library: parsed.library ?? {},
    searchHistory: parsed.searchHistory ?? [],
    version: SCHEMA_VERSION,
  };
}

function readLegacyLocalStorage(): Store | null {
  try {
    const raw = localStorage.getItem(LEGACY_LS_KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw) as PersistedV2);
  } catch {
    return null;
  }
}

function entryKey(kind: "tv" | "movie", id: number): string {
  return `${kind}:${id}`;
}

function mergeEntries(a: Entry, b: Entry): Entry {
  if (a.kind !== b.kind) return newer(a, b);
  if (a.kind === "tv" && b.kind === "tv") {
    const progress: Record<number, number> = { ...a.progress };
    for (const [k, v] of Object.entries(b.progress)) {
      const n = Number(k);
      progress[n] = Math.max(progress[n] ?? 0, v);
    }
    const seasons = a.seasons.length >= b.seasons.length ? a.seasons : b.seasons;
    const winner = newer(a, b) as TvEntry;
    return {
      ...winner,
      seasons,
      progress,
      updatedAt: latestDate(a.updatedAt, b.updatedAt),
      addedAt: earliestDate(a.addedAt, b.addedAt),
    };
  }
  if (a.kind === "movie" && b.kind === "movie") {
    return {
      ...(newer(a, b) as Entry),
      watched: a.watched || b.watched,
      updatedAt: latestDate(a.updatedAt, b.updatedAt),
      addedAt: earliestDate(a.addedAt, b.addedAt),
    } as Entry;
  }
  return newer(a, b);
}

function newer(a: Entry, b: Entry): Entry {
  return (a.updatedAt ?? "") >= (b.updatedAt ?? "") ? a : b;
}
function latestDate(a: string, b: string): string {
  return a >= b ? a : b;
}
function earliestDate(a: string, b: string): string {
  return a <= b ? a : b;
}

function createStore() {
  const state = $state<Store>(structuredClone(empty));
  const meta = $state({ loaded: !browser, error: null as string | null, migratedFromLs: false });

  if (browser) {
    void (async () => {
      try {
        let data = await idbGet<PersistedV2>(IDB_KEY);
        if (!data) {
          const legacy = readLegacyLocalStorage();
          if (legacy) {
            data = legacy;
            await idbSet(IDB_KEY, legacy);
            try {
              localStorage.removeItem(LEGACY_LS_KEY);
            } catch {
              // ignore
            }
            meta.migratedFromLs = true;
          }
        }
        const next = data ? migrate(data) : structuredClone(empty);
        state.apiKey = next.apiKey;
        state.library = next.library;
        state.searchHistory = next.searchHistory;
        state.version = next.version;
      } catch (e) {
        meta.error = e instanceof Error ? e.message : String(e);
        console.error("[store] IDB load failed", e);
      } finally {
        meta.loaded = true;
      }
    })();

    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    $effect.root(() => {
      $effect(() => {
        // track all top-level fields
        void state.apiKey;
        void state.library;
        void state.searchHistory;
        void state.version;
        if (!meta.loaded) return;
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          const snapshot: Store = {
            apiKey: state.apiKey,
            library: $state.snapshot(state.library) as Record<string, Entry>,
            searchHistory: [...state.searchHistory],
            version: state.version,
          };
          void idbSet(IDB_KEY, snapshot).catch((e) => {
            meta.error = e instanceof Error ? e.message : String(e);
            console.error("[store] IDB save failed", e);
          });
        }, SAVE_DEBOUNCE_MS);
      });
    });
  }

  return {
    get loaded() {
      return meta.loaded;
    },
    get error() {
      return meta.error;
    },
    get migratedFromLs() {
      return meta.migratedFromLs;
    },
    get apiKey() {
      return state.apiKey;
    },
    get library() {
      return state.library;
    },
    get entries(): Entry[] {
      return Object.values(state.library);
    },
    get searchHistory(): string[] {
      return state.searchHistory;
    },

    has(kind: "tv" | "movie", id: number): boolean {
      return entryKey(kind, id) in state.library;
    },

    get(kind: "tv" | "movie", id: number): Entry | undefined {
      return state.library[entryKey(kind, id)];
    },

    setApiKey(v: string | null) {
      state.apiKey = v?.trim() || null;
    },

    addToLibrary(entry: Entry) {
      state.library[entryKey(entry.kind, entry.id)] = entry;
    },

    removeFromLibrary(kind: "tv" | "movie", id: number) {
      delete state.library[entryKey(kind, id)];
    },

    updateProgress(showId: number, season: number, delta: number) {
      const e = state.library[entryKey("tv", showId)];
      if (!e || e.kind !== "tv") return;
      const s = e.seasons.find((x) => x.number === season);
      if (!s) return;
      const next = (e.progress[season] ?? 0) + delta;
      e.progress[season] = Math.max(0, Math.min(s.episodeCount, next));
      e.updatedAt = new Date().toISOString();
      const allDone = e.seasons.every((x) => (e.progress[x.number] ?? 0) === x.episodeCount);
      const anyProgress = Object.values(e.progress).some((v) => v > 0);
      if (allDone) e.status = "completed";
      else if (anyProgress && (e.status === "plan" || e.status === "completed")) e.status = "watching";
    },

    setProgress(showId: number, season: number, value: number) {
      const e = state.library[entryKey("tv", showId)];
      if (!e || e.kind !== "tv") return;
      const s = e.seasons.find((x) => x.number === season);
      if (!s) return;
      e.progress[season] = Math.max(0, Math.min(s.episodeCount, Math.floor(value || 0)));
      e.updatedAt = new Date().toISOString();
    },

    incrementCurrent(showId: number): boolean {
      const e = state.library[entryKey("tv", showId)];
      if (!e || e.kind !== "tv") return false;
      for (const s of e.seasons) {
        const cur = e.progress[s.number] ?? 0;
        if (cur < s.episodeCount) {
          this.updateProgress(showId, s.number, 1);
          return true;
        }
      }
      return false;
    },

    setStatus(kind: "tv" | "movie", id: number, status: Status) {
      const e = state.library[entryKey(kind, id)];
      if (!e) return;
      e.status = status;
      e.updatedAt = new Date().toISOString();
    },

    setMovieWatched(id: number, watched: boolean) {
      const e = state.library[entryKey("movie", id)];
      if (!e || e.kind !== "movie") return;
      e.watched = watched;
      if (watched && e.status !== "dropped") e.status = "completed";
      e.updatedAt = new Date().toISOString();
    },

    pushSearchHistory(query: string) {
      const q = query.trim();
      if (!q) return;
      const next = [q, ...state.searchHistory.filter((x) => x.toLowerCase() !== q.toLowerCase())];
      state.searchHistory = next.slice(0, SEARCH_HISTORY_LIMIT);
    },

    clearSearchHistory() {
      state.searchHistory = [];
    },

    exportJson(): string {
      return JSON.stringify(
        {
          version: SCHEMA_VERSION,
          apiKey: state.apiKey,
          library: state.library,
          searchHistory: state.searchHistory,
        },
        null,
        2
      );
    },

    importJson(text: string, mode: "replace" | "merge" = "replace"): { added: number; merged: number; total: number } {
      const parsed = migrate(JSON.parse(text) as PersistedV2);
      let added = 0;
      let merged = 0;

      if (mode === "replace") {
        if (parsed.apiKey !== null) state.apiKey = parsed.apiKey;
        state.library = parsed.library;
        state.searchHistory = parsed.searchHistory;
        added = Object.keys(parsed.library).length;
      } else {
        if (!state.apiKey && parsed.apiKey) state.apiKey = parsed.apiKey;
        for (const [key, incoming] of Object.entries(parsed.library)) {
          const existing = state.library[key];
          if (!existing) {
            state.library[key] = incoming;
            added++;
          } else {
            state.library[key] = mergeEntries(existing, incoming);
            merged++;
          }
        }
        const seen = new Set(state.searchHistory.map((s) => s.toLowerCase()));
        for (const q of parsed.searchHistory) {
          if (!seen.has(q.toLowerCase())) {
            state.searchHistory.push(q);
            seen.add(q.toLowerCase());
          }
        }
        state.searchHistory = state.searchHistory.slice(0, SEARCH_HISTORY_LIMIT);
      }

      return { added, merged, total: Object.keys(state.library).length };
    },

    wipeLibrary() {
      state.library = {};
    },

    async wipeAll() {
      state.apiKey = null;
      state.library = {};
      state.searchHistory = [];
      state.version = SCHEMA_VERSION;
      try {
        await idbDelete(IDB_KEY);
      } catch (e) {
        console.error("[store] wipe failed", e);
      }
    },
  };
}

export const store = createStore();
