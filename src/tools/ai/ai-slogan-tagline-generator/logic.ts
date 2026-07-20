/**
 * AI Slogan & Tagline Generator — pure logic.
 *
 * Deterministically generate catchy slogans and taglines from a brand name
 * and keywords across six style families (benefit, emotional, witty,
 * rhyming, minimalist, imperative) using 100+ bundled power words, then
 * score each on length, memorability, and impact. Includes alliteration
 * and end-rhyme detection, a bundled cliché filter, an A/B pair
 * generator, favorites, history, and a shareable URL. Optional BYO-key
 * LLM call lives in ui.tsx (touches network).
 *
 * Pure functions only — no DOM, no network.
 *
 * Honesty: the scorer is a deterministic heuristic (syllable counts,
 * phonetic devices, power-word density, cliché list) — useful for ranking
 * but not a substitute for human judgement. The cliché list is bundled and
 * dated; it is NOT a trademark clearance check. Nothing is uploaded or
 * logged by us.
 */

// ---------- Types ----------

export type SloganStyle =
  | "benefit"
  | "emotional"
  | "witty"
  | "rhyming"
  | "minimalist"
  | "imperative";

export type Tone = "playful" | "bold" | "premium" | "friendly" | "trustworthy";

export interface Slogan {
  text: string;
  style: SloganStyle;
  tone: Tone;
  score: SloganScore;
}

export interface SloganScore {
  length: number;       // 0..100
  memorability: number; // 0..100
  impact: number;       // 0..100
  overall: number;      // weighted average, 0..100
}

export interface GenerateOptions {
  tone: Tone;
  /** Optional style filter; if omitted, all styles are used. */
  styles?: SloganStyle[];
  /** Min/max word count for the slogan (excluding the brand name). */
  minWords?: number;
  maxWords?: number;
  /** Require the slogan to contain the brand or one of the keywords. */
  brandFit?: boolean;
  /** Filter out slogans matching the bundled cliché list. */
  avoidCliches?: boolean;
  /** Toggle alliteration preference (boosts alliterative slogans). */
  alliteration?: boolean;
  /** Toggle rhyme preference (boosts rhyming slogans). */
  rhyme?: boolean;
  /** Maximum number of slogans to return. */
  limit?: number;
}

export interface AbPair {
  a: Slogan;
  b: Slogan;
}

export interface HistoryEntry {
  ts: number;
  brand: string;
  keywords: string[];
  tone: Tone;
  count: number;
}

export interface ShareState {
  brand: string;
  keywords: string;
  tone: Tone;
}

