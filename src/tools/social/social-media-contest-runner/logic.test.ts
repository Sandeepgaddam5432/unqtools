import { describe, it, expect } from "vitest";
import {
  shuffle,
  dedupeEntries,
  buildWeightedPool,
  pickWinners,
  parseEntries,
  type Entry,
  type Prize,
  type RandomSource,
} from "./logic";

function seededRandom(seed: number): RandomSource {
  let s = seed >>> 0;
  return (max: number) => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s % max;
  };
}

const entries: Entry[] = [
  { id: "1", handle: "alice", extraEntry: 0 },
  { id: "2", handle: "bob", extraEntry: 0 },
  { id: "3", handle: "carol", extraEntry: 0 },
  { id: "4", handle: "dave", extraEntry: 0 },
  { id: "5", handle: "eve", extraEntry: 0 },
];

const prizes: Prize[] = [{ label: "Gold", count: 1 }, { label: "Silver", count: 2 }];

describe("social-media-contest-runner shuffle", () => {
  it("preserves all elements", () => {
    const out = shuffle([1, 2, 3, 4, 5], seededRandom(1));
    expect(out.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("is deterministic for the same seed", () => {
    const a = shuffle([1, 2, 3, 4, 5], seededRandom(1));
    const b = shuffle([1, 2, 3, 4, 5], seededRandom(1));
    expect(a).toEqual(b);
  });
});

describe("social-media-contest-runner dedupeEntries", () => {
  it("removes duplicates by id", () => {
    const { unique, duplicates } = dedupeEntries([
      { id: "1", handle: "a" },
      { id: "1", handle: "a" },
      { id: "2", handle: "b" },
    ]);
    expect(unique.length).toBe(2);
    expect(duplicates).toBe(1);
  });

  it("handles empty input", () => {
    expect(dedupeEntries([]).unique).toEqual([]);
  });
});

describe("social-media-contest-runner buildWeightedPool", () => {
  it("expands by extraEntry count", () => {
    const pool = buildWeightedPool([
      { id: "1", handle: "a", extraEntry: 2 },
      { id: "2", handle: "b", extraEntry: 0 },
    ]);
    expect(pool.length).toBe(4); // 3 + 1
  });

  it("defaults to 1 slot per entry", () => {
    const pool = buildWeightedPool([{ id: "1", handle: "a" }]);
    expect(pool.length).toBe(1);
  });
});

describe("social-media-contest-runner pickWinners", () => {
  it("returns error for empty entries", () => {
    const r = pickWinners([], prizes, seededRandom(1));
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/entries/i);
  });

  it("returns error for empty prizes", () => {
    const r = pickWinners(entries, [], seededRandom(1));
    expect(r.isValid).toBe(false);
  });

  it("picks the correct number of winners", () => {
    const r = pickWinners(entries, prizes, seededRandom(1));
    expect(r.isValid).toBe(true);
    expect(r.winners.length).toBe(3);
  });

  it("does not pick the same entry twice by default", () => {
    const r = pickWinners(entries, prizes, seededRandom(1));
    expect(r.isValid).toBe(true);
    const ids = r.winners.map((w) => w.entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns error when not enough unique entries", () => {
    const r = pickWinners([entries[0]], prizes, seededRandom(1));
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/unique entries/i);
  });

  it("allows repeats when option enabled", () => {
    const r = pickWinners([entries[0]], [{ label: "X", count: 3 }], seededRandom(1), { allowRepeatAcrossPrizes: true });
    expect(r.isValid).toBe(true);
    expect(r.winners.length).toBe(3);
  });
});

describe("social-media-contest-runner parseEntries", () => {
  it("parses one handle per line", () => {
    const e = parseEntries("@alice\n@bob\n@carol");
    expect(e.length).toBe(3);
    expect(e[0].handle).toBe("alice");
  });

  it("ignores blank lines", () => {
    const e = parseEntries("\nalice\n\nbob\n");
    expect(e.length).toBe(2);
  });

  it("returns empty for empty input", () => {
    expect(parseEntries("")).toEqual([]);
  });
});
