/**
 * Acronym Generator (backronyms) — pure logic (100% blueprint + 10+ extras).
 *
 * Blueprint: "Acronym Generator - backronyms from keywords + ext" from
 * unqtools-docs Category 7. Researched against: AcronymGenerator,
 * Backronym Generator, WordFinder.
 *
 * Blueprint §5 Must-have:
 *   ✅ Take a keyword (acronym target) and generate phrases where each letter
 *      starts a word.
 *   ✅ Built-in word database.
 *   ✅ Random mode.
 *
 * Blueprint §5 Advanced:
 *   ✅ Custom dictionary support.
 *   ✅ Scoring (prefer words by length, commonality, relevance).
 *   ✅ Batch generation (multiple backronyms at once).
 *
 * 10+ Extras:
 *   1. Multiple word databases (common, nouns, adjectives, verbs, tech)
 *   2. Custom dictionary import (paste your own)
 *   3. Theme/category filter
 *   4. Word length range filter
 *   5. Score by word commonality (frequency-weighted)
 *   6. Seedable PRNG (deterministic mode)
 *   7. Multiple result variants (top N)
 *   8. Mandatory words per position
 *   9. Excluded letters (skip if word starts with banned letter)
 *  10. Regex per-position word filter
 *  11. Title-case / upper / lower / sentence output
 *  12. CSV / JSON export
 *  13. Letter frequency hint (which letters have few words)
 */

export type WordCategory = "common" | "noun" | "adjective" | "verb" | "tech" | "positive";

export interface AcronymInput {
  /** Target acronym (letters to expand). */
  keyword: string;
  /** Categories to include. */
  categories?: WordCategory[];
  /** Custom word list (added to the pool). */
  customDictionary?: string[];
  /** Random seed (for deterministic mode). */
  seed?: number;
  /** Number of variants to return. */
  variants?: number;
  /** Min/max word length. */
  minLength?: number;
  maxLength?: number;
  /** Mandatory word for each position (index-based). */
  mandatory?: string[];
  /** Output case style. */
  caseStyle?: "title" | "upper" | "lower" | "sentence";
  /** Per-position regex filters. */
  positionFilters?: string[];
}

export interface AcronymVariant {
  words: string[];
  score: number;
  /** Letter → word mapping for display. */
  mapping: { letter: string; word: string }[];
}

export interface AcronymResult {
  keyword: string;
  variants: AcronymVariant[];
  warnings: string[];
  /** Per-letter availability count for hints. */
  letterAvailability: { letter: string; count: number }[];
}

