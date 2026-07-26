/**
 * Oxford Comma Fixer — pure logic.
 * Detects lists and adds/removes the Oxford comma (serial comma before "and"/"or"/"nor")
 * per style guide rules (APA/Chicago = always use; AP = omit unless needed for clarity).
 */

export type Style = "apa" | "chicago" | "ap" | "oxford" | "none";

export interface FixOptions {
  style: Style;
  /** Conjunctions that trigger list detection. */
  conjunctions?: string[];
  /** Minimum number of list items required to apply. */
  minItems?: number;
}

const DEFAULT_CONJUNCTIONS = ["and", "or", "nor", "as well as", "but", "yet"];

/** Detect if a sentence has a list with a terminal conjunction. */
export function detectList(
  sentence: string,
  options: FixOptions = { style: "apa" },
): { isList: boolean; items: string[]; conjunction: string | null } {
  const conjunctions = options.conjunctions ?? DEFAULT_CONJUNCTIONS;
  const trimmed = sentence.trim();
  // Find the LAST conjunction in the sentence (heuristic).
  let bestMatch: { conj: string; idx: number } | null = null;
  for (const conj of conjunctions) {
    const re = new RegExp(`\\s+${escapeRegex(conj)}\\s+`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(trimmed)) !== null) {
      if (!bestMatch || m.index > bestMatch.idx) {
        bestMatch = { conj, idx: m.index };
      }
    }
  }
  if (!bestMatch) return { isList: false, items: [], conjunction: null };
  const before = trimmed.slice(0, bestMatch.idx).trim();
  const after = trimmed.slice(bestMatch.idx + bestMatch.conj.length + 1).trim();
  // Items before the conjunction — split by commas.
  const items = before
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // The last item is the one after the conjunction.
  if (after.length > 0) items.push(after);
  const minItems = options.minItems ?? 3;
  return {
    isList: items.length >= minItems,
    items,
    conjunction: bestMatch.conj,
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Add the Oxford comma (serial comma before the final conjunction). */
export function addOxfordComma(text: string, options: FixOptions = { style: "apa" }): string {
  return splitSentences(text)
    .map((sentence) => {
      const { isList, conjunction } = detectList(sentence, options);
      if (!isList || !conjunction) return sentence;
      // Find the last occurrence of ", and" or " and" and ensure comma before conjunction.
      const re = new RegExp(`\\s+${escapeRegex(conjunction)}\\s+`, "gi");
      let lastIdx = -1;
      let lastMatch: RegExpExecArray | null = null;
      let m: RegExpExecArray | null;
      while ((m = re.exec(sentence)) !== null) {
        lastIdx = m.index;
        lastMatch = m;
      }
      if (lastIdx === -1 || !lastMatch) return sentence;
      const before = sentence.slice(0, lastIdx).trimEnd();
      // If already ends with a comma, no change needed.
      if (before.endsWith(",")) return sentence;
      // If the previous chunk has no comma at all (only two items), don't add.
      // (E.g. "apples and oranges" is not a list needing Oxford comma.)
      const commaCount = (before.match(/,/g) ?? []).length;
      if (commaCount === 0) return sentence;
      const after = sentence.slice(lastIdx + lastMatch[0].length);
      return `${before}, ${conjunction} ${after}`;
    })
    .join("");
}

/** Remove the Oxford comma. */
export function removeOxfordComma(text: string, options: FixOptions = { style: "none" }): string {
  return splitSentences(text)
    .map((sentence) => {
      const { isList, conjunction } = detectList(sentence, options);
      if (!isList || !conjunction) return sentence;
      const re = new RegExp(`,\\s+${escapeRegex(conjunction)}\\s+`, "gi");
      return sentence.replace(re, ` ${conjunction} `);
    })
    .join("");
}

/** Apply style rules: APA/Chicago always add; AP only adds when needed for clarity. */
export function fixStyle(text: string, options: FixOptions): string {
  switch (options.style) {
    case "apa":
    case "chicago":
    case "oxford":
      return addOxfordComma(text, options);
    case "none":
      return removeOxfordComma(text, options);
    case "ap":
      return fixAP(text, options);
  }
}

/** AP style: omit Oxford comma unless it prevents ambiguity. */
export function fixAP(text: string, options: FixOptions = { style: "ap" }): string {
  return splitSentences(text)
    .map((sentence) => {
      // First, add Oxford comma if needed for clarity (e.g. items contain "and").
      // Then remove if it's a simple unambiguous list.
      const { isList, items, conjunction } = detectList(sentence, options);
      if (!isList || !conjunction) return sentence;
      // If any item contains the conjunction word itself, KEEP the Oxford comma.
      const ambiguous = items.some((it) =>
        new RegExp(`\\b${escapeRegex(conjunction)}\\b`, "i").test(it),
      );
      if (ambiguous) {
        return addOxfordComma(sentence, options);
      }
      return removeOxfordComma(sentence, options);
    })
    .join("");
}

/** Split text into sentences (preserving whitespace separators). */
export function splitSentences(text: string): string[] {
  // Split but keep the delimiters (so we can rejoin without loss).
  const parts = text.split(/(\s*[.!?]+\s+|\s*\n+\s*)/);
  return parts;
}

/** Count Oxford commas present in a text. */
export function countOxfordCommas(text: string, options: FixOptions = { style: "apa" }): number {
  let count = 0;
  for (const sentence of splitSentences(text)) {
    const { isList, conjunction } = detectList(sentence, options);
    if (!isList || !conjunction) continue;
    const re = new RegExp(`,\\s+${escapeRegex(conjunction)}\\s+`, "gi");
    count += (sentence.match(re) ?? []).length;
  }
  return count;
}

/** Compare text before & after, returning a unified diff-like list. */
export function diff(before: string, after: string): { type: "same" | "added" | "removed"; text: string }[] {
  // Simple line-by-line diff.
  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  const max = Math.max(beforeLines.length, afterLines.length);
  const out: { type: "same" | "added" | "removed"; text: string }[] = [];
  for (let i = 0; i < max; i++) {
    const b = beforeLines[i];
    const a = afterLines[i];
    if (b === a) {
      if (b !== undefined) out.push({ type: "same", text: b });
    } else {
      if (b !== undefined) out.push({ type: "removed", text: b });
      if (a !== undefined) out.push({ type: "added", text: a });
    }
  }
  return out;
}

/** Statistics: list count, Oxford commas added/removed. */
export function stats(text: string, options: FixOptions = { style: "apa" }): {
  sentenceCount: number;
  listCount: number;
  oxfordCommas: number;
} {
  const sentences = splitSentences(text).filter((s) => /[.!?]$/.test(s.trim()) || s.trim().length > 0);
  let listCount = 0;
  for (const s of sentences) {
    if (detectList(s, options).isList) listCount++;
  }
  return {
    sentenceCount: sentences.length,
    listCount,
    oxfordCommas: countOxfordCommas(text, options),
  };
}

/** Validate options. */
export function validateOptions(options: FixOptions): string[] {
  const errs: string[] = [];
  if (!["apa", "chicago", "ap", "oxford", "none"].includes(options.style)) {
    errs.push("Invalid style");
  }
  if ((options.minItems ?? 3) < 2) errs.push("minItems must be ≥ 2");
  return errs;
}

/** Batch fix multiple paragraphs. */
export function batchFix(text: string, options: FixOptions): string {
  return text
    .split(/\r?\n/)
    .map((line) => (line.trim() ? fixStyle(line, options) : line))
    .join("\n");
}

/** Explanation: describe what changed in a sentence. */
export function explainChange(original: string, fixed: string, options: FixOptions): string {
  const list = detectList(original, options);
  if (!list.isList) return "No list detected.";
  if (original === fixed) return "No change needed.";
  const added = countOxfordCommas(fixed, options) - countOxfordCommas(original, options);
  if (added > 0) {
    return `Added Oxford comma before "${list.conjunction}" (${options.style} style).`;
  }
  if (added < 0) {
    return `Removed Oxford comma before "${list.conjunction}" (${options.style} style).`;
  }
  return "Adjusted formatting.";
}

/** Style guide descriptions for UI. */
export const STYLE_INFO: Record<Style, { name: string; description: string }> = {
  apa: { name: "APA", description: "Always use the Oxford comma." },
  chicago: { name: "Chicago", description: "Always use the Oxford comma." },
  oxford: { name: "Oxford", description: "Always use the Oxford comma (synonym for APA)." },
  ap: { name: "AP", description: "Omit unless needed for clarity." },
  none: { name: "No Oxford", description: "Remove the Oxford comma." },
};
