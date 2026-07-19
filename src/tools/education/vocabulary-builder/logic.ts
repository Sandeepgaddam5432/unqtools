/**
 * Vocabulary Builder & Study Modes — pure logic.
 *
 * Parse words (pipe-separated, comma-separated, or JSON), validate, normalize,
 * dedupe synonyms/antonyms, auto-mark difficulty (1-5), search filter,
 * alphabetical sort, Fisher-Yates shuffle, build flashcard deck, build match-game
 * pairs + validate answers, render as text/CSV/JSON, history (localStorage),
 * shareable URL, summary stats, word frequency analyzer, 4 vocab presets.
 *
 * Pure functions only — no DOM, no network.
 */

// ---- Types ----

export type StudyMode = "browse" | "flashcard" | "match-game";

export interface WordEntry {
  id: string;
  word: string;
  definition: string;
  example: string;
  synonyms: string[];
  antonyms: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  wordCount: number;
}

export interface MatchPair {
  wordId: string;
  word: string;
  definition: string;
}

export interface MatchRound {
  pairs: MatchPair[];
  // Definitions presented in randomized order (separate from word order)
  definitionOrder: MatchPair[];
}

export interface MatchAnswerResult {
  correct: boolean;
  matchedPairId: string | null;
}

export interface SummaryStats {
  totalWords: number;
  byDifficulty: Record<1 | 2 | 3 | 4 | 5, number>;
  avgSynonymsPerWord: number;
  avgAntonymsPerWord: number;
  totalSynonyms: number;
  totalAntonyms: number;
  withExamples: number;
  withSynonyms: number;
  withAntonyms: number;
}

export interface WordFrequency {
  word: string;
  count: number;
}

export interface HistoryEntry {
  ts: number;
  listName: string;
  wordCount: number;
  studyMode: StudyMode;
}

// ---- Constants & presets ----

export const HISTORY_KEY = "unqtools:vocabulary-builder:history";
export const HISTORY_MAX = 20;

export const STUDY_MODES: StudyMode[] = ["browse", "flashcard", "match-game"];

export const STUDY_MODE_LABELS: Record<StudyMode, string> = {
  "browse": "Browse list",
  "flashcard": "Flashcards",
  "match-game": "Match game",
};

// ---- ID counter (module-level; must be initialized before presets) ----

let _idCounter = 0;
function nextId(): string {
  _idCounter += 1;
  return `w${Date.now().toString(36)}${_idCounter}`;
}

// ---- Vocabulary list presets (4) ----

export const SAT_PRESET: WordEntry[] = [
  entry("ephemeral", "lasting for a very short time", "Fame can be ephemeral, vanishing overnight.", "transient,fleeting,momentary", "permanent,eternal,lasting"),
  entry("candid", "truthful and straightforward; frank", "She gave a candid interview about her struggles.", "honest,frank,open", "deceitful,evasive,guarded"),
  entry("meticulous", "showing great attention to detail", "He was meticulous about keeping his workspace clean.", "thorough,precise,scrupulous", "careless,sloppy,negligent"),
  entry("pragmatic", "dealing with things sensibly and realistically", "We need a pragmatic approach to this problem.", "practical,realistic,rational", "idealistic,theoretical,impractical"),
  entry("ambiguous", "open to more than one interpretation", "The ending of the film was deliberately ambiguous.", "unclear,vague,equivocal", "clear,explicit,definite"),
  entry("verbose", "using more words than needed", "His verbose explanation confused the audience.", "wordy,long-winded,prolix", "concise,terse,succinct"),
  entry("diligent", "showing care and conscientious effort", "The diligent student studied every night.", "industrious,hardworking,assiduous", "lazy,indolent,negligent"),
  entry("resilient", "able to recover quickly from difficulties", "Children are often remarkably resilient.", "tough,hardy,robust", "fragile,vulnerable,weak"),
];

