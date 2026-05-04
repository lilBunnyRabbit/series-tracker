import { browser } from "$app/environment";
import { idbDelete, idbGet, idbSet } from "./idb";
import { effectiveSeasons } from "./types";
import type { ActionEntry, ActionType, DiaryEntry, Entry, Preferences, Season, Status, Store, TvEntry } from "./types";

const IDB_KEY = "state";
const LEGACY_LS_KEY = "series-tracker:v1";
const SCHEMA_VERSION = 6;
const SEARCH_HISTORY_LIMIT = 8;
const ACTIONS_LIMIT = 200;
const SAVE_DEBOUNCE_MS = 300;

type PersistedV1 = { apiKey?: string | null; library?: Record<string, Entry> };
type PersistedV2 = PersistedV1 & {
  version?: number;
  searchHistory?: string[];
};
type PersistedV3 = PersistedV2 & {
  preferences?: Preferences;
};
type PersistedV4 = PersistedV3 & {
  diary?: DiaryEntry[];
};
// V5 — added optional `rewatchable: boolean` to TvEntry / MovieEntry. No
// migration logic needed: undefined is the falsy default, and the field is
// purely additive. The version bump is the marker so future migrations can
// branch from here.
type PersistedV5 = PersistedV4;
// V6 — added `actions: ActionEntry[]` for the activity log. Additive: missing
// field defaults to []. Capped at ACTIONS_LIMIT inside the store.
type PersistedV6 = PersistedV5 & {
  actions?: ActionEntry[];
};

const empty: Store = {
  apiKey: null,
  library: {},
  searchHistory: [],
  preferences: {},
  diary: [],
  actions: [],
  version: SCHEMA_VERSION,
};

function migrate(parsed: PersistedV6): Store {
  return {
    apiKey: parsed.apiKey ?? null,
    library: parsed.library ?? {},
    searchHistory: parsed.searchHistory ?? [],
    preferences: parsed.preferences ?? {},
    diary: parsed.diary ?? [],
    actions: (parsed.actions ?? []).slice(0, ACTIONS_LIMIT),
    version: SCHEMA_VERSION,
  };
}

function makeDiaryId(): string {
  // Sortable-ish: timestamp-prefixed + 6 random base36 chars. Cheap, no deps.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeActionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readLegacyLocalStorage(): Store | null {
  try {
    const raw = localStorage.getItem(LEGACY_LS_KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw) as PersistedV6);
  } catch {
    return null;
  }
}

function entryKey(kind: "tv" | "movie", id: number): string {
  return `${kind}:${id}`;
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

/** Drops any explicit per-episode set for `season`. Used whenever a
 *  contiguous-mode action (tap-to-here, complete, reset, +/- in counter mode)
 *  fires — the season's representation reverts to the cheaper progress
 *  counter alone. */
function clearExplicit(e: TvEntry, season: number): void {
  if (!e.watchedEpisodes) return;
  if (!(season in e.watchedEpisodes)) return;
  delete e.watchedEpisodes[season];
  if (Object.keys(e.watchedEpisodes).length === 0) delete e.watchedEpisodes;
}

/** Materialise the current watched set for a season, regardless of whether
 *  the entry is in counter or explicit mode. Counter mode produces {1..N}; in
 *  explicit mode we return a copy so callers can mutate without aliasing the
 *  stored array. */
function currentWatchedSet(e: TvEntry, season: number): Set<number> {
  const explicit = e.watchedEpisodes?.[season];
  if (explicit && explicit.length > 0) return new Set(explicit);
  const out = new Set<number>();
  const cur = e.progress[season] ?? 0;
  for (let i = 1; i <= cur; i++) out.add(i);
  return out;
}

/** Persist a watched set for a season. Detects contiguous-from-E1 sets and
 *  collapses them back into counter mode so the entry's storage stays compact
 *  for the common case. Always keeps `progress[season]` equal to the watched
 *  count so existing display code (which reads progress as a count) is
 *  unaffected. */
function applyWatchedSet(e: TvEntry, season: number, set: Set<number>): void {
  const sorted = [...set].sort((a, b) => a - b);
  const isContig = sorted.every((n, i) => n === i + 1);
  if (isContig) {
    e.progress[season] = sorted.length;
    clearExplicit(e, season);
    return;
  }
  e.watchedEpisodes ??= {};
  e.watchedEpisodes[season] = sorted;
  e.progress[season] = sorted.length;
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
      ...newer(a, b),
      watched: a.watched || b.watched,
      updatedAt: latestDate(a.updatedAt, b.updatedAt),
      addedAt: earliestDate(a.addedAt, b.addedAt),
    } as Entry;
  }
  return newer(a, b);
}

