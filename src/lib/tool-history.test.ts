/**
 * Unit tests for src/lib/tool-history.ts — favorites + recent tools storage.
 * Pure helpers, tested with a fake in-memory storage (no DOM required).
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  FAVORITES_KEY,
  RECENT_KEY,
  RECENT_LIMIT,
  FAVORITES_LIMIT,
  type ToolHistoryStorage,
  getDefaultStorage,
  loadFavorites,
  saveFavorites,
  toggleFavorite,
  isFavorite,
  clearFavorites,
  loadRecent,
  recordRecent,
  clearRecent,
} from "./tool-history";

function makeStorage(): ToolHistoryStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe("favorites", () => {
  let storage: ReturnType<typeof makeStorage>;

  beforeEach(() => {
    storage = makeStorage();
  });

  it("loads empty favorites from empty storage", () => {
    expect(loadFavorites(storage)).toEqual([]);
  });

  it("toggles a tool on and off", () => {
    const on = toggleFavorite("json-formatter", storage);
    expect(on).toEqual(["json-formatter"]);
    expect(loadFavorites(storage)).toEqual(["json-formatter"]);
    expect(isFavorite("json-formatter", on)).toBe(true);

    const off = toggleFavorite("json-formatter", storage);
    expect(off).toEqual([]);
    expect(isFavorite("json-formatter", off)).toBe(false);
  });

  it("newest favorite lands at the front", () => {
    toggleFavorite("a", storage);
    toggleFavorite("b", storage);
    toggleFavorite("c", storage);
    expect(loadFavorites(storage)).toEqual(["c", "b", "a"]);
  });

  it("ignores duplicate ids", () => {
    toggleFavorite("a", storage);
    const again = toggleFavorite("a", storage); // toggles OFF, not duplicate
    expect(again).toEqual([]);
  });

  it("caps favorites at FAVORITES_LIMIT", () => {
    for (let i = 0; i < FAVORITES_LIMIT + 10; i++) {
      toggleFavorite(`tool-${i}`, storage);
    }
    const favs = loadFavorites(storage);
    expect(favs.length).toBe(FAVORITES_LIMIT);
    expect(favs[0]).toBe(`tool-${FAVORITES_LIMIT + 9}`); // newest first
  });

  it("saveFavorites + clearFavorites round-trip", () => {
    saveFavorites(["x", "y"], storage);
    expect(loadFavorites(storage)).toEqual(["x", "y"]);
    clearFavorites(storage);
    expect(loadFavorites(storage)).toEqual([]);
  });

  it("ignores corrupt storage data", () => {
    storage.data.set(FAVORITES_KEY, "{not json");
    expect(loadFavorites(storage)).toEqual([]);
    storage.data.set(FAVORITES_KEY, JSON.stringify({ id: "nope" }));
    expect(loadFavorites(storage)).toEqual([]);
    storage.data.set(FAVORITES_KEY, JSON.stringify([42, "", "ok", null]));
    expect(loadFavorites(storage)).toEqual(["ok"]);
  });
});

describe("recent tools", () => {
  let storage: ReturnType<typeof makeStorage>;

  beforeEach(() => {
    storage = makeStorage();
  });

  it("loads empty recents from empty storage", () => {
    expect(loadRecent(storage)).toEqual([]);
  });

  it("records visits newest-first with dedupe", () => {
    recordRecent("a", storage);
    recordRecent("b", storage);
    recordRecent("a", storage); // revisit moves to front, no duplicate
    expect(loadRecent(storage)).toEqual(["a", "b"]);
    expect(storage.data.get(RECENT_KEY)).toBe(JSON.stringify(["a", "b"]));
  });

  it("caps recents at RECENT_LIMIT", () => {
    for (let i = 0; i < RECENT_LIMIT + 5; i++) recordRecent(`tool-${i}`, storage);
    const recents = loadRecent(storage);
    expect(recents.length).toBe(RECENT_LIMIT);
    expect(recents[0]).toBe(`tool-${RECENT_LIMIT + 4}`);
    expect(recents[recents.length - 1]).toBe("tool-5");
  });

  it("honours a custom limit", () => {
    recordRecent("a", storage, 2);
    recordRecent("b", storage, 2);
    recordRecent("c", storage, 2);
    expect(loadRecent(storage)).toEqual(["c", "b"]);
  });

  it("clearRecent wipes the list", () => {
    recordRecent("a", storage);
    clearRecent(storage);
    expect(loadRecent(storage)).toEqual([]);
  });

  it("ignores corrupt storage data", () => {
    storage.data.set(RECENT_KEY, JSON.stringify([{ x: 1 }, "good"]));
    expect(loadRecent(storage)).toEqual(["good"]);
  });
});

describe("storage fallback (non-browser)", () => {
  it("default storage is a safe no-op outside the browser", () => {
    // getDefaultStorage returns memoryStorage when window is undefined (node env)
    const s = getDefaultStorage();
    expect(s.getItem(FAVORITES_KEY)).toBeNull();
    expect(() => s.setItem(FAVORITES_KEY, "[]")).not.toThrow();
    expect(() => s.removeItem?.(FAVORITES_KEY)).not.toThrow();
  });
});