export const GRE_PRESET: WordEntry[] = [
  entry("obfuscate", "to deliberately make something unclear or confusing", "The lawyer obfuscated the facts with jargon.", "confuse,obscure,muddy", "clarify,illuminate,explain"),
  entry("recalcitrant", "having an obstinately uncooperative attitude", "The recalcitrant child refused to eat.", "stubborn,defiant,intractable", "obedient,compliant,docile"),
  entry("magnanimous", "generous or forgiving, especially toward a rival", "She was magnanimous in victory.", "generous,forbearing,benevolent", "petty,selfish,vengeful"),
  entry("pernicious", "having a harmful effect, especially in a gradual way", "The pernicious rumor destroyed his career.", "harmful,detrimental,destructive", "beneficial,benign,advantageous"),
  entry("sycophant", "a person who flatters powerful people for personal gain", "The CEO was surrounded by sycophants.", "flatterer,toady,fawner", "critic,detractor,opponent"),
  entry("iconoclast", "a person who attacks cherished beliefs or institutions", "The artist was an iconoclast of his time.", "rebel,dissenter,maverick", "conformist,traditionalist,conservative"),
  entry("equivocate", "to use ambiguous language to conceal the truth", "The politician equivocated when asked about taxes.", "hedge,waffle,prevaricate", "declare,affirm,assert"),
  entry("alacrity", "brisk and cheerful readiness", "She accepted the invitation with alacrity.", "eagerness,willingness,zeal", "reluctance,hesitation,sluggishness"),
];

export const TOEFL_PRESET: WordEntry[] = [
  entry("acquire", "to gain or come to have something", "She acquired a new skill over the summer.", "obtain,gain,secure", "lose,forfeit,release"),
  entry("comprehensive", "complete; including all elements", "The report gave a comprehensive overview.", "thorough,complete,exhaustive", "partial,incomplete,limited"),
  entry("demonstrate", "to show clearly; to prove", "He demonstrated how the machine works.", "show,illustrate,exhibit", "conceal,hide,obscure"),
  entry("emphasize", "to give special importance to", "She emphasized the need for teamwork.", "highlight,stress,accentuate", "minimize,downplay,de-emphasize"),
  entry("fundamental", "forming a necessary base or core", "Trust is fundamental to any relationship.", "basic,essential,core", "peripheral,secondary,incidental"),
  entry("inevitable", "certain to happen; unavoidable", "Change is inevitable in life.", "unavoidable,inescapable,certain", "avoidable,uncertain,preventable"),
  entry("predominant", "most common or important; main", "The predominant color was blue.", "main,principal,chief", "minor,secondary,subordinate"),
  entry("subsequent", "coming after something in time", "Subsequent events proved him right.", "following,later,succeeding", "previous,prior,preceding"),
];

export const ELEMENTARY_PRESET: WordEntry[] = [
  entry("happy", "feeling or showing pleasure", "She was happy to see her friends.", "joyful,glad,cheerful", "sad,unhappy,miserable"),
  entry("big", "of considerable size", "He lives in a big house.", "large,huge,enormous", "small,tiny,little"),
  entry("fast", "moving quickly", "The cheetah is a fast animal.", "quick,rapid,swift", "slow,sluggish,leisurely"),
  entry("smart", "having intelligence", "She is a very smart student.", "clever,intelligent,bright", "dull,foolish,dim"),
  entry("beautiful", "pleasing the senses, especially to look at", "The sunset was beautiful.", "pretty,lovely,gorgeous", "ugly,plain,hideous"),
  entry("brave", "ready to face danger without fear", "The brave firefighter saved the cat.", "courageous,fearless,bold", "afraid,scared,cowardly"),
  entry("kind", "having a friendly nature", "He is always kind to animals.", "gentle,caring,compassionate", "cruel,mean,unkind"),
  entry("loud", "producing much noise", "The music was too loud.", "noisy,booming,thundering", "quiet,silent,soft"),
];

export const VOCAB_PRESETS: Record<"sat" | "gre" | "toefl" | "elementary", WordEntry[]> = {
  sat: SAT_PRESET,
  gre: GRE_PRESET,
  toefl: TOEFL_PRESET,
  elementary: ELEMENTARY_PRESET,
};

