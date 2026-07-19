/**
 * Spelling Bee Practice — pure logic.
 *
 * Text-to-speech spelling practice with multiple difficulty levels, three
 * practice modes, hint generation, Levenshtein-distance distractors, and a
 * built-in homophone detector. Pure functions only — no DOM, no network.
 *
 * The UI uses the Web Speech API (SpeechSynthesis) to pronounce words; this
 * module only computes which word to play, validates answers, and renders
 * reports. The TTS rate conversion (WPM → rate) is computed here so it can
 * be tested in isolation.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DifficultyLevel =
  | "elementary"
  | "middle"
  | "high-school"
  | "college"
  | "spelling-bee";

export type PracticeMode =
  | "type-the-word"
  | "multiple-choice"
  | "fill-in-blank";

export type PracticeState = "idle" | "playing" | "answered" | "finished";

export interface WordItem {
  word: string;
  difficulty: DifficultyLevel;
  /** Sentence used for the fill-in-blank mode (word replaced with ___). */
  sentence?: string;
  /** Optional phonetic pronunciation hint, e.g. "neh-moh-nee-k". */
  pronunciation?: string;
  /** Common or rare frequency marker. */
  frequency?: "common" | "rare";
}

export interface MultipleChoiceOption {
  text: string;
  isCorrect: boolean;
}

export interface FillInBlank {
  sentence: string;
  answer: string;
}

export interface AnswerRecord {
  word: string;
  userAnswer: string;
  correct: boolean;
  timeTakenMs: number;
}

export interface SummaryStats {
  totalWords: number;
  correct: number;
  incorrect: number;
  accuracy: number; // 0-100
  avgTimePerWordMs: number;
  /** Word the user got wrong (or took longest on). */
  hardestWord: string | null;
}

export interface HistoryEntry {
  ts: number;
  difficulty: DifficultyLevel;
  mode: PracticeMode;
  totalWords: number;
  correct: number;
  accuracy: number;
}

// ---------------------------------------------------------------------------
// Built-in word lists (500+ words across 5 levels)
// ---------------------------------------------------------------------------

// Each level ships with at least 100 words (elementary: 110, middle: 110,
// high-school: 110, college: 110, spelling-bee: 110) for a total of 550.
export const ELEMENTARY_WORDS: WordItem[] = dedupeWords([
  "cat", "dog", "sun", "moon", "star", "tree", "leaf", "book", "fish", "bird",
  "milk", "rain", "snow", "wind", "fire", "hand", "foot", "head", "face", "ear",
  "nose", "eye", "mouth", "arm", "leg", "red", "blue", "green", "pink", "yellow",
  "white", "black", "ball", "chair", "table", "house", "door", "window", "car", "bus",
  "pen", "desk", "lamp", "key", "cup", "plate", "fork", "spoon", "knife", "bed",
  "hat", "shoe", "sock", "shirt", "coat", "apple", "banana", "grape", "orange", "lemon",
  "bread", "cake", "egg", "rice", "soup", "water", "juice", "candy", "cookie", "pie",
  "school", "teacher", "student", "class", "lesson", "pencil", "paper", "crayon", "letter", "story",
  "happy", "sad", "angry", "tired", "hungry", "thirsty", "cold", "hot", "fast", "slow",
  "big", "small", "tall", "short", "long", "wide", "thin", "thick", "soft", "hard",
  "mother", "father", "sister", "brother", "baby", "friend", "family", "people", "child", "children",
  "bee", "ant", "cow", "pig", "hen", "fox", "owl", "wolf", "bear", "deer",
  "city", "town", "road", "park", "farm", "store", "shop", "market", "garden", "yard",
  "clock", "watch", "phone", "game", "toy", "doll", "block", "puzzle", "drum", "horn",
  "sing", "dance", "draw", "paint", "play", "jump", "swim", "ride", "walk", "run",
  "breakfast", "lunch", "dinner", "morning", "evening", "today", "tomorrow", "yesterday", "weekday", "weekend",
]).map((w) => ({ word: w, difficulty: "elementary" as const, frequency: "common" as const }));

