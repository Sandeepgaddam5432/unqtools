/**
 * AI Business Name Ideator — pure logic.
 *
 * Generate 30+ themed business / brand name ideas from keywords, industry,
 * and style (modern, classic, playful, techy) using combinatorial templates
 * — compounds, portmanteaus, invented words, affixes, alliteration.
 * Score each candidate for brandability (length, syllables, pronounceability,
 * uniqueness). Suggest domain patterns + social-handle patterns + taglines.
 *
 * Pure functions only — no DOM, no network. The optional LLM call
 * (BYO API key) and the optional live DNS-over-HTTPS check both live in
 * ui.tsx because they touch the network.
 *
 * Honesty: brandability is an *indicator*, not a guarantee — your market
 * testing is the real test. Trademark caution: we surface a link to the
 * official USPTO / WIPO search but we do NOT clear names legally. Always
 * run a formal trademark search before launching a brand.
 */

// ---------- Types ----------

export type Style = "modern" | "classic" | "playful" | "techy";
export type Technique =
  | "compound"
  | "portmanteau"
  | "invented"
  | "prefix"
  | "suffix"
  | "alliterative";

export interface NameInputs {
  keywords: string[];
  industry: string;
  style: Style;
  minLength: number;
  maxLength: number;
  maxSyllables: number;
}

export interface BrandabilityScore {
  total: number; // 0–100
  lengthScore: number; // 0–25
  syllableScore: number; // 0–25
  pronounceabilityScore: number; // 0–25
  uniquenessScore: number; // 0–25
  notes: string[];
}

export interface NameCandidate {
  name: string;
  technique: Technique;
  style: Style;
  score: BrandabilityScore;
  domainSuggestions: DomainSuggestion[];
  socialHandles: string[];
  tagline: string;
}

export interface DomainSuggestion {
  domain: string;
  tld: string;
  registrarSearchUrl: string;
}

export interface NameOutput {
  candidates: NameCandidate[];
  warnings: string[];
  count: number;
  uniqueCount: number;
}

export interface HistoryEntry {
  ts: number;
  keywords: string[];
  industry: string;
  style: Style;
  topName: string;
  topScore: number;
}

export interface ShareState {
  inputs: Partial<NameInputs>;
}