export const PRESET_LABELS: Record<"sat" | "gre" | "toefl" | "elementary", string> = {
  sat: "SAT Vocabulary (8)",
  gre: "GRE Vocabulary (8)",
  toefl: "TOEFL Vocabulary (8)",
  elementary: "Elementary (8)",
};

// ---- Helpers ----

/** Build a WordEntry (helper used by presets — exposed for tests). */
export function entry(
  word: string,
  definition: string,
  example: string,
  synonymsCsv: string,
  antonymsCsv: string,
): WordEntry {
  const w = word.trim();
  return {
    id: nextId(),
    word: w,
    definition: definition.trim(),
    example: example.trim(),
    synonyms: parseCommaList(synonymsCsv),
    antonyms: parseCommaList(antonymsCsv),
    difficulty: markDifficulty(w, definition),
  };
}

// ---- Parsers ----

/** Parse a comma-separated cell into a deduped list. */
export function parseCommaList(input: string): string[] {
  if (!input) return [];
  return dedupeStrings(
    input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/** Parse one line of pipe-separated input into a partial word entry. */
export function parsePipeLine(line: string): Partial<WordEntry> & { word: string; definition: string } {
  const parts = (line || "").split("|").map((s) => s.trim());
  const [word, definition = "", example = "", synonymsCsv = "", antonymsCsv = ""] = parts;
  return {
    word: word || "",
    definition,
    example,
    synonyms: parseCommaList(synonymsCsv),
    antonyms: parseCommaList(antonymsCsv),
  };
}

/** Parse comma-separated input (minimal: word,definition). */
export function parseCommaLine(line: string): Partial<WordEntry> & { word: string; definition: string } {
  const parts = (line || "").split(",").map((s) => s.trim());
  const [word, definition = ""] = parts;
  return {
    word: word || "",
    definition,
    example: "",
    synonyms: [],
    antonyms: [],
  };
}

/** Detect if input looks like JSON. */
export function looksLikeJson(input: string): boolean {
  const t = (input || "").trim();
  if (!t) return false;
  return t[0] === "[" || t[0] === "{";
}

/** Parse JSON array of word objects. */
export function parseJsonWords(input: string): WordEntry[] {
  const t = (input || "").trim();
  if (!t) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(t);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: WordEntry[] = [];
  for (const raw of parsed) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const word = typeof r.word === "string" ? r.word.trim() : "";
    const definition = typeof r.definition === "string" ? r.definition.trim() : "";
    if (!word || !definition) continue;
    const example = typeof r.example === "string" ? r.example.trim() : "";
    const synonyms = Array.isArray(r.synonyms)
      ? dedupeStrings(r.synonyms.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean))
      : typeof r.synonyms === "string" ? parseCommaList(r.synonyms) : [];
    const antonyms = Array.isArray(r.antonyms)
      ? dedupeStrings(r.antonyms.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean))
      : typeof r.antonyms === "string" ? parseCommaList(r.antonyms) : [];
    out.push(normalizeWord({
      id: nextId(),
      word,
      definition,
      example,
      synonyms,
      antonyms,
      difficulty: 3,
    }));
  }
  return out;
}

/** Parse multi-line input (auto-detects JSON vs pipe vs comma). */
export function parseWords(input: string): WordEntry[] {
  const t = (input || "").trim();
  if (!t) return [];
  if (looksLikeJson(t)) {
    return parseJsonWords(t);
  }
  const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: WordEntry[] = [];
  for (const line of lines) {
    // Skip comment lines
    if (line.startsWith("#") || line.startsWith("//")) continue;
    const hasPipe = line.includes("|");
    const partial = hasPipe ? parsePipeLine(line) : parseCommaLine(line);
    if (!partial.word || !partial.definition) continue;
    out.push(normalizeWord({
      id: nextId(),
      word: partial.word,
      definition: partial.definition,
      example: partial.example || "",
      synonyms: partial.synonyms || [],
      antonyms: partial.antonyms || [],
      difficulty: 3,
    }));
  }
  return out;
}

