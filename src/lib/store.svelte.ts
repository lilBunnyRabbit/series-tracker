import { browser } from "$app/environment";
import type { Entry, Store, Status } from "./types";

const KEY = "series-tracker:v1";

const empty: Store = { apiKey: null, library: {} };

function load(): Store {
  if (!browser) return structuredClone(empty);
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(empty);
    const parsed = JSON.parse(raw) as Partial<Store>;
    return { apiKey: parsed.apiKey ?? null, library: parsed.library ?? {} };
  } catch {
    return structuredClone(empty);
  }
}

function entryKey(kind: "tv" | "movie", id: number): string {
  return `${kind}:${id}`;
}

function createStore() {
  const state = $state<Store>(load());

  if (browser) {
    $effect.root(() => {
      $effect(() => {
        const snapshot = JSON.stringify(state);
        localStorage.setItem(KEY, snapshot);
      });
    });
  }

  return {
    get apiKey() {
      return state.apiKey;
    },
    get library() {
      return state.library;
    },
    get entries(): Entry[] {
      return Object.values(state.library);
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
      if (e.progress[season] === s.episodeCount && e.seasons.every((x) => (e.progress[x.number] ?? 0) === x.episodeCount)) {
        e.status = "completed";
      } else if (Object.values(e.progress).some((v) => v > 0) && e.status === "plan") {
        e.status = "watching";
      }
    },

    setProgress(showId: number, season: number, value: number) {
      const e = state.library[entryKey("tv", showId)];
      if (!e || e.kind !== "tv") return;
      const s = e.seasons.find((x) => x.number === season);
      if (!s) return;
      e.progress[season] = Math.max(0, Math.min(s.episodeCount, Math.floor(value || 0)));
      e.updatedAt = new Date().toISOString();
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
      if (watched && e.status === "plan") e.status = "completed";
      e.updatedAt = new Date().toISOString();
    },

    exportJson(): string {
      return JSON.stringify(state, null, 2);
    },

    importJson(text: string) {
      const parsed = JSON.parse(text) as Partial<Store>;
      if (parsed.apiKey !== undefined) state.apiKey = parsed.apiKey;
      if (parsed.library !== undefined) state.library = parsed.library;
    },
  };
}

export const store = createStore();