export interface LlmEnhancement {
  refinedNames: Array<{ name: string; rationale: string }>;
  taglineSuggestions: string[];
  notes: string[];
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-business-name-ideator:history";
export const HISTORY_MAX = 20;
export const FAVORITES_KEY = "unqtools:ai-business-name-ideator:favorites";
export const FAVORITES_MAX = 50;
export const LLM_KEY_STORAGE = "unqtools:ai-business-name-ideator:llm-key";

export const STYLE_LABELS: Record<Style, string> = {
  modern: "Modern",
  classic: "Classic",
  playful: "Playful",
  techy: "Techy",
};

export const TECHNIQUE_LABELS: Record<Technique, string> = {
  compound: "Compound",
  portmanteau: "Portmanteau",
  invented: "Invented",
  prefix: "Prefix",
  suffix: "Suffix",
  alliterative: "Alliterative",
};

/** Inline hint + sample for each input field. */
export const FIELD_HINTS: Record<keyof NameInputs, { hint: string; sample: string }> = {
  keywords: {
    hint: "1–5 keywords that describe your product, customer, or value. Separate with commas or spaces.",
    sample: "ledger, books, honest",
  },
  industry: {
    hint: "Your industry or vertical (1–3 words). Used to bias affix and root selection.",
    sample: "accounting software",
  },
  style: {
    hint: "Modern (sharp, vowel-light), Classic (Latin roots), Playful (double letters, cheerful suffixes), Techy (short, x/y/z endings).",
    sample: "modern",
  },
  minLength: {
    hint: "Minimum name length (characters). 4 is usually the shortest readable brand.",
    sample: "4",
  },
  maxLength: {
    hint: "Maximum name length. Sweet spot is 5–9 characters.",
    sample: "12",
  },
  maxSyllables: {
    hint: "Maximum syllables. Sweet spot is 2–3.",
    sample: "4",
  },
};

/** Common English words used for uniqueness comparisons. */
const COMMON_WORDS = new Set<string>([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "her",
  "was", "one", "our", "out", "day", "get", "has", "him", "his", "how",
  "its", "may", "new", "now", "old", "see", "two", "way", "who", "boy",
  "did", "let", "say", "she", "too", "use", "apple", "house", "water",
  "world", "school", "money", "story", "light", "right", "place", "thing",
  "every", "great", "small", "large", "next", "best", "make", "take",
  "time", "year", "work", "look", "only", "come", "over", "think",
  "back", "after", "before", "first", "last", "good", "well", "even",
]);

// ---------- Style pools ----------

/**
 * Style-tuned word pools. Each style contributes prefixes, suffixes,
 * "real words" (non-keyword vocabulary to blend with), and foreign/Latin
 * roots. Used by the six generation techniques.
 */
export const STYLE_POOLS: Record<Style, {
  prefixes: string[];
  suffixes: string[];
  realWords: string[];
  roots: string[];
}> = {
  modern: {
    prefixes: ["no", "non", "un", "in", "ex", "al", "be", "lu", "vi", "vo"],
    suffixes: ["ly", "ify", "io", "ai", "ova", "iq", "ic", "us", "ix", "a"],
    realWords: ["flow", "pulse", "loop", "wave", "edge", "rise", "shift", "core", "vault", "kind"],
    roots: ["nov", "lu", "vi", "ver", "luc", "aur", "or", "lum"],
  },
  classic: {
    prefixes: ["aure", "omni", "prime", "veri", "meri", "altus", "novus"],
    suffixes: ["us", "um", "a", "ia", "or", "ix", "um", "aris"],
    realWords: ["trust", "crown", "estate", "guild", "haven", "oak", "stone", "manor", "abode", "haven"],
    roots: ["aur", "ver", "mer", "alt", "nox", "lux", "pac", "sanct"],
  },
  playful: {
    prefixes: ["b", "p", "m", "k", "w", "z", "boo", "pip", "pop", "sm"],
    suffixes: ["y", "ie", "ee", "oo", "le", "kin", "let", "ling", "berry", "pop"],
    realWords: ["bun", "bop", "snug", "toot", "wink", "pop", "blip", "dip", "hug", "smile"],
    roots: ["bun", "pop", "wink", "snug", "blip", "toot"],
  },
  techy: {
    prefixes: ["cy", "syn", "ex", "hex", "bit", "byte", "code", "digi"],
    suffixes: ["x", "y", "z", "iq", "io", "ly", "fy", "tek", "sync", "bot"],
    realWords: ["byte", "bit", "node", "sync", "flux", "grid", "loop", "net", "data", "code"],
    roots: ["byt", "nod", "syn", "flux", "grd", "dat", "cod", "lin"],
  },
};

/** TLDs to suggest as domain patterns. */
export const TLDS = ["com", "io", "co", "app", "ai", "so"] as const;

/**
 * Generic phrases to detect in keyword inputs. Helps the user understand
 * their input is too vague and steer them to specifics.
 */
export const GENERIC_KEYWORDS = new Set<string>([
  "best", "good", "great", "top", "premier", "premium", "leading",
  "innovative", "modern", "advanced", "quality", "expert", "professional",
  "company", "business", "service", "solution",
]);

// ---------- Validation ----------

/**
 * Validate name inputs and return a list of human-readable warnings.
 */
export function validateInputs(inputs: NameInputs): string[] {
  const warnings: string[] = [];
  if (!inputs.keywords || inputs.keywords.length === 0) {
    warnings.push("Add at least one keyword.");
  }
  if (inputs.keywords.length > 5) {
    warnings.push("More than 5 keywords dilutes generation quality — keep to 1–5.");
  }
  if (inputs.keywords.some((k) => k.length > 20)) {
    warnings.push("One or more keywords is very long (over 20 chars) — names may be hard to read.");
  }
  if (inputs.keywords.some((k) => GENERIC_KEYWORDS.has(k.toLowerCase()))) {
    warnings.push("Some keywords are generic (best, quality, modern, etc.) — try more concrete words.");
  }
  if (!inputs.industry || !inputs.industry.trim()) {
    warnings.push("Add an industry — it shapes which affixes and roots the tool pulls from.");
  }
  if (inputs.minLength < 3) {
    warnings.push("Minimum length below 3 chars is rarely brandable.");
  }
  if (inputs.maxLength < inputs.minLength) {
    warnings.push("Max length is smaller than min length — no names will be generated.");
  }
  if (inputs.maxLength > 20) {
    warnings.push("Max length over 20 chars produces names that are hard to remember.");
  }
  if (inputs.maxSyllables < 2) {
    warnings.push("Max syllables below 2 produces one-syllable names only — usually too short to be brandable.");
  }
  return warnings;
}

// ---------- Helpers ----------

/** Capitalize the first character. */
export function capitalize(s: string): string {
  return s && s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Lowercase the first character. */
export function lcFirst(s: string): string {
  return s && s.length > 0 ? s[0].toLowerCase() + s.slice(1) : s;
}

/** Escape a string for use in a RegExp. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strip non-alphanumeric characters and lowercase. Keeps leading digits
 *  (some brands like 37signals or 99designs start with digits). */
export function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/^[^a-z0-9]+/, "")
    .slice(0, 24);
}

