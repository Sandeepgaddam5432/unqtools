/**
 * AI Brand Tone of Voice Builder — pure logic.
 *
 * Build an AI-operable brand voice guide from sample content. Six
 * Nielsen-Norman-style tone dimensions, heuristic estimation, do/don't
 * rules, approved/avoid vocabulary, sentence-rhythm, before/after
 * examples, reusable system prompt, check-a-draft mode, inclusivity
 * checks. Pure functions only — no DOM, no network. The optional LLM
 * call (BYO API key) lives in ui.tsx because it touches the network.
 *
 * Honesty: the guide reflects the samples you provide — review and
 * refine it. Heuristic estimation is approximate; on-device models are
 * less nuanced than BYO-key LLMs. Your content stays local.
 */

// ---------- Types ----------

export type Dimension =
  | "formalCasual"
  | "funnySerious"
  | "respectfulIrreverent"
  | "matterOfFactEnthusiastic"
  | "subversiveConservative"
  | "cynicalEarnest";

export type Dimensions = Record<Dimension, number>;

export interface DimensionMeta {
  left: string;
  right: string;
  description: string;
}

export interface SentenceRhythm {
  avgSentenceLength: number;
  stddev: number;
  label: string;
}

export interface Readability {
  fleschScore: number;
  gradeLevel: number;
  label: string;
}

export interface VoiceExample {
  before: string;
  after: string;
  note: string;
}

export interface InclusivityIssue {
  term: string;
  suggestion: string;
  why: string;
  start: number;
  end: number;
  category: "ableist" | "gendered";
}

export interface DraftCheck {
  draft: string;
  draftDimensions: Dimensions;
  score: number; // 0-100 alignment
  perDimension: Array<{ dimension: Dimension; target: number; actual: number; delta: number }>;
  fixes: string[];
  readability: Readability;
  rhythm: SentenceRhythm;
  inclusivityIssues: InclusivityIssue[];
}

export interface VoiceProfile {
  samples: string;
  dimensions: Dimensions;
  traits: string[];
  dos: string[];
  donts: string[];
  approvedVocab: string[];
  avoidVocab: string[];
  rhythm: SentenceRhythm;
  readability: Readability;
  examples: VoiceExample[];
  systemPrompt: string;
  inclusivityNotes: string[];
  warnings: string[];
}

export interface HistoryEntry {
  ts: number;
  snippet: string;
  score: number;
  traits: string[];
}

export interface ShareState {
  samples: string;
  dimensions: Dimensions;
}

export interface LlmEnhancement {
  refinedTraits: string[];
  refinedDos: string[];
  refinedDonts: string[];
  refinedSystemPrompt: string;
  suggestions: string[];
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-brand-tone-of-voice-builder:history";
export const HISTORY_MAX = 20;
export const LLM_KEY_STORAGE = "unqtools:ai-brand-tone-of-voice-builder:llm-key";

export const DIMENSION_ORDER: Dimension[] = [
  "formalCasual",
  "funnySerious",
  "respectfulIrreverent",
  "matterOfFactEnthusiastic",
  "subversiveConservative",
  "cynicalEarnest",
];

export const DIMENSION_META: Record<Dimension, DimensionMeta> = {
  formalCasual: {
    left: "Formal",
    right: "Casual",
    description: "Strict conventions vs. relaxed, conversational wording.",
  },
  funnySerious: {
    left: "Funny",
    right: "Serious",
    description: "Playful, humorous vs. sober, straight-laced.",
  },
  respectfulIrreverent: {
    left: "Respectful",
    right: "Irreverent",
    description: "Deferential, polite vs. cheeky, rule-breaking.",
  },
  matterOfFactEnthusiastic: {
    left: "Matter-of-fact",
    right: "Enthusiastic",
    description: "Just-the-facts vs. energetic, emotive.",
  },
  subversiveConservative: {
    left: "Subversive",
    right: "Conservative",
    description: "Challenges the status quo vs. honors tradition.",
  },
  cynicalEarnest: {
    left: "Cynical",
    right: "Earnest",
    description: "Wry, skeptical vs. sincere, heartfelt.",
  },
};

export const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "else", "for",
  "of", "to", "in", "on", "at", "by", "with", "without", "from", "into",
  "is", "are", "was", "were", "be", "been", "being", "am", "do", "does",
  "did", "doing", "have", "has", "had", "having", "will", "would", "shall",
  "should", "may", "might", "must", "can", "could", "i", "me", "my", "mine",
  "we", "us", "our", "ours", "you", "your", "yours", "he", "him", "his",
  "she", "her", "hers", "it", "its", "they", "them", "their", "theirs",
  "this", "that", "these", "those", "there", "here", "where", "when", "why",
  "how", "what", "who", "whom", "which", "as", "like", "so", "than", "too",
  "very", "just", "also", "only", "up", "down", "out", "over", "under",
  "again", "more", "most", "some", "any", "all", "both", "each", "few",
  "such", "no", "not", "nor", "yes", "ok", "okay", "got", "get", "go",
  "going", "one", "two", "three", "first", "last", "now", "then", "yet",
  "still", "ever", "never", "always", "because", "while", "since", "until",
  "about", "after", "before", "between", "through", "during", "via", "per",
  "vs", "etc", "via", "once", "twice",
]);