// ---- Normalization & validation ----

/** Normalize a word: lowercase + collapse whitespace + trim. */
export function normalizeWordStr(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Dedupe a list of strings (case-insensitive) preserving order. */
export function dedupeStrings(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of list) {
    const key = s.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}

/** Normalize a complete WordEntry (lowercase word, dedupe synonyms/antonyms). */
export function normalizeWord(w: WordEntry): WordEntry {
  const word = normalizeWordStr(w.word);
  const synonyms = dedupeStrings(w.synonyms.map((s) => s.trim()).filter(Boolean));
  const antonyms = dedupeStrings(w.antonyms.map((s) => s.trim()).filter(Boolean));
  // Remove word itself from synonyms (a word is not its own synonym)
  const filteredSyn = synonyms.filter((s) => s.toLowerCase() !== word);
  const filteredAnt = antonyms.filter((s) => s.toLowerCase() !== word);
  return {
    ...w,
    word,
    synonyms: filteredSyn,
    antonyms: filteredAnt,
    difficulty: markDifficulty(word, w.definition),
  };
}

/** Validate a list of words. Returns errors + count. */
export function validateWords(words: WordEntry[]): ValidationResult {
  const errors: string[] = [];
  if (words.length === 0) {
    errors.push("At least one word is required.");
    return { ok: false, errors, wordCount: 0 };
  }
  const seen = new Set<string>();
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!w.word) errors.push(`Row ${i + 1}: missing word.`);
    if (!w.definition) errors.push(`Row ${i + 1}: missing definition.`);
    if (w.word && seen.has(w.word.toLowerCase())) {
      errors.push(`Row ${i + 1}: duplicate word "${w.word}".`);
    }
    if (w.word) seen.add(w.word.toLowerCase());
  }
  return { ok: errors.length === 0, errors, wordCount: words.length };
}

/** Mark difficulty (1-5) based on word length + definition complexity. */
export function markDifficulty(word: string, definition: string): 1 | 2 | 3 | 4 | 5 {
  const wlen = (word || "").length;
  const dlen = (definition || "").length;
  const dwords = (definition || "").split(/\s+/).filter(Boolean).length;
  let score = 0;
  // Word length contribution (longer = harder)
  if (wlen >= 12) score += 3;
  else if (wlen >= 9) score += 2;
  else if (wlen >= 6) score += 1;
  // Definition length contribution
  if (dlen >= 120) score += 2;
  else if (dlen >= 60) score += 1;
  // Definition word count contribution
  if (dwords >= 20) score += 2;
  else if (dwords >= 12) score += 1;
  // Map 0-7 → 1-5
  let diff: 1 | 2 | 3 | 4 | 5;
  if (score <= 1) diff = 1;
  else if (score === 2) diff = 2;
  else if (score === 3) diff = 3;
  else if (score === 4) diff = 4;
  else diff = 5;
  return diff;
}

// ---- Filters / sort / shuffle ----

/** Case-insensitive search across word, definition, example, synonyms, antonyms. */
export function filterWords(words: WordEntry[], query: string): WordEntry[] {
  const q = (query || "").toLowerCase().trim();
  if (!q) return words;
  return words.filter((w) => {
    if (w.word.toLowerCase().includes(q)) return true;
    if (w.definition.toLowerCase().includes(q)) return true;
    if (w.example.toLowerCase().includes(q)) return true;
    if (w.synonyms.some((s) => s.toLowerCase().includes(q))) return true;
    if (w.antonyms.some((s) => s.toLowerCase().includes(q))) return true;
    return false;
  });
}

/** Alphabetical sort by word. */
export function sortAlphabetical(words: WordEntry[]): WordEntry[] {
  return [...words].sort((a, b) => a.word.localeCompare(b.word));
}