/** Parse a comma- or space-separated keyword string into a clean list.
 *  Strips punctuation before validating so "Books!" → "books". */
export function parseKeywords(raw: string): string[] {
  if (!raw) return [];
  const parts = raw
    .split(/[\s,]+/)
    .map((s) => s.trim().toLowerCase().replace(/[^a-z0-9-]/g, ""))
    .filter(Boolean)
    .filter((s) => /^[a-z][a-z0-9-]*$/.test(s));
  return Array.from(new Set(parts)).slice(0, 5);
}

// ---------- Pronounceability ----------

/**
 * Count vowel clusters (each cluster ≈ 1 syllable). Heuristic, but
 * accurate for most English/Latin-invented names.
 */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  let count = (w.match(/[aeiouy]+/g) || []).length;
  // Silent 'e' at end.
  if (w.endsWith("e") && count > 1) count -= 1;
  // 'le' at end forms its own syllable.
  if (w.endsWith("le") && w.length > 2 && !/[aeiou]/.test(w.slice(-3, -1))) count += 1;
  return Math.max(1, count);
}

/**
 * Pronounceability heuristic: vowel/consonant alternation, no awkward
 * clusters (3+ consecutive consonants except common ones), no awkward
 * vowel clusters.
 */
export function scorePronounceability(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length < 3) return 5;
  let score = 25;
  // Penalize 3+ consecutive consonants (except common blends).
  const consonantClusters = w.match(/[^aeiouy]{3,}/g) || [];
  for (const c of consonantClusters) {
    if (!/(sch|scr|shr|sph|spl|spr|squ|str|thr|tch|rth|nth|ght|lds|nds|sts)/.test(c)) {
      score -= 4;
    }
  }
  // Penalize 3+ consecutive vowels.
  const vowelClusters = w.match(/[aeiouy]{3,}/g) || [];
  score -= vowelClusters.length * 4;
  // Penalize awkward character pairs.
  if (/x[bcdfghjklmnpqrstvwxz]{2}/i.test(w)) score -= 3;
  if (/q[^u]/i.test(w)) score -= 3;
  // Reward vowel/consonant alternation.
  let alternations = 0;
  for (let i = 1; i < w.length; i++) {
    const prev = /[aeiouy]/i.test(w[i - 1]);
    const cur = /[aeiouy]/i.test(w[i]);
    if (prev !== cur) alternations += 1;
  }
  const ratio = alternations / Math.max(1, w.length - 1);
  if (ratio > 0.6) score += 3;
  return Math.max(0, Math.min(25, score));
}