// Cue lexicons — used for heuristic dimension estimation.
export const CONTRACTION_RE = /\b\w+'(?:t|re|ve|s|m|ll|d)\b/gi;

export const HUMOR_CUES = [
  "lol", "haha", "heh", "lmao", "rofl", "jk", "j/k", "pun intended",
  "kidding", "joke", "funny", "hilarious", "wink", "nudge",
];

export const PROFANITY_CUES = [
  "damn", "hell", "crap", "ass", "wtf", "bs", "freaking", "frigging",
  "bloody", "bugger",
];

export const SARCASM_CUES = [
  "obviously", "of course", "duh", "clearly", "sure", "surely",
  "yeah right", "right", "supposedly", "allegedly", "supposed to",
];

export const INTENSIFIERS = [
  "really", "very", "incredibly", "super", "extremely", "absolutely",
  "totally", "so", "amazing", "awesome", "fabulous", "fantastic",
  "incredible", "stunning", "remarkable", "phenomenal",
];

export const EARNEST_CUES = [
  "we believe", "we care", "we promise", "we mean it", "we're committed",
  "we stand for", "honestly", "truly", "sincerely", "from the heart",
  "we're passionate", "we love", "we're proud",
];

export const CYNICAL_CUES = [
  "yeah right", "sure jan", "obviously", "of course they did",
  "supposedly", "allegedly", "claims to", "apparently", "right...",
];

export const SUBVERSIVE_CUES = [
  "disrupt", "reinvent", "break the rules", "break the mold",
  "challenge", "question", "reimagine", "rethink", "tear down",
  "smash", "burn down", "subvert",
];

export const CONSERVATIVE_CUES = [
  "tradition", "heritage", "established", "trusted", "since",
  "founded", "legacy", "time-tested", "proven", "classic",
];

export const SLANG_CUES = [
  "gonna", "wanna", "gotta", "kinda", "sorta", "ya", "y'all", "yall",
  "dunno", "lemme", "gimme", "outta", "ain't", "k", "thx", "pls",
  "u", "ur", "r", "y", "b4", "l8r", "btw", "fwiw", "imo", "imho",
];

// Built-in avoid-vocabulary: jargon, ableist, gendered.
export const JARGON_TERMS = [
  "utilize", "leverage", "synergy", "synergies", "paradigm",
  "paradigm shift", "ecosystem", "operationalize", "ideate", "ideation",
  "circle back", "touch base", "synergize", "low-hanging fruit",
  "move the needle", "boil the ocean", "drink the kool-aid",
  "best of breed", "value-add", "value add", "core competency",
  "thought leader", "thought leadership", "growth hack", "growth hacking",
  "pivot", "disruptive", "deep dive", "drill down", "lift and shift",
];

export const ABLEIST_TERMS: Record<string, string> = {
  "crazy": "wild",
  "insane": "intense",
  "lame": "underwhelming",
  "blind to": "overlooking",
  "deaf to": "ignoring",
  "fall on deaf ears": "ignored",
  "turn a blind eye": "look the other way",
  "crippled": "hobbled",
  "cripples": "hobbles",
  "dumb": "misguided",
  "nuts": "wild",
  "psycho": "reckless",
  "spaz": "erratic",
  "handicap": "limitation",
  "handicapped": "limited",
};

export const GENDERED_TERMS: Record<string, string> = {
  "chairman": "chair",
  "salesman": "salesperson",
  "salesmen": "salespeople",
  "mailman": "mail carrier",
  "policeman": "police officer",
  "policemen": "police officers",
  "fireman": "firefighter",
  "businessman": "businessperson",
  "businessmen": "businesspeople",
  "manpower": "workforce",
  "man-hours": "person-hours",
  "mankind": "humanity",
  "manmade": "manufactured",
  "guys": "team",
  "fellas": "team",
  "stewardess": "flight attendant",
};

// ---------- Text utilities ----------