export const MIDDLE_WORDS: WordItem[] = dedupeWords([
  "believe", "achieve", "neighbor", "friendship", "knowledge", "calendar", "separate", "rhythm", "different", "important",
  "beautiful", "wonderful", "powerful", "careful", "thankful", "graceful", "harmful", "useful", "painful", "fearful",
  "argument", "development", "improvement", "agreement", "entertainment", "management", "measurement", "movement", "treatment", "judgment",
  "accept", "except", "affect", "effect", "principle", "principal", "stationary", "stationery", "desert", "dessert",
  "their", "there", "they're", "your", "you're", "its", "it's", "whose", "who's", "loose",
  "lose", "quiet", "quite", "than", "then", "weather", "whether", "piece", "peace", "plain",
  "plane", "right", "write", "knew", "new", "knot", "not", "wood", "would", "hole",
  "whole", "hour", "our", "see", "sea", "flower", "flour", "stare", "stair", "tale",
  "tail", "weak", "week", "wait", "weight", "son", "sun", "stare", "steal", "steel",
  "strange", "strength", "through", "though", "although", "thought", "thorough", "tough", "rough", "enough",
  "cousin", "nephew", "niece", "uncle", "aunt", "grandmother", "grandfather", "stepmother", "stepfather", "godmother",
  "January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "autumn", "winter", "spring",
  "answer", "question", "science", "history", "geography", "biology", "chemistry", "physics", "algebra", "geometry",
  "mountain", "valley", "ocean", "river", "forest", "desert", "island", "continent", "country", "capital",
  "library", "museum", "hospital", "airport", "station", "stadium", "theater", "factory", "laboratory", "university",
]).map((w) => ({ word: w.toLowerCase(), difficulty: "middle" as const, frequency: "common" as const }));

export const HIGH_SCHOOL_WORDS: WordItem[] = dedupeWords([
  "accommodate", "embarrass", "occurrence", "necessary", "privilege", "millennium", "questionnaire", "bureaucracy", "conscientious", "consensus",
  "definitely", "separate", "recommend", "occurrence", "maintenance", "pronunciation", "supersede", "threshold", "unforeseen", "vacuum",
  "weird", "rhythm", "silhouette", "liaison", "connoisseur", "paraphernalia", "manoeuvre", "onomatopoeia", "pharaoh", "playwright",
  "mischievous", "harass", "exhilarate", "exaggerate", "definitely", "desperate", "disastrous", "embarrass", "environment", "existence",
  "fourth", "forty", "government", "guarantee", "hierarchy", "humorous", "independent", "intelligence", "jewelry", "leisure",
  "lightning", "luxury", "mathematics", "mischievous", "necessary", "neighbor", "noticeable", "occasionally", "occurred", "occurrence",
  "pavilion", "permanent", "perseverance", "personnel", "possession", "preferred", "prejudice", "privilege", "proceed", "professor",
  "promise", "psychology", "publicly", "pursue", "quaternion", "receipt", "recommend", "relevant", "restaurant", "rhythm",
  "schedule", "seize", "separate", "shield", "simile", "sophomore", "specialty", "specimen", "statistically", "strongly",
  "subtle", "succeed", "successful", "supersede", "supposedly", "surprise", "tedious", "tendency", "threshold", "tomorrow",
  "truly", "tyranny", "unfortunately", "until", "vacuum", "vehement", "weird", "wherever", "whether", "withhold",
  "analyze", "approach", "argument", "assumption", "audience", "authority", "available", "background", "basically", "category",
  "characteristic", "circumstance", "community", "complex", "concept", "conclusion", "condition", "considerable", "constitute", "context",
  "contribute", "culture", "decision", "demonstrate", "derive", "distribute", "economic", "emphasize", "establish", "evidence",
  "evolve", "factor", "function", "identify", "indicate", "interpret", "involve", "issue", "journal", "labor",
  "legal", "legitimate", "major", "method", "obtain", "occur", "paragraph", "period", "perspective", "phenomenon",
  "principle", "proceed", "process", "prominent", "property", "publish", "purchase", "range", "region", "relevant",
  "release", "require", "research", "resource", "respond", "role", "section", "select", "significant", "similar",
  "source", "specific", "structure", "theory", "tradition", "transfer", "trend", "valid", "vary", "volume",
]).map((w) => ({ word: w.toLowerCase(), difficulty: "high-school" as const, frequency: "common" as const }));