/**
 * Uniqueness heuristic: distance from common English words. Closer to a
 * common word = lower uniqueness. Pure invented = higher.
 */
export function scoreUniqueness(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (COMMON_WORDS.has(w)) return 2;
  // Start high and deduct for common-word similarity.
  let score = 25;
  for (const cw of COMMON_WORDS) {
    if (cw.length < 3) continue;
    // Prefix or suffix match against common words reduces uniqueness.
    if (w.startsWith(cw) || w.endsWith(cw)) {
      score -= 6;
      break;
    }
    // Contains a common word as substring (length 4+).
    if (cw.length >= 4 && w.includes(cw)) {
      score -= 4;
      break;
    }
  }
  // Mostly numeric = low brandability.
  if (/^[0-9]+$/.test(w)) score -= 10;
  return Math.max(0, Math.min(25, score));
}

/**
 * Length score: sweet spot 5–9 chars, deduct outside.
 */
export function scoreLength(word: string): number {
  const w = word.replace(/[^a-zA-Z0-9]/g, "");
  const len = w.length;
  if (len < 3) return 0;
  if (len >= 5 && len <= 9) return 25;
  if (len === 4 || len === 10) return 22;
  if (len === 3 || len === 11) return 18;
  if (len === 12) return 14;
  if (len === 13) return 10;
  return 5;
}

/**
 * Syllable score: sweet spot 2–3 syllables.
 */
export function scoreSyllables(word: string): number {
  const s = countSyllables(word);
  if (s === 2 || s === 3) return 25;
  if (s === 1) return 18;
  if (s === 4) return 17;
  if (s === 5) return 10;
  return 5;
}

// ---------- Brandability ----------

/**
 * Compute the brandability score for a candidate name.
 * Returns 0–100 plus per-component scores and human-readable notes.
 */
export function scoreBrandability(name: string): BrandabilityScore {
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, "");
  const lengthScore = scoreLength(cleaned);
  const syllableScore = scoreSyllables(cleaned);
  const pronounceabilityScore = scorePronounceability(cleaned);
  const uniquenessScore = scoreUniqueness(cleaned);
  const total = lengthScore + syllableScore + pronounceabilityScore + uniquenessScore;
  const notes: string[] = [];
  if (lengthScore < 18) notes.push(`Length ${cleaned.length} is outside the 5–9 char sweet spot.`);
  const syl = countSyllables(cleaned);
  if (syl < 2) notes.push(`${syl} syllable — usually too short to be distinctive.`);
  if (syl > 4) notes.push(`${syl} syllables — may be hard to say.`);
  if (pronounceabilityScore < 18) notes.push("Pronounceability concerns (awkward consonant or vowel clusters).");
  if (uniquenessScore < 18) notes.push("Closely resembles a common word — may be hard to trademark or rank for.");
  return {
    total,
    lengthScore,
    syllableScore,
    pronounceabilityScore,
    uniquenessScore,
    notes,
  };
}

// ---------- Generation techniques ----------

/** Combine two words into a compound, capitalizing the second. */
export function buildCompound(a: string, b: string): string {
  if (!a || !b) return "";
  return a.toLowerCase() + capitalize(b.toLowerCase());
}

/** Build a portmanteau by blending the end of `a` with the start of `b`. */
export function buildPortmanteau(a: string, b: string): string {
  if (!a || !b || a.length < 3 || b.length < 3) return "";
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  // Take first 2–3 chars of a and merge with last 2–3 chars of b.
  const splitA = Math.max(2, Math.floor(aLower.length / 2));
  const splitB = Math.max(2, Math.floor(bLower.length / 2));
  return aLower.slice(0, splitA) + bLower.slice(splitB);
}