export function splitSentences(text: string): { text: string; start: number; end: number }[] {
  if (!text) return [];
  const out: { text: string; start: number; end: number }[] = [];
  const re = /[^.!?]+[.!?]+(?:["'”’)\]]+)?|\S[^.!?]*$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const t = m[0].trim();
    if (!t) continue;
    const start = m.index + (m[0].indexOf(t));
    out.push({ text: t, start, end: start + t.length });
  }
  return out;
}

export function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  // Strip silent endings. Don't strip final 'e' when it forms an -le
  // syllable (apple, table, little) — only strip silent 'e' preceded
  // by a non-vowel, non-y, non-l consonant (home, gate, ride).
  const stripped = w
    .replace(/(?:es|ed)$/, "")
    .replace(/([^aeiouyl])e$/, "$1");
  const matches = stripped.match(/[aeiouy]+/g);
  return matches ? Math.max(1, matches.length) : 1;
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Count occurrences of any phrase in text, case-insensitive, word-bounded. */
export function countPhrase(text: string, phrase: string): number {
  if (!text || !phrase) return 0;
  const re = new RegExp(`\\b${escapeRegex(phrase.toLowerCase())}\\b`, "g");
  const lower = text.toLowerCase();
  let count = 0;
  while (re.exec(lower) !== null) count++;
  return count;
}

/** Count total occurrences of a list of cue phrases in text. */
export function countCues(text: string, cues: string[]): { total: number; hits: Array<{ cue: string; count: number }> } {
  let total = 0;
  const hits: Array<{ cue: string; count: number }> = [];
  for (const cue of cues) {
    const c = countPhrase(text, cue);
    if (c > 0) {
      total += c;
      hits.push({ cue, count: c });
    }
  }
  return { total, hits };
}

// ---------- Readability & rhythm ----------

export function computeReadability(text: string): Readability {
  const words = tokenize(text);
  const wordCount = words.length;
  if (wordCount === 0) {
    return { fleschScore: 0, gradeLevel: 0, label: "—" };
  }
  const sentences = splitSentences(text);
  const sentenceCount = Math.max(1, sentences.length);
  const syllableCount = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const fleschScore = Math.max(
    0,
    Math.min(
      100,
      206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / wordCount),
    ),
  );
  const gradeLevel = Math.max(
    0,
    Math.round(0.39 * (wordCount / sentenceCount) + 11.8 * (syllableCount / wordCount) - 15.59),
  );
  let label = "Very difficult";
  if (fleschScore >= 90) label = "Very easy (5th grade)";
  else if (fleschScore >= 80) label = "Easy (6th grade)";
  else if (fleschScore >= 70) label = "Fairly easy (7th grade)";
  else if (fleschScore >= 60) label = "Standard (8–9th grade)";
  else if (fleschScore >= 50) label = "Fairly difficult (10–12th grade)";
  else if (fleschScore >= 30) label = "Difficult (college)";
  return { fleschScore: Math.round(fleschScore), gradeLevel, label };
}

export function computeSentenceRhythm(text: string): SentenceRhythm {
  const sentences = splitSentences(text);
  if (sentences.length === 0) {
    return { avgSentenceLength: 0, stddev: 0, label: "—" };
  }
  const lengths = sentences.map((s) => countWords(s.text));
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((a, b) => a + (b - avg) ** 2, 0) / lengths.length;
  const stddev = Math.sqrt(variance);
  let label = "Varied";
  if (avg < 10 && stddev > 4) label = "Punchy and varied";
  else if (avg < 10) label = "Punchy, uniform";
  else if (avg > 20 && stddev > 6) label = "Long and varied";
  else if (avg > 20) label = "Long, uniform";
  else if (stddev < 3) label = "Uniform rhythm";
  return {
    avgSentenceLength: Math.round(avg * 10) / 10,
    stddev: Math.round(stddev * 10) / 10,
    label,
  };
}

// ---------- Dimension estimation ----------

/** Default neutral dimensions (50 each). */
export function defaultDimensions(): Dimensions {
  return {
    formalCasual: 50,
    funnySerious: 50,
    respectfulIrreverent: 50,
    matterOfFactEnthusiastic: 50,
    subversiveConservative: 50,
    cynicalEarnest: 50,
  };
}

/**
 * Estimate tone dimensions from sample text using heuristic cue counts.
 * Returns 0-100 per dimension. Always returns neutral 50 if samples are
 * empty. The estimation is approximate — the UI is explicit about this.
 */
export function estimateDimensions(samples: string): Dimensions {
  const base = defaultDimensions();
  if (!samples || !samples.trim()) return base;
  const wordCount = Math.max(1, countWords(samples));
  const sentenceCount = Math.max(1, splitSentences(samples).length);
  const lower = samples.toLowerCase();
  const contractionMatches = lower.match(CONTRACTION_RE) ?? [];
  const contractionsPer100 = (contractionMatches.length / wordCount) * 100;
  const exclamationCount = (samples.match(/!/g) ?? []).length;
  const exclamationPerSentence = exclamationCount / sentenceCount;
  const avgWordLength = tokenize(samples).reduce((a, w) => a + w.length, 0) / Math.max(1, tokenize(samples).length);

  const humorHits = countCues(samples, HUMOR_CUES);
  const profanityHits = countCues(samples, PROFANITY_CUES);
  const sarcasmHits = countCues(samples, SARCASM_CUES);
  const intensifierHits = countCues(samples, INTENSIFIERS);
  const earnestHits = countCues(samples, EARNEST_CUES);
  const cynicalHits = countCues(samples, CYNICAL_CUES);
  const subversiveHits = countCues(samples, SUBVERSIVE_CUES);
  const conservativeHits = countCues(samples, CONSERVATIVE_CUES);
  const slangHits = countCues(samples, SLANG_CUES);

  const intensifierPer100 = (intensifierHits.total / wordCount) * 100;

  // formalCasual: 0=formal, 100=casual. Contractions + slang → casual; long words → formal.
  const formalCasual = clamp(
    50
      + contractionsPer100 * 8
      + slangHits.total * 10
      - (avgWordLength > 5.5 ? 12 : 0)
      - (avgWordLength > 6.5 ? 8 : 0),
    0,
    100,
  );

  // funnySerious: 0=funny, 100=serious. Long Latinate words → serious;
  // exclamations + humor cues → funny.
  const funnySerious = clamp(
    50
      + Math.max(0, avgWordLength - 5) * 5
      - exclamationPerSentence * 12
      - humorHits.total * 15
      - slangHits.total * 3,
    0,
    100,
  );

  // respectfulIrreverent: 0=respectful, 100=irreverent. Profanity + sarcasm → irreverent.
  const respectfulIrreverent = clamp(
    50
      + profanityHits.total * 20
      + sarcasmHits.total * 8
      + slangHits.total * 4,
    0,
    100,
  );

  // matterOfFactEnthusiastic: 0=matter-of-fact, 100=enthusiastic.
  const matterOfFactEnthusiastic = clamp(
    50
      + exclamationPerSentence * 10
      + intensifierPer100 * 8,
    0,
    100,
  );

  // subversiveConservative: 0=subversive, 100=conservative.
  const subversiveConservative = clamp(
    50
      + conservativeHits.total * 12
      - subversiveHits.total * 15,
    0,
    100,
  );

  // cynicalEarnest: 0=cynical, 100=earnest.
  const cynicalEarnest = clamp(
    50
      + earnestHits.total * 12
      - cynicalHits.total * 15
      - sarcasmHits.total * 4,
    0,
    100,
  );

  return {
    formalCasual: Math.round(formalCasual),
    funnySerious: Math.round(funnySerious),
    respectfulIrreverent: Math.round(respectfulIrreverent),
    matterOfFactEnthusiastic: Math.round(matterOfFactEnthusiastic),
    subversiveConservative: Math.round(subversiveConservative),
    cynicalEarnest: Math.round(cynicalEarnest),
  };
}

