/**
 * Site-wide tool history — Favorites + Recently viewed tools.
 *
 * 100% localStorage-based, privacy-first: nothing ever leaves the browser,
 * no accounts, no tracking. Used by the tool page (favorite button + visit
 * tracking), the tools directory (Favorites / Recent quick filters), and the
 * ⌘K command palette (Favorites + Recent groups).
 *
 * All functions accept an optional `storage` argument so they are trivially
 * unit-testable with a fake in-memory storage.
 */

export const FAVORITES_KEY = "unqtools:favorites";
export const RECENT_KEY = "unqtools:recent";
export const RECENT_LIMIT = 12;
export const FAVORITES_LIMIT = 100;

/** Minimal storage interface (subset of `Storage`) — swappable for tests. */
export interface ToolHistoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

/** No-op in-memory fallback so helpers never throw outside the browser. */
const memoryStorage: ToolHistoryStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

/** Real localStorage when available, otherwise a silent no-op. */
export function getDefaultStorage(): ToolHistoryStorage {
  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    return window.localStorage;
  }
  return memoryStorage;
}

/** Read a string[] of tool ids from storage. Corrupt/foreign data → []. */
export function readIds(storage: ToolHistoryStorage, key: string): string[] {
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  } catch {
    return [];
  }
}

/** Write a string[] of tool ids to storage. Never throws. */
export function writeIds(storage: ToolHistoryStorage, key: string, ids: string[]): void {
  try {
    storage.setItem(key, JSON.stringify(ids));
  } catch {
    /* storage full / private mode — fail silently, feature degrades gracefully */
  }
}

/** Remove a key from storage. Never throws. */
export function removeKey(storage: ToolHistoryStorage, key: string): void {
  try {
    if (typeof storage.removeItem === "function") storage.removeItem(key);
    else storage.setItem(key, "");
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Favorites                                                          */
/* ------------------------------------------------------------------ */

/** Ordered favorite tool ids — most recently favorited first. */
export function loadFavorites(storage: ToolHistoryStorage = getDefaultStorage()): string[] {
  return readIds(storage, FAVORITES_KEY);
}

/** Persist an ordered favorite list. */
export function saveFavorites(ids: string[], storage: ToolHistoryStorage = getDefaultStorage()): void {
  writeIds(storage, FAVORITES_KEY, ids);
}

/**
 * Toggle a tool id in favorites (move to front when added).
 * Returns the NEW favorites list so callers can update React state atomically.
 */
export function toggleFavorite(
  id: string,
  storage: ToolHistoryStorage = getDefaultStorage()
): string[] {
  const current = loadFavorites(storage);
  const next = current.includes(id)
    ? current.filter((x) => x !== id)
    : [id, ...current].slice(0, FAVORITES_LIMIT);
  saveFavorites(next, storage);
  return next;
}

export function isFavorite(id: string, favorites: string[]): boolean {
  return favorites.includes(id);
}

export function clearFavorites(storage: ToolHistoryStorage = getDefaultStorage()): void {
  removeKey(storage, FAVORITES_KEY);
}

/* ------------------------------------------------------------------ */
/* Recently viewed                                                    */
/* ------------------------------------------------------------------ */

/** Ordered recent tool ids — most recently visited first, capped at RECENT_LIMIT. */
export function loadRecent(storage: ToolHistoryStorage = getDefaultStorage()): string[] {
  return readIds(storage, RECENT_KEY).slice(0, RECENT_LIMIT);
}

/**
 * Record a tool visit (dedupe + move to front + cap).
 * Returns the NEW recent list so callers can update React state atomically.
 */
export function recordRecent(
  id: string,
  storage: ToolHistoryStorage = getDefaultStorage(),
  limit: number = RECENT_LIMIT
): string[] {
  const current = readIds(storage, RECENT_KEY).filter((x) => x !== id);
  const next = [id, ...current].slice(0, limit);
  writeIds(storage, RECENT_KEY, next);
  return next;
}

export function clearRecent(storage: ToolHistoryStorage = getDefaultStorage()): void {
  removeKey(storage, RECENT_KEY);
}