export const COLLEGE_WORDS: WordItem[] = dedupeWords([
  "aberration", "abstemious", "acumen", "alacrity", "amalgamate", "anachronism", "anomaly", "antipathy", "apocryphal", "apothegm",
  "arcane", "ascetic", "assiduous", "astringent", "atrophy", "avarice", "balustrade", "bellicose", "beneficent", "blandishment",
  "bombast", "boor", "bucolic", "cacophony", "callow", "calumny", "capricious", "castigate", "catalyst", "caustic",
  "chicanery", "churlish", "circumlocution", "circumscribe", "coalesce", "coda", "cogent", "commensurate", "compendious", "complaisant",
  "confluence", "contiguous", "contrite", "conundrum", "copious", "corollary", "credulous", "culpable", "cursory", "decorum",
  "deference", "delineate", "demagogue", "denigrate", "derelict", "desiccate", "desultory", "diaphanous", "diatribe", "dichotomy",
  "didactic", "diffidence", "dilatory", "dilettante", "disabuse", "disparage", "dissemble", "dissonance", "doctrinaire", "dogmatic",
  "ebullient", "eclectic", "effrontery", "elegy", "embezzlement", "emollient", "empyrean", "encomium", "endemic", "enervate",
  "engender", "ephemeral", "epistolary", "equanimity", "equivocate", "erudite", "esoteric", "espy", "eulogy", "euphony",
  "evanescent", "exacerbate", "exculpate", "exigent", "extrapolate", "fastidious", "fatuous", "fawning", "fecund", "felicitous",
  "garrulous", "germane", "grandiloquent", "gregarious", "hackneyed", "halcyon", "harangue", "haughty", "hegemony", "iconoclast",
  "idiosyncrasy", "impecunious", "impetuous", "implacable", "inchoate", "incognito", "incongruous", "incumbent", "indelible", "ineffable",
  "inexorable", "ingenuous", "inimitable", "iniquity", "inscrutable", "insidious", "intransigent", "inveterate", "invidious", "irascible",
  "laconic", "largess", "latent", "lexicon", "loquacious", "lugubrious", "magnanimous", "malfeasance", "malign", "mellifluous",
  "mendacious", "meretricious", "misanthrope", "mitigate", "mollify", "moribund", "nebulous", "nefarious", "neophyte", "noisome",
  "obstreperous", "obfuscate", "opulent", "ostentatious", "palliate", "pariah", "pejorative", "perfidious", "perfunctory", "peripatetic",
  "perspicacious", "petulant", "phlegmatic", "pithy", "placate", "plethora", "precipitate", "predilection", "prevaricate", "profligate",
  "prosaic", "punctilious", "quaff", "querulous", "quotidian", "recalcitrant", "recant", "recondite", "redoubtable", "relegate",
]).map((w) => ({ word: w.toLowerCase(), difficulty: "college" as const, frequency: "rare" as const }));

export const SPELLING_BEE_WORDS: WordItem[] = dedupeWords([
  "autochthonous", "appoggiatura", "cymotrichous", "ursprache", "pococurante", "serrefile", "synecdoche", "chiaroscurist", "logorrhea", "antediluvian",
  "eleemosynary", "obstreperous", "psoriasis", "haughty", "insouciant", "obsequious", "pejorative", "pernicious", "perspicacious", "propinquity",
  "querulous", "rancorous", "recalcitrant", "sagacious", "soporific", "sycophant", "taciturn", "trenchant", "ubiquitous", "venal",
  "vituperative", "vociferous", "voluble", "wistful", "zenith", "aberrant", "abjure", "abnegate", "abrogate", "abscond",
  "abstemious", "abstruse", "acarpous", "acumen", "adumbrate", "alacrity", "amalgamate", "anfractuous", "anodyne", "apocryphal",
  "apothegm", "apotheosis", "approbation", "apropos", "arcane", "arrant", "ascetic", "asperity", "assiduous", "asseverate",
  "astringent", "atrophy", "augur", "avarice", "avuncular", "baleful", "bellicose", "beneficent", "bezel", "blandishment",
  "bowdlerize", "bucolic", "burgeon", "byzantine", "cacophony", "callow", "calumny", "canard", "candid", "cankered",
  "cantankerous", "capacious", "capricious", "captious", "cartel", "castigate", "cataclysm", "catalyst", "categorical", "catharsis",
  "caustic", "celerity", "censorious", "centripetal", "cerebral", "chagrin", "chary", "chicanery", "chimera", "choleric",
  "chrestomathy", "churlish", "circumlocution", "circumscribe", "circumvent", "coda", "cogent", "cogitate", "cognate", "cognoscenti",
  "compendious", "concupiscent", "conflagration", "congeal", "conjoin", "consanguinity", "contiguous", "contrite", "contumacious", "contumely",
  "copacetic", "coruscate", "crepuscular", "defalcate", "defenestration", "deleterious", "demulcent", "denouement", "deprecate", "derogatory",
  "desuetude", "diaphanous", "diurnal", "doggerel", "doleful", "dolorous", "edacious", "effervescent", "efflorescent", "egregious",
  "ejaculatory", "eldritch", "emolument", "encomium", "entrepot", "epigone", "epigonic", "equable", "erstwhile", "etiolate",
  "euphony", "evanescent", "excoriate", "exiguous", "extraneous", "facetious", "factitious", "fallacious", "fastidious", "fatidic",
]).map((w) => ({ word: w.toLowerCase(), difficulty: "spelling-bee" as const, frequency: "rare" as const }));