/** Apply a prefix to a keyword. */
export function applyPrefix(prefix: string, word: string): string {
  if (!prefix || !word) return "";
  return prefix.toLowerCase() + word.toLowerCase();
}

/** Apply a suffix to a keyword. */
export function applySuffix(word: string, suffix: string): string {
  if (!word || !suffix) return "";
  return word.toLowerCase() + suffix.toLowerCase();
}

/** Build an invented name from a foreign/Latin root + a style suffix. */
export function buildInvented(root: string, suffix: string): string {
  if (!root || !suffix) return "";
  return root.toLowerCase() + suffix.toLowerCase();
}

/** Build an alliterative name: same first letter as the keyword, from a real word. */
export function buildAlliterative(keyword: string, realWord: string): string {
  if (!keyword || !realWord) return "";
  if (keyword[0].toLowerCase() !== realWord[0].toLowerCase()) return "";
  return keyword.toLowerCase() + realWord.toLowerCase();
}

// ---------- Generation ----------

/**
 * Generate 30+ candidate names from inputs. Six techniques are used:
 * compound, portmanteau, invented, prefix, suffix, alliterative.
 * Names are deduped (case-insensitive) and filtered by length / syllable
 * constraints before being scored.
 */
export function generate(inputs: NameInputs): NameOutput {
  const warnings = validateInputs(inputs);
  const pool = STYLE_POOLS[inputs.style] ?? STYLE_POOLS.modern;
  const keywords = (inputs.keywords || []).filter((k) => k && k.trim());
  const candidates: NameCandidate[] = [];
  const seen = new Set<string>();

  if (keywords.length === 0) {
    return { candidates, warnings, count: 0, uniqueCount: 0 };
  }

  const add = (name: string, technique: Technique) => {
    if (!name) return;
    const cleaned = name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    if (!cleaned) return;
    if (cleaned.length < inputs.minLength || cleaned.length > inputs.maxLength) return;
    if (countSyllables(cleaned) > inputs.maxSyllables) return;
    if (seen.has(cleaned)) return;
    seen.add(cleaned);
    candidates.push(buildCandidate(capitalize(cleaned), technique, inputs.style));
  };

  // 1. Compounds: keyword + keyword, keyword + real word, real word + keyword.
  for (const k of keywords) {
    for (const k2 of keywords) {
      if (k !== k2) add(buildCompound(k, k2), "compound");
    }
    for (const w of pool.realWords) {
      add(buildCompound(k, w), "compound");
      add(buildCompound(w, k), "compound");
    }
  }

  // 2. Portmanteaus: keyword + keyword, keyword + real word.
  for (const k of keywords) {
    for (const k2 of keywords) {
      if (k !== k2) add(buildPortmanteau(k, k2), "portmanteau");
    }
    for (const w of pool.realWords) {
      add(buildPortmanteau(k, w), "portmanteau");
      add(buildPortmanteau(w, k), "portmanteau");
    }
  }

  // 3. Invented: roots + style suffixes, keywords as roots.
  for (const r of pool.roots) {
    for (const sfx of pool.suffixes) {
      add(buildInvented(r, sfx), "invented");
    }
  }
  for (const k of keywords) {
    // Use first 3 chars of keyword as a "root".
    if (k.length >= 3) {
      for (const sfx of pool.suffixes) {
        add(buildInvented(k.slice(0, 3), sfx), "invented");
      }
    }
  }

  // 4. Prefixes.
  for (const p of pool.prefixes) {
    for (const k of keywords) {
      add(applyPrefix(p, k), "prefix");
    }
  }

  // 5. Suffixes.
  for (const sfx of pool.suffixes) {
    for (const k of keywords) {
      add(applySuffix(k, sfx), "suffix");
    }
  }

  // 6. Alliterative: keyword + real word with same first letter.
  for (const k of keywords) {
    for (const w of pool.realWords) {
      add(buildAlliterative(k, w), "alliterative");
      add(buildAlliterative(w, k), "alliterative");
    }
  }

  // Sort by score desc, then by name asc for stable output.
  candidates.sort((a, b) => {
    if (b.score.total !== a.score.total) return b.score.total - a.score.total;
    return a.name.localeCompare(b.name);
  });

  // Cap at 80 candidates for performance + readability.
  const capped = candidates.slice(0, 80);
  return {
    candidates: capped,
    warnings,
    count: candidates.length,
    uniqueCount: seen.size,
  };
}

