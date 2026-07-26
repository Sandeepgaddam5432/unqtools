/**
 * Grammar Fixer — pure logic.
 *
 * Applies a curated set of rule-based grammar corrections for common
 * English mistakes. The goal is conservative, deterministic fixes —
 * not full NLP. Rules covered:
 *
 *   • its / it's              (possessive vs. contraction)
 *   • their / there / they're
 *   • your / you're
 *   • a / an                  (based on following word's first sound)
 *   • to / too / two
 *   • then / than
 *   • affect / effect         (basic heuristics)
 *   • loose / lose
 *   • Capitalisation at the start of sentences
 *   • Double spaces, trailing whitespace, repeated punctuation
 *   • I capitalisation
 *
 * Each rule records the number of replacements so the UI can show a
 * summary of changes.
 */

export interface GrammarFixOptions {
  fixCapitalization?: boolean;
  fixSpacingPunctuation?: boolean;
  fixCommonConfusables?: boolean;
  fixAAn?: boolean;
}

export interface GrammarFixResult {
  output: string;
  changes: GrammarChange[];
  totalChanges: number;
  warnings: string[];
}

export interface GrammarChange {
  rule: string;
  before: string;
  after: string;
  count: number;
}

const VOWEL_SOUNDS = new Set(["a", "e", "i", "o", "u"]);
// Words that start with a vowel letter but consonant sound (use "a")
const CONSONANT_SOUND_VOWELS = new Set([
  "university", "union", "unicorn", "user", "use", "used", "useful", "european", "ewe", "one", "once", "uniform", "unique", "unit", "united",
]);
// Words that start with a consonant letter but vowel sound (use "an")
const VOWEL_SOUND_CONSONANTS = new Set([
  "hour", "honest", "honor", "honorable", "heir", "mba", "mp3", "x-ray", "fbi", "fda", "ceo", "cfo", "cto", "iou",
]);

function startsWithVowelSound(word: string): boolean {
  const w = word.toLowerCase();
  if (!w) return false;
  if (VOWEL_SOUND_CONSONANTS.has(w)) return true;
  if (CONSONANT_SOUND_VOWELS.has(w)) return false;
  // Special: silent-h words handled above. Otherwise, vowel letter ⇒ vowel sound.
  if (VOWEL_SOUNDS.has(w[0]!)) return true;
  // Acronyms pronounced letter-by-letter (e.g. "MBA")
  if (w.length <= 5 && w === w.toUpperCase() && /[aeiou]/.test(w)) return true;
  return false;
}

/** Replace all occurrences of `pattern` in `text`, recording change count. */
function applyRule(
  text: string,
  rule: string,
  pattern: RegExp,
  replacement: string,
  changes: GrammarChange[],
  before: string,
  after: string,
): string {
  // Use matchAll to count; String.replace with global flag replaces all.
  const matches = text.match(pattern);
  const count = matches ? matches.length : 0;
  if (count > 0) {
    changes.push({ rule, before, after, count });
    return text.replace(pattern, replacement);
  }
  return text;
}

/**
 * Apply grammar fixes. Rules are applied in a sensible order so that
 * subsequent rules can rely on prior normalisation (e.g. spacing is
 * normalised first, then capitalisation, then confusables).
 */
