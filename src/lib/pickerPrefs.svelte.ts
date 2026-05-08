// Lightweight runtime-only state for picker UX:
//   • last-used mode — shown as the recommended card on the mode grid.
//   • kind and progress filters — persisted so a user who likes
//     "TV-only, untouched" doesn't have to re-pick each visit.
//
// Status selection is INTENTIONALLY not persisted and starts empty on
// every page load. The picker tries to feel like a fresh decision each
// time you land on it — re-using last visit's status set tends to
// shrink the candidate pool in ways the user doesn't notice until the
// pick feels off. Kind / progress are mode-of-use preferences (you tend
// to want the same axis every time); status is the actual decision
// scope (varies by mood).
//
// Persisted to localStorage rather than IDB because none of this is
// library-relevant: it's UI ergonomics, not user data. Survives a reload,
// dies with the browser profile.

import type { Status } from "./types";
import type { KindFilter, ProgressFilter } from "./picker";

const MODE_KEY = "picker:lastMode";
const FILTERS_KEY = "picker:filters";

export type PickerMode =
  | "bracket"
  | "coin"
  | "spin"
  | "mini"
  | "stalled"
  | "mood"
  | "rank";

type StoredFilters = {
  kindFilter: KindFilter;
  progressFilter: ProgressFilter;
};

const DEFAULT_FILTERS: StoredFilters = {
  kindFilter: "all",
  progressFilter: "any",
};

function readMode(): PickerMode | null {
  if (typeof localStorage === "undefined") return null;
  const v = localStorage.getItem(MODE_KEY);
  if (!v) return null;
  if (
    v === "bracket" || v === "coin" || v === "spin" || v === "mini" ||
    v === "stalled" || v === "mood" || v === "rank"
  ) {
    return v;
  }
  return null;
}

function readFilters(): StoredFilters {
  if (typeof localStorage === "undefined") return { ...DEFAULT_FILTERS };
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (!raw) return { ...DEFAULT_FILTERS };
    const parsed = JSON.parse(raw);
    return {
      kindFilter:
        parsed.kindFilter === "tv" || parsed.kindFilter === "movie"
          ? parsed.kindFilter
          : "all",
      progressFilter:
        parsed.progressFilter === "started" || parsed.progressFilter === "untouched"
          ? parsed.progressFilter
          : "any",
    };
  } catch {
    return { ...DEFAULT_FILTERS };
  }
}

const initial = readFilters();

export const pickerPrefs = $state({
  lastMode: readMode(),
  // Always start empty — see the file header for why status doesn't
  // persist across visits.
  selectedStatuses: [] as Status[],
  kindFilter: initial.kindFilter,
  progressFilter: initial.progressFilter,
});

export function setLastMode(mode: PickerMode): void {
  pickerPrefs.lastMode = mode;
  if (typeof localStorage !== "undefined") localStorage.setItem(MODE_KEY, mode);
}

export function persistFilters(): void {
  if (typeof localStorage === "undefined") return;
  const payload: StoredFilters = {
    kindFilter: pickerPrefs.kindFilter,
    progressFilter: pickerPrefs.progressFilter,
  };
  localStorage.setItem(FILTERS_KEY, JSON.stringify(payload));
}