/** Build a single NameCandidate with score, domain suggestions, handles, tagline. */
export function buildCandidate(name: string, technique: Technique, style: Style): NameCandidate {
  const score = scoreBrandability(name);
  const slug = slugify(name);
  return {
    name,
    technique,
    style,
    score,
    domainSuggestions: suggestDomains(slug),
    socialHandles: suggestSocialHandles(slug),
    tagline: suggestTagline(name, technique),
  };
}

// ---------- Domain / handle / tagline suggestions ----------

/**
 * Suggest domain patterns for a name. Each suggestion includes a
 * one-click search URL into a registrar (Namecheap) so the user can
 * verify availability themselves. No network call is made by this fn.
 */
export function suggestDomains(slug: string): DomainSuggestion[] {
  if (!slug) return [];
  const out: DomainSuggestion[] = [];
  for (const tld of TLDS) {
    const domain = `${slug}.${tld}`;
    out.push({
      domain,
      tld,
      registrarSearchUrl: `https://www.namecheap.com/domains/registration/results/?domain=${encodeURIComponent(domain)}`,
    });
  }
  // Add a "get" prefixed variant for the .com (common pattern).
  out.push({
    domain: `get${slug}.com`,
    tld: "com",
    registrarSearchUrl: `https://www.namecheap.com/domains/registration/results/?domain=get${encodeURIComponent(slug)}.com`,
  });
  return out;
}

/** Suggest social-handle patterns for a name. */
export function suggestSocialHandles(slug: string): string[] {
  if (!slug) return [];
  return [
    `@${slug}`,
    `@get${slug}`,
    `@${slug}app`,
    `@try${slug}`,
    `@${slug}hq`,
  ];
}

/** Suggest a short tagline pairing for a name, varied by technique. */
export function suggestTagline(name: string, technique: Technique): string {
  const n = name || "[name]";
  switch (technique) {
    case "compound":
      return `${n}: two ideas, one brand.`;
    case "portmanteau":
      return `${n}: where two ideas meet.`;
    case "invented":
      return `${n}: a new word for a new thing.`;
    case "prefix":
      return `${n}: your category, reimagined.`;
    case "suffix":
      return `${n}: the next generation of your category.`;
    case "alliterative":
      return `${n}: memorable from the first letter.`;
    default:
      return `${n}.`;
  }
}

// ---------- Trademark / legal caution ----------

/** Build the trademark caution note shown to users. */
export function trademarkCaution(): string {
  return "Name generation does NOT clear trademarks. Always run a formal trademark search (USPTO TESS for the US, WIPO Global Brand Database for international) before launching a brand. The brandability score is an indicator, not legal clearance.";
}

/** Build a list of trademark-search links for a name. */
export function trademarkSearchUrls(name: string): Array<{ label: string; url: string }> {
  const slug = slugify(name);
  return [
    {
      label: "USPTO TESS",
      url: `https://tmsearch.uspto.gov/search/search-information?searchText=${encodeURIComponent(slug)}`,
    },
    {
      label: "WIPO Global Brand Database",
      url: `https://branddb.wipo.int/en/quicksearch/brand/${encodeURIComponent(slug)}`,
    },
    {
      label: "Google (general)",
      url: `https://www.google.com/search?q=${encodeURIComponent(`"${slug}" brand`)}`,
    },
  ];
}

// ---------- Render ----------

