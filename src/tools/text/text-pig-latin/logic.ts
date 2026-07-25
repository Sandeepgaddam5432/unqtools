/**
 * Text Pig Latin — both directions.
 * Rules:
 *  - If word starts with vowel → add "way" / "yay"
 *  - If word starts with consonant cluster → move cluster to end + "ay"
 */
export type PigLatinSuffix = "ay" | "way" | "yay";

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

function isVowel(ch: string, useYAsVowel = false): boolean {
  const c = ch.toLowerCase();
  return VOWELS.has(c) || (useYAsVowel && c === "y");
}

/** Find the index of the first vowel in a word. Returns -1 if no vowel. */
export function firstVowelIndex(word: string): number {
  for (let i = 0; i < word.length; i++) {
    if (isVowel(word[i]!, i > 0)) return i;
  }
  return -1;
}

/** Translate a single word to Pig Latin. */
export function translateWord(word: string, suffix: PigLatinSuffix = "ay"): string {
  if (!word) return "";
  // Preserve leading/trailing punctuation
  const lead = word.match(/^[^A-Za-z]+/)?.[0] ?? "";
  const trail = word.match(/[^A-Za-z]+$/)?.[0] ?? "";
  const core = word.slice(lead.length, word.length - trail.length);
  if (!core) return word;
  const lower = core.toLowerCase();
  const isTitle = core[0] === core[0]?.toUpperCase() && core[0] !== core[0]?.toLowerCase();
  let translated: string;
  if (isVowel(lower[0]!)) {
    translated = suffix === "ay" ? lower + "ay" : lower + suffix;
  } else {
    const idx = firstVowelIndex(lower);
    if (idx <= 0) {
      translated = lower + "ay";
    } else {
      translated = lower.slice(idx) + lower.slice(0, idx) + "ay";
    }
  }
  if (isTitle) {
    translated = translated.charAt(0).toUpperCase() + translated.slice(1);
  }
  return lead + translated + trail;
}

/** Translate English → Pig Latin. */
export function toPigLatin(text: string, suffix: PigLatinSuffix = "ay"): string {
  if (!text) return "";
  return text.split(/\s+/).map((w) => translateWord(w, suffix)).join(" ");
}

/** Detect and reverse Pig Latin → English. */
export function fromPigLatin(word: string): string {
  if (!word) return "";
  const lead = word.match(/^[^A-Za-z]+/)?.[0] ?? "";
  const trail = word.match(/[^A-Za-z]+$/)?.[0] ?? "";
  const core = word.slice(lead.length, word.length - trail.length).toLowerCase();
  if (!core) return word;
  // Ends with "way" or "yay" and starts with vowel → strip suffix
  if ((core.endsWith("way") || core.endsWith("yay")) && isVowel(core[0]!)) {
    return lead + core.slice(0, -3) + trail;
  }
  // Ends with "ay" → move trailing consonant cluster (after last vowel) to front
  if (core.endsWith("ay")) {
    const stem = core.slice(0, -2);
    let lastVowel = -1;
    for (let i = stem.length - 1; i >= 0; i--) {
      if (/[aeiou]/.test(stem[i]!)) { lastVowel = i; break; }
    }
    if (lastVowel >= 0 && lastVowel < stem.length - 1) {
      const cluster = stem.slice(lastVowel + 1);
      const original = cluster + stem.slice(0, lastVowel + 1);
      return lead + original + trail;
    }
    return lead + stem + trail;
  }
  return word;
}

/** Reverse Pig Latin text → English. */
export function fromPigLatinText(text: string): string {
  if (!text) return "";
  return text.split(/\s+/).map((w) => fromPigLatin(w)).join(" ");
}

export function validateSuffix(s: string): { ok: true; suffix: PigLatinSuffix } | { error: string } {
  if (["ay", "way", "yay"].includes(s)) return { ok: true, suffix: s as PigLatinSuffix };
  return { error: "Unknown suffix" };
}