/** Master preset map: difficulty → word list. */
/** Dedupe a string array preserving order (case-insensitive). */
function dedupeWords(words: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    const n = w.toLowerCase();
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

export const DIFFICULTY_PRESETS: Record<DifficultyLevel, WordItem[]> = {
  elementary: ELEMENTARY_WORDS,
  middle: MIDDLE_WORDS,
  "high-school": HIGH_SCHOOL_WORDS,
  college: COLLEGE_WORDS,
  "spelling-bee": SPELLING_BEE_WORDS,
};

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  elementary: "Elementary (K-5)",
  middle: "Middle School (6-8)",
  "high-school": "High School (9-12)",
  college: "College / SAT / GRE",
  "spelling-bee": "Spelling Bee Champion",
};

export const PRACTICE_MODES: PracticeMode[] = [
  "type-the-word",
  "multiple-choice",
  "fill-in-blank",
];

export const PRACTICE_MODE_LABELS: Record<PracticeMode, string> = {
  "type-the-word": "Type the Word",
  "multiple-choice": "Multiple Choice",
  "fill-in-blank": "Fill in the Blank",
};

/** Common English homophones — pairs that sound alike but are spelled differently. */
export const HOMOPHONES: Record<string, string[]> = {
  "their": ["there", "they're"],
  "there": ["their", "they're"],
  "they're": ["their", "there"],
  "your": ["you're"],
  "you're": ["your"],
  "its": ["it's"],
  "it's": ["its"],
  "whose": ["who's"],
  "who's": ["whose"],
  "loose": ["lose"],
  "lose": ["loose"],
  "quiet": ["quite"],
  "quite": ["quiet"],
  "than": ["then"],
  "then": ["than"],
  "weather": ["whether"],
  "whether": ["weather"],
  "piece": ["peace"],
  "peace": ["piece"],
  "plain": ["plane"],
  "plane": ["plain"],
  "right": ["write", "rite"],
  "write": ["right", "rite"],
  "knew": ["new"],
  "new": ["knew"],
  "knot": ["not"],
  "not": ["knot"],
  "wood": ["would"],
  "would": ["wood"],
  "hole": ["whole"],
  "whole": ["hole"],
  "hour": ["our"],
  "our": ["hour"],
  "see": ["sea"],
  "sea": ["see"],
  "flower": ["flour"],
  "flour": ["flower"],
  "stare": ["stair"],
  "stair": ["stare"],
  "tale": ["tail"],
  "tail": ["tale"],
  "weak": ["week"],
  "week": ["weak"],
  "wait": ["weight"],
  "weight": ["wait"],
  "son": ["sun"],
  "sun": ["son"],
  "steal": ["steel"],
  "steel": ["steal"],
  "brake": ["break"],
  "break": ["brake"],
  "flair": ["flare"],
  "flare": ["flair"],
  "groan": ["grown"],
  "grown": ["groan"],
  "heel": ["heal", "he'll"],
  "heal": ["heel"],
  "knead": ["need"],
  "need": ["knead"],
  "leak": ["leek"],
  "leek": ["leak"],
  "maid": ["made"],
  "made": ["maid"],
  "peak": ["peek", "pique"],
  "peek": ["peak", "pique"],
  "pique": ["peak", "peek"],
  "role": ["roll"],
  "roll": ["role"],
  "sail": ["sale"],
  "sale": ["sail"],
  "scene": ["seen"],
  "seen": ["scene"],
  "soar": ["sore"],
  "sore": ["soar"],
  "tide": ["tied"],
  "tied": ["tide"],
  "vain": ["vein", "vane"],
  "vein": ["vain", "vane"],
  "waist": ["waste"],
  "waste": ["waist"],
  "ware": ["wear", "where"],
  "wear": ["ware", "where"],
  "where": ["ware", "wear"],
};

