/**
 * Text Accent Adder — add accents to vowels using a configurable accent map.
 *
 * Supports five accent types (acute/grave/circumflex/umlaut/tilde), cycling mode
 * that rotates through all accents, and a "random" seeded mode for variety.
 */

export type AccentType = "acute" | "grave" | "circumflex" | "umlaut" | "tilde";

export const ACCENT_MAP: Record<AccentType, Record<string, string>> = {
  acute:      { a: "á", e: "é", i: "í", o: "ó", u: "ú", y: "ý", A: "Á", E: "É", I: "Í", O: "Ó", U: "Ú", Y: "Ý" },
  grave:      { a: "à", e: "è", i: "ì", o: "ò", u: "ù", A: "À", E: "È", I: "Ì", O: "Ò", U: "Ù" },
  circumflex: { a: "â", e: "ê", i: "î", o: "ô", u: "û", A: "Â", E: "Ê", I: "Î", O: "Ô", U: "Û" },
  umlaut:     { a: "ä", e: "ë", i: "ï", o: "ö", u: "ü", y: "ÿ", A: "Ä", E: "Ë", I: "Ï", O: "Ö", U: "Ü", Y: "Ÿ" },
  tilde:      { a: "ã", o: "õ", n: "ñ", A: "Ã", O: "Õ", N: "Ñ" },
};

export type AccentMode = AccentType | "cycle" | "random";

export interface AccentAddStats {
  chars: number;
  vowelsAccented: number;
  charsPreserved: number;
  mode: AccentMode;
  durationMs: number;
}

export interface AccentBreakdownEntry {
  original: string;
  accented: string;
  accent: AccentType;
  count: number;
}

/** Add the given accent to a single character if it's a supported vowel. */
export function addAccentToChar(ch: string, accent: AccentType): string {
  const map = ACCENT_MAP[accent];
  return map[ch] ?? ch;
}

/** Add the given accent to all vowels in the text. */
export function addAccents(text: string, accent: AccentType): string {
  if (!text) return "";
  const map = ACCENT_MAP[accent];
  return Array.from(text).map((ch) => map[ch] ?? ch).join("");
}

/** Add a different accent to each vowel in rotation (cycle through available accents). */
export function addCyclingAccents(text: string): string {
  if (!text) return "";
  const accents: AccentType[] = ["acute", "grave", "circumflex", "umlaut"];
  let idx = 0;
  return Array.from(text).map((ch) => {
    if ("aeiouAEIOU".includes(ch)) {
      const a = accents[idx % accents.length]!;
      idx++;
      return ACCENT_MAP[a][ch] ?? ch;
    }
    return ch;
  }).join("");
}

/** Mulberry32 — small fast seeded PRNG. Returns a function → float 0..1. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Add random accents to vowels using a seeded PRNG (deterministic). */
export function addRandomAccents(text: string, seed = 1): string {
  if (!text) return "";
  const accents: AccentType[] = ["acute", "grave", "circumflex", "umlaut", "tilde"];
  const rng = mulberry32(seed);
  return Array.from(text).map((ch) => {
    if ("aeiouAEIOU".includes(ch)) {
      const a = accents[Math.floor(rng() * accents.length)]!;
      return ACCENT_MAP[a][ch] ?? ch;
    }
    return ch;
  }).join("");
}

/** Dispatch by mode. */
export function applyAccents(text: string, mode: AccentMode, seed = 1): string {
  if (mode === "cycle") return addCyclingAccents(text);
  if (mode === "random") return addRandomAccents(text, seed);
  return addAccents(text, mode);
}

/** Batch: process each line. */
export function applyAccentsBatch(inputs: string[], mode: AccentMode, seed = 1): string[] {
  return inputs.map((s) => applyAccents(s, mode, seed));
}

export function validateAccentType(t: string): { ok: true; type: AccentType } | { error: string } {
  if (["acute", "grave", "circumflex", "umlaut", "tilde"].includes(t)) {
    return { ok: true, type: t as AccentType };
  }
  return { error: "Unknown accent type" };
}

/** Compute statistics about an accent-add operation. */
export function computeStats(input: string, mode: AccentMode): AccentAddStats {
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  let vowelsAccented = 0;
  let charsPreserved = 0;
  for (const ch of input) {
    if ("aeiouAEIOU".includes(ch)) vowelsAccented++;
    else charsPreserved++;
  }
  const end = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    chars: input.length,
    vowelsAccented,
    charsPreserved,
    mode,
    durationMs: Math.max(0, end - start),
  };
}

/** Per-character breakdown: for each vowel in input, show its accented form. */
export function perCharBreakdown(input: string, mode: AccentMode, seed = 1): AccentBreakdownEntry[] {
  if (!input) return [];
  const output = applyAccents(input, mode, seed);
  const map = new Map<string, AccentBreakdownEntry>();
  const accents: AccentType[] = ["acute", "grave", "circumflex", "umlaut", "tilde"];
  let cycleIdx = 0;
  const rng = mulberry32(seed);
  for (let i = 0; i < input.length; i++) {
    const orig = input[i]!;
    const acc = output[i]!;
    if (orig === acc) continue;
    let accent: AccentType;
    if (mode === "cycle") {
      accent = ["acute", "grave", "circumflex", "umlaut"][cycleIdx % 4] as AccentType;
      cycleIdx++;
    } else if (mode === "random") {
      accent = accents[Math.floor(rng() * accents.length)]!;
    } else {
      accent = mode;
    }
    const key = `${orig}→${acc}`;
    if (!map.has(key)) {
      map.set(key, { original: orig, accented: acc, accent, count: 0 });
    }
    map.get(key)!.count++;
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/** List all distinct vowels in input that would be accented. */
export function listVowels(input: string): string[] {
  const seen = new Set<string>();
  for (const ch of input) {
    if ("aeiouAEIOU".includes(ch)) seen.add(ch);
  }
  return [...seen];
}

/** Serialize a per-character breakdown to CSV. */
export function breakdownToCsv(breakdown: AccentBreakdownEntry[]): string {
  const lines = ["Original,Accented,Accent,Count"];
  for (const e of breakdown) {
    lines.push(`"${e.original}","${e.accented}",${e.accent},${e.count}`);
  }
  return lines.join("\n");
}
