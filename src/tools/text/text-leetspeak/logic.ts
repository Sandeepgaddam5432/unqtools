/**
 * Text Leetspeak — substitution maps at three levels.
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

/** Reverse leetspeak → approximate English (best-effort). */
export function fromLeet(text: string, level: LeetLevel = "basic"): string {
  if (!text) return "";
  const table = TABLES[level];
  const inverse: Record<string, string> = {};
  for (const [k, v] of Object.entries(table)) inverse[v] = k;
  // Greedy match: try longest substitution first
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