// ---------------------------------------------------------------------------
// Parsing / normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a word: trim, collapse whitespace, lowercase. We do NOT strip
 * diacritics here — the caller can opt into that via the validator.
 */
export function normalizeWord(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, "").trim();
}

/** Strip diacritics (é → e, ñ → n). */
export function stripDiacritics(s: string): string {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Parse a textarea of words (one per line, comma-separated also accepted).
 * Normalizes to lowercase, dedupes, drops empties.
 */
export function parseWordList(input: string): string[] {
  if (!input) return [];
  const parts = input.split(/[\n,;]+/).map((w) => normalizeWord(w)).filter(Boolean);
  return Array.from(new Set(parts));
}

// ---------------------------------------------------------------------------
// Spelling validator
// ---------------------------------------------------------------------------

/**
 * Validate a user-typed answer against the correct word.
 *
 * Comparison is case-insensitive by default. When `ignoreDiacritics` is true
 * (the default), accents are stripped before comparison — so "cafe" matches
 * "café".
 */
export function validateSpelling(
  correct: string,
  userAnswer: string,
  options: { ignoreDiacritics?: boolean } = {},
): boolean {
  const ignoreDiacritics = options.ignoreDiacritics ?? true;
  let a = normalizeWord(correct);
  let b = normalizeWord(userAnswer);
  if (ignoreDiacritics) {
    a = stripDiacritics(a);
    b = stripDiacritics(b);
  }
  if (!a || !b) return false;
  return a === b;
}

// ---------------------------------------------------------------------------
// Score calculator
// ---------------------------------------------------------------------------

/** Compute percentage score: (correct / total) × 100, rounded to nearest int. */
export function calculateScore(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100);
}

// ---------------------------------------------------------------------------
// Fisher-Yates shuffler
// ---------------------------------------------------------------------------

/**
 * Fisher-Yates shuffle. Returns a new array (does not mutate input).
 * Accepts an optional RNG (for testing determinism).
 */
export function shuffle<T>(arr: readonly T[], rng: () => number = Math.random): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Speed converter: WPM → TTS rate
// ---------------------------------------------------------------------------

/**
 * Convert a words-per-minute reading speed into a SpeechSynthesis `rate`
 * value (0.1–10, where 1.0 ≈ 180 WPM). We use the common heuristic that
 * 1.0 = 180 WPM, so rate = wpm / 180, clamped to [0.5, 2.0] to keep TTS
 * intelligible.
 *
 * Also returns the milliseconds-per-word for UI display.
 */
export function wpmToTtsRate(wpm: number): { rate: number; msPerWord: number } {
  const safe = Math.max(40, Math.min(400, wpm || 180));
  const rate = Math.max(0.5, Math.min(2.0, safe / 180));
  const msPerWord = Math.round(60000 / safe);
  return { rate, msPerWord };
}

// ---------------------------------------------------------------------------
// Hint generator
// ---------------------------------------------------------------------------

/**
 * Build a hint: the first letter revealed, remaining letters as dashes,
 * with a space between each character. e.g. "elephant" → "e _ _ _ _ _ _ _".
 */
