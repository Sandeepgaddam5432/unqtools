/**
 * Text Accent Adder — add accents to vowels using a configurable accent map.
 */
export type AccentType = "acute" | "grave" | "circumflex" | "umlaut" | "tilde";

export const ACCENT_MAP: Record<AccentType, Record<string, string>> = {
  acute:      { a: "á", e: "é", i: "í", o: "ó", u: "ú", y: "ý", A: "Á", E: "É", I: "Í", O: "Ó", U: "Ú", Y: "Ý" },
  grave:      { a: "à", e: "è", i: "ì", o: "ò", u: "ù", A: "À", E: "È", I: "Ì", O: "Ò", U: "Ù" },
  circumflex: { a: "â", e: "ê", i: "î", o: "ô", u: "û", A: "Â", E: "Ê", I: "Î", O: "Ô", U: "Û" },
  umlaut:     { a: "ä", e: "ë", i: "ï", o: "ö", u: "ü", y: "ÿ", A: "Ä", E: "Ë", I: "Ï", O: "Ö", U: "Ü", Y: "Ÿ" },
  tilde:      { a: "ã", o: "õ", n: "ñ", A: "Ã", O: "Õ", N: "Ñ" },
};

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

export function validateAccentType(t: string): { ok: true; type: AccentType } | { error: string } {
  if (["acute", "grave", "circumflex", "umlaut", "tilde"].includes(t)) {
    return { ok: true, type: t as AccentType };
  }
  return { error: "Unknown accent type" };
}