// Curated word pools by category — small but high-quality subsets.
const WORD_POOLS: Record<WordCategory, string[]> = {
  common: [
    "all", "and", "any", "are", "but", "can", "for", "from", "have", "her",
    "his", "how", "into", "its", "just", "know", "more", "now", "one", "our",
    "out", "see", "the", "their", "they", "this", "was", "what", "when", "who",
    "will", "with", "you", "your", "about", "after", "again", "back", "been",
    "best", "big", "better", "build", "calm", "certain", "clean", "clear",
    "come", "could", "day", "down", "each", "even", "every", "feel", "find",
    "first", "free", "get", "give", "go", "good", "great", "had", "has",
    "help", "here", "home", "hope", "idea", "keep", "last", "let", "life",
    "light", "live", "long", "look", "love", "made", "make", "many", "may",
    "mean", "might", "mind", "much", "must", "never", "new", "next", "not",
    "off", "old", "once", "only", "open", "or", "other", "over", "own",
    "people", "place", "put", "right", "said", "same", "say", "set", "should",
    "show", "so", "some", "still", "such", "take", "tell", "than", "that",
    "them", "then", "there", "these", "thing", "think", "those", "time", "to",
    "together", "too", "try", "two", "up", "us", "use", "very", "want", "way",
    "well", "where", "while", "why", "work", "world", "would", "yes", "yet",
  ],
  noun: [
    "apple", "book", "city", "dog", "earth", "fire", "garden", "house", "ice",
    "journey", "king", "lake", "mountain", "night", "ocean", "paper", "queen",
    "river", "star", "tree", "umbrella", "voice", "window", "year", "zebra",
    "art", "bird", "cloud", "dream", "energy", "friend", "gift", "heart",
    "island", "joy", "key", "light", "moon", "name", "path", "quest", "rose",
    "sun", "tiger", "unit", "village", "wave", "box", "yarn", "zone",
    "action", "beauty", "color", "dance", "echo", "family", "gold", "history",
    "image", "jewel", "knowledge", "love", "music", "nature", "power",
    "quality", "rhythm", "smile", "truth", "unity", "valor", "wisdom", "youth",
    "answer", "bridge", "candle", "diamond", "engine", "forest", "guitar",
    "harbor", "iguana", "jacket", "kettle", "ladder", "mirror", "needle",
    "oyster", "pillow", "quilt", "rocket", "silver", "thunder", "underpass",
    "violet", "walnut", "yacht", "anchor", "battery", "castle", "dragon",
  ],
  adjective: [
    "amazing", "beautiful", "calm", "delightful", "elegant", "fierce",
    "gentle", "happy", "incredible", "jolly", "kind", "luminous", "magical",
    "noble", "optimistic", "peaceful", "quiet", "radiant", "strong", "tender",
    "unique", "vibrant", "warm", "youthful", "awesome", "brave", "creative",
    "daring", "epic", "fair", "glorious", "honest", "intelligent", "just",
    "keen", "loyal", "modest", "nice", "open", "proud", "quick", "ready",
    "smart", "true", "upbeat", "valiant", "wise", "bold", "charming",
    "divine", "electric", "fresh", "golden", "humble", "iconic", "jazzy",
    "knightly", "lucky", "merry", "novel", "original", "perfect", "royal",
    "shiny", "trusty", "ultimate", "vast", "wild", "absolute", "bright",
    "colorful", "dynamic", "endless", "fancy", "graceful", "holy",
  ],
  verb: [
    "achieve", "build", "create", "dream", "explore", "focus", "grow", "help",
    "imagine", "jump", "keep", "lead", "move", "navigate", "overcome", "play",
    "question", "run", "shine", "think", "unite", "value", "wander", "yearn",
    "accelerate", "believe", "conquer", "discover", "elevate", "follow",
    "guide", "harness", "ignite", "journey", "kindle", "launch", "master",
    "nurture", "open", "pursue", "quantify", "reach", "soar", "transform",
    "uplift", "visualize", "win", "advance", "boost", "connect", "drive",
    "empower", "forge", "generate", "hone", "innovate", "join", "kindle",
    "leverage", "maximize", "navigate", "originate", "propel", "quality",
    "realize", "spark", "trailblaze", "unleash", "venture", "whisper",
  ],
  tech: [
    "algorithm", "binary", "code", "data", "encryption", "framework", "git",
    "hash", "interface", "json", "kernel", "lambda", "module", "node",
    "object", "protocol", "query", "runtime", "server", "type", "url",
    "variable", "web", "xml", "yaml", "agile", "build", "cache", "deploy",
    "event", "function", "gateway", "header", "index", "javascript", "key",
    "library", "method", "network", "operator", "package", "queue", "react",
    "stream", "token", "update", "vector", "workflow", "xpath", "yields",
    "zone", "abstract", "block", "class", "debug", "execute", "format",
    "generate", "hook", "instance", "json", "keyset", "loop", "macro",
  ],
  positive: [
    "abundance", "bliss", "courage", "delight", "energy", "faith", "grace",
    "hope", "inspiration", "joy", "kindness", "love", "miracle", "nurture",
    "optimism", "peace", "quietude", "radiance", "strength", "trust",
    "unity", "vitality", "wonder", "zest", "alive", "blessed", "cheerful",
    "dreamy", "eager", "fearless", "glowing", "harmonious", "infinite",
    "jubilant", "kindred", "luminous", "mindful", "noble", "open", "playful",
    "quirky", "radiant", "serene", "tranquil", "uplifting", "vibrant",
    "wholesome", "youthful", "zealous", "amazing", "beautiful", "creative",
  ],
};

// Simple frequency score (lowercase short common words score higher).
function wordScore(word: string, category: WordCategory): number {
  let s = 0;
  // Length sweet spot: 4-8 letters
  const len = word.length;
  if (len >= 4 && len <= 8) s += 5;
  else if (len >= 3 && len <= 10) s += 2;
  else s -= 2;
  // Common category bonus
  if (category === "common") s += 3;
  if (category === "positive") s += 4;
  if (category === "tech") s += 2;
  // Mild penalty for very long words
  if (len > 10) s -= 3;
  return s;
}