export interface LlmEnhancement {
  slogans: string[];
  explanation: string;
  warnings: string[];
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-slogan-tagline-generator:history";
export const FAV_KEY = "unqtools:ai-slogan-tagline-generator:favorites";
export const HISTORY_MAX = 20;
export const FAV_MAX = 50;
export const LLM_KEY_STORAGE = "unqtools:ai-slogan-tagline-generator:llm-key";

/** 100+ power words that boost impact scores. */
export const POWER_WORDS: string[] = [
  // action
  "unleash", "ignite", "transform", "elevate", "empower", "amplify",
  "accelerate", "conquer", "master", "thrive", "boost", "sharpen",
  "build", "create", "design", "craft", "launch", "deliver",
  // emotion
  "love", "joy", "freedom", "dream", "adventure", "wonder",
  "passion", "magic", "forever", "always", "never", "ever",
  "happy", "smile", "calm", "peace", "hope", "glow",
  // outcome
  "effortless", "easy", "simple", "fast", "smart", "brilliant",
  "bold", "fearless", "unstoppable", "limitless", "infinite", "supreme",
  // exclusivity
  "premium", "elite", "exclusive", "rare", "ultimate", "essential",
  // trust
  "trusted", "proven", "guaranteed", "real", "authentic", "genuine",
  // value
  "free", "save", "win", "discover", "unlock", "reveal",
  // time
  "now", "today", "instant", "always", "first", "next",
  // sensory
  "fresh", "crisp", "smooth", "vivid", "bright", "sharp",
  // comparative
  "better", "best", "more", "most", "less", "zero",
  // mystery
  "secret", "hidden", "untold", "beyond", "unknown", "future",
  // outcome-2
  "perfect", "flawless", "seamless", "instant", "remarkable",
  "unbeatable", "legendary", "iconic", "timeless", "phenomenal",
  // motion
  "rise", "soar", "fly", "leap", "drive", "rush",
];

/** Known cliché slogans to filter (lowercase). NOT a trademark clearance. */
export const CLICHES: string[] = [
  "just do it", "think different", "got milk", "i'm lovin' it",
  "because you're worth it", "the ultimate driving machine",
  "taste the feeling", "open happiness", "finger lickin' good",
  "melts in your mouth not in your hands", "it's the real thing",
  "have it your way", "king of beers", "breakfast of champions",
  "plop plop fizz fizz", "where's the beef", "whassup",
  "can you hear me now", "what's in your wallet", "you're in good hands",
  "like a good neighbor", "the quicker picker upper", "maybe she's born with it",
  "we try harder", "a diamond is forever", "don't leave home without it",
  "reach out and touch someone", "it takes a licking and keeps on ticking",
  "there are some things money can't buy", "good to the last drop",
  "when it absolutely positively has to be there overnight", "we bring good things to life",
  "imagination at work", "let's build something together", "what can brown do for you",
  "the happiest place on earth", "it's everywhere you want to be",
  "save money live better", "every little helps", "always low prices",
  "expect more pay less", "the joy of soda", "for the love of food",
];

export const STYLES: SloganStyle[] = [
  "benefit", "emotional", "witty", "rhyming", "minimalist", "imperative",
];

export const STYLE_LABELS: Record<SloganStyle, string> = {
  benefit: "Benefit-led",
  emotional: "Emotional",
  witty: "Witty",
  rhyming: "Rhyming",
  minimalist: "Minimalist",
  imperative: "Imperative",
};

export const TONES: Tone[] = ["playful", "bold", "premium", "friendly", "trustworthy"];

export const TONE_LABELS: Record<Tone, string> = {
  playful: "Playful",
  bold: "Bold",
  premium: "Premium",
  friendly: "Friendly",
  trustworthy: "Trustworthy",
};

/** Tone → power-word subset preference (for variety / flavor). */
export const TONE_POWER_WORDS: Record<Tone, string[]> = {
  playful: ["fun", "joy", "happy", "play", "smile", "magic", "wonder"],
  bold: ["bold", "fearless", "unstoppable", "conquer", "ignite", "unleash"],
  premium: ["premium", "elite", "exclusive", "ultimate", "rare", "essential"],
  friendly: ["easy", "simple", "warm", "welcome", "together", "always"],
  trustworthy: ["trusted", "proven", "real", "genuine", "guaranteed", "since"],
};

/** Slogan formula templates per style. ${brand}, ${kw}, ${pw} are substituted. */
export const SLOGAN_FORMULAS: Record<SloganStyle, string[]> = {
  benefit: [
    "${brand}: ${pw}, every time.",
    "Get more from your ${kw} with ${brand}.",
    "${brand} makes ${kw} ${pw}.",
    "Your ${kw}, ${pw}—by ${brand}.",
    "${brand}: where ${kw} meets ${pw}.",
  ],
  emotional: [
    "Love your ${kw} again with ${brand}.",
    "${brand}: ${pw} for what matters.",
    "Feel the ${pw} of ${brand}.",
    "${brand}: ${kw} that moves you.",
    "Bring your ${kw} to life—${brand}.",
  ],
  witty: [
    "${brand}: because ${kw} deserves ${pw}.",
    "Less ${kw}. More ${brand}.",
    "${brand}: ${pw} with a wink.",
    "We ${kw}. So you don't have to—${brand}.",
    "${brand}: seriously ${pw}.",
  ],
  rhyming: [
    "${brand}: ${kw} at its best, put us to the test.",
    "From first to best, ${brand} beats the rest.",
    "${brand}—${pw}, nothing less.",
    "When ${kw} is the quest, ${brand} is best.",
    "${brand}: the ${kw} you crave, the ${pw} you save.",
  ],
  minimalist: [
    "${brand}. ${pw}.",
    "${brand}: ${kw}.",
    "Just ${brand}.",
    "${brand}—${pw}.",
    "${kw}, by ${brand}.",
  ],
  imperative: [
    "Unleash your ${kw} with ${brand}.",
    "Choose ${brand}. Choose ${pw}.",
    "Discover ${pw}—discover ${brand}.",
    "Make every ${kw} ${pw}—${brand}.",
    "Go ${brand}. Go ${pw}.",
  ],
};

// ---------- Helpers ----------

/** Normalize a string: trim, collapse whitespace, lowercase for matching. */
export function normalize(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Tokenize a string into lowercased words (no punctuation). */
export function tokenize(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Count words in a string. */
export function countWords(s: string): number {
  return tokenize(s).length;
}

/** Heuristic syllable count for a single word. */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  // Count vowel groups, subtract silent e.
  const groups = w.match(/[aeiouy]+/g);
  let n = groups ? groups.length : 1;
  if (w.endsWith("e") && n > 1) n -= 1;
  if (w.endsWith("le") && w.length > 2 && !/[aeiouy]/.test(w[w.length - 3] ?? "")) n += 1;
  return Math.max(1, n);
}

/** Total syllables across a phrase. */
export function totalSyllables(s: string): number {
  return tokenize(s).reduce((sum, w) => sum + countSyllables(w), 0);
}

/** Detect alliteration: 2+ words in a row share the same first letter. */
export function detectAlliteration(s: string): boolean {
  const words = tokenize(s);
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i][0] === words[i + 1][0] && words[i][0] !== "") return true;
  }
  return false;
}

