/**
 * AI Poem & Lyrics Writer — pure logic.
 *
 * Generate form-aware poems and song lyrics with rhyme, meter, mood, and
 * theme control. Pure functions only — no DOM, no network. The optional
 * LLM call (BYO API key) lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type PoemForm = "haiku" | "sonnet" | "free-verse" | "limerick" | "acrostic" | "song";

export type RhymeScheme = "AABB" | "ABAB" | "ABBA" | "Free";

export type Mood =
  | "joyful"
  | "melancholy"
  | "defiant"
  | "contemplative"
  | "romantic"
  | "playful";

export interface PoemLine {
  index: number;       // 0-based
  text: string;
  syllables: number;
  /** Rhyme-letter label (A, B, C, ...) assigned by the generator. */
  rhymeLabel: string;
  /** For acrostic: the letter this line starts with. */
  acrosticLetter?: string;
}

export interface Poem {
  id: string;
  theme: string;
  form: PoemForm;
  rhymeScheme: RhymeScheme;
  mood: Mood;
  acrosticWord?: string;
  lines: PoemLine[];
  title: string;
  /** Validation report — flags rule violations. */
  validation: ValidationReport;
  createdAt: number;
}

export interface ValidationReport {
  formOk: boolean;
  rhymeSchemeOk: boolean;
  syllableOk: boolean;
  notes: string[];
}

export interface SongLyrics {
  id: string;
  theme: string;
  mood: Mood;
  sections: SongSection[];
  title: string;
  createdAt: number;
}

export interface SongSection {
  kind: "verse" | "chorus" | "bridge" | "outro";
  label: string;
  lines: PoemLine[];
}