/** Render the candidates as a CSV (name, technique, score, top domain suggestion). */
export function renderCsv(output: NameOutput): string {
  const lines: string[] = [];
  lines.push("name,technique,style,score,length,syllables,pronounceability,uniqueness,top_domain,top_social,tagline");
  for (const c of output.candidates) {
    const fields = [
      c.name,
      TECHNIQUE_LABELS[c.technique],
      STYLE_LABELS[c.style],
      String(c.score.total),
      String(c.score.lengthScore),
      String(c.score.syllableScore),
      String(c.score.pronounceabilityScore),
      String(c.score.uniquenessScore),
      c.domainSuggestions[0]?.domain ?? "",
      c.socialHandles[0] ?? "",
      `"${c.tagline.replace(/"/g, '""')}"`,
    ];
    lines.push(fields.join(","));
  }
  return lines.join("\n");
}

/** Render the output as a Markdown report. */
export function renderMarkdown(output: NameOutput, inputs: NameInputs): string {
  const lines: string[] = [];
  lines.push(`# Business name ideas — ${inputs.industry || "(no industry)"}`);
  lines.push("");
  lines.push(`_Generated by UnQTools AI Business Name Ideator. ${output.uniqueCount} unique names, top ${output.candidates.length} shown._`);
  lines.push("");
  lines.push("## Inputs");
  lines.push("");
  lines.push(`- **Keywords:** ${inputs.keywords.join(", ") || "—"}`);
  lines.push(`- **Industry:** ${inputs.industry || "—"}`);
  lines.push(`- **Style:** ${STYLE_LABELS[inputs.style]}`);
  lines.push(`- **Length:** ${inputs.minLength}–${inputs.maxLength} chars`);
  lines.push(`- **Max syllables:** ${inputs.maxSyllables}`);
  lines.push("");
  if (output.warnings.length > 0) {
    lines.push("## Warnings");
    lines.push("");
    for (const w of output.warnings) lines.push(`- ${w}`);
    lines.push("");
  }
  lines.push("## Top candidates");
  lines.push("");
  for (const c of output.candidates) {
    lines.push(`### ${c.name} — ${c.score.total}/100`);
    lines.push("");
    lines.push(`- **Technique:** ${TECHNIQUE_LABELS[c.technique]}`);
    lines.push(`- **Length:** ${c.score.lengthScore}/25 · **Syllables:** ${c.score.syllableScore}/25 · **Pronounceability:** ${c.score.pronounceabilityScore}/25 · **Uniqueness:** ${c.score.uniquenessScore}/25`);
    if (c.score.notes.length > 0) {
      for (const n of c.score.notes) lines.push(`  - ${n}`);
    }
    lines.push(`- **Tagline:** ${c.tagline}`);
    lines.push(`- **Domains:** ${c.domainSuggestions.slice(0, 3).map((d) => d.domain).join(", ")}`);
    lines.push(`- **Social:** ${c.socialHandles.slice(0, 3).join(", ")}`);
    lines.push("");
  }
  lines.push("## Trademark caution");
  lines.push("");
  lines.push(trademarkCaution());
  return lines.join("\n");
}

/** Render the output as JSON (full inputs + output). */
export function renderJson(output: NameOutput, inputs: NameInputs): string {
  return JSON.stringify({ inputs, output, generatedAt: new Date().toISOString() }, null, 2);
}

// ---------- History (localStorage) ----------

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------- Favorites (localStorage) ----------

export function loadFavorites(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) ? arr.slice(0, FAVORITES_MAX) : [];
  } catch {
    return [];
  }
}