/** Detect end-rhyme between two words (last 2+ chars match, ignoring case). */
export function detectRhyme(a: string, b: string): boolean {
  const x = a.toLowerCase().replace(/[^a-z]/g, "");
  const y = b.toLowerCase().replace(/[^a-z]/g, "");
  if (x.length < 3 || y.length < 3) return false;
  if (x === y) return false;
  const tail = Math.min(2, x.length, y.length);
  return x.slice(-tail) === y.slice(-tail);
}

/** Detect whether the slogan contains an end-rhyme anywhere in the phrase. */
export function detectPhraseRhyme(s: string): boolean {
  const words = tokenize(s);
  if (words.length < 2) return false;
  for (let i = 0; i < words.length - 1; i++) {
    for (let j = i + 1; j < words.length; j++) {
      if (detectRhyme(words[i], words[j])) return true;
    }
  }
  return false;
}

/** Check whether a slogan matches the bundled cliché list. */
export function isCliche(s: string, cliches: string[] = CLICHES): boolean {
  const t = normalize(s).toLowerCase();
  if (!t) return false;
  return cliches.some((c) => t.includes(c.toLowerCase()));
}

/** Pick a random element from an array (deterministic if seed provided). */
function pick<T>(arr: readonly T[], rng: () => number = Math.random): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Mulberry32 seeded RNG for deterministic output. */
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

/** Parse comma- or newline-separated keywords. */
export function parseKeywords(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,;]+/)
    .map((s) => normalize(s))
    .filter(Boolean);
}

// ---------- Scoring ----------

/** Score length on a 0..100 scale; sweet spot is 3–6 words. */
export function scoreLength(text: string): number {
  const n = countWords(text);
  if (n === 0) return 0;
  if (n >= 3 && n <= 6) return 100;
  if (n === 2 || n === 7) return 80;
  if (n === 1 || n === 8) return 60;
  if (n === 9 || n === 10) return 40;
  return 20;
}

/** Score memorability: rewards alliteration, rhyme, manageable syllables. */
export function scoreMemorability(text: string): number {
  const words = tokenize(text);
  if (words.length === 0) return 0;
  let score = 50;
  if (detectAlliteration(text)) score += 20;
  if (detectPhraseRhyme(text)) score += 15;
  const syl = totalSyllables(text);
  // sweet spot 4–10 syllables for a tagline
  if (syl >= 4 && syl <= 10) score += 15;
  else if (syl < 3) score -= 5;
  else if (syl > 14) score -= 20;
  // Penalise tongue-twisters: any word with 5+ syllables
  if (words.some((w) => countSyllables(w) >= 5)) score -= 10;
  return clamp(score, 0, 100);
}

/** Score impact: power-word density, cliché penalty. */
export function scoreImpact(
  text: string,
  opts: { alliteration?: boolean; rhyme?: boolean; avoidCliches?: boolean } = {},
): number {
  const words = tokenize(text);
  if (words.length === 0) return 0;
  const pwHits = words.filter((w) => POWER_WORDS.includes(w)).length;
  const density = pwHits / words.length;
  let score = 40 + density * 120; // baseline + density bonus
  if (opts.alliteration && detectAlliteration(text)) score += 5;
  if (opts.rhyme && detectPhraseRhyme(text)) score += 5;
  if (opts.avoidCliches && isCliche(text)) score -= 30;
  return clamp(Math.round(score), 0, 100);
}