// ---------- Trait derivation ----------

/**
 * Derive 3–6 voice-trait descriptor words from the dimensions.
 * For each dimension that is strongly polarized (< 30 or > 70), pull
 * the trait word for that side.
 */
export function deriveTraits(dimensions: Dimensions): string[] {
  const traits: string[] = [];
  const push = (label: string) => {
    if (!traits.includes(label)) traits.push(label);
  };
  if (dimensions.formalCasual < 30) push("Polished");
  else if (dimensions.formalCasual > 70) push("Conversational");
  if (dimensions.funnySerious < 30) push("Playful");
  else if (dimensions.funnySerious > 70) push("Sober");
  if (dimensions.respectfulIrreverent < 30) push("Respectful");
  else if (dimensions.respectfulIrreverent > 70) push("Irreverent");
  if (dimensions.matterOfFactEnthusiastic < 30) push("Understated");
  else if (dimensions.matterOfFactEnthusiastic > 70) push("Energetic");
  if (dimensions.subversiveConservative < 30) push("Subversive");
  else if (dimensions.subversiveConservative > 70) push("Traditional");
  if (dimensions.cynicalEarnest < 30) push("Wry");
  else if (dimensions.cynicalEarnest > 70) push("Earnest");
  // Fallback if everything is mid-range.
  if (traits.length === 0) push("Balanced");
  return traits;
}

// ---------- Do/Don't derivation ----------

interface DoDontRule {
  applies: (d: Dimensions) => boolean;
  do: string;
  dont: string;
}

const DO_DONT_RULES: DoDontRule[] = [
  {
    applies: (d) => d.formalCasual < 40,
    do: "Use complete words ('do not' instead of 'don't').",
    dont: "Use contractions or text-speak ('gonna', 'thx', 'u').",
  },
  {
    applies: (d) => d.formalCasual > 60,
    do: "Use contractions ('we're', 'you'll') to sound human.",
    dont: "Use Latinate jargon ('utilize', 'facilitate') when plain words work.",
  },
  {
    applies: (d) => d.funnySerious < 40,
    do: "Use wit and wordplay to make technical ideas memorable.",
    dont: "Force humor into serious subjects (outages, refunds, legal).",
  },
  {
    applies: (d) => d.funnySerious > 60,
    do: "Lead with the facts; let the data speak.",
    dont: "Use humor that could land flat in B2B or regulated contexts.",
  },
  {
    applies: (d) => d.respectfulIrreverent > 60,
    do: "Call out industry tropes by name; take a clear point of view.",
    dont: "Punch down — irreverence targets the powerful, not the customer.",
  },
  {
    applies: (d) => d.respectfulIrreverent < 40,
    do: "Acknowledge the reader's context before pitching your product.",
    dont: "Mock competitors by name — lead with your strengths instead.",
  },
  {
    applies: (d) => d.matterOfFactEnthusiastic > 60,
    do: "Use specific intensifiers ('3× faster', 'trusted by 400 teams').",
    dont: "Hedge with 'might', 'possibly', 'we think' — claim the result.",
  },
  {
    applies: (d) => d.matterOfFactEnthusiastic < 40,
    do: "State the outcome plainly and let the reader decide.",
    dont: "Stack adjectives ('amazing, incredible, world-class').",
  },
  {
    applies: (d) => d.subversiveConservative < 40,
    do: "Name the broken thing you're replacing and why it fails.",
    dont: "Hedge the critique — subversive brands take the stance.",
  },
  {
    applies: (d) => d.subversiveConservative > 60,
    do: "Reference heritage, lineage, and proof points.",
    dont: "Use 'disrupt' or 'reinvent' — your brand honors tradition.",
  },
  {
    applies: (d) => d.cynicalEarnest < 40,
    do: "Use dry understatement and deadpan delivery.",
    dont: "Slip into earnestness ('we believe', 'we're passionate').",
  },
  {
    applies: (d) => d.cynicalEarnest > 60,
    do: "State what you believe and why it matters.",
    dont: "Use sarcasm that could read as contempt for the reader.",
  },
];