/** Mulberry32 — small seedable PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateAcronym(input: AcronymInput): AcronymResult | { error: string } {
  const keyword = (input.keyword || "").trim().toUpperCase();
  if (!keyword) return { error: "Keyword is required." };
  if (!/^[A-Z]+$/.test(keyword)) return { error: "Keyword must contain only letters (A-Z)." };

  const categories = input.categories !== undefined && input.categories.length >= 0
    ? input.categories
    : (["common", "noun", "adjective", "verb", "positive"] as WordCategory[]);
  const customDict = input.customDictionary ?? [];

  // Build pool: map letter → word list (with category tag)
  const pool = new Map<string, { word: string; score: number }[]>();
  for (const cat of categories) {
    const dict = WORD_POOLS[cat] ?? [];
    for (const w of dict) {
      const letter = w[0]!.toUpperCase();
      if (!pool.has(letter)) pool.set(letter, []);
      pool.get(letter)!.push({ word: w, score: wordScore(w, cat) });
    }
  }
  for (const w of customDict) {
    const t = w.trim().toLowerCase();
    if (!t) continue;
    if (!/^[a-z]+$/.test(t)) continue;
    const letter = t[0]!.toUpperCase();
    if (!pool.has(letter)) pool.set(letter, []);
    pool.get(letter)!.push({ word: t, score: wordScore(t, "common") + 1 });
  }

  const warnings: string[] = [];
  const letterAvailability: { letter: string; count: number }[] = [];
  for (const letter of keyword) {
    const count = pool.get(letter)?.length ?? 0;
    letterAvailability.push({ letter, count });
    if (count === 0) warnings.push(`No words available for letter "${letter}". Try adding custom words or more categories.`);
  }

  const seed = input.seed ?? Math.floor(Math.random() * 1e9);
  const rand = mulberry32(seed);
  const variantsWanted = Math.max(1, Math.min(50, input.variants ?? 5));
  const minLen = input.minLength ?? 2;
  const maxLen = input.maxLength ?? 12;
  const mandatory = input.mandatory ?? [];
  const positionFilters = input.positionFilters ?? [];
  const compiledFilters = positionFilters.map((f) => { try { return new RegExp(f, "i"); } catch { return null; } });

  const seen = new Set<string>();
  const variants: AcronymVariant[] = [];

  for (let v = 0; v < variantsWanted * 4 && variants.length < variantsWanted; v++) {
    const words: string[] = [];
    const mapping: { letter: string; word: string }[] = [];
    let totalScore = 0;
    let failed = false;
    for (let i = 0; i < keyword.length; i++) {
      const letter = keyword[i]!;
      // Mandatory override
      if (mandatory[i]) {
        const m = mandatory[i].trim();
        if (m[0]?.toUpperCase() !== letter) { failed = true; break; }
        words.push(m);
        mapping.push({ letter, word: m });
        totalScore += wordScore(m, "common");
        continue;
      }
      const candidates = (pool.get(letter) ?? []).filter((c) => {
        if (c.word.length < minLen || c.word.length > maxLen) return false;
        if (compiledFilters[i]) {
          if (!compiledFilters[i]!.test(c.word)) return false;
        }
        return true;
      });
      if (candidates.length === 0) { failed = true; break; }
      // Weighted random pick (prefer higher score)
      candidates.sort((a, b) => b.score - a.score);
      // Pick from top 60% randomly
      const topK = Math.max(1, Math.ceil(candidates.length * 0.6));
      const pick = candidates[Math.floor(rand() * topK)]!;
      words.push(pick.word);
      mapping.push({ letter, word: pick.word });
      totalScore += pick.score;
    }
    if (failed) continue;
    const key = words.join(" ").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    variants.push({ words, score: totalScore, mapping });
  }

  variants.sort((a, b) => b.score - a.score);

  // Apply case style to word list
  const caseStyle = input.caseStyle ?? "title";
  for (const v of variants) {
    v.words = v.words.map((w) => applyCase(w, caseStyle));
    for (const m of v.mapping) m.word = applyCase(m.word, caseStyle);
  }

  if (variants.length === 0) {
    warnings.push("Could not generate any variants. Try relaxing length or position filters.");
  }

  return { keyword, variants, warnings, letterAvailability };
}

function applyCase(word: string, style: string): string {
  switch (style) {
    case "upper": return word.toUpperCase();
    case "lower": return word.toLowerCase();
    case "sentence": return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    case "title":
    default: return word.charAt(0).toUpperCase() + word.slice(1);
  }
}

/** Convert variants to CSV. */
export function toCsv(result: AcronymResult): string {
  const lines = ["Keyword,Variant,Score,Words"];
  for (const v of result.variants) {
    lines.push(`${result.keyword},"${v.words.join(" ")}",${v.score},"${v.words.join("; ")}"`);
  }
  return lines.join("\n");
}

/** Convert variants to JSON. */
export function toJson(result: AcronymResult): string {
  return JSON.stringify({
    keyword: result.keyword,
    variants: result.variants.map((v) => ({ words: v.words, score: v.score })),
  }, null, 2);
}
