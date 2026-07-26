/**
 * Pig Latin Decoder — pure logic.
 * Decodes Pig Latin back to English using rule-based + heuristic approaches.
 *
 * Pig Latin rules (encoder, for reference):
 *  - Starts with consonant: move consonant cluster to end + "ay"  (smile → ilesmay)
 *  - Starts with vowel: add "way" or "yay" (apple → appleway)
 *  - Starts with "qu": move "qu" together (queen → eenquay)
 *
 * Decoder must reverse these, but ambiguity exists (e.g. "ilesmay" → smile OR ilesm+ay).
 * Heuristics help: prefer real English words, common consonant clusters.
 */

const VOWELS = ["a", "e", "i", "o", "u"];

/** Common English consonant clusters (prefer these when decoding). */
const CLUSTERS = [
  "sch", "scr", "shr", "sph", "spl", "spr", "squ", "str", "thr",
  "ch", "gh", "gn", "ph", "pr", "qu", "sc", "sh", "sk", "sl", "sm", "sn", "sp", "st", "sw", "th", "tr", "tw", "wh", "wr",
  "bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl",
];

/** Small dictionary of common English words for heuristic verification. */
const COMMON_WORDS = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
  "this", "but", "his", "by", "from", "they", "we", "say", "her", "she", "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
  "smile", "hello", "world", "pig", "latin", "queen", "apple", "banana", "chair", "string", "school",
  "is", "are", "was", "were", "am", "been", "being", "have", "has", "had", "do", "does", "did", "go", "goes", "went", "come", "comes", "came",
]);

export interface DecodeOptions {
  /** Suffix used for vowel-start words (default: any of "way", "yay", "ay"). */
  vowelSuffix?: string[];
  /** Suffix used for consonant-start words (default: "ay"). */
  consonantSuffix?: string;
  /** Preserve original case of decoded word. */
  preserveCase?: boolean;
  /** Use heuristic to pick most-likely English word. */
  useHeuristic?: boolean;
}

/** Detect if a word ends with one of the given suffixes. Returns the suffix matched or null. */
export function matchSuffix(word: string, suffixes: string[]): string | null {
  const lower = word.toLowerCase();
  for (const s of suffixes) {
    if (lower.endsWith(s.toLowerCase())) return s;
  }
  return null;
}

/** Preserve case pattern: apply the case pattern of `template` to `word`. */
export function applyCase(template: string, word: string): string {
  if (template === template.toUpperCase()) return word.toUpperCase();
  if (template[0] === template[0]?.toUpperCase()) {
    return word[0].toUpperCase() + word.slice(1).toLowerCase();
  }
  return word.toLowerCase();
}

/** Is the word capitalized (first letter uppercase)? */
function isCapitalized(word: string): boolean {
  return word.length > 0 && word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase();
}

/** Is the word all-caps? */
function isAllCaps(word: string): boolean {
  return word === word.toUpperCase() && /[A-Z]/.test(word);
}

/** Does the word have any uppercase letters (anywhere)? */
function hasAnyUppercase(word: string): boolean {
  return /[A-Z]/.test(word);
}

/** Decode a single Pig Latin word. Returns array of possible decodings. */
export function decodeWord(word: string, options: DecodeOptions = {}): string[] {
  const vowelSuffixes = options.vowelSuffix ?? ["way", "yay", "ay"];
  const consonantSuffix = options.consonantSuffix ?? "ay";
  const preserveCase = options.preserveCase ?? true;
  const useHeuristic = options.useHeuristic ?? true;

  if (!word) return [word];
  const lower = word.toLowerCase();
  const wasCap = hasAnyUppercase(word) && !isAllCaps(word);
  const wasAllCaps = isAllCaps(word);

  const results = new Set<string>();
  const apply = (decoded: string) => {
    if (preserveCase) {
      if (wasAllCaps) results.add(decoded.toUpperCase());
      else if (wasCap) results.add(decoded[0].toUpperCase() + decoded.slice(1));
      else results.add(decoded);
    } else {
      results.add(decoded);
    }
  };

  // Case 1: vowel-start word (e.g. "appleway" → "apple")
  for (const suf of vowelSuffixes) {
    if (lower.endsWith(suf)) {
      const stem = lower.slice(0, -suf.length);
      if (stem.length > 0 && VOWELS.includes(stem[0])) {
        apply(stem);
      }
    }
  }

  // Case 2: consonant-start word (e.g. "ilesmay" → "smile")
  if (lower.endsWith(consonantSuffix)) {
    const stem = lower.slice(0, -consonantSuffix.length);
    // The "stem" includes a moved consonant cluster at the end.
    // Try every possible cluster position.
    for (let i = 1; i <= stem.length; i++) {
      const cluster = stem.slice(-i);
      const base = stem.slice(0, -i);
      if (base.length === 0) continue;
      // The base should start with a vowel (after the cluster is moved back to front)
      if (VOWELS.includes(base[0])) {
        // Re-attach cluster at front
        apply(cluster + base);
      }
    }
    // Special case: "qu" cluster (e.g. "eenquay" → "queen")
    // Try moving "qu" back to front if base ends with a vowel before "qu"
    if (stem.endsWith("qu")) {
      const base = stem.slice(0, -2);
      if (base.length > 0 && VOWELS.includes(base[base.length - 1])) {
        apply("qu" + base);
      }
    }
  }

  // If no decoding found, return the original word unchanged
  if (results.size === 0) apply(lower);

  // Heuristic: prefer common English words or longer/more-cluster-matched decodings
  const arr = Array.from(results);
  if (useHeuristic && arr.length > 1) {
    // Prefer words in our dictionary
    const dictWords = arr.filter((w) => COMMON_WORDS.has(w.toLowerCase()));
    if (dictWords.length > 0) return dictWords;
    // Prefer decodings that start with a known consonant cluster
    const clusterWords = arr.filter((w) => {
      const low = w.toLowerCase();
      return CLUSTERS.some((c) => low.startsWith(c));
    });
    if (clusterWords.length > 0) return clusterWords;
  }
  return arr;
}