/** Sort by difficulty (ascending). */
export function sortByDifficulty(words: WordEntry[]): WordEntry[] {
  return [...words].sort((a, b) => a.difficulty - b.difficulty);
}

/** Fisher-Yates shuffle (pure — uses Math.random by default, or seeded RNG if provided). Generic. */
export function shuffleWords<T>(words: T[], rng: () => number = Math.random): T[] {
  const out = [...words];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---- Flashcard deck ----

export interface FlashcardDeck {
  name: string;
  cards: WordEntry[];
  currentIndex: number;
}

/** Build a flashcard deck (optionally shuffled). */
export function buildFlashcardDeck(name: string, words: WordEntry[], shuffle = false): FlashcardDeck {
  const cards = shuffle ? shuffleWords(words) : [...words];
  return {
    name: name || "Untitled",
    cards,
    currentIndex: 0,
  };
}

/** Get current card, or null if deck is empty. */
export function currentCard(deck: FlashcardDeck): WordEntry | null {
  if (deck.cards.length === 0) return null;
  return deck.cards[deck.currentIndex] ?? null;
}

/** Advance to next card (wraps around). */
export function nextCard(deck: FlashcardDeck): FlashcardDeck {
  if (deck.cards.length === 0) return deck;
  return { ...deck, currentIndex: (deck.currentIndex + 1) % deck.cards.length };
}

/** Go to previous card (wraps around). */
export function prevCard(deck: FlashcardDeck): FlashcardDeck {
  if (deck.cards.length === 0) return deck;
  return { ...deck, currentIndex: (deck.currentIndex - 1 + deck.cards.length) % deck.cards.length };
}

// ---- Match game ----

/** Build a match-game round (4-6 pairs, definitions shuffled separately). */
export function buildMatchRound(words: WordEntry[], pairCount = 5): MatchRound {
  const count = Math.max(4, Math.min(6, Math.min(pairCount, words.length)));
  // Pick `count` words. Shuffle first then slice.
  const shuffled = shuffleWords(words);
  const selected = shuffled.slice(0, count);
  const pairs: MatchPair[] = selected.map((w) => ({
    wordId: w.id,
    word: w.word,
    definition: w.definition,
  }));
  // Shuffle definitions independently of words.
  const definitionOrder = shuffleWords(pairs.map((p) => ({ ...p })));
  return { pairs, definitionOrder };
}

/** Validate a match: is wordId's definition the one user clicked? */
export function validateMatch(
  round: MatchRound,
  wordId: string,
  definitionWordId: string,
): MatchAnswerResult {
  const pair = round.pairs.find((p) => p.wordId === wordId);
  if (!pair) return { correct: false, matchedPairId: null };
  const correct = pair.wordId === definitionWordId;
  return { correct, matchedPairId: correct ? pair.wordId : null };
}

// ---- Renderers ----

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render words as plain text vocabulary list. */
export function renderText(listName: string, words: WordEntry[]): string {
  const lines: string[] = [];
  lines.push(`# ${listName || "Vocabulary List"}`);
  lines.push(`# ${words.length} word(s)`);
  lines.push("");
  for (const w of words) {
    lines.push(`${w.word}  (difficulty: ${w.difficulty}/5)`);
    lines.push(`  Definition: ${w.definition}`);
    if (w.example) lines.push(`  Example: ${w.example}`);
    if (w.synonyms.length > 0) lines.push(`  Synonyms: ${w.synonyms.join(", ")}`);
    if (w.antonyms.length > 0) lines.push(`  Antonyms: ${w.antonyms.join(", ")}`);
    lines.push("");
  }
  return lines.join("\n");
}

/** Render words as CSV (word, definition, example, synonyms, antonyms, difficulty). */
export function renderCsv(words: WordEntry[]): string {
  const lines = ["word,definition,example,synonyms,antonyms,difficulty"];
  for (const w of words) {
    lines.push([
      escapeCsv(w.word),
      escapeCsv(w.definition),
      escapeCsv(w.example),
      escapeCsv(w.synonyms.join(", ")),
      escapeCsv(w.antonyms.join(", ")),
      String(w.difficulty),
    ].join(","));
  }
  return lines.join("\n");
}

/** Render words as JSON (for import/export). */
export function renderJson(listName: string, words: WordEntry[]): string {
  return JSON.stringify({
    name: listName || "Untitled",
    count: words.length,
    words: words.map((w) => ({
      word: w.word,
      definition: w.definition,
      example: w.example,
      synonyms: w.synonyms,
      antonyms: w.antonyms,
      difficulty: w.difficulty,
    })),
  }, null, 2);
}

/** Render the source pipe-separated format (round-trip friendly). */
export function renderSource(words: WordEntry[]): string {
  return words
    .map((w) => [w.word, w.definition, w.example, w.synonyms.join(","), w.antonyms.join(",")].join("|"))
    .join("\n");
}

// ---- Summary stats ----

export function computeSummaryStats(words: WordEntry[]): SummaryStats {
  const byDifficulty: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalSyn = 0;
  let totalAnt = 0;
  let withExamples = 0;
  let withSyn = 0;
  let withAnt = 0;
  for (const w of words) {
    byDifficulty[w.difficulty] += 1;
    totalSyn += w.synonyms.length;
    totalAnt += w.antonyms.length;
    if (w.example) withExamples += 1;
    if (w.synonyms.length > 0) withSyn += 1;
    if (w.antonyms.length > 0) withAnt += 1;
  }
  const n = Math.max(1, words.length);
  return {
    totalWords: words.length,
    byDifficulty,
    avgSynonymsPerWord: Math.round((totalSyn / n) * 10) / 10,
    avgAntonymsPerWord: Math.round((totalAnt / n) * 10) / 10,
    totalSynonyms: totalSyn,
    totalAntonyms: totalAnt,
    withExamples,
    withSynonyms: withSyn,
    withAntonyms: withAnt,
  };
}

// ---- Word frequency analyzer ----

const STOP_WORDS = new Set([
  "the","a","an","and","or","but","of","to","in","for","on","with","as","by",
  "is","are","was","were","be","been","being","it","its","that","this","these",
  "those","at","from","into","than","then","so","such","not","no","if","they",
  "he","she","you","we","i","his","her","their","our","your","my","me","him",
  "them","us","do","does","did","has","have","had","will","would","can","could",
  "should","may","might","must","shall","about","above","after","again","all",
  "any","because","below","between","both","each","few","more","most","other",
  "out","over","own","same","too","very","just","also","only","up","down","off",
]);

/** Tokenize a string into lowercase words (length > 2, not stop words). */
export function tokenize(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .split(/[^a-z']+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2 && !STOP_WORDS.has(s));
}

/** Compute top-N most common words across definitions + examples. */
export function computeWordFrequency(words: WordEntry[], topN = 10): WordFrequency[] {
  const counts = new Map<string, number>();
  for (const w of words) {
    for (const tok of tokenize(w.definition)) {
      counts.set(tok, (counts.get(tok) ?? 0) + 1);
    }
    for (const tok of tokenize(w.example)) {
      counts.set(tok, (counts.get(tok) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, topN);
}

// ---- History (localStorage) ----

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

// ---- Shareable URL ----

export interface ShareState {
  listName: string;
  words: string; // raw input text
  studyMode: StudyMode;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.listName) params.set("name", state.listName);
  if (state.words) params.set("words", state.words);
  if (state.studyMode && state.studyMode !== "browse") params.set("mode", state.studyMode);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { listName: "", words: "", studyMode: "browse" };
  const params = new URLSearchParams(clean);
  const listName = params.get("name") ?? "";
  const words = params.get("words") ?? "";
  const modeRaw = params.get("mode") ?? "browse";
  const studyMode: StudyMode =
    modeRaw === "flashcard" || modeRaw === "match-game" ? modeRaw : "browse";
  return { listName, words, studyMode };
}