/** Derive do/don't pairs based on which dimension rules apply. */
export function deriveDosAndDonts(dimensions: Dimensions): { dos: string[]; donts: string[] } {
  const dos: string[] = [];
  const donts: string[] = [];
  for (const rule of DO_DONT_RULES) {
    if (rule.applies(dimensions)) {
      dos.push(rule.do);
      donts.push(rule.dont);
    }
  }
  // Always include at least these baseline rules.
  dos.push("Read every sentence aloud — if you stumble, rewrite it.");
  donts.push("Publish without a colleague proofreading for tone.");
  return { dos, donts };
}

// ---------- Vocabulary ----------

/** Extract top non-stopword unigrams + bigrams from samples, ranked by frequency. */
export function deriveApprovedVocab(samples: string, limit = 15): string[] {
  if (!samples || !samples.trim()) return [];
  const tokens = tokenize(samples);
  const unigrams = new Map<string, number>();
  const bigrams = new Map<string, number>();
  for (const t of tokens) {
    if (STOPWORDS.has(t) || t.length < 3) continue;
    unigrams.set(t, (unigrams.get(t) ?? 0) + 1);
  }
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i];
    const b = tokens[i + 1];
    if (STOPWORDS.has(a) || STOPWORDS.has(b)) continue;
    if (a.length < 3 || b.length < 3) continue;
    const bg = `${a} ${b}`;
    bigrams.set(bg, (bigrams.get(bg) ?? 0) + 1);
  }
  const topUnis = [...unigrams.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, Math.ceil(limit / 2))
    .map(([w]) => w);
  const topBis = [...bigrams.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, Math.floor(limit / 2))
    .map(([w]) => w);
  // Interleave: bigram, unigram, bigram, unigram (keeps both visible).
  const out: string[] = [];
  const maxLen = Math.max(topBis.length, topUnis.length);
  for (let i = 0; i < maxLen; i++) {
    if (topBis[i]) out.push(topBis[i]);
    if (topUnis[i]) out.push(topUnis[i]);
  }
  return out.slice(0, limit);
}

/** Detect avoid-vocabulary (jargon + ableist + gendered) found in samples. */
export function detectAvoidVocab(samples: string): string[] {
  if (!samples || !samples.trim()) return [];
  const found = new Set<string>();
  for (const term of JARGON_TERMS) {
    if (countPhrase(samples, term) > 0) found.add(term);
  }
  for (const term of Object.keys(ABLEIST_TERMS)) {
    if (countPhrase(samples, term) > 0) found.add(term);
  }
  for (const term of Object.keys(GENDERED_TERMS)) {
    if (countPhrase(samples, term) > 0) found.add(term);
  }
  return [...found].sort();
}

// ---------- Examples ----------

/**
 * Generate before/after worked examples based on the dimensions.
 * Each example shows a generic 'before' and a 'after' rewritten in the
 * brand voice, with a note explaining the change.
 */
export function deriveExamples(dimensions: Dimensions): VoiceExample[] {
  const examples: VoiceExample[] = [];
  // Example 1 — opening line.
  const isCasual = dimensions.formalCasual > 60;
  const isEnthusiastic = dimensions.matterOfFactEnthusiastic > 60;
  const isIrreverent = dimensions.respectfulIrreverent > 60;
  examples.push({
    before: "We are pleased to introduce our new product.",
    after: isCasual && isEnthusiastic
      ? "Meet the thing you've been asking for — it's here, and it's fast."
      : isCasual
        ? "We shipped something new. Here's what it does."
        : isEnthusiastic
          ? "Today we're launching a product we're proud of — and here's why it matters."
          : "Today we're introducing our newest product. Here's what it does and why we built it.",
    note: isIrreverent
      ? "Irreverent voice — drop the corporate 'pleased to' framing."
      : "Trimmed filler; led with the news.",
  });
  // Example 2 — feature benefit.
  const isFunny = dimensions.funnySerious < 40;
  examples.push({
    before: "Our solution provides users with the ability to optimize workflows.",
    after: isFunny
      ? "It does the boring part so you don't have to. You're welcome."
      : isCasual
        ? "It handles the busywork so you can focus on the real work."
        : "It automates routine tasks so your team can focus on higher-value work.",
    note: "Replaced Latinate 'provides users with the ability to' with a direct verb.",
  });
  // Example 3 — CTA.
  examples.push({
    before: "Please do not hesitate to contact us should you require further assistance.",
    after: isCasual
      ? "Questions? Reply to this email — we read every one."
      : "Need help? Reach out and we'll get back to you within one business day.",
    note: "Replaced stiff hedges with a concrete, friendly ask.",
  });
  return examples;
}

// ---------- System prompt ----------