export interface PoemStats {
  lineCount: number;
  syllableTotal: number;
  rhymeGroups: number;
  avgSyllablesPerLine: number;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-poem-lyrics:history";
export const HISTORY_MAX = 20;

export const FORM_LABELS: Record<PoemForm, string> = {
  haiku: "Haiku (5-7-5)",
  sonnet: "Sonnet (14 lines, ABAB CDCD EFEF GG)",
  "free-verse": "Free verse (no rules)",
  limerick: "Limerick (AABBA)",
  acrostic: "Acrostic (spells a word)",
  song: "Song lyrics (verse/chorus/bridge)",
};

export const RHYME_SCHEME_LABELS: Record<RhymeScheme, string> = {
  AABB: "AABB (couplets)",
  ABAB: "ABAB (alternating)",
  ABBA: "ABBA (envelope)",
  Free: "Free (no rhyme)",
};

export const MOOD_LABELS: Record<Mood, string> = {
  joyful: "Joyful",
  melancholy: "Melancholy",
  defiant: "Defiant",
  contemplative: "Contemplative",
  romantic: "Romantic",
  playful: "Playful",
};

export const MOOD_TONE_WORDS: Record<Mood, string[]> = {
  joyful: ["bright", "warm", "gold", "rise", "sing", "laugh", "shine", "leap", "bloom", "dance"],
  melancholy: ["grey", "faded", "drift", "hollow", "rain", "silence", "fade", "lost", "echo", "shadow"],
  defiant: ["stand", "burn", "roar", "break", "rise", "fight", "fist", "tear", "iron", "thunder"],
  contemplative: ["still", "watch", "wonder", "wait", "dust", "river", "stone", "breath", "dawn", "horizon"],
  romantic: ["bloom", "heart", "blush", "warm", "touch", "tender", "rose", "kiss", "flame", "star"],
  playful: ["bounce", "tickle", "skip", "giggle", "spin", "leap", "grin", "wiggle", "snap", "whirl"],
};

export const THEME_PRESETS: string[] = [
  "Autumn rain",
  "The sea at dawn",
  "A childhood memory",
  "City lights",
  "Lost love",
  "A long journey home",
  "The first snow",
  "An old photograph",
];

// ---------- Rhyme dictionary (200+ words) ----------
// Grouped by rhyme ending. Each key is a phonetic rhyme ending; the values
// are words that share that ending. 200+ entries total.

export const RHYME_DICTIONARY: Record<string, string[]> = {
  "-ight": [
    "light", "night", "sight", "bright", "fight", "flight", "might", "right",
    "tight", "white", "knight", "height", "slight", "spite", "delight", "tonight",
  ],
  "-ake": [
    "make", "take", "wake", "lake", "cake", "bake", "fake", "shake", "brake",
    "snake", "stake", "ache", "break", "forsake", "awake", "mistake",
  ],
  "-old": [
    "old", "cold", "bold", "gold", "hold", "told", "fold", "mold", "sold",
    "scold", "unfold", "withhold", "outfold",
  ],
  "-ear": [
    "near", "dear", "fear", "hear", "tear", "year", "clear", "gear", "rear",
    "spear", "steer", "cheer", "sneer", "sphere", "frontier",
  ],
  "-ay": [
    "day", "way", "say", "play", "stay", "may", "lay", "pay", "ray", "clay",
    "gray", "pray", "sway", "betray", "delay", "display", "today", "away",
  ],
  "-ee": [
    "see", "be", "free", "tree", "me", "we", "key", "lee", "sea", "tea",
    "knee", "plea", "flee", "agree", "decree", "spree", "guarantee",
  ],
  "-ow": [
    "now", "how", "bow", "row", "snow", "blow", "flow", "grow", "low", "show",
    "slow", "throw", "glow", "know", "crow", "bestow",
  ],
  "-oo": [
    "too", "do", "you", "two", "blue", "true", "new", "knew", "flew", "grew",
    "threw", "chew", "brew", "stew", "drew", "screw",
  ],
  "-ain": [
    "rain", "main", "pain", "gain", "vain", "brain", "chain", "train", "plain",
    "strain", "remain", "domain", "refrain", "explain",
  ],
  "-air": [
    "air", "fair", "hair", "pair", "chair", "stair", "lair", "flair", "affair",
    "repair", "despair", "compare",
  ],
  "-ore": [
    "more", "store", "score", "shore", "bore", "core", "door", "floor", "roar",
    "soar", "explore", "before", "restore",
  ],
  "-ime": [
    "time", "rhyme", "chime", "climb", "prime", "crime", "lime", "dime", "slime",
    "sublime",
  ],
  "-ind": [
    "find", "mind", "kind", "blind", "behind", "remind", "bind", "grind", "wind",
  ],
  "-ove": [
    "love", "dove", "glove", "above", "shove",
  ],
  "-ove-long": [
    "move", "prove", "groove", "improve", "remove",
  ],
  "-all": [
    "all", "call", "fall", "tall", "wall", "small", "ball", "hall", "stall",
    "crawl", "drawl", "install", "overall",
  ],
  "-ell": [
    "tell", "well", "fell", "sell", "bell", "shell", "spell", "yell", "dwell",
    "knell", "expel", "compel",
  ],
  "-ill": [
    "will", "hill", "fill", "still", "mill", "pill", "drill", "skill", "spill",
    "until", "fulfill",
  ],
  "-and": [
    "and", "hand", "land", "sand", "band", "stand", "grand", "command",
    "demand", "expand", "withstand",
  ],
  "-est": [
    "best", "rest", "test", "west", "nest", "vest", "chest", "quest", "blest",
    "bequest",
  ],
  "-ide": [
    "side", "ride", "hide", "wide", "pride", "tide", "guide", "bride", "glide",
    "stride", "beside", "divide",
  ],
  "-ine": [
    "line", "fine", "nine", "mine", "wine", "shine", "pine", "vine", "twine",
    "divine", "design", "combine",
  ],
  "-oat": [
    "boat", "coat", "goat", "float", "moat", "throat", "overcoat",
  ],
  "-ound": [
    "sound", "round", "bound", "found", "ground", "hound", "mound", "pound",
    "wound", "surround", "abound",
  ],
  "-own": [
    "own", "known", "thrown", "grown", "shown", "blown", "flown", "stone",
    "bone", "alone", "atone",
  ],
  "-aze": [
    "aze", "blaze", "gaze", "maze", "phase", "raise", "praise", "craze", "glaze",
  ],
};

/** Total word count in the rhyme dictionary. */
export function rhymeDictionarySize(): number {
  let n = 0;
  for (const k of Object.keys(RHYME_DICTIONARY)) {
    n += RHYME_DICTIONARY[k].length;
  }
  return n;
}

// ---------- Helpers ----------

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "of", "to", "in", "on", "at",
  "for", "with", "about", "as", "by", "from", "is", "are", "was", "were",
  "be", "been", "being", "this", "that", "these", "those", "it", "its",
  "your", "you", "we", "they", "them", "their", "our", "my", "i",
]);

/** Normalize a theme string. */
export function normalizeTheme(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Extract meaningful keywords from the theme. */
export function extractThemeKeywords(theme: string): string[] {
  const clean = normalizeTheme(theme).toLowerCase();
  if (!clean) return [];
  const noParen = clean.replace(/\([^)]*\)/g, " ").trim();
  const words = noParen
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  const unique: string[] = [];
  for (const w of words) {
    if (!unique.includes(w)) unique.push(w);
  }
  return unique;
}

/**
 * Count syllables in a word using a vowel-group heuristic.
 * Handles common English patterns; falls back gracefully.
 */