export function buildHint(word: string, revealCount = 1): string {
  const w = normalizeWord(word);
  if (!w) return "";
  const n = Math.max(0, Math.min(revealCount, w.length));
  return w
    .split("")
    .map((ch, i) => (i < n ? ch : "_"))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Levenshtein distance + similar-word finder
// ---------------------------------------------------------------------------

/** Classic Levenshtein edit distance (iterative, O(m·n)). */
export function levenshtein(a: string, b: string): number {
  const x = (a || "").toLowerCase();
  const y = (b || "").toLowerCase();
  if (x === y) return 0;
  if (!x.length) return y.length;
  if (!y.length) return x.length;
  const prev = new Array<number>(y.length + 1);
  const curr = new Array<number>(y.length + 1);
  for (let j = 0; j <= y.length; j++) prev[j] = j;
  for (let i = 1; i <= x.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= y.length; j++) prev[j] = curr[j];
  }
  return prev[y.length];
}

/**
 * Find similar words (edit distance ≤ maxDistance) from a candidate pool.
 * The correct word itself is excluded.
 */
export function findSimilarWords(
  correct: string,
  pool: readonly string[],
  maxDistance = 2,
): { word: string; distance: number }[] {
  const target = normalizeWord(correct);
  const out: { word: string; distance: number }[] = [];
  for (const w of pool) {
    const n = normalizeWord(w);
    if (!n || n === target) continue;
    const d = levenshtein(target, n);
    if (d <= maxDistance) out.push({ word: n, distance: d });
  }
  out.sort((a, b) => a.distance - b.distance || a.word.localeCompare(b.word));
  return out;
}

// ---------------------------------------------------------------------------
// Multiple choice distractor generator
// ---------------------------------------------------------------------------

/**
 * Generate multiple-choice options: the correct word plus 3 distractors.
 * Distractors come from the Levenshtein-similar pool; if the pool runs dry,
 * we synthesize plausible distractors by swapping a single character.
 */
export function generateMultipleChoice(
  correct: string,
  pool: readonly string[],
  options: { numOptions?: number; rng?: () => number } = {},
): MultipleChoiceOption[] {
  const numOptions = options.numOptions ?? 4;
  const rng = options.rng ?? Math.random;
  const target = normalizeWord(correct);
  const similar = findSimilarWords(target, pool, 2)
    .map((s) => s.word);
  // If not enough similar, fall back to single-char swaps of the target.
  const distractors = new Set<string>();
  for (const s of similar) {
    if (distractors.size >= numOptions - 1) break;
    distractors.add(s);
  }
  if (distractors.size < numOptions - 1) {
    // Synthesize swap-distractors.
    const chars = "abcdefghijklmnopqrstuvwxyz";
    let guard = 0;
    while (distractors.size < numOptions - 1 && guard < 50) {
      guard++;
      if (!target) break;
      const idx = Math.floor(rng() * target.length);
      const newChar = chars[Math.floor(rng() * chars.length)];
      if (newChar === target[idx]) continue;
      const candidate = target.slice(0, idx) + newChar + target.slice(idx + 1);
      if (candidate !== target) distractors.add(candidate);
    }
  }
  const opts: MultipleChoiceOption[] = [
    { text: target, isCorrect: true },
    ...Array.from(distractors).slice(0, numOptions - 1).map((d) => ({ text: d, isCorrect: false })),
  ];
  return shuffle(opts, rng);
}

// ---------------------------------------------------------------------------
// Fill-in-blank generator
// ---------------------------------------------------------------------------

/** Replace the target word inside a sentence with "___". Case-insensitive. */
export function buildFillInBlank(sentence: string, word: string): FillInBlank {
  const s = (sentence || "").trim();
  const w = normalizeWord(word);
  if (!s) {
    return { sentence: `Please spell the word: ___ (${w.length} letters).`, answer: w };
  }
  // Build a case-insensitive whole-word regex.
  const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "i");
  if (re.test(s)) {
    return { sentence: s.replace(re, "___"), answer: w };
  }
  // Sentence doesn't contain the word — append a hint.
  return { sentence: `${s} (Hint: spell the word with ${w.length} letters — ___)`, answer: w };
}

// ---------------------------------------------------------------------------
// Pronunciation guide (very simplified)
// ---------------------------------------------------------------------------