export function toggleFavorite(name: string): string[] {
  const current = loadFavorites();
  const slug = slugify(name);
  const next = current.includes(slug)
    ? current.filter((n) => n !== slug)
    : [slug, ...current].slice(0, FAVORITES_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearFavorites(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(FAVORITES_KEY);
  } catch {
    // ignore
  }
}

// ---------- Shareable URL ----------

export function buildShareUrl(inputs: NameInputs): string {
  const params = new URLSearchParams();
  if (inputs.keywords.length > 0) params.set("kw", inputs.keywords.join(","));
  if (inputs.industry) params.set("ind", inputs.industry);
  if (inputs.style !== "modern") params.set("style", inputs.style);
  if (inputs.minLength !== 4) params.set("min", String(inputs.minLength));
  if (inputs.maxLength !== 12) params.set("max", String(inputs.maxLength));
  if (inputs.maxSyllables !== 4) params.set("syl", String(inputs.maxSyllables));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  let clean = hash;
  if (clean.startsWith("#") || clean.startsWith("?")) clean = clean.slice(1);
  if (!clean) return { inputs: {} };
  const params = new URLSearchParams(clean);
  const inputs: Partial<NameInputs> = {};
  const kw = params.get("kw");
  if (kw) inputs.keywords = parseKeywords(kw);
  const ind = params.get("ind");
  if (ind) inputs.industry = ind;
  const style = params.get("style");
  if (style === "modern" || style === "classic" || style === "playful" || style === "techy") {
    inputs.style = style;
  }
  const min = params.get("min");
  if (min && /^\d+$/.test(min)) inputs.minLength = parseInt(min, 10);
  const max = params.get("max");
  if (max && /^\d+$/.test(max)) inputs.maxLength = parseInt(max, 10);
  const syl = params.get("syl");
  if (syl && /^\d+$/.test(syl)) inputs.maxSyllables = parseInt(syl, 10);
  return { inputs };
}

// ---------- Optional LLM enhancement ----------

export function buildLlmPrompt(inputs: NameInputs, sample: string[]): string {
  return [
    "You are an expert brand naming consultant. Review the candidate business names below and propose 5–10 refined names with rationale.",
    "",
    "Inputs:",
    `- Keywords: ${inputs.keywords.join(", ") || "(none)"}`,
    `- Industry: ${inputs.industry || "(none)"}`,
    `- Style: ${STYLE_LABELS[inputs.style]}`,
    `- Length range: ${inputs.minLength}–${inputs.maxLength} chars`,
    `- Max syllables: ${inputs.maxSyllables}`,
    "",
    `Candidate names so far (top ${sample.length}):`,
    ...sample.map((n) => `- ${n}`),
    "",
    "Output a JSON object with:",
    '- "refinedNames": array of { "name": string, "rationale": string } (5–10 items, each name should be ≤14 chars, brandable, not a common word)',
    '- "taglineSuggestions": array of 5 strings (short taglines, each ≤8 words)',
    '- "notes": array of strings (specific naming advice for this industry/style)',
    "",
    "Do not include domain extensions in the names. Avoid names that are existing well-known brands. Be honest — flag if the keyword pool is too generic.",
  ].join("\n");
}

export function renderLlmResult(rawText: string):
  | { ok: true; result: LlmEnhancement }
  | { ok: false; error: string } {
  let s = (rawText || "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  let obj: unknown;
  try {
    obj = JSON.parse(s);
  } catch {
    return { ok: false, error: "Could not parse LLM output as JSON. Try again." };
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return { ok: false, error: "LLM output was not a JSON object." };
  }
  const o = obj as Record<string, unknown>;
  const refinedNames = Array.isArray(o.refinedNames)
    ? (o.refinedNames as unknown[])
        .filter((x) => typeof x === "object" && x !== null && !Array.isArray(x))
        .map((x) => {
          const r = x as Record<string, unknown>;
          return {
            name: typeof r.name === "string" ? r.name : "",
            rationale: typeof r.rationale === "string" ? r.rationale : "",
          };
        })
        .filter((x) => x.name.length > 0)
    : [];
  const taglineSuggestions = Array.isArray(o.taglineSuggestions)
    ? (o.taglineSuggestions as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  const notes = Array.isArray(o.notes)
    ? (o.notes as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  return {
    ok: true,
    result: { refinedNames, taglineSuggestions, notes },
  };
}