function createStore() {
  const state = $state<Store>(structuredClone(empty));
  const meta = $state({ loaded: !browser, error: null as string | null, migratedFromLs: false });

  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  function flushPendingSave(): void {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    const snapshot = $state.snapshot(state) as Store;
    void idbSet(IDB_KEY, snapshot).catch((e) => {
      meta.error = e instanceof Error ? e.message : String(e);
      console.error("[store] IDB save failed", e);
    });
  }

  if (browser) {
    void (async () => {
      try {
        let data = await idbGet<PersistedV6>(IDB_KEY);
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
        state.preferences = next.preferences;
        state.diary = next.diary;
        state.actions = next.actions;
        state.version = next.version;
      } catch (e) {
        meta.error = e instanceof Error ? e.message : String(e);
        console.error("[store] IDB load failed", e);
      } finally {
        meta.loaded = true;
      }
    })();

    $effect.root(() => {
      $effect(() => {
        // $state.snapshot traverses every property, so any nested mutation
        // (e.g. state.library[key] = entry) registers a dep and fires this effect.
        const snapshot = $state.snapshot(state) as Store;
        if (!meta.loaded) return;
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          saveTimer = null;
          void idbSet(IDB_KEY, snapshot).catch((e) => {
            meta.error = e instanceof Error ? e.message : String(e);
            console.error("[store] IDB save failed", e);
          });
        }, SAVE_DEBOUNCE_MS);
      });
    });

    window.addEventListener("beforeunload", flushPendingSave);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushPendingSave();
    });
  }

  function withTimestamp<T extends { updatedAt: string }>(e: T): T {
    e.updatedAt = new Date().toISOString();
    return e;
  }

  /** Snapshot the current entry under (kind, id) for use as `prev` on an
   *  ActionEntry. Must be called BEFORE the mutation runs, otherwise we
   *  capture the post-mutation state. structuredClone keeps the snapshot
   *  immune to subsequent in-place mutation. */
  function snapshotEntry(kind: "tv" | "movie", id: number): Entry | undefined {
    const e = state.library[entryKey(kind, id)];
    return e ? structuredClone($state.snapshot(e)) : undefined;
  }

  /** Append an action to the activity log, trimming to ACTIONS_LIMIT. */
  function pushAction(input: {
    type: ActionType;
    kind: "tv" | "movie";
    refId: number;
    title: string;
    poster?: string | null;
    meta?: { season?: number; episode?: number };
    prev?: Entry;
  }): void {
    const action: ActionEntry = {
      id: makeActionId(),
      createdAt: new Date().toISOString(),
      ...input,
    };
    state.actions.unshift(action);
    if (state.actions.length > ACTIONS_LIMIT) {
      state.actions.length = ACTIONS_LIMIT;
    }
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
    get preferences(): Preferences {
      return state.preferences;
    },
    get diary(): DiaryEntry[] {
      return state.diary;
    },
    get actions(): ActionEntry[] {
      return state.actions;
    },

    setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
      if (value === null || value === undefined) {
        delete state.preferences[key];
      } else {
        state.preferences[key] = value;
      }
    },

    /** Diary entries for a given title, newest first. */
    diaryFor(kind: "tv" | "movie", id: number): DiaryEntry[] {
      return state.diary
        .filter((d) => d.kind === kind && d.refId === id)
        .sort((a, b) => (b.watchedAt + b.createdAt).localeCompare(a.watchedAt + a.createdAt));
    },

    addDiary(input: Omit<DiaryEntry, "id" | "createdAt">): DiaryEntry {
      const entry: DiaryEntry = {
        ...input,
        id: makeDiaryId(),
        createdAt: new Date().toISOString(),
      };
      state.diary.push(entry);
      return entry;
    },

    updateDiary(id: string, patch: Partial<Omit<DiaryEntry, "id" | "createdAt">>): void {
      const idx = state.diary.findIndex((d) => d.id === id);
      if (idx === -1) return;
      state.diary[idx] = { ...state.diary[idx], ...patch };
    },

    removeDiary(id: string): void {
      state.diary = state.diary.filter((d) => d.id !== id);
    },

    /** Synthesize one diary entry per completed entry, dated to its updatedAt.
     *  Skip any title that already has at least one diary entry — backfill
     *  shouldn't create duplicates. Returns the count of entries added. */
    backfillDiary(): number {
      const seen = new Set(state.diary.map((d) => `${d.kind}:${d.refId}`));
      let added = 0;
      const now = new Date().toISOString();
      for (const e of Object.values(state.library)) {
        if (e.status !== "completed") continue;
        const key = `${e.kind}:${e.id}`;
        if (seen.has(key)) continue;
        const watchedAt = (e.updatedAt ?? now).slice(0, 10);
        const entry: DiaryEntry = {
          id: makeDiaryId(),
          kind: e.kind,
          refId: e.id,
          title: e.title,
          poster: e.poster,
          watchedAt,
          rating: e.rating,
          createdAt: now,
        };
        // For TV, mark the full season range so the entry reads as "all of it".
        if (e.kind === "tv" && e.seasons.length > 0) {
          const totalEps = e.seasons.reduce((a, s) => a + s.episodeCount, 0);
          entry.season = e.seasons[0].number;
          entry.fromEp = 1;
          entry.toEp = totalEps;
        }
        state.diary.push(entry);
        seen.add(key);
        added++;
      }
      return added;
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
      const key = entryKey(entry.kind, entry.id);
      const existed = state.library[key];
      state.library[key] = entry;
      // Treat re-add of an existing entry as a no-op for the activity log —
      // prevents flicker-add/remove flows or import paths from doubling rows.
      if (existed) return;
      pushAction({
        type: "add",
        kind: entry.kind,
        refId: entry.id,
        title: entry.title,
        poster: entry.poster,
      });
    },

    removeFromLibrary(kind: "tv" | "movie", id: number) {
      const prev = snapshotEntry(kind, id);
      if (!prev) return;
      delete state.library[entryKey(kind, id)];
      pushAction({
        type: "remove",
        kind,
        refId: id,
        title: prev.title,
        poster: prev.poster,
        prev,
      });
    },

    updateProgress(showId: number, season: number, delta: number) {
      const e = state.library[entryKey("tv", showId)];
      if (!e || e.kind !== "tv") return;
      const s = e.seasons.find((x) => x.number === season);
      if (!s) return;
      const prev = snapshotEntry("tv", showId);
      const prevCount = e.progress[season] ?? 0;
      // Honour any explicit set: +1 fills the lowest-numbered unwatched ep
      // (advancing toward contiguous), -1 drops the highest watched. We
      // recompute progress as the watched count and re-evaluate whether the
      // resulting set is now contiguous from E1 — if so, the explicit set is
      // dropped in favour of the cheaper counter representation.
      const explicit = e.watchedEpisodes?.[season];
      if (explicit && explicit.length > 0 && delta !== 0) {
        const set = new Set(explicit);
        if (delta > 0) {
          for (let i = 1; i <= s.episodeCount; i++) {
            if (!set.has(i)) {
              set.add(i);
              break;
            }
          }
        } else {
          let max = 0;
          for (const v of set) if (v > max) max = v;
          if (max > 0) set.delete(max);
        }
        applyWatchedSet(e, season, set);
      } else {
        const next = (e.progress[season] ?? 0) + delta;
        e.progress[season] = Math.max(0, Math.min(s.episodeCount, next));
      }
      const newCount = e.progress[season] ?? 0;
      if (newCount === prevCount) return;
      withTimestamp(e);
      // Completion is judged against the seasons that count for this show —
      // specials are excluded unless includeSpecials is on.
      const counted = effectiveSeasons(e);
      const allDone = counted.length > 0 && counted.every((x) => (e.progress[x.number] ?? 0) === x.episodeCount);
      const anyProgress = Object.values(e.progress).some((v) => v > 0);
      if (allDone) e.status = "completed";
      else if (anyProgress && (e.status === "plan" || e.status === "completed")) e.status = "watching";
      else if (!anyProgress && e.status === "completed") e.status = "watching";
      pushAction({
        type: "progress",
        kind: "tv",
        refId: showId,
        title: e.title,
        poster: e.poster,
        meta: { season, episode: newCount },
        prev,
      });
    },

    setProgress(showId: number, season: number, value: number) {
      const e = state.library[entryKey("tv", showId)];
      if (!e || e.kind !== "tv") return;
      const s = e.seasons.find((x) => x.number === season);
      if (!s) return;
      const prev = snapshotEntry("tv", showId);
      const prevCount = e.progress[season] ?? 0;
      const prevExplicit = e.watchedEpisodes?.[season];
      // setProgress is the explicit "I've watched the first N" lever (used by
      // the row tap, the +/- island when contiguous, and the manual input).
      // It always produces a contiguous {1..N} state — drop any explicit set
      // for this season so the season's representation is clean.
      e.progress[season] = Math.max(0, Math.min(s.episodeCount, Math.floor(value || 0)));
      clearExplicit(e, season);
      const newCount = e.progress[season] ?? 0;
      // Treat collapsing an explicit set into the same numeric count as a
      // change worth logging (representation flipped), but a true no-op (same
      // count, no explicit set to drop) is silent.
      if (newCount === prevCount && !prevExplicit) return;
      withTimestamp(e);
      const counted = effectiveSeasons(e);
      const allDone = counted.length > 0 && counted.every((x) => (e.progress[x.number] ?? 0) === x.episodeCount);
      const anyProgress = Object.values(e.progress).some((v) => v > 0);
      if (allDone) e.status = "completed";
      else if (anyProgress && (e.status === "plan" || e.status === "completed")) e.status = "watching";
      pushAction({
        type: "progress",
        kind: "tv",
        refId: showId,
        title: e.title,
        poster: e.poster,
        meta: { season, episode: newCount },
        prev,
      });
    },

    /** Toggle a single episode's watched state without affecting the others.
     *  If the toggle leaves the season as a contiguous run from E1 (e.g. the
     *  user only ever ticks E1..EN in order) the season falls back to counter
     *  mode; otherwise the explicit set is persisted on the entry. */
    toggleEpisode(showId: number, season: number, episodeNumber: number) {
      const e = state.library[entryKey("tv", showId)];
      if (!e || e.kind !== "tv") return;
      const s = e.seasons.find((x) => x.number === season);
      if (!s) return;
      if (episodeNumber < 1 || episodeNumber > s.episodeCount) return;
      const prev = snapshotEntry("tv", showId);
      const set = currentWatchedSet(e, season);
      if (set.has(episodeNumber)) set.delete(episodeNumber);
      else set.add(episodeNumber);
      applyWatchedSet(e, season, set);
      withTimestamp(e);
      const counted = effectiveSeasons(e);
      const allDone = counted.length > 0 && counted.every((x) => (e.progress[x.number] ?? 0) === x.episodeCount);
      const anyProgress = Object.values(e.progress).some((v) => v > 0);
      if (allDone) e.status = "completed";
      else if (anyProgress && (e.status === "plan" || e.status === "completed")) e.status = "watching";
      else if (!anyProgress && e.status === "completed") e.status = "watching";
      pushAction({
        type: "episode-toggle",
        kind: "tv",
        refId: showId,
        title: e.title,
        poster: e.poster,
        meta: { season, episode: episodeNumber },
        prev,
      });
    },

    completeSeason(showId: number, season: number) {
      const e = state.library[entryKey("tv", showId)];
      if (!e || e.kind !== "tv") return;
      const s = e.seasons.find((x) => x.number === season);
      if (!s) return;
      // No-op when the season is already at episodeCount with no explicit set
      // — common when the row is tapped twice or "Mark caught up" lands on a
      // season already fully watched.
      const prevCount = e.progress[season] ?? 0;
      const hadExplicit = !!e.watchedEpisodes?.[season];
      if (prevCount === s.episodeCount && !hadExplicit) return;
      const prev = snapshotEntry("tv", showId);
      e.progress[season] = s.episodeCount;
      clearExplicit(e, season);
      withTimestamp(e);
      const counted = effectiveSeasons(e);
      const allDone = counted.length > 0 && counted.every((x) => (e.progress[x.number] ?? 0) === x.episodeCount);
      if (allDone) e.status = "completed";
      else if (e.status === "plan") e.status = "watching";
      pushAction({
        type: "season-complete",
        kind: "tv",
        refId: showId,
        title: e.title,
        poster: e.poster,
        meta: { season },
        prev,
      });
    },

    resetSeason(showId: number, season: number) {
      const e = state.library[entryKey("tv", showId)];
      if (!e || e.kind !== "tv") return;
      const prevCount = e.progress[season] ?? 0;
      const hadExplicit = !!e.watchedEpisodes?.[season];
      if (prevCount === 0 && !hadExplicit) return;
      const prev = snapshotEntry("tv", showId);
      e.progress[season] = 0;
      clearExplicit(e, season);
      withTimestamp(e);
      // Reset must demote from completed whenever the show is no longer fully
      // done — not just when every season is empty. Otherwise resetting one
      // season of a 3-season "completed" show keeps the (now-stale) completed
      // badge. Mirrors the allDone check in updateProgress/setProgress.
      const counted = effectiveSeasons(e);
      const allDone = counted.length > 0 && counted.every((x) => (e.progress[x.number] ?? 0) === x.episodeCount);
      if (!allDone && e.status === "completed") e.status = "watching";
      pushAction({
        type: "season-reset",
        kind: "tv",
        refId: showId,
        title: e.title,
        poster: e.poster,
        meta: { season },
        prev,
      });
    },

    incrementCurrent(showId: number): boolean {
      const e = state.library[entryKey("tv", showId)];
      if (!e || e.kind !== "tv") return false;
      // Walk only the seasons that count for this show — skip specials when
      // they're excluded so "+1 episode" never lands inside specials by
      // accident on a show the user has otherwise finished.
      for (const s of effectiveSeasons(e)) {
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
      if (e.status === status) return;
      const prev = snapshotEntry(kind, id);
      e.status = status;
      // For movies, "watched" mirrors status === "completed". Keep them aligned
      // so any legacy export that still ships `watched` stays consistent.
      if (e.kind === "movie") e.watched = status === "completed";
      // For TV, "completed" implies every counted episode watched — fill
      // progress for the seasons that count and drop any explicit per-episode
      // sets (a fully-watched season is contiguous by definition). Specials
      // stay at their current value (typically 0) unless the user has opted
      // into tracking them.
      if (e.kind === "tv" && status === "completed") {
        for (const s of effectiveSeasons(e)) {
          e.progress[s.number] = s.episodeCount;
          clearExplicit(e, s.number);
        }
      }
      withTimestamp(e);
      pushAction({
        type: "status",
        kind,
        refId: id,
        title: e.title,
        poster: e.poster,
        prev,
      });
    },

    setIncludeSpecials(showId: number, value: boolean) {
      const e = state.library[entryKey("tv", showId)];
      if (!e || e.kind !== "tv") return;
      if ((!!e.includeSpecials) === value) return;
      const prev = snapshotEntry("tv", showId);
      if (value) e.includeSpecials = true;
      else delete e.includeSpecials;
      withTimestamp(e);
      // Toggling can flip completion state in either direction:
      // - turning ON specials: a show that was "completed" without specials
      //   may need to drop back to "watching" if specials are unwatched.
      // - turning OFF specials: a show stuck on "watching" because of
      //   unwatched specials may deserve to auto-promote to "completed".
      const counted = effectiveSeasons(e);
      const allDone = counted.length > 0 && counted.every((s) => (e.progress[s.number] ?? 0) === s.episodeCount);
      if (allDone && e.status !== "completed") e.status = "completed";
      else if (!allDone && e.status === "completed") {
        const anyProgress = Object.values(e.progress).some((v) => v > 0);
        e.status = anyProgress ? "watching" : "plan";
      }
      pushAction({
        type: "specials",
        kind: "tv",
        refId: showId,
        title: e.title,
        poster: e.poster,
        prev,
      });
    },

    // Reconciles a stored TV entry's seasons with a fresh TMDB snapshot. Preserves
    // existing progress (capping any season's count if episodes were removed,
    // dropping progress for seasons that no longer exist). When new episodes
    // appear and the show was marked "completed", demote it to "watching" (or
    // "plan" if nothing was actually watched) so the user notices unwatched eps.
    //
    // Does NOT bump updatedAt — same reasoning as setBackdrop. Sync runs every
    // time a show page is opened, so bumping the timestamp would surface the
    // entry on top of "recently updated" just from viewing it. updatedAt should
    // reflect user edits (status, rating, progress), not background metadata sync.
    syncTvSeasons(showId: number, freshSeasons: Season[]) {
      const e = state.library[entryKey("tv", showId)];
      if (!e || e.kind !== "tv") return;

      const sameShape =
        e.seasons.length === freshSeasons.length &&
        e.seasons.every(
          (s, i) =>
            s.number === freshSeasons[i].number &&
            s.episodeCount === freshSeasons[i].episodeCount &&
            s.name === freshSeasons[i].name
        );
      if (sameShape) return;

      const prevTotal = e.seasons.reduce((a, s) => a + s.episodeCount, 0);
      const newTotal = freshSeasons.reduce((a, s) => a + s.episodeCount, 0);

      const nextProgress: Record<number, number> = {};
      const nextExplicit: Record<number, number[]> = {};
      const validSeasons = new Set(freshSeasons.map((s) => s.number));
      for (const s of freshSeasons) {
        const prev = e.progress[s.number];
        if (prev !== undefined) nextProgress[s.number] = Math.min(prev, s.episodeCount);
        const prevExplicit = e.watchedEpisodes?.[s.number];
        if (prevExplicit) {
          // Drop any episode numbers that no longer exist (count shrank); keep
          // sorted. If the trimmed set is now contiguous from E1 it collapses
          // back to counter mode below.
          const trimmed = prevExplicit.filter((n) => n >= 1 && n <= s.episodeCount);
          const sortedTrimmed = trimmed.sort((a, b) => a - b);
          const isContig = sortedTrimmed.every((n, i) => n === i + 1);
          if (sortedTrimmed.length > 0 && !isContig) {
            nextExplicit[s.number] = sortedTrimmed;
          }
          if (sortedTrimmed.length > 0) nextProgress[s.number] = sortedTrimmed.length;
        }
      }
      // Drop progress entries for seasons that no longer exist (number changed).
      for (const k of Object.keys(nextProgress)) {
        if (!validSeasons.has(Number(k))) delete nextProgress[Number(k)];
      }
      e.seasons = freshSeasons;
      e.progress = nextProgress;
      if (Object.keys(nextExplicit).length > 0) e.watchedEpisodes = nextExplicit;
      else delete e.watchedEpisodes;

      if (newTotal > prevTotal && e.status === "completed") {
        const counted = effectiveSeasons(e);
        const allDone = counted.length > 0 && counted.every((s) => (e.progress[s.number] ?? 0) === s.episodeCount);
        if (!allDone) {
          const anyProgress = Object.values(e.progress).some((v) => v > 0);
          e.status = anyProgress ? "watching" : "plan";
        }
      }
    },

    /** Lazy-fill the backdrop URL on an existing entry. Skips if already set
     *  (we trust the captured URL — TMDB images are stable per id) so this is
     *  a no-op for fresh adds. Does NOT bump updatedAt: backfill is a metadata
     *  detail, not a user edit, and bumping would reorder the watchlist when
     *  users open detail pages. */
    setBackdrop(kind: "tv" | "movie", id: number, url: string | null) {
      const e = state.library[entryKey(kind, id)];
      if (!e || e.backdrop) return;
      e.backdrop = url;
    },

    setRewatchable(kind: "tv" | "movie", id: number, value: boolean) {
      const e = state.library[entryKey(kind, id)];
      if (!e) return;
      if ((!!e.rewatchable) === value) return;
      const prev = snapshotEntry(kind, id);
      if (value) e.rewatchable = true;
      else delete e.rewatchable;
      withTimestamp(e);
      pushAction({
        type: "rewatchable",
        kind,
        refId: id,
        title: e.title,
        poster: e.poster,
        prev,
      });
    },

    setRating(kind: "tv" | "movie", id: number, rating: number | null) {
      const e = state.library[entryKey(kind, id)];
      if (!e) return;
      const next = rating === null ? undefined : Math.max(0, Math.min(10, rating));
      if (e.rating === next) return;
      const prev = snapshotEntry(kind, id);
      if (next === undefined) delete e.rating;
      else e.rating = next;
      withTimestamp(e);
      pushAction({
        type: "rating",
        kind,
        refId: id,
        title: e.title,
        poster: e.poster,
        prev,
      });
    },

    setNotes(kind: "tv" | "movie", id: number, notes: string) {
      const e = state.library[entryKey(kind, id)];
      if (!e) return;
      const trimmed = notes.trim();
      const nextNotes = trimmed ? notes : undefined;
      // Compare against current notes (treat empty/undefined as equivalent).
      const cur = e.notes ?? undefined;
      if (cur === nextNotes) return;
      const prev = snapshotEntry(kind, id);
      if (nextNotes) e.notes = nextNotes;
      else delete e.notes;
      withTimestamp(e);
      pushAction({
        type: "notes",
        kind,
        refId: id,
        title: e.title,
        poster: e.poster,
        prev,
      });
    },

    setSeasonRating(showId: number, season: number, rating: number | null) {
      const e = state.library[entryKey("tv", showId)];
      if (!e || e.kind !== "tv") return;
      const ratings = e.seasonRatings ?? {};
      const next = rating === null ? undefined : Math.max(0, Math.min(10, rating));
      const cur = ratings[season];
      if (cur === next) return;
      const prev = snapshotEntry("tv", showId);
      if (next === undefined) delete ratings[season];
      else ratings[season] = next;
      e.seasonRatings = ratings;
      withTimestamp(e);
      pushAction({
        type: "season-rating",
        kind: "tv",
        refId: showId,
        title: e.title,
        poster: e.poster,
        meta: { season },
        prev,
      });
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

    /** Export library + search history. API key is excluded by default to avoid leaking secrets. */
    exportJson({ includeApiKey = false }: { includeApiKey?: boolean } = {}): string {
      return JSON.stringify(
        {
          version: SCHEMA_VERSION,
          ...(includeApiKey ? { apiKey: state.apiKey } : {}),
          library: state.library,
          searchHistory: state.searchHistory,
          preferences: state.preferences,
          diary: state.diary,
          actions: state.actions,
        },
        null,
        2
      );
    },

    importJson(text: string, mode: "replace" | "merge" = "replace"): { added: number; merged: number; total: number } {
      const parsed = migrate(JSON.parse(text) as PersistedV6);
      let added = 0;
      let merged = 0;

      if (mode === "replace") {
        if (parsed.apiKey !== null) state.apiKey = parsed.apiKey;
        state.library = parsed.library;
        state.searchHistory = parsed.searchHistory;
        state.preferences = parsed.preferences;
        state.diary = parsed.diary;
        state.actions = parsed.actions;
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
        state.preferences = { ...parsed.preferences, ...state.preferences };
        // Diary merge: dedupe by id, keep both sides' entries.
        const haveIds = new Set(state.diary.map((d) => d.id));
        for (const d of parsed.diary) {
          if (!haveIds.has(d.id)) {
            state.diary.push(d);
            haveIds.add(d.id);
          }
        }
        // Actions merge: dedupe by id, then resort by createdAt desc and trim.
        const haveActionIds = new Set(state.actions.map((a) => a.id));
        for (const a of parsed.actions) {
          if (!haveActionIds.has(a.id)) {
            state.actions.push(a);
            haveActionIds.add(a.id);
          }
        }
        state.actions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        if (state.actions.length > ACTIONS_LIMIT) state.actions.length = ACTIONS_LIMIT;
      }

      return { added, merged, total: Object.keys(state.library).length };
    },

    wipeLibrary() {
      state.library = {};
    },

    async wipeAll() {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      state.apiKey = null;
      state.library = {};
      state.searchHistory = [];
      state.preferences = {};
      state.diary = [];
      state.actions = [];
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