export function countSyllables(word: string): number {
  const w = (word || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  // Silent -e at end:
  //   - Strip if word ends in plain "e" (e.g., "make", "time")
  //   - Strip if word ends in "vowel + le" (e.g., "ale", "while") — e is silent
  //   - Keep if word ends in "consonant + le" (e.g., "table", "apple") — le forms a syllable
  let s = w;
  if (s.endsWith("e")) {
    if (s.endsWith("le") && s.length > 2 && !/[aeiou]le$/.test(s)) {
      // consonant + le — keep the e (it's part of the syllabic l sound)
    } else {
      s = s.slice(0, -1);
    }
  }
  // Trailing y acts as a vowel iff preceded by a consonant ("city", "happy" → 2),
  // and is silent if preceded by a vowel ("day", "boy" → 1). We model this by
  // replacing trailing y with i when it acts as a vowel.
  let t = s;
  if (t.length > 1 && t.endsWith("y")) {
    const before = t[t.length - 2];
    if (!"aeiou".includes(before)) {
      t = t.slice(0, -1) + "i";
    }
  }
  // Count vowel groups
  const groups = t.match(/[aeiou]+/g);
  let count = groups ? groups.length : 0;
  if (count === 0) count = 1;
  return Math.max(1, count);
}

/** Count syllables in a full line of text. */
export function countLineSyllables(line: string): number {
  if (!line.trim()) return 0;
  return line
    .trim()
    .split(/\s+/)
    .reduce((acc, w) => acc + countSyllables(w), 0);
}

/**
 * Determine the rhyme ending of a word. Looks the word up in the
 * dictionary; falls back to a heuristic (last 3 chars or last vowel + consonants).
 */
export function getRhymeEnding(word: string): string {
  const w = (word || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return "";
  // Check dictionary first
  for (const ending of Object.keys(RHYME_DICTIONARY)) {
    if (RHYME_DICTIONARY[ending].includes(w)) return ending;
  }
  // Heuristic: last vowel group + trailing consonants
  const m = w.match(/[aeiouy]+[^aeiouy]*$/);
  return m ? `-${m[0]}` : `-${w.slice(-2)}`;
}

/** Find all rhymes for a word from the dictionary. */
export function findRhymes(word: string): string[] {
  const w = (word || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return [];
  const ending = getRhymeEnding(w);
  const all = RHYME_DICTIONARY[ending] ?? [];
  return all.filter((r) => r !== w);
}

/** Pick a random rhyme partner for a word (deterministic by index). */
export function pickRhymePartner(word: string, offset: number): string {
  const rhymes = findRhymes(word);
  if (rhymes.length === 0) return word;
  return rhymes[Math.abs(offset) % rhymes.length];
}

// ---------- Line builders ----------

interface LineBuilderOpts {
  theme: string;
  mood: Mood;
  keywords: string[];
  targetSyllables?: number;
  rhymeWord?: string;
  acrosticLetter?: string;
}

/** Build a single poem line honoring syllable target and optional rhyme. */
export function buildLine(opts: LineBuilderOpts): string {
  const { theme, mood, keywords, targetSyllables, rhymeWord, acrosticLetter } = opts;
  const kw = keywords[0] ?? theme.toLowerCase().split(/\s+/)[0] ?? "the";
  const tone = MOOD_TONE_WORDS[mood] ?? MOOD_TONE_WORDS.contemplative;
  const toneWord = tone[Math.abs(hashCode(theme)) % tone.length];

  // Sentence templates; pick by length budget
  const short: string[] = [
    `${cap(kw)} ${toneWord} now.`,
    `The ${kw} ${toneWord}.`,
    `Here, ${toneWord} and ${kw}.`,
    `${cap(toneWord)} ${kw}.`,
  ];
  const medium: string[] = [
    `The ${kw} ${toneWord} in the ${theme.toLowerCase()}.`,
    `Where ${kw} ${toneWord}s, the ${theme.toLowerCase()} begins.`,
    `Beneath the ${theme.toLowerCase()}, a ${toneWord} ${kw} waits.`,
    `We ${toneWord} through ${kw} and remember.`,
  ];
  const long: string[] = [
    `Long ago the ${kw} ${toneWord}ed in the heart of the ${theme.toLowerCase()}.`,
    `When the ${theme.toLowerCase()} ${toneWord}s, the ${kw} rises to meet the dawn.`,
    `In the silence of the ${theme.toLowerCase()}, a ${kw} ${toneWord}s forever.`,
    `Tell me again how the ${kw} ${toneWord}ed across the ${theme.toLowerCase()}.`,
  ];

  // Pick template by target syllables
  let tmpl: string;
  if (!targetSyllables) {
    tmpl = medium[Math.abs(hashCode(theme + kw)) % medium.length];
  } else if (targetSyllables <= 4) {
    tmpl = short[Math.abs(hashCode(theme + kw)) % short.length];
  } else if (targetSyllables <= 9) {
    tmpl = medium[Math.abs(hashCode(theme + kw)) % medium.length];
  } else {
    tmpl = long[Math.abs(hashCode(theme + kw)) % long.length];
  }

  let line = tmpl;

  // Acrostic: force the line to start with the letter
  if (acrosticLetter) {
    const L = acrosticLetter.toUpperCase();
    // Try to find a word in our line that starts with the letter; if none,
    // prepend a filler word that does
    const words = line.split(/\s+/);
    if (words.length > 0 && words[0].toUpperCase().startsWith(L)) {
      // already starts with it
    } else {
      const fillers: Record<string, string> = {
        A: "All", B: "By", C: "Come", D: "Down", E: "Each", F: "From",
        G: "Great", H: "Here", I: "In", J: "Just", K: "Know", L: "Long",
        M: "Many", N: "Now", O: "Once", P: "Past", Q: "Quiet", R: "Rising",
        S: "Some", T: "Through", U: "Under", V: "Voices", W: "When",
        X: "Xenial", Y: "Years", Z: "Zealous",
      };
      const filler = fillers[L] ?? "And";
      line = `${filler} ${line.charAt(0).toLowerCase()}${line.slice(1)}`;
    }
  }

  // Rhyme: replace the last word with a rhyme partner if specified
  if (rhymeWord) {
    const words = line.split(/\s+/);
    if (words.length > 1) {
      // Strip trailing punctuation
      const lastIdx = words.length - 1;
      const last = words[lastIdx];
      const punctMatch = last.match(/[.,!?;:]+$/);
      const punct = punctMatch ? punctMatch[0] : "";
      words[lastIdx] = `${rhymeWord}${punct}`;
      line = words.join(" ");
    } else {
      line = rhymeWord;
    }
  }

  return line;
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

// ---------- Rhyme-scheme helpers ----------

/** Expand a scheme label (AABB) into per-line letters: [A, A, B, B]. */
export function expandScheme(scheme: RhymeScheme, lineCount: number): string[] {
  if (scheme === "Free") {
    return Array.from({ length: lineCount }, (_, i) => String.fromCharCode(65 + i));
  }
  if (scheme === "AABB") {
    return Array.from({ length: lineCount }, (_, i) =>
      String.fromCharCode(65 + Math.floor(i / 2)),
    );
  }
  if (scheme === "ABAB") {
    return Array.from({ length: lineCount }, (_, i) => {
      const m = i % 4;
      return m < 2 ? String.fromCharCode(65 + m) : String.fromCharCode(65 + m - 2);
    });
  }
  if (scheme === "ABBA") {
    return Array.from({ length: lineCount }, (_, i) => {
      const m = i % 4;
      return ["A", "B", "B", "A"][m];
    });
  }
  return Array.from({ length: lineCount }, () => "A");
}

/** Pick a representative rhyme word for each unique rhyme label. */
export function pickRhymeWordsForLabels(
  labels: string[],
  theme: string,
  mood: Mood,
): Record<string, string> {
  const out: Record<string, string> = {};
  const tone = MOOD_TONE_WORDS[mood] ?? MOOD_TONE_WORDS.contemplative;
  // For each unique label, pick a starting word; for repeated labels,
  // pick a rhyme partner.
  const seedWords = [...tone, "sky", "rain", "fire", "moon", "star", "wind", "wave", "tree", "stone"];
  let seedIdx = 0;
  for (const label of labels) {
    if (out[label]) continue;
    // Try to find a seed word that has rhymes in the dictionary
    let attempts = 0;
    let seed = seedWords[seedIdx % seedWords.length];
    while (findRhymes(seed).length === 0 && attempts < seedWords.length) {
      seedIdx += 1;
      seed = seedWords[seedIdx % seedWords.length];
      attempts += 1;
    }
    out[label] = seed;
    seedIdx += 1;
  }
  // For repeated labels, ensure the partner is set
  for (const label of labels) {
    if (out[label]) continue;
  }
  return out;
}

/** Validate that lines labeled with the same letter actually rhyme. */
export function validateRhymeScheme(lines: PoemLine[]): { ok: boolean; mismatches: string[] } {
  const groups = new Map<string, PoemLine[]>();
  for (const l of lines) {
    if (!groups.has(l.rhymeLabel)) groups.set(l.rhymeLabel, []);
    groups.get(l.rhymeLabel)!.push(l);
  }
  const mismatches: string[] = [];
  for (const [label, group] of groups) {
    if (group.length < 2) continue;
    const endings = new Set<string>();
    for (const l of group) {
      const words = l.text.trim().split(/\s+/);
      const last = (words[words.length - 1] || "").toLowerCase().replace(/[^a-z]/g, "");
      endings.add(getRhymeEnding(last));
    }
    if (endings.size > 1) {
      mismatches.push(`Rhyme group ${label} has mismatched endings: ${[...endings].join(", ")}`);
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}

// ---------- Form generators ----------

/** Generate a haiku (5-7-5 syllables, 3 lines, no rhyme). */
export function generateHaiku(theme: string, mood: Mood): PoemLine[] {
  const keywords = extractThemeKeywords(theme);
  const lines: PoemLine[] = [];
  const targets = [5, 7, 5];
  for (let i = 0; i < 3; i++) {
    const text = buildLine({
      theme, mood, keywords, targetSyllables: targets[i],
    });
    lines.push({
      index: i,
      text,
      syllables: countLineSyllables(text),
      rhymeLabel: String.fromCharCode(65 + i), // A, B, C — no rhyme
    });
  }
  return lines;
}

/** Generate a sonnet (14 lines, ABAB CDCD EFEF GG). */
export function generateSonnet(theme: string, mood: Mood): PoemLine[] {
  const keywords = extractThemeKeywords(theme);
  const scheme = ["A", "B", "A", "B", "C", "D", "C", "D", "E", "F", "E", "F", "G", "G"];
  const seedWords = MOOD_TONE_WORDS[mood];
  // Pick a seed word for each unique rhyme label
  const labelWords: Record<string, string> = {};
  const uniqueLabels = [...new Set(scheme)];
  for (let i = 0; i < uniqueLabels.length; i++) {
    labelWords[uniqueLabels[i]] = seedWords[i % seedWords.length];
  }
  // For each line, if its label is repeated (a "B" follows an "A"), set rhymeWord
  // to the partner that rhymes with the seed.
  const seenLabel: Record<string, boolean> = {};
  const lines: PoemLine[] = [];
  for (let i = 0; i < 14; i++) {
    const label = scheme[i];
    const seed = labelWords[label];
    let rhymeWord: string | undefined;
    if (seenLabel[label]) {
      // Second (or later) occurrence — pick a rhyme partner
      rhymeWord = pickRhymePartner(seed, i);
    } else {
      // First occurrence — use the seed itself
      rhymeWord = seed;
      seenLabel[label] = true;
    }
    const text = buildLine({
      theme, mood, keywords,
      targetSyllables: 10,
      rhymeWord,
    });
    lines.push({
      index: i,
      text,
      syllables: countLineSyllables(text),
      rhymeLabel: label,
    });
  }
  return lines;
}

/** Generate free verse (8 lines, no rules). */
export function generateFreeVerse(theme: string, mood: Mood): PoemLine[] {
  const keywords = extractThemeKeywords(theme);
  const lines: PoemLine[] = [];
  const lineCount = 8;
  for (let i = 0; i < lineCount; i++) {
    const target = i % 2 === 0 ? 7 : 9;
    const text = buildLine({
      theme, mood, keywords, targetSyllables: target,
    });
    lines.push({
      index: i,
      text,
      syllables: countLineSyllables(text),
      rhymeLabel: String.fromCharCode(65 + i),
    });
  }
  return lines;
}

/** Generate a limerick (5 lines, AABBA, specific meter). */
export function generateLimerick(theme: string, mood: Mood): PoemLine[] {
  const keywords = extractThemeKeywords(theme);
  const scheme = ["A", "A", "B", "B", "A"];
  const targets = [9, 9, 6, 6, 9];
  const seedWords = MOOD_TONE_WORDS.playful;
  const labelWords: Record<string, string> = {
    A: seedWords[0],
    B: seedWords[1],
  };
  const seen: Record<string, boolean> = {};
  const lines: PoemLine[] = [];
  for (let i = 0; i < 5; i++) {
    const label = scheme[i];
    const seed = labelWords[label];
    let rhymeWord: string | undefined;
    if (seen[label]) {
      rhymeWord = pickRhymePartner(seed, i);
    } else {
      rhymeWord = seed;
      seen[label] = true;
    }
    const text = buildLine({
      theme, mood: "playful", keywords,
      targetSyllables: targets[i],
      rhymeWord,
    });
    lines.push({
      index: i,
      text,
      syllables: countLineSyllables(text),
      rhymeLabel: label,
    });
  }
  return lines;
}

/** Generate an acrostic poem (first letter of each line spells a word). */
export function generateAcrostic(theme: string, mood: Mood, word: string): PoemLine[] {
  const keywords = extractThemeKeywords(theme);
  const cleanWord = (word || "POEM").toUpperCase().replace(/[^A-Z]/g, "");
  const lines: PoemLine[] = [];
  for (let i = 0; i < cleanWord.length; i++) {
    const letter = cleanWord[i];
    const text = buildLine({
      theme, mood, keywords,
      targetSyllables: 8,
      acrosticLetter: letter,
    });
    lines.push({
      index: i,
      text,
      syllables: countLineSyllables(text),
      rhymeLabel: String.fromCharCode(65 + i),
      acrosticLetter: letter,
    });
  }
  return lines;
}

/** Generate song lyrics (verse/chorus/bridge structure). */
export function generateSongLyrics(theme: string, mood: Mood): SongSection[] {
  const keywords = extractThemeKeywords(theme);
  const sections: SongSection[] = [];
  const structure: Array<{ kind: SongSection["kind"]; label: string; lines: number; scheme: RhymeScheme }> = [
    { kind: "verse", label: "Verse 1", lines: 4, scheme: "AABB" },
    { kind: "chorus", label: "Chorus", lines: 4, scheme: "ABAB" },
    { kind: "verse", label: "Verse 2", lines: 4, scheme: "AABB" },
    { kind: "chorus", label: "Chorus", lines: 4, scheme: "ABAB" },
    { kind: "bridge", label: "Bridge", lines: 3, scheme: "Free" },
    { kind: "chorus", label: "Chorus", lines: 4, scheme: "ABAB" },
    { kind: "outro", label: "Outro", lines: 2, scheme: "AABB" },
  ];
  for (const s of structure) {
    const labels = expandScheme(s.scheme, s.lines);
    const labelSeed: Record<string, string> = {};
    const seedWords = MOOD_TONE_WORDS[mood];
    const uniqueLabels = [...new Set(labels)];
    for (let i = 0; i < uniqueLabels.length; i++) {
      labelSeed[uniqueLabels[i]] = seedWords[i % seedWords.length];
    }
    const seen: Record<string, boolean> = {};
    const sectionLines: PoemLine[] = [];
    for (let i = 0; i < s.lines; i++) {
      const label = labels[i];
      const seed = labelSeed[label];
      let rhymeWord: string | undefined;
      if (s.scheme === "Free") {
        rhymeWord = undefined;
      } else if (seen[label]) {
        rhymeWord = pickRhymePartner(seed, i);
      } else {
        rhymeWord = seed;
        seen[label] = true;
      }
      const text = buildLine({
        theme, mood, keywords,
        targetSyllables: s.kind === "chorus" ? 7 : 9,
        rhymeWord,
      });
      sectionLines.push({
        index: i,
        text,
        syllables: countLineSyllables(text),
        rhymeLabel: label,
      });
    }
    sections.push({ kind: s.kind, label: s.label, lines: sectionLines });
  }
  return sections;
}

// ---------- Validation ----------

/** Validate a poem against its form's rules. */
export function validateForm(poem: Poem): ValidationReport {
  const notes: string[] = [];
  let formOk = true;
  let rhymeSchemeOk = true;
  let syllableOk = true;

  // Line count check
  if (poem.form === "haiku" && poem.lines.length !== 3) {
    notes.push(`Haiku should have 3 lines; got ${poem.lines.length}.`);
    formOk = false;
  }
  if (poem.form === "sonnet" && poem.lines.length !== 14) {
    notes.push(`Sonnet should have 14 lines; got ${poem.lines.length}.`);
    formOk = false;
  }
  if (poem.form === "limerick" && poem.lines.length !== 5) {
    notes.push(`Limerick should have 5 lines; got ${poem.lines.length}.`);
    formOk = false;
  }

  // Syllable checks (haiku)
  if (poem.form === "haiku") {
    const targets = [5, 7, 5];
    for (let i = 0; i < Math.min(poem.lines.length, 3); i++) {
      if (poem.lines[i].syllables !== targets[i]) {
        notes.push(`Line ${i + 1}: ${poem.lines[i].syllables} syllables (target ${targets[i]}).`);
        syllableOk = false;
      }
    }
  }

  // Rhyme scheme check (limerick)
  if (poem.form === "limerick") {
    const expected = ["A", "A", "B", "B", "A"];
    for (let i = 0; i < Math.min(poem.lines.length, 5); i++) {
      if (poem.lines[i].rhymeLabel !== expected[i]) {
        notes.push(`Line ${i + 1}: rhyme label ${poem.lines[i].rhymeLabel} (expected ${expected[i]}).`);
        rhymeSchemeOk = false;
      }
    }
  }

  // General rhyme-scheme validation
  const rhCheck = validateRhymeScheme(poem.lines);
  if (!rhCheck.ok) {
    rhymeSchemeOk = rhymeSchemeOk && rhCheck.ok;
    notes.push(...rhCheck.mismatches);
  }

  if (notes.length === 0) {
    notes.push("Form follows the rules.");
  }

  return { formOk, rhymeSchemeOk, syllableOk, notes };
}

// ---------- Main entry ----------

export interface GeneratePoemInput {
  theme: string;
  form: PoemForm;
  rhymeScheme: RhymeScheme;
  mood: Mood;
  acrosticWord?: string;
}

/** Validate poem input. Returns null on success, error message otherwise. */
export function validatePoemInput(input: GeneratePoemInput): string | null {
  if (!normalizeTheme(input.theme)) return "Please enter a theme.";
  if (!FORM_LABELS[input.form]) return "Unknown poem form.";
  if (!RHYME_SCHEME_LABELS[input.rhymeScheme]) return "Unknown rhyme scheme.";
  if (!MOOD_LABELS[input.mood]) return "Unknown mood.";
  if (input.form === "acrostic") {
    const w = (input.acrosticWord || "").toUpperCase().replace(/[^A-Z]/g, "");
    if (!w) return "Acrostic form requires a word.";
    if (w.length < 2) return "Acrostic word must be at least 2 letters.";
    if (w.length > 16) return "Acrostic word must be 16 letters or less.";
  }
  return null;
}

/** Generate a poem (or song lyrics) based on inputs. */
export function generatePoem(input: GeneratePoemInput): Poem | SongLyrics {
  const err = validatePoemInput(input);
  if (err) throw new Error(err);

  const theme = normalizeTheme(input.theme);
  const { form, rhymeScheme, mood } = input;

  if (form === "song") {
    const sections = generateSongLyrics(theme, mood);
    return {
      id: `song-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      theme,
      mood,
      sections,
      title: buildTitle(theme, mood),
      createdAt: Date.now(),
    };
  }

  let lines: PoemLine[];
  switch (form) {
    case "haiku": lines = generateHaiku(theme, mood); break;
    case "sonnet": lines = generateSonnet(theme, mood); break;
    case "free-verse": lines = generateFreeVerse(theme, mood); break;
    case "limerick": lines = generateLimerick(theme, mood); break;
    case "acrostic":
      lines = generateAcrostic(theme, mood, input.acrosticWord ?? "POEM");
      break;
    default:
      throw new Error(`Unknown form: ${form}`);
  }

  const poem: Poem = {
    id: `poem-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    theme,
    form,
    rhymeScheme,
    mood,
    acrosticWord: form === "acrostic" ? (input.acrosticWord ?? "POEM").toUpperCase() : undefined,
    lines,
    title: buildTitle(theme, mood),
    validation: { formOk: true, rhymeSchemeOk: true, syllableOk: true, notes: [] },
    createdAt: Date.now(),
  };
  poem.validation = validateForm(poem);
  return poem;
}

/** Build a poem title from theme + mood. */
export function buildTitle(theme: string, mood: Mood): string {
  const kw = extractThemeKeywords(theme);
  const primary = kw[0] ? kw[0].charAt(0).toUpperCase() + kw[0].slice(1) : theme;
  const titles: Record<Mood, string> = {
    joyful: `Bright ${primary}`,
    melancholy: `The Weight of ${primary}`,
    defiant: `Beneath the ${primary}`,
    contemplative: `Watching ${primary}`,
    romantic: `${primary}, and You`,
    playful: `${primary} on the Loose`,
  };
  return titles[mood];
}

// ---------- Stats ----------

export function computeStats(poem: Poem | SongLyrics): PoemStats {
  const allLines: PoemLine[] = "sections" in poem
    ? poem.sections.flatMap((s) => s.lines)
    : poem.lines;
  const lineCount = allLines.length;
  const syllableTotal = allLines.reduce((a, l) => a + l.syllables, 0);
  const rhymeLabels = new Set(allLines.map((l) => l.rhymeLabel));
  return {
    lineCount,
    syllableTotal,
    rhymeGroups: rhymeLabels.size,
    avgSyllablesPerLine: lineCount > 0 ? Math.round((syllableTotal / lineCount) * 10) / 10 : 0,
  };
}

// ---------- Renderers ----------

export function renderText(work: Poem | SongLyrics): string {
  const lines: string[] = [];
  lines.push(work.title);
  lines.push("");
  if ("sections" in work) {
    for (const s of work.sections) {
      lines.push(`[${s.label}]`);
      for (const l of s.lines) {
        lines.push(`${l.text}  (${l.syllables} syl, ${l.rhymeLabel})`);
      }
      lines.push("");
    }
  } else {
    for (const l of work.lines) {
      const acro = l.acrosticLetter ? `[${l.acrosticLetter}] ` : "";
      lines.push(`${acro}${l.text}  (${l.syllables} syl, ${l.rhymeLabel})`);
    }
    lines.push("");
    lines.push("Validation:");
    for (const n of work.validation.notes) lines.push(`  • ${n}`);
  }
  return lines.join("\n");
}

export function renderMarkdown(work: Poem | SongLyrics): string {
  const lines: string[] = [];
  lines.push(`# ${work.title}`);
  lines.push("");
  lines.push(`*Theme: ${work.theme} · Mood: ${MOOD_LABELS[work.mood]}*`);
  if ("form" in work) {
    lines.push(`*Form: ${FORM_LABELS[work.form]} · Scheme: ${RHYME_SCHEME_LABELS[work.rhymeScheme]}*`);
    if (work.acrosticWord) lines.push(`*Acrostic word: **${work.acrosticWord}***`);
  }
  lines.push("");
  if ("sections" in work) {
    for (const s of work.sections) {
      lines.push(`## ${s.label}`);
      lines.push("");
      for (const l of s.lines) {
        lines.push(`> ${l.text}`);
        lines.push("");
      }
    }
  } else {
    lines.push("```");
    for (const l of work.lines) {
      lines.push(l.text);
    }
    lines.push("```");
    lines.push("");
    lines.push("**Validation:**");
    for (const n of work.validation.notes) lines.push(`- ${n}`);
  }
  return lines.join("\n");
}

export function renderJson(work: Poem | SongLyrics): string {
  return JSON.stringify(work, null, 2);
}

// ---------- History (localStorage) ----------

export interface HistoryEntry {
  ts: number;
  theme: string;
  form: PoemForm;
  rhymeScheme: RhymeScheme;
  mood: Mood;
  lineCount: number;
  isSong: boolean;
}

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
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
}

// ---------- Shareable URL ----------

export interface ShareState {
  theme: string;
  form: PoemForm;
  rhymeScheme: RhymeScheme;
  mood: Mood;
  acrosticWord: string;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.theme) params.set("t", state.theme);
  if (state.form) params.set("f", state.form);
  if (state.rhymeScheme) params.set("r", state.rhymeScheme);
  if (state.mood) params.set("m", state.mood);
  if (state.acrosticWord) params.set("a", state.acrosticWord);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareState> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareState> = {};
  const t = params.get("t");
  if (t) out.theme = t;
  const f = params.get("f") as PoemForm | null;
  if (f && f in FORM_LABELS) out.form = f;
  const r = params.get("r") as RhymeScheme | null;
  if (r && r in RHYME_SCHEME_LABELS) out.rhymeScheme = r;
  const m = params.get("m") as Mood | null;
  if (m && m in MOOD_LABELS) out.mood = m;
  const a = params.get("a");
  if (a) out.acrosticWord = a;
  return out;
}

// ---------- LLM prompt builder (optional BYO-key enhancement) ----------

export function buildLlmPrompt(
  theme: string,
  form: PoemForm,
  rhymeScheme: RhymeScheme,
  mood: Mood,
  acrosticWord: string,
): string {
  const formLabel = FORM_LABELS[form];
  const moodLabel = MOOD_LABELS[mood];
  const acrosticLine = form === "acrostic" && acrosticWord
    ? `The first letter of each line must spell: ${acrosticWord.toUpperCase()}.`
    : "No acrostic constraint.";
  return [
    "You are a poet who writes original, form-aware verse.",
    `Theme: ${theme}.`,
    `Form: ${formLabel}.`,
    `Rhyme scheme: ${rhymeScheme} (or as the form requires).`,
    `Mood: ${moodLabel}.`,
    acrosticLine,
    "",
    "Generate a JSON object with these fields:",
    '- "title": a poem title (string).',
    '- "lines": an array of strings, one per line.',
    '- "syllablesPerLine": an array of integers, parallel to lines, giving the syllable count for each line.',
    '- "rhymeLabels": an array of single uppercase letters (A, B, C, ...) parallel to lines.',
    '- "validationNotes": an array of 1-3 strings noting how closely the poem follows the form.',
    "",
    "Rules:",
    "- The poem must be original. Never copy real copyrighted lyrics or published poems.",
    "- Follow the form's rules as strictly as you can; if you can't, note it in validationNotes.",
    "- Keep the theme at the center; don't drift to generic imagery.",
    "- Output ONLY the JSON object — no markdown fences, no commentary.",
  ].join("\n");
}

export function renderLlmResult(
  rawText: string,
):
  | {
      ok: true;
      result: {
        title: string;
        lines: string[];
        syllablesPerLine: number[];
        rhymeLabels: string[];
        validationNotes: string[];
      };
    }
  | { ok: false; error: string } {
  let s = (rawText || "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  let obj: unknown;
  try {
    obj = JSON.parse(s);
  } catch {
    return { ok: false, error: "Could not parse LLM output as JSON. Try again or edit manually." };
  }
  if (typeof obj !== "object" || obj === null) {
    return { ok: false, error: "LLM output was not a JSON object." };
  }
  if (Array.isArray(obj)) {
    return { ok: false, error: "LLM output was not a JSON object." };
  }
  const o = obj as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title : "";
  const lines = Array.isArray(o.lines)
    ? o.lines.filter((x): x is string => typeof x === "string")
    : [];
  const syllablesPerLine = Array.isArray(o.syllablesPerLine)
    ? o.syllablesPerLine.filter((x): x is number => typeof x === "number")
    : [];
  const rhymeLabels = Array.isArray(o.rhymeLabels)
    ? o.rhymeLabels.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];
  const validationNotes = Array.isArray(o.validationNotes)
    ? o.validationNotes.filter((x): x is string => typeof x === "string")
    : [];
  if (!title && lines.length === 0) {
    return { ok: false, error: "LLM output contained no useful content." };
  }
  return {
    ok: true,
    result: { title, lines, syllablesPerLine, rhymeLabels, validationNotes },
  };
}
