/**
 * Social Media Contest Runner — pure logic.
 * Pick random winners from entries using crypto-grade randomness.
 * Pure: accepts an injectable random source.
 */

export interface Entry {
  id: string;
  handle: string;
  extraEntry?: number; // additional entries (weighted)
}

export interface WinnerPick {
  entry: Entry;
  prizeIndex: number;
  prizeLabel: string;
}

export interface ContestResult {
  winners: WinnerPick[];
  entriesConsidered: number;
  duplicatesRemoved: number;
  isValid: boolean;
  error?: string;
}

export type RandomSource = (maxExclusive: number) => number;

/** Make a random source backed by crypto.getRandomValues. */
export function makeCryptoRandomSource(): RandomSource {
  return (max: number) => {
    if (max <= 0) return 0;
    const buf = new Uint32Array(1);
    const u32max = 0xffffffff;
    const limit = u32max - (u32max % max);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
        globalThis.crypto.getRandomValues(buf);
      } else {
        buf[0] = Math.floor(Math.random() * u32max);
      }
      if (buf[0] < limit) return buf[0] % max;
    }
  };
}

/** Fisher-Yates shuffle using provided random source. Pure (no side effects on input). */
export function shuffle<T>(arr: T[], random: RandomSource): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Deduplicate entries by id, preserving order. */
export function dedupeEntries(entries: Entry[]): { unique: Entry[]; duplicates: number } {
  const seen = new Set<string>();
  const unique: Entry[] = [];
  let duplicates = 0;
  for (const e of entries) {
    if (!e.id || seen.has(e.id)) {
      duplicates++;
      continue;
    }
    seen.add(e.id);
    unique.push(e);
  }
  return { unique, duplicates };
}

/** Expand entries into a weighted pool (one slot per extraEntry + 1). */
export function buildWeightedPool(entries: Entry[]): Entry[] {
  const pool: Entry[] = [];
  for (const e of entries) {
    const count = Math.max(1, Math.floor(e.extraEntry ?? 0) + 1);
    for (let i = 0; i < count; i++) pool.push(e);
  }
  return pool;
}

export interface Prize {
  label: string;
  count: number;
}

/** Pick `count` unique winners from a weighted pool. */
export function pickWinners(
  entries: Entry[],
  prizes: Prize[],
  random: RandomSource,
  options: { allowRepeatAcrossPrizes: boolean } = { allowRepeatAcrossPrizes: false }
): ContestResult {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { winners: [], entriesConsidered: 0, duplicatesRemoved: 0, isValid: false, error: "No entries provided." };
  }
  if (!Array.isArray(prizes) || prizes.length === 0) {
    return { winners: [], entriesConsidered: 0, duplicatesRemoved: 0, isValid: false, error: "No prizes provided." };
  }
  for (const p of prizes) {
    if (p.count <= 0) return { winners: [], entriesConsidered: 0, duplicatesRemoved: 0, isValid: false, error: `Prize "${p.label}" has non-positive count.` };
  }
  const { unique, duplicates } = dedupeEntries(entries);
  const pool = buildWeightedPool(unique);
  const totalWinnersNeeded = prizes.reduce((s, p) => s + p.count, 0);
  if (!options.allowRepeatAcrossPrizes && unique.length < totalWinnersNeeded) {
    return { winners: [], entriesConsidered: pool.length, duplicatesRemoved: duplicates, isValid: false, error: `Need ${totalWinnersNeeded} winners but only ${unique.length} unique entries.` };
  }

  const winners: WinnerPick[] = [];
  const usedIds = new Set<string>();
  const workingPool = shuffle(pool, random);
  let idx = 0;
  for (const prize of prizes) {
    for (let i = 0; i < prize.count; i++) {
      // Skip used entries if no repeats allowed
      while (idx < workingPool.length && !options.allowRepeatAcrossPrizes && usedIds.has(workingPool[idx].id)) idx++;
      if (idx >= workingPool.length) {
        if (options.allowRepeatAcrossPrizes) idx = 0;
        else break;
      }
      const entry = workingPool[idx];
      usedIds.add(entry.id);
      winners.push({ entry, prizeIndex: prizes.indexOf(prize), prizeLabel: prize.label });
      idx++;
    }
  }

  return {
    winners,
    entriesConsidered: pool.length,
    duplicatesRemoved: duplicates,
    isValid: true,
  };
}

/** Parse raw text input (one handle per line) into entries. */
export function parseEntries(text: string): Entry[] {
  if (!text || !text.trim()) return [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.map((line, i) => {
    const cleaned = line.replace(/^@/, "");
    return { id: `${cleaned}-${i}`, handle: cleaned, extraEntry: 0 };
  });
}