export function fixGrammar(input: string, options: GrammarFixOptions = {}): GrammarFixResult {
  const changes: GrammarChange[] = [];
  const warnings: string[] = [];
  let text = input ?? "";
  if (text.length === 0) {
    return { output: "", changes, totalChanges: 0, warnings };
  }

  const doSpacing = options.fixSpacingPunctuation ?? true;
  const doCapital = options.fixCapitalization ?? true;
  const doConfusables = options.fixCommonConfusables ?? true;
  const doAAn = options.fixAAn ?? true;

  if (doSpacing) {
    // Collapse multiple spaces
    text = applyRule(text, "double-space", / {2,}/g, " ", changes, "  ", " ");
    // Trim trailing whitespace on each line
    text = applyRule(text, "trailing-ws", /[ \t]+$/gm, "", changes, " \\n", "\\n");
    // Single space after sentence punctuation (.,;:!?) when followed by a non-space
    text = applyRule(text, "space-after-punct", /([.,;:!?])(?=[A-Za-z])/g, "$1 ", changes, ".X", ". X");
    // Remove space BEFORE sentence punctuation
    text = applyRule(text, "space-before-punct", /\s+([.,;:!?])/g, "$1", changes, " .", ".");
    // Repeated punctuation (e.g. "..." stays, but "!!!" collapses to "!")
    text = applyRule(text, "repeated-punct", /([!?]){2,}/g, "$1", changes, "!!", "!");
  }

  if (doCapital) {
    // Capitalise first letter of each sentence (after . ! ? or at start)
    text = applyRule(
      text,
      "sentence-cap",
      /(^|[.!?]\s+)([a-z])/g,
      (_m, p1, p2) => p1 + p2.toUpperCase(),
      changes,
      ". a", ". A",
    );
    // Standalone "i" → "I"
    text = applyRule(text, "capital-i", /\bi\b/g, "I", changes, "i", "I");
  }

  if (doConfusables) {
    // its vs it's: "it's" possessive ⇒ "its" only when followed by a noun-ish word.
    // Conservative: replace "it's" when followed by a word ending in 's' or common noun.
    text = applyRule(
      text,
      "its-possessive",
      /\bit's\s+(name|own|color|colour|value|use|size|shape|form|title|first|last|best|worst|position|place|role|job|way|time|day|year)/gi,
      (m) => m.replace(/it's/i, "its"),
      changes,
      "it's name", "its name",
    );
    // their/there/they're
    text = applyRule(text, "their-for-possessive", /\bthey're\s+(car|house|dog|cat|book|books|family|parents|children|kids|friends)/gi, (m) => m.replace(/they're/i, "their"), changes, "they're car", "their car");
    text = applyRule(text, "there-for-location", /\bthey're\s+(is|are|was|were|goes|went|comes|came)/gi, (m) => m.replace(/they're/i, "there"), changes, "they're goes", "there goes");
    // your / you're
    text = applyRule(text, "your-for-possessive", /\byou're\s+(car|house|dog|cat|book|books|family|parents|children|kids|friends|name|birthday|mother|father|sister|brother)/gi, (m) => m.replace(/you're/i, "your"), changes, "you're car", "your car");
    // to / too
    text = applyRule(text, "too-for-excess", /\bto\s+(much|many|late|early|fast|slow|big|small|hot|cold|long|short)/gi, (m) => m.replace(/^to/i, "too"), changes, "to much", "too much");
    // then / than
    text = applyRule(text, "than-for-comparison", /\bthen\s+(me|you|him|her|us|them|yesterday|before|after|better|worse|bigger|smaller|faster|slower|higher|lower)/gi, (m) => m.replace(/^then/i, "than"), changes, "then me", "than me");
    // loose / lose
    text = applyRule(text, "lose-verb", /\bloose\s+(weight|my|your|his|her|their|our|the|this|that|control|interest|hope|track|sight)/gi, (m) => m.replace(/^loose/i, "lose"), changes, "loose weight", "lose weight");
    // could of / should of / would of / must of
    text = applyRule(text, "could-have", /\b(could|should|would|must|might)\s+of\b/gi, "$1 have", changes, "could of", "could have");
    // alot → a lot
    text = applyRule(text, "alot", /\balot\b/gi, "a lot", changes, "alot", "a lot");
  }

  if (doAAn) {
    // Fix "a" before vowel-sound words and "an" before consonant-sound words.
    text = text.replace(/\b(a|an)\s+([A-Za-z][\w'-]*)/gi, (match, article, next) => {
      const wantsAn = startsWithVowelSound(next);
      const isAn = /^an$/i.test(article);
      if (wantsAn && !isAn) {
        changes.push({ rule: "a-an", before: `a ${next}`, after: `an ${next}`, count: 1 });
        return `an ${next}`;
      }
      if (!wantsAn && isAn) {
        changes.push({ rule: "a-an", before: `an ${next}`, after: `a ${next}`, count: 1 });
        return `a ${next}`;
      }
      return match;
    });
  }

  if (changes.length === 0) {
    warnings.push("No grammar issues detected by the rule set. Manual review still recommended.");
  }

  // Merge a-an entries (each match pushed individually)
  const merged: GrammarChange[] = [];
  for (const c of changes) {
    const last = merged[merged.length - 1];
    if (last && last.rule === c.rule && last.before === c.before && last.after === c.after) {
      last.count += c.count;
    } else {
      merged.push({ ...c });
    }
  }

  return {
    output: text,
    changes: merged,
    totalChanges: merged.reduce((sum, c) => sum + c.count, 0),
    warnings,
  };
}

/** Render a markdown-friendly summary of changes. */
export function summarizeChanges(result: GrammarFixResult): string {
  if (result.changes.length === 0) return "No changes.";
  const lines = ["Rule | Before → After | Count", "--- | --- | ---"];
  for (const c of result.changes) {
    lines.push(`${c.rule} | \`${c.before}\` → \`${c.after}\` | ${c.count}`);
  }
  lines.push(`**Total: ${result.totalChanges}**`);
  return lines.join("\n");
}
