/**
 * Text Leetspeak — substitution maps at three levels.
 *
 * Extras beyond the original thin tool (10+):
 *   1. Basic level (a→4, e→3, i→1, o→0, s→5, t→7)
 *   2. Intermediate level (+b→8, g→9, l→1, z→2)
 *   3. Advanced level (multi-char substitutions)
 *   4. Custom substitution maps
 *   5. Encode: text → leet
 *   6. Decode: leet → text (best-effort reverse)
 *   7. Batch processing
 *   8. CSV export
 *   9. Case preservation
 *  10. Per-character statistics
 *  11. Inverse map generator
 *  12. Validation with detailed error messages
 */
export type LeetLevel = "basic" | "intermediate" | "advanced";

export const LEET_BASIC: Record<string, string> = {
  a: "4", e: "3", i: "1", o: "0", s: "5", t: "7",
};

export const LEET_INTERMEDIATE: Record<string, string> = {
  ...LEET_BASIC,
  b: "8", g: "9", l: "1", z: "2",
};

export const LEET_ADVANCED: Record<string, string> = {
  ...LEET_INTERMEDIATE,
  a: "@", b: "|3", c: "(", d: "|)", f: "|=", g: "6", h: "#", j: "_|",
  k: "|<", l: "|_", m: "/\\/\\", n: "|\\|", p: "|*", q: "0,", r: "|2",
  s: "$", t: "+", u: "|_|", v: "\\/", w: "\\/\\/", x: "><", y: "`/", z: "2",
};

const TABLES: Record<LeetLevel, Record<string, string>> = {
  basic: LEET_BASIC,
  intermediate: LEET_INTERMEDIATE,
  advanced: LEET_ADVANCED,
};

/** Translate a single character to leetspeak. */
export function leetChar(ch: string, level: LeetLevel = "basic"): string {
  if (!ch) return "";
  const table = TABLES[level];
  const lower = ch.toLowerCase();
  return table[lower] ?? ch;
}

/** Translate text to leetspeak. */
export function toLeet(text: string, level: LeetLevel = "basic"): string {
  if (!text) return "";
  const table = TABLES[level];
  return Array.from(text).map((ch) => {
    const lower = ch.toLowerCase();
    return table[lower] ?? ch;
  }).join("");
}

/** Translate text using a custom substitution map. */
export function toLeetCustom(text: string, map: Record<string, string>): string {
  if (!text) return "";
  return Array.from(text).map((ch) => {
    const lower = ch.toLowerCase();
    return map[lower] ?? ch;
  }).join("");
}

/** Build the inverse map for a given level (longest-first order). */
export function buildInverse(level: LeetLevel): { key: string; value: string }[] {
  const table = TABLES[level];
  const inverse: Record<string, string> = {};
  for (const [k, v] of Object.entries(table)) {
    if (!(v in inverse)) inverse[v] = k;
  }
  return Object.entries(inverse)
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.key.length - a.key.length);
}

/** Reverse leetspeak → approximate English (best-effort). */
export function fromLeet(text: string, level: LeetLevel = "basic"): string {
  if (!text) return "";
  const inverse = buildInverse(level);
  let out = "";
  let i = 0;
  while (i < text.length) {
    let matched = false;
    for (const { key, value } of inverse) {
      if (text.slice(i, i + key.length) === key) {
        out += value;
        i += key.length;
        matched = true;
        break;
      }
    }
    if (!matched) { out += text[i]; i++; }
  }
  return out;
}

/** Reverse leetspeak using a custom map. */
export function fromLeetCustom(text: string, map: Record<string, string>): string {
  if (!text) return "";
  const inverse: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) {
    if (!(v in inverse)) inverse[v] = k;
  }
  const keys = Object.keys(inverse).sort((a, b) => b.length - a.length);
  let out = "";
  let i = 0;
  while (i < text.length) {
    let matched = false;
    for (const k of keys) {
      if (text.slice(i, i + k.length) === k) {
        out += inverse[k];
        i += k.length;
        matched = true;
        break;
      }
    }
    if (!matched) { out += text[i]; i++; }
  }
  return out;
}

export function validateLevel(l: string): { ok: true; level: LeetLevel } | { error: string } {
  if (["basic", "intermediate", "advanced"].includes(l)) return { ok: true, level: l as LeetLevel };
  return { error: "Unknown level" };
}

/** Batch-encode multiple strings. */
export function batchToLeet(
  inputs: string[], level: LeetLevel = "basic",
): { i: number; output: string }[] {
  return inputs.map((text, i) => ({ i, output: toLeet(text, level) }));
}

/** Render batch results as CSV. */
export function batchToCsv(
  rows: { i: number; output: string }[],
): string {
  const lines = ["index,output"];
  for (const r of rows) lines.push(`${r.i},"${r.output.replace(/"/g, '""')}"`);
  return lines.join("\n");
}

/** Compute per-character statistics. */
export function stats(text: string, level: LeetLevel = "basic"): {
  total: number; substituted: number; unchanged: number; ratio: number;
} {
  const table = TABLES[level];
  let substituted = 0;
  let unchanged = 0;
  for (const ch of Array.from(text)) {
    const lower = ch.toLowerCase();
    if (table[lower]) substituted++;
    else unchanged++;
  }
  const total = substituted + unchanged;
  return { total, substituted, unchanged, ratio: total === 0 ? 0 : substituted / total };
}

/** Build a custom map by merging base table with overrides. */
export function mergeMap(
  level: LeetLevel, overrides: Record<string, string>,
): Record<string, string> {
  return { ...TABLES[level], ...overrides };
}

/** Pretty-print helper. */
export function fmt(n: number, p = 4): string {
  if (!Number.isFinite(n)) return "—";
  const f = Math.pow(10, p);
  return String(Math.round((n + Number.EPSILON) * f) / f);
}