/** Build a reusable system prompt describing the voice for any AI. */
export function buildSystemPrompt(profile: VoiceProfile): string {
  const lines: string[] = [];
  lines.push("You are writing in this brand's voice. Follow every rule below.");
  lines.push("");
  lines.push("## Tone dimensions (0–100; 0 = left anchor, 100 = right anchor)");
  for (const key of DIMENSION_ORDER) {
    const meta = DIMENSION_META[key];
    const val = profile.dimensions[key];
    const side = val < 50 ? meta.left : val > 50 ? meta.right : "balanced";
    lines.push(`- ${meta.left} ↔ ${meta.right}: ${val} (lean: ${side})`);
  }
  lines.push("");
  lines.push("## Voice traits");
  lines.push(profile.traits.join(", ") + ".");
  lines.push("");
  lines.push("## Do");
  for (const d of profile.dos) lines.push(`- ${d}`);
  lines.push("");
  lines.push("## Don't");
  for (const d of profile.donts) lines.push(`- ${d}`);
  lines.push("");
  if (profile.approvedVocab.length > 0) {
    lines.push("## Approved vocabulary (use freely)");
    lines.push(profile.approvedVocab.map((v) => `\`${v}\``).join(", "));
    lines.push("");
  }
  if (profile.avoidVocab.length > 0) {
    lines.push("## Avoid vocabulary");
    lines.push(profile.avoidVocab.map((v) => `\`${v}\``).join(", "));
    lines.push("");
  }
  lines.push("## Sentence rhythm");
  lines.push(
    `Target average ~${profile.rhythm.avgSentenceLength} words per sentence (${profile.rhythm.label}).`,
  );
  lines.push("");
  lines.push("## Readability");
  lines.push(
    `Aim for Flesch reading ease ~${profile.readability.fleschScore} (${profile.readability.label}).`,
  );
  lines.push("");
  if (profile.examples.length > 0) {
    lines.push("## Worked examples");
    for (const ex of profile.examples) {
      lines.push(`- Before: ${ex.before}`);
      lines.push(`  After: ${ex.after}`);
      lines.push(`  Note: ${ex.note}`);
    }
    lines.push("");
  }
  if (profile.inclusivityNotes.length > 0) {
    lines.push("## Inclusivity notes");
    for (const n of profile.inclusivityNotes) lines.push(`- ${n}`);
    lines.push("");
  }
  lines.push("When in doubt, prefer clarity over cleverness. Never invent features, prices, or proof points.");
  return lines.join("\n");
}

// ---------- Inclusivity ----------

export interface InclusivityMatch {
  term: string;
  suggestion: string;
  why: string;
  start: number;
  end: number;
  category: "ableist" | "gendered";
}

/** Scan text for ableist and gendered terms with replacement suggestions. */
export function detectInclusivityIssues(text: string): InclusivityMatch[] {
  if (!text) return [];
  const out: InclusivityMatch[] = [];
  const scan = (
    map: Record<string, string>,
    category: "ableist" | "gendered",
    why: string,
  ) => {
    for (const [term, suggestion] of Object.entries(map)) {
      const re = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        out.push({
          term: m[0],
          suggestion,
          why,
          start: m.index,
          end: m.index + m[0].length,
          category,
        });
        re.lastIndex = m.index + m[0].length;
      }
    }
  };
  scan(ABLEIST_TERMS, "ableist", "Ableist language excludes readers with disabilities.");
  scan(GENDERED_TERMS, "gendered", "Gendered language excludes non-binary readers.");
  // Sort by position.
  out.sort((a, b) => a.start - b.start);
  return out;
}

/** Apply inclusivity fixes to text. Returns rewritten text. */
export function applyInclusivityFixes(text: string): string {
  if (!text) return "";
  let out = text;
  // Apply longest-first to avoid partial overlaps.
  const allTerms = [
    ...Object.keys(ABLEIST_TERMS),
    ...Object.keys(GENDERED_TERMS),
  ].sort((a, b) => b.length - a.length);
  for (const term of allTerms) {
    const re = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
    const suggestion =
      ABLEIST_TERMS[term] ?? GENDERED_TERMS[term] ?? term;
    out = out.replace(re, (match) => {
      // Preserve leading capitalization.
      if (match.charAt(0) === match.charAt(0).toUpperCase()) {
        return suggestion.charAt(0).toUpperCase() + suggestion.slice(1);
      }
      return suggestion;
    });
  }
  return out;
}

// ---------- Profile assembly ----------