/** Combined 0..100 score for a slogan. */
export function scoreOverall(
  text: string,
  opts: { alliteration?: boolean; rhyme?: boolean; avoidCliches?: boolean } = {},
): SloganScore {
  const length = scoreLength(text);
  const memorability = scoreMemorability(text);
  const impact = scoreImpact(text, opts);
  const overall = Math.round(length * 0.3 + memorability * 0.35 + impact * 0.35);
  return { length, memorability, impact, overall };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// ---------- Generation ----------

/** Substitute ${brand}, ${kw}, ${pw} into a formula template. */
export function fillFormula(
  template: string,
  brand: string,
  keyword: string,
  powerWord: string,
): string {
  return template
    .replace(/\$\{brand\}/g, brand)
    .replace(/\$\{kw\}/g, keyword)
    .replace(/\$\{pw\}/g, powerWord);
}

/** Capitalise the first character of a slogan for display. */
export function capitaliseFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Generate slogans deterministically from a brand + keywords.
 * If `seed` is omitted, Math.random is used (non-deterministic).
 */
export function generateSlogans(
  brand: string,
  keywords: string[],
  opts: GenerateOptions,
  seed?: number,
): Slogan[] {
  const b = normalize(brand);
  const kws = keywords.map(normalize).filter(Boolean);
  const rng = seed !== undefined ? mulberry32(seed) : Math.random;
  const styles = opts.styles && opts.styles.length > 0 ? opts.styles : STYLES;
  const tone = opts.tone;
  const tonePw = TONE_POWER_WORDS[tone];
  // Combine tone-flavored power words with the full list for variety.
  const pwPool = Array.from(new Set([...tonePw, ...POWER_WORDS]));
  const limit = opts.limit ?? 30;
  const minWords = opts.minWords ?? 2;
  const maxWords = opts.maxWords ?? 10;
  const fallbackKw = kws[0] || "everything";

  const out: Slogan[] = [];
  const seen = new Set<string>();
  // Iterate styles × keywords × power words × formulas up to a safety cap.
  let safety = 0;
  while (out.length < limit && safety < 2000) {
    safety++;
    const style = pick(styles, rng);
    const kw = pick(kws.length > 0 ? kws : [fallbackKw], rng);
    const pw = pick(pwPool, rng);
    const formula = pick(SLOGAN_FORMULAS[style], rng);
    const text = capitaliseFirst(fillFormula(formula, b, kw, pw));
    const norm = text.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);

    // Cliché filter
    if (opts.avoidCliches && isCliche(text)) continue;

    // Length filter (count words excluding brand)
    const withoutBrand = text.toLowerCase().replace(b.toLowerCase(), "").trim();
    const wordCount = countWords(withoutBrand);
    if (wordCount < minWords || wordCount > maxWords) continue;

    // Brand-fit filter (must contain brand or a keyword)
    if (opts.brandFit) {
      const hasBrand = b && norm.includes(b.toLowerCase());
      const hasKw = kws.some((k) => norm.includes(k.toLowerCase()));
      if (!hasBrand && !hasKw) continue;
    }

    const score = scoreOverall(text, {
      alliteration: opts.alliteration,
      rhyme: opts.rhyme,
      avoidCliches: opts.avoidCliches,
    });

    out.push({ text, style, tone, score });
  }

  // Sort by overall score (desc) as a default ordering.
  out.sort((a, b) => b.score.overall - a.score.overall);
  return out;
}

/** Generate A/B pairs from different style families. */
export function generateAbPairs(
  brand: string,
  keywords: string[],
  opts: GenerateOptions,
  count = 5,
  seed?: number,
): AbPair[] {
  const pairs: AbPair[] = [];
  const usedStyles = new Set<SloganStyle>();
  // Single RNG instance — keeps state across iterations so consecutive
  // picks don't repeat.
  const baseRng = seed !== undefined ? mulberry32(seed) : Math.random;
  let counter = 0;
  const nextRand = (): number => {
    counter += 1;
    if (seed !== undefined) return mulberry32(seed + counter * 7919)();
    return Math.random();
  };
  for (let i = 0; i < count; i++) {
    // Pick two different style families for variety.
    const stylePool = STYLES.filter((s) => !usedStyles.has(s));
    const pool = stylePool.length >= 2 ? stylePool : STYLES;
    const s1 = pool[Math.floor(nextRand() * pool.length)];
    let s2: SloganStyle;
    let safety = 0;
    do {
      s2 = pool[Math.floor(nextRand() * pool.length)];
      safety++;
      if (safety > 50) break;
    } while (s2 === s1);
    usedStyles.add(s1);
    usedStyles.add(s2);
    const a = generateSlogans(brand, keywords, { ...opts, styles: [s1], limit: 1 }, seed !== undefined ? seed + i * 2 + 1 : undefined);
    const b = generateSlogans(brand, keywords, { ...opts, styles: [s2], limit: 1 }, seed !== undefined ? seed + i * 2 + 2 : undefined);
    if (a.length > 0 && b.length > 0) {
      pairs.push({ a: a[0], b: b[0] });
    }
  }
  // Suppress unused-baseRng lint by reading it once.
  void baseRng;
  return pairs;
}