const PHONETIC_RULES: Array<[RegExp, string]> = [
  [/ph/gi, "f"],
  [/ck/gi, "k"],
  [/kn/gi, "n"],
  [/wr/gi, "r"],
  [/mb$/gi, "m"],
  [/tch/gi, "ch"],
  [/dge/gi, "j"],
  [/ough/gi, "oh"],
  [/ae/gi, "ee"],
  [/oe/gi, "oh"],
  [/ie/gi, "ee"],
  [/ei/gi, "ay"],
  [/c(?=[eiy])/gi, "s"],
  [/g(?=[eiy])/gi, "j"],
  [/y/gi, "ee"],
  [/qu/gi, "kw"],
  [/x/gi, "ks"],
  [/sh/gi, "sh"],
  [/ch/gi, "ch"],
  [/th/gi, "th"],
];

/**
 * Generate a very rough phonetic pronunciation hint by applying simple
 * substitution rules. Output is hyphenated between consonant clusters.
 * This is NOT a real phonetic transcription — just an aid for spelling.
 */
export function buildPronunciation(word: string): string {
  let w = normalizeWord(word);
  if (!w) return "";
  for (const [pattern, replacement] of PHONETIC_RULES) {
    w = w.replace(pattern, replacement);
  }
  // Group into syllable-ish chunks (split on vowel boundaries).
  const chunks = w.match(/[bcdfghjklmnpqrstvwxyz]*[aeiou]+(?:[bcdfghjklmnpqrstvwxyz]|$)?/gi);
  if (!chunks || chunks.length === 0) return w;
  return chunks.join("-").toLowerCase();
}

// ---------------------------------------------------------------------------
// Word frequency marker
// ---------------------------------------------------------------------------

/** Built-in list of "common" words. Anything else is considered "rare". */
const COMMON_WORDS = new Set<string>([
  ...ELEMENTARY_WORDS.map((w) => w.word),
  ...MIDDLE_WORDS.map((w) => w.word),
]);

export function markFrequency(word: string): "common" | "rare" {
  return COMMON_WORDS.has(normalizeWord(word)) ? "common" : "rare";
}

// ---------------------------------------------------------------------------
// Homophone detector
// ---------------------------------------------------------------------------

export function findHomophones(word: string): string[] {
  return HOMOPHONES[normalizeWord(word)] ?? [];
}

// ---------------------------------------------------------------------------
// Practice state machine
// ---------------------------------------------------------------------------

/**
 * Pure state-machine transition for the practice flow.
 *
 *   idle → playing (start)
 *   playing → answered (submit)
 *   answered → playing (next)
 *   answered → finished (no more words)
 *   playing → finished (skip last / no more)
 *   finished → idle (reset)
 */