/** Build a complete voice profile from samples + (optional) overrides. */
export function buildProfile(
  samples: string,
  dimensionOverrides?: Partial<Dimensions>,
): VoiceProfile {
  const estimated = estimateDimensions(samples);
  const dimensions: Dimensions = { ...estimated, ...(dimensionOverrides ?? {}) };
  const readability = computeReadability(samples);
  const rhythm = computeSentenceRhythm(samples);
  const traits = deriveTraits(dimensions);
  const { dos, donts } = deriveDosAndDonts(dimensions);
  const approvedVocab = deriveApprovedVocab(samples);
  const avoidVocab = detectAvoidVocab(samples);
  const examples = deriveExamples(dimensions);
  const inclusivityMatches = detectInclusivityIssues(samples);
  const inclusivityNotes = inclusivityMatches.length === 0
    ? [
        "No ableist or gendered terms detected in samples. Keep this up — review every draft.",
        "Default to gender-neutral terms ('team' not 'guys', 'chair' not 'chairman').",
      ]
    : [
        `Samples contain ${inclusivityMatches.length} inclusivity issue(s): ${inclusivityMatches.map((m) => `"${m.term}"`).join(", ")}.`,
        "Replace with the suggested neutral terms in all future drafts.",
      ];
  const warnings: string[] = [];
  if (!samples || !samples.trim()) {
    warnings.push("No samples provided — dimensions default to neutral. Paste 2–5 on-brand pieces for a real profile.");
  } else if (countWords(samples) < 50) {
    warnings.push("Samples are very short — paste at least 50 words for a reliable estimate.");
  }
  if (approvedVocab.length < 5) {
    warnings.push("Approved vocabulary list is short — paste more samples to expand it.");
  }
  // Pre-build system prompt with everything but itself.
  const profile: VoiceProfile = {
    samples,
    dimensions,
    traits,
    dos,
    donts,
    approvedVocab,
    avoidVocab,
    rhythm,
    readability,
    examples,
    systemPrompt: "", // filled below
    inclusivityNotes,
    warnings,
  };
  profile.systemPrompt = buildSystemPrompt(profile);
  return profile;
}

// ---------- Check-a-draft ----------

/**
 * Score a draft against the voice profile. Returns 0-100 alignment,
 * per-dimension deltas, and concrete fixes.
 */
export function checkDraft(draft: string, profile: VoiceProfile): DraftCheck {
  const draftDimensions = estimateDimensions(draft);
  const perDimension = DIMENSION_ORDER.map((d) => {
    const target = profile.dimensions[d];
    const actual = draftDimensions[d];
    return { dimension: d, target, actual, delta: Math.abs(target - actual) };
  });
  const avgDelta = perDimension.reduce((a, b) => a + b.delta, 0) / perDimension.length;
  const score = clamp(Math.round(100 - avgDelta), 0, 100);
  const fixes: string[] = [];
  for (const p of perDimension) {
    if (p.delta <= 10) continue;
    const meta = DIMENSION_META[p.dimension];
    const targetSide = p.target < 50 ? meta.left : p.target > 50 ? meta.right : "balanced";
    const actualSide = p.actual < 50 ? meta.left : p.actual > 50 ? meta.right : "balanced";
    if (targetSide !== actualSide) {
      fixes.push(
        `${meta.left}↔${meta.right}: draft reads ${actualSide.toLowerCase()} (${p.actual}); target is ${targetSide.toLowerCase()} (${p.target}).`,
      );
    } else {
      fixes.push(
        `${meta.left}↔${meta.right}: draft is ${p.delta} points off target (${p.actual} vs ${p.target}).`,
      );
    }
  }
  // Cue-based fixes.
  const lower = draft.toLowerCase();
  const exclamationCount = (draft.match(/!/g) ?? []).length;
  const sentences = splitSentences(draft);
  const exclamationPerSentence = exclamationCount / Math.max(1, sentences.length);
  if (exclamationPerSentence > 0.5 && profile.dimensions.matterOfFactEnthusiastic < 60) {
    fixes.push(`Too many exclamations (${exclamationCount}) for a matter-of-fact voice.`);
  }
  if (exclamationPerSentence < 0.05 && profile.dimensions.matterOfFactEnthusiastic > 70) {
    fixes.push("Not enough energy — add an exclamation or intensifier for an enthusiastic voice.");
  }
  const contractions = lower.match(CONTRACTION_RE) ?? [];
  if (contractions.length > 3 && profile.dimensions.formalCasual < 40) {
    fixes.push(`Too many contractions (${contractions.length}) for a formal voice.`);
  }
  if (contractions.length === 0 && profile.dimensions.formalCasual > 70 && sentences.length > 2) {
    fixes.push("No contractions detected — loosen up for a casual voice.");
  }
  const jargonHits = countCues(draft, JARGON_TERMS);
  if (jargonHits.total > 0) {
    fixes.push(`Jargon detected: ${jargonHits.hits.map((h) => `"${h.cue}"`).join(", ")}.`);
  }
  const inclusivityIssues = detectInclusivityIssues(draft);
  if (inclusivityIssues.length > 0) {
    fixes.push(
      `Inclusivity issues: ${inclusivityIssues.map((i) => `"${i.term}"→"${i.suggestion}"`).join(", ")}.`,
    );
  }
  return {
    draft,
    draftDimensions,
    score,
    perDimension,
    fixes,
    readability: computeReadability(draft),
    rhythm: computeSentenceRhythm(draft),
    inclusivityIssues,
  };
}

// ---------- Rendering ----------