/** Filter slogans by length (word count, inclusive). */
export function filterByLength(slogans: Slogan[], min: number, max: number): Slogan[] {
  return slogans.filter((s) => {
    const n = countWords(s.text);
    return n >= min && n <= max;
  });
}

/** Sort slogans by overall score (descending). */
export function sortByScore(slogans: Slogan[]): Slogan[] {
  return [...slogans].sort((a, b) => b.score.overall - a.score.overall);
}

/** Render slogans as plain text (one per line). */
export function renderText(slogans: Slogan[]): string {
  return slogans.map((s) => `${s.text}  [${s.score.overall}]`).join("\n");
}

/** Render slogans as CSV. */
export function renderCsv(slogans: Slogan[]): string {
  const lines = ["text,style,tone,length,memorability,impact,overall"];
  for (const s of slogans) {
    lines.push([
      escapeCsv(s.text),
      s.style,
      s.tone,
      s.score.length,
      s.score.memorability,
      s.score.impact,
      s.score.overall,
    ].join(","));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
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
    const raw = localStorage.getItem(FAV_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) ? arr.slice(0, FAV_MAX) : [];
  } catch {
    return [];
  }
}

export function toggleFavorite(slogan: string): string[] {
  const current = loadFavorites();
  const norm = slogan.trim();
  const idx = current.findIndex((s) => s.trim() === norm);
  let next: string[];
  if (idx >= 0) {
    next = current.filter((s) => s.trim() !== norm);
  } else {
    next = [norm, ...current].slice(0, FAV_MAX);
  }
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearFavorites(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(FAV_KEY);
  } catch {
    // ignore
  }
}

// ---------- Shareable URL ----------

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.brand) params.set("brand", state.brand);
  if (state.keywords) params.set("kw", state.keywords);
  if (state.tone) params.set("tone", state.tone);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { brand: "", keywords: "", tone: "bold" };
  const params = new URLSearchParams(clean);
  const tone = (params.get("tone") as Tone) ?? "bold";
  return {
    brand: params.get("brand") ?? "",
    keywords: params.get("kw") ?? "",
    tone: TONES.includes(tone) ? tone : "bold",
  };
}

// ---------- Optional BYO-key LLM prompt ----------

export function buildLlmPrompt(brand: string, keywords: string[], tone: Tone): string {
  return [
    "You are a brand copywriter. Generate 10 catchy slogans/taglines for a brand",
    `with tone=${tone}. Each tagline should be 3–6 words, varied across styles`,
    "(benefit-led, emotional, witty, rhyming, minimalist, imperative). Avoid",
    "trademarked slogans. Return JSON with this exact shape:",
    "",
    "{",
    '  "slogans": ["tagline 1", "tagline 2", ...],',
    '  "explanation": "one-paragraph note on the angle you took",',
    '  "warnings": ["any trademark or cliché concern"]',
    "}",
    "",
    "Do not include markdown fences. Return raw JSON only.",
    "",
    `Brand: ${brand}`,
    `Keywords: ${keywords.join(", ") || "(none)"}`,
  ].join("\n");
}

export function renderLlmResult(raw: string): LlmEnhancement {
  const fallback: LlmEnhancement = {
    slogans: [],
    explanation: "The LLM did not return parseable JSON.",
    warnings: [],
  };
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) return fallback;
    const obj = JSON.parse(raw.slice(start, end + 1)) as Partial<LlmEnhancement>;
    return {
      slogans: Array.isArray(obj.slogans) ? obj.slogans.filter((s) => typeof s === "string") : [],
      explanation: obj.explanation ?? "",
      warnings: Array.isArray(obj.warnings) ? obj.warnings : [],
    };
  } catch {
    return fallback;
  }
}