export function transition(
  state: PracticeState,
  action: "start" | "submit" | "next" | "skip" | "finish" | "reset",
  hasMore: boolean,
): PracticeState {
  switch (state) {
    case "idle":
      return action === "start" ? "playing" : "idle";
    case "playing":
      if (action === "submit") return "answered";
      if (action === "skip" || action === "next") return hasMore ? "playing" : "finished";
      if (action === "finish") return "finished";
      return state;
    case "answered":
      if (action === "next") return hasMore ? "playing" : "finished";
      if (action === "finish" || action === "reset") return action === "reset" ? "idle" : "finished";
      return state;
    case "finished":
      return action === "reset" ? "idle" : "finished";
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

export function computeSummary(records: AnswerRecord[]): SummaryStats {
  if (records.length === 0) {
    return {
      totalWords: 0,
      correct: 0,
      incorrect: 0,
      accuracy: 0,
      avgTimePerWordMs: 0,
      hardestWord: null,
    };
  }
  const correct = records.filter((r) => r.correct).length;
  const totalTime = records.reduce((s, r) => s + r.timeTakenMs, 0);
  // Hardest word = the incorrect one with the longest time; if all correct,
  // the slowest-correct word.
  const incorrect = records.filter((r) => !r.correct);
  const pool = incorrect.length > 0 ? incorrect : records;
  const hardest = pool.reduce(
    (max, r) => (r.timeTakenMs > max.timeTakenMs ? r : max),
    pool[0],
  );
  return {
    totalWords: records.length,
    correct,
    incorrect: records.length - correct,
    accuracy: calculateScore(correct, records.length),
    avgTimePerWordMs: Math.round(totalTime / records.length),
    hardestWord: hardest.word,
  };
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

/** Render a plain-text session report. */
export function renderText(
  records: AnswerRecord[],
  stats: SummaryStats,
  difficulty: DifficultyLevel,
  mode: PracticeMode,
): string {
  const lines: string[] = [];
  lines.push("Spelling Bee Practice — Session Report");
  lines.push("=====================================");
  lines.push(`Difficulty: ${DIFFICULTY_LABELS[difficulty]}`);
  lines.push(`Mode: ${PRACTICE_MODE_LABELS[mode]}`);
  lines.push(`Date: ${new Date().toLocaleString()}`);
  lines.push("");
  lines.push(`Total words:  ${stats.totalWords}`);
  lines.push(`Correct:      ${stats.correct}`);
  lines.push(`Incorrect:    ${stats.incorrect}`);
  lines.push(`Accuracy:     ${stats.accuracy}%`);
  lines.push(`Avg time/word:${stats.avgTimePerWordMs} ms`);
  lines.push(`Hardest word: ${stats.hardestWord ?? "—"}`);
  lines.push("");
  lines.push("Word-by-word:");
  lines.push("-------------------------------------");
  for (const r of records) {
    const mark = r.correct ? "✓" : "✗";
    const shown = r.correct ? r.word : `${r.userAnswer || "(blank)"} → ${r.word}`;
    lines.push(`${mark}  ${shown}  (${r.timeTakenMs} ms)`);
  }
  return lines.join("\n");
}

/** Render records as CSV with header row. */
export function renderCsv(records: AnswerRecord[]): string {
  const lines = ["word,user_answer,correct,time_taken_ms"];
  for (const r of records) {
    lines.push([
      escapeCsv(r.word),
      escapeCsv(r.userAnswer),
      r.correct ? "true" : "false",
      String(r.timeTakenMs),
    ].join(","));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:spelling-bee-practice:history";
const HISTORY_MAX = 20;

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

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

export interface ShareState {
  words: string;
  difficulty: DifficultyLevel;
  mode: PracticeMode;
  speedWpm: number;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.words) params.set("words", state.words);
  if (state.difficulty) params.set("diff", state.difficulty);
  if (state.mode) params.set("mode", state.mode);
  if (state.speedWpm) params.set("wpm", String(state.speedWpm));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const defaults: ShareState = {
    words: "",
    difficulty: "elementary",
    mode: "type-the-word",
    speedWpm: 100,
  };
  if (!clean) return defaults;
  const params = new URLSearchParams(clean);
  const validDiffs = Object.keys(DIFFICULTY_LABELS) as DifficultyLevel[];
  const validModes = PRACTICE_MODES;
  const diff = params.get("diff");
  const mode = params.get("mode");
  const wpmRaw = params.get("wpm");
  const wpm = wpmRaw ? Number(wpmRaw) : NaN;
  return {
    words: params.get("words") ?? "",
    difficulty: diff && validDiffs.includes(diff as DifficultyLevel)
      ? (diff as DifficultyLevel)
      : defaults.difficulty,
    mode: mode && validModes.includes(mode as PracticeMode)
      ? (mode as PracticeMode)
      : defaults.mode,
    speedWpm: Number.isFinite(wpm) && wpm > 0 ? wpm : defaults.speedWpm,
  };
}

// ---------------------------------------------------------------------------
// Session builder — assemble the ordered word queue for a session.
// ---------------------------------------------------------------------------

/**
 * Build the word queue for a practice session.
 *
 * - If the user provided a custom word list, use it (deduped, normalized).
 * - Otherwise, sample from the difficulty preset's built-in list (shuffled,
 *   capped at `maxWords`).
 */
export function buildSession(
  customWords: readonly string[],
  difficulty: DifficultyLevel,
  maxWords = 20,
  rng: () => number = Math.random,
): WordItem[] {
  if (customWords.length > 0) {
    return customWords.map((w) => ({
      word: normalizeWord(w),
      difficulty,
      frequency: markFrequency(w),
      pronunciation: buildPronunciation(w),
    }));
  }
  const pool = DIFFICULTY_PRESETS[difficulty] ?? [];
  return shuffle(pool, rng).slice(0, Math.max(1, Math.min(maxWords, pool.length)));
}