export function renderMarkdown(profile: VoiceProfile): string {
  const lines: string[] = [];
  lines.push("# Brand Tone of Voice Guide");
  lines.push("");
  lines.push("_Generated by UnQTools AI Brand Tone of Voice Builder._");
  lines.push("");
  lines.push("## Tone dimensions");
  lines.push("");
  for (const key of DIMENSION_ORDER) {
    const meta = DIMENSION_META[key];
    const val = profile.dimensions[key];
    lines.push(`- **${meta.left} ↔ ${meta.right}**: ${val}/100 — _${meta.description}_`);
  }
  lines.push("");
  lines.push("## Voice traits");
  lines.push("");
  lines.push(profile.traits.map((t) => `\`${t}\``).join(" · "));
  lines.push("");
  lines.push("## Do");
  lines.push("");
  for (const d of profile.dos) lines.push(`- ${d}`);
  lines.push("");
  lines.push("## Don't");
  lines.push("");
  for (const d of profile.donts) lines.push(`- ${d}`);
  lines.push("");
  if (profile.approvedVocab.length > 0) {
    lines.push("## Approved vocabulary");
    lines.push("");
    lines.push(profile.approvedVocab.map((v) => `\`${v}\``).join(", "));
    lines.push("");
  }
  if (profile.avoidVocab.length > 0) {
    lines.push("## Avoid vocabulary");
    lines.push("");
    lines.push(profile.avoidVocab.map((v) => `\`${v}\``).join(", "));
    lines.push("");
  }
  lines.push("## Sentence rhythm");
  lines.push("");
  lines.push(`Average ${profile.rhythm.avgSentenceLength} words per sentence · σ ${profile.rhythm.stddev} · ${profile.rhythm.label}.`);
  lines.push("");
  lines.push("## Readability");
  lines.push("");
  lines.push(`Flesch reading ease: ${profile.readability.fleschScore}/100 — ${profile.readability.label} (grade ${profile.readability.gradeLevel}).`);
  lines.push("");
  if (profile.examples.length > 0) {
    lines.push("## Worked examples");
    lines.push("");
    for (const ex of profile.examples) {
      lines.push(`- **Before:** ${ex.before}`);
      lines.push(`  **After:** ${ex.after}`);
      lines.push(`  _Note: ${ex.note}_`);
    }
    lines.push("");
  }
  if (profile.inclusivityNotes.length > 0) {
    lines.push("## Inclusivity notes");
    lines.push("");
    for (const n of profile.inclusivityNotes) lines.push(`- ${n}`);
    lines.push("");
  }
  lines.push("## System prompt (paste into any AI)");
  lines.push("");
  lines.push("```");
  lines.push(profile.systemPrompt);
  lines.push("```");
  if (profile.warnings.length > 0) {
    lines.push("");
    lines.push("## Warnings");
    lines.push("");
    for (const w of profile.warnings) lines.push(`- ${w}`);
  }
  return lines.join("\n");
}

export function renderJson(profile: VoiceProfile): string {
  // Strip samples from the export to keep file size reasonable when
  // samples are long — keep them otherwise.
  return JSON.stringify({ ...profile, generatedAt: new Date().toISOString() }, null, 2);
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

// ---------- Shareable URL ----------

export function buildShareUrl(samples: string, dimensions: Dimensions): string {
  const params = new URLSearchParams();
  if (samples) params.set("samples", samples);
  for (const key of DIMENSION_ORDER) {
    if (dimensions[key] !== 50) params.set(key, String(dimensions[key]));
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  let clean = hash;
  if (clean.startsWith("#") || clean.startsWith("?")) clean = clean.slice(1);
  const dims = defaultDimensions();
  if (!clean) return { samples: "", dimensions: dims };
  const params = new URLSearchParams(clean);
  const samples = params.get("samples") ?? "";
  for (const key of DIMENSION_ORDER) {
    const raw = params.get(key);
    if (raw !== null) {
      const n = Number.parseInt(raw, 10);
      if (!Number.isNaN(n)) dims[key] = clamp(n, 0, 100);
    }
  }
  return { samples, dimensions: dims };
}

// ---------- Optional LLM enhancement ----------

export function buildLlmPrompt(samples: string, dimensions: Dimensions): string {
  return [
    "You are an expert brand strategist. Refine the voice guide below into sharper, more AI-operable rules.",
    "",
    "Samples:",
    samples.slice(0, 6000) || "(empty)",
    "",
    "Estimated dimensions (0-100):",
    ...DIMENSION_ORDER.map((k) => `- ${DIMENSION_META[k].left}↔${DIMENSION_META[k].right}: ${dimensions[k]}`),
    "",
    "Output a JSON object with:",
    '- "refinedTraits": array of 3-6 short descriptor words',
    '- "refinedDos": array of 4-8 specific, actionable do-rules',
    '- "refinedDonts": array of 4-8 specific, actionable dont-rules',
    '- "refinedSystemPrompt": string (a ready-to-paste system prompt for any LLM, 200-500 words)',
    '- "suggestions": array of strings (specific improvements the user could make to their samples or voice)',
    "",
    "Be concrete. Avoid generic advice like 'be authentic'. Cite the samples where useful.",
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
  const refineStrings = (v: unknown): string[] =>
    Array.isArray(v) ? (v as unknown[]).filter((x) => typeof x === "string") as string[] : [];
  const result: LlmEnhancement = {
    refinedTraits: refineStrings(o.refinedTraits),
    refinedDos: refineStrings(o.refinedDos),
    refinedDonts: refineStrings(o.refinedDonts),
    refinedSystemPrompt: typeof o.refinedSystemPrompt === "string" ? o.refinedSystemPrompt : "",
    suggestions: refineStrings(o.suggestions),
  };
  return { ok: true, result };
}

// ---------- Helpers ----------

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