/** Decode a Pig Latin sentence. Returns the best-guess decoding for each word. */
export function decodeSentence(text: string, options: DecodeOptions = {}): string {
  return text
    .split(/\s+/)
    .map((token) => {
      // Preserve leading/trailing punctuation
      const m = token.match(/^([^\w]*)([\w'-]+)?([^\w]*)$/);
      if (!m || !m[2]) return token;
      const lead = m[1];
      const word = m[2];
      const trail = m[3];
      const decodings = decodeWord(word, options);
      let best = decodings[0];
      // Capitalize the first letter of each decoded word (sentence-case for each word)
      if (best && best.length > 0) {
        best = best[0].toUpperCase() + best.slice(1);
      }
      return `${lead}${best}${trail}`;
    })
    .join(" ");
}

/** Decode with full alternatives: returns all possible decodings per word. */
export function decodeWithAlternatives(text: string, options: DecodeOptions = {}): { word: string; alternatives: string[] }[] {
  return text.split(/\s+/).map((token) => {
    const m = token.match(/^([^\w]*)([\w'-]+)?([^\w]*)$/);
    if (!m || !m[2]) return { word: token, alternatives: [token] };
    return { word: token, alternatives: decodeWord(m[2], options) };
  });
}

/** Encode a word to Pig Latin (for verification). */
export function encodeWord(word: string, options: DecodeOptions = {}): string {
  const vowelSuffix = (options.vowelSuffix ?? ["way"])[0];
  const consonantSuffix = options.consonantSuffix ?? "ay";
  const lower = word.toLowerCase();
  if (VOWELS.includes(lower[0])) {
    return applyCaseOriginal(word, lower + vowelSuffix);
  }
  // Find initial consonant cluster (including "qu")
  let clusterEnd = 0;
  while (clusterEnd < lower.length && !VOWELS.includes(lower[clusterEnd])) {
    clusterEnd++;
    // Check if "qu" pattern (consonant + u after q)
    if (lower[clusterEnd - 1] === "q" && lower[clusterEnd] === "u") {
      clusterEnd++;
      break;
    }
  }
  const cluster = lower.slice(0, clusterEnd);
  const rest = lower.slice(clusterEnd);
  return applyCaseOriginal(word, rest + cluster + consonantSuffix);
}

function applyCaseOriginal(template: string, word: string): string {
  if (isAllCaps(template)) return word.toUpperCase();
  if (isCapitalized(template)) return word[0].toUpperCase() + word.slice(1);
  return word;
}

/** Validate a Pig Latin word — checks suffix and structure. */
export function validateWord(word: string): { valid: boolean; reason: string } {
  if (!word) return { valid: false, reason: "Empty" };
  const lower = word.toLowerCase();
  const suffixes = ["way", "yay", "ay"];
  if (!suffixes.some((s) => lower.endsWith(s))) {
    return { valid: false, reason: "Does not end in -ay/-way/-yay" };
  }
  return { valid: true, reason: "OK" };
}

/** Statistics: total words, valid Pig Latin, decoded successfully. */
export function decodeStats(text: string, options: DecodeOptions = {}): {
  total: number;
  valid: number;
  invalid: number;
} {
  const words = text.split(/\s+/).filter(Boolean);
  let valid = 0;
  for (const w of words) {
    if (validateWord(w).valid) valid++;
  }
  return { total: words.length, valid, invalid: words.length - valid };
}

/** Batch decode multiple lines. */
export function batchDecode(text: string, options: DecodeOptions = {}): string {
  return text
    .split(/\r?\n/)
    .map((line) => decodeSentence(line, options))
    .join("\n");
}

/** Suggest the most likely English original for an ambiguous decoding. */
export function suggestBest(alternatives: string[]): string {
  // Prefer dictionary words
  const inDict = alternatives.find((w) => COMMON_WORDS.has(w.toLowerCase()));
  if (inDict) return inDict;
  // Prefer shorter words (more likely correct)
  return alternatives.sort((a, b) => a.length - b.length)[0] ?? alternatives[0];
}
