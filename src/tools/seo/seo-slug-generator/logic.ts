/**
 * SEO Slug Generator — pure logic.
 */

export type Separator = "-" | "_" | "." | "~" | "+";
export type CaseMode = "lower" | "upper" | "preserve";

export interface SlugInput {
  text: string;
  separator?: Separator;
  caseMode?: CaseMode;
  /** Remove common stop words (a, an, the, of, in, etc.). Default false. */
  removeStopWords?: boolean;
  /** Stop-word language. Default "en". */
  stopWordLang?: "en" | "es" | "fr" | "de" | "it" | "pt" | "nl" | "sv" | "all";
  /** Transliterate unicode (é→e). Default true. */
  transliterate?: boolean;
  /** Maximum slug length. Truncates on word boundary. */
  maxLength?: number;
  /** Preserve numbers in slug. Default true. */
  preserveNumbers?: boolean;
  /** Strip emoji and symbols. Default true. */
  stripEmoji?: boolean;
  /** Custom replacements applied before slugification: { find: replace }. */
  customReplacements?: { find: string; replace: string }[];
}

export interface SlugResult {
  slug: string;
  originalText: string;
  wordsRemoved: string[];
  truncated: boolean;
  warnings: string[];
}

/** Common stop words by language. */
const STOP_WORDS: Record<string, Set<string>> = {
  en: new Set(["a", "an", "the", "and", "or", "but", "of", "to", "in", "on", "at", "by", "for", "with", "from", "as", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "must", "can", "this", "that", "these", "those", "i", "you", "he", "she", "it", "we", "they", "what", "which", "who", "when", "where", "why", "how"]),
  es: new Set(["el", "la", "los", "las", "un", "una", "unos", "unas", "y", "o", "de", "del", "en", "con", "por", "para", "que", "se", "su", "sus", "al", "lo", "le", "les"]),
  fr: new Set(["le", "la", "les", "un", "une", "des", "et", "ou", "de", "du", "en", "dans", "avec", "pour", "par", "que", "se", "sa", "son", "ses", "au", "aux", "ce", "cette"]),
  de: new Set(["der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "eines", "und", "oder", "aber", "in", "an", "auf", "mit", "bei", "von", "zu", "zur", "zum"]),
  it: new Set(["il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "e", "o", "di", "del", "della", "in", "con", "per", "da", "su", "tra", "fra", "che", "se"]),
  pt: new Set(["o", "a", "os", "as", "um", "uma", "uns", "umas", "e", "ou", "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas", "por", "para", "que", "se", "com"]),
  nl: new Set(["de", "het", "een", "en", "of", "van", "in", "op", "met", "voor", "door", "aan", "uit", "te", "dat", "die", "zijn", "is", "was", "wordt"]),
  sv: new Set(["den", "det", "en", "ett", "och", "eller", "av", "i", "på", "med", "för", "till", "från", "att", "som", "är", "var", "blir"]),
};

function getStopWordSet(lang: string): Set<string> {
  if (lang === "all") {
    const all = new Set<string>();
    for (const set of Object.values(STOP_WORDS)) for (const w of set) all.add(w);
    return all;
  }
  return STOP_WORDS[lang] ?? STOP_WORDS.en!;
}

/** Transliterate common Unicode characters to ASCII. */
function transliterateChar(ch: string): string {
  // Latin-1 supplement + Extended-A common diacritics
  const map: Record<string, string> = {
    "à": "a", "á": "a", "â": "a", "ã": "a", "ä": "a", "å": "a", "æ": "ae",
    "ç": "c",
    "è": "e", "é": "e", "ê": "e", "ë": "e",
    "ì": "i", "í": "i", "î": "i", "ï": "i",
    "ñ": "n",
    "ò": "o", "ó": "o", "ô": "o", "õ": "o", "ö": "o", "ø": "o", "œ": "oe",
    "ù": "u", "ú": "u", "û": "u", "ü": "u",
    "ý": "y", "ÿ": "y",
    "ß": "ss",
    "À": "A", "Á": "A", "Â": "A", "Ã": "A", "Ä": "A", "Å": "A", "Æ": "AE",
    "Ç": "C",
    "È": "E", "É": "E", "Ê": "E", "Ë": "E",
    "Ì": "I", "Í": "I", "Î": "I", "Ï": "I",
    "Ñ": "N",
    "Ò": "O", "Ó": "O", "Ô": "O", "Õ": "O", "Ö": "O", "Ø": "O", "Œ": "OE",
    "Ù": "U", "Ú": "U", "Û": "U", "Ü": "U",
    "Ý": "Y",
    // Greek
    "α": "a", "β": "b", "γ": "g", "δ": "d", "ε": "e", "ζ": "z", "η": "i", "θ": "th", "ι": "i", "κ": "k", "λ": "l", "μ": "m", "ν": "n", "ξ": "x", "ο": "o", "π": "p", "ρ": "r", "σ": "s", "τ": "t", "υ": "y", "φ": "f", "χ": "ch", "ψ": "ps", "ω": "o",
    // Cyrillic (subset)
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "yo", "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
  };
  return map[ch] ?? ch;
}

function transliterate(s: string): string {
  let out = "";
  for (const ch of s) {
    out += transliterateChar(ch);
  }
  return out;
}

function isEmoji(ch: string): boolean {
  const cp = ch.codePointAt(0)!;
  return (cp >= 0x1F300 && cp <= 0x1FAFF) // symbols & pictographs
    || (cp >= 0x2600 && cp <= 0x27BF)     // misc symbols + dingbats
    || (cp >= 0x2B00 && cp <= 0x2BFF);    // misc symbols
}

export function generateSlug(input: SlugInput): SlugResult | { error: string } {
  const { text } = input;
  if (!text) return { error: "Text is required." };
  if (text.length > 500) return { error: "Text is too long (max 500 chars)." };

  const separator = input.separator ?? "-";
  const caseMode = input.caseMode ?? "lower";
  const removeStopWords = input.removeStopWords ?? false;
  const stopWordLang = input.stopWordLang ?? "en";
  const doTransliterate = input.transliterate ?? true;
  const maxLength = input.maxLength;
  const preserveNumbers = input.preserveNumbers ?? true;
  const stripEmoji = input.stripEmoji ?? true;
  const customReplacements = input.customReplacements ?? [];

  const warnings: string[] = [];
  let working = text;

  // Apply custom replacements first
  for (const r of customReplacements) {
    working = working.split(r.find).join(r.replace);
  }

  // Transliterate
  if (doTransliterate) {
    working = transliterate(working);
  }

  // Strip emoji + symbols (preserve letters, numbers, spaces, basic punctuation)
  if (stripEmoji) {
    let stripped = "";
    for (const ch of working) {
      if (isEmoji(ch)) continue;
      // Strip other symbol/punctuation we don't want
      const cp = ch.codePointAt(0)!;
      if (cp >= 0x2000 && cp <= 0x206F) continue; // general punctuation
      stripped += ch;
    }
    working = stripped;
  }

  // Replace any non-alphanumeric with separator
  let slugified = "";
  let lastWasSep = true;
  for (const ch of working) {
    const isLetter = /[a-zA-Z]/.test(ch);
    const isDigit = /[0-9]/.test(ch);
    if (isLetter || (isDigit && preserveNumbers)) {
      slugified += ch;
      lastWasSep = false;
    } else if (!lastWasSep) {
      slugified += separator;
      lastWasSep = true;
    }
  }
  // Trim trailing separator
  if (slugified.endsWith(separator)) slugified = slugified.slice(0, -separator.length);

  // Apply case
  if (caseMode === "lower") slugified = slugified.toLowerCase();
  else if (caseMode === "upper") slugified = slugified.toUpperCase();

  // Remove stop words
  let wordsRemoved: string[] = [];
  if (removeStopWords) {
    const stopSet = getStopWordSet(stopWordLang);
    const words = slugified.split(separator);
    const kept: string[] = [];
    for (const w of words) {
      const checkW = w.toLowerCase();
      if (stopSet.has(checkW)) {
        wordsRemoved.push(w);
      } else {
        kept.push(w);
      }
    }
    slugified = kept.join(separator);
  }

  // Max length truncation on word boundary
  let truncated = false;
  if (maxLength && maxLength > 0 && slugified.length > maxLength) {
    // Find last separator within maxLength
    const truncated_str = slugified.slice(0, maxLength);
    const lastSepIdx = truncated_str.lastIndexOf(separator);
    if (lastSepIdx > 0) {
      slugified = truncated_str.slice(0, lastSepIdx);
    } else {
      slugified = truncated_str;
    }
    truncated = true;
    warnings.push(`Slug truncated to ${slugified.length} chars to respect max length ${maxLength}.`);
  }

  if (!slugified) {
    warnings.push("Slug is empty after processing — text may contain only stop words or symbols.");
  }

  if (slugified.length > 0 && slugified.length > 75) {
    warnings.push(`Slug is ${slugified.length} chars — recommended max is 75 for SEO.`);
  }

  return {
    slug: slugified,
    originalText: text,
    wordsRemoved,
    truncated,
    warnings,
  };
}

/** Batch slugify: one slug per line. */
export function generateSlugsBatch(inputs: SlugInput[]): SlugResult[] | { error: string } {
  if (!inputs.length) return { error: "At least one input is required." };
  const results: SlugResult[] = [];
  for (const inp of inputs) {
    const r = generateSlug(inp);
    if ("error" in r) return r;
    results.push(r);
  }
  return results;
}

/** Reverse: convert a slug back to Title Case. */
export function slugToTitle(slug: string, separator: Separator = "-"): string {
  return slug
    .split(separator)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Add a numeric suffix to avoid collisions (slug-1, slug-2, etc.). */
export function deduplicateSlug(slug: string, existing: string[], separator: Separator = "-"): string {
  if (!existing.includes(slug)) return slug;
  let i = 1;
  while (existing.includes(`${slug}${separator}${i}`)) i++;
  return `${slug}${separator}${i}`;
}
