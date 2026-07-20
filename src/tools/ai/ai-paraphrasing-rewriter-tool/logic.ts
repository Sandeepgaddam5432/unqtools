/**
 * AI Paraphrasing & Rewriter Tool — pure logic.
 *
 * Rewrites text across six modes:
 *   - Standard: balanced synonym substitution
 *   - Fluent: lighter substitution + smoothing
 *   - Formal: removes contractions, elevates vocabulary
 *   - Casual: adds contractions, simpler vocabulary
 *   - Concise: removes filler/redundant words
 *   - Expand: adds elaboration phrases
 *
 * Features:
 *   - Strength slider (1–5) controlling synonym aggressiveness
 *   - Active↔passive voice change
 *   - Preserve-terms list (do-not-substitute)
 *   - Per-sentence alternatives
 *   - Multiple variations (deterministic via seed offset)
 *   - Side-by-side diff (LCS-based)
 *   - Readability delta (Flesch Reading Ease)
 *   - Local history (max 20) and shareable URL
 *   - Optional BYO-key LLM prompt builder
 *
 * Pure functions only — no DOM, no network.
 *
 * Honesty: this is a deterministic, rule-based rewriter. It will not
 * match the fluency of an LLM. We do NOT claim it beats AI detectors,
 * and we discourage using paraphrasing to disguise plagiarism. Always
 * cite sources and write originally where it matters.
 */

// ---------- Types ----------

export type ParaphraseMode =
  | "standard"
  | "fluent"
  | "formal"
  | "casual"
  | "concise"
  | "expand";

export type VoiceMode = "preserve" | "active" | "passive";

export interface RewriteOptions {
  mode?: ParaphraseMode;
  strength?: number; // 1..5
  voice?: VoiceMode;
  preserveTerms?: string[];
  /** Variation index (0-based). Each index applies a different synonym rotation. */
  variation?: number;
}

export interface RewriteResult {
  text: string;
  sentences: SentenceRewrite[];
  stats: {
    originalWordCount: number;
    rewrittenWordCount: number;
    originalReadability: number;
    rewrittenReadability: number;
    readabilityDelta: number;
    mode: ParaphraseMode;
    strength: number;
    voice: VoiceMode;
    variation: number;
  };
  warnings: string[];
}

export interface SentenceRewrite {
  original: string;
  rewritten: string;
  alternatives: string[];
  changed: boolean;
}

export interface DiffToken {
  type: "equal" | "replace" | "insert" | "delete";
  original?: string;
  rewritten?: string;
}

export interface HistoryEntry {
  ts: number;
  mode: ParaphraseMode;
  strength: number;
  voice: VoiceMode;
  originalWordCount: number;
  rewrittenWordCount: number;
  readabilityDelta: number;
  preview: string;
}

// ---------- Constants ----------

/**
 * Built-in synonym dictionary. Each key maps to a list of synonyms.
 * Order matters: variation 0 uses synonyms[0], variation 1 uses
 * synonyms[1] (or rotated), etc.
 */
export const SYNONYMS: Record<string, string[]> = {
  // Verbs
  "use": ["utilize", "employ", "apply"],
  "uses": ["utilizes", "employs", "applies"],
  "used": ["utilized", "employed", "applied"],
  "make": ["create", "produce", "construct"],
  "makes": ["creates", "produces", "constructs"],
  "made": ["created", "produced", "constructed"],
  "get": ["obtain", "acquire", "receive"],
  "gets": ["obtains", "acquires", "receives"],
  "got": ["obtained", "acquired", "received"],
  "show": ["demonstrate", "reveal", "display"],
  "shows": ["demonstrates", "reveals", "displays"],
  "showed": ["demonstrated", "revealed", "displayed"],
  "help": ["assist", "aid", "support"],
  "helps": ["assists", "aids", "supports"],
  "helped": ["assisted", "aided", "supported"],
  "start": ["begin", "commence", "initiate"],
  "starts": ["begins", "commences", "initiates"],
  "started": ["began", "commenced", "initiated"],
  "end": ["conclude", "finish", "complete"],
  "ends": ["concludes", "finishes", "completes"],
  "ended": ["concluded", "finished", "completed"],
  "need": ["require", "necessitate", "demand"],
  "needs": ["requires", "necessitates", "demands"],
  "needed": ["required", "necessitated", "demanded"],
  "want": ["desire", "wish", "seek"],
  "wants": ["desires", "wishes", "seeks"],
  "wanted": ["desired", "wished", "sought"],
  "think": ["believe", "consider", "reckon"],
  "thinks": ["believes", "considers", "reckons"],
  "thought": ["believed", "considered", "reckoned"],
  "know": ["understand", "comprehend", "recognize"],
  "knows": ["understands", "comprehends", "recognizes"],
  "knew": ["understood", "comprehended", "recognized"],
  "see": ["observe", "notice", "perceive"],
  "sees": ["observes", "notices", "perceives"],
  "saw": ["observed", "noticed", "perceived"],
  "give": ["provide", "offer", "supply"],
  "gives": ["provides", "offers", "supplies"],
  "gave": ["provided", "offered", "supplied"],
  "find": ["discover", "locate", "identify"],
  "finds": ["discovers", "locates", "identifies"],
  "found": ["discovered", "located", "identified"],
  "try": ["attempt", "endeavor", "strive"],
  "tries": ["attempts", "endeavors", "strives"],
  "tried": ["attempted", "endeavored", "strove"],
  "work": ["function", "operate", "perform"],
  "works": ["functions", "operates", "performs"],
  "worked": ["functioned", "operated", "performed"],
  "buy": ["purchase", "acquire", "procure"],
  "buys": ["purchases", "acquires", "procures"],
  "bought": ["purchased", "acquired", "procured"],
  "build": ["construct", "develop", "establish"],
  "builds": ["constructs", "develops", "establishes"],
  "built": ["constructed", "developed", "established"],
  "change": ["modify", "alter", "transform"],
  "changes": ["modifies", "alters", "transforms"],
  "changed": ["modified", "altered", "transformed"],
  "improve": ["enhance", "refine", "upgrade"],
  "improves": ["enhances", "refines", "upgrades"],
  "improved": ["enhanced", "refined", "upgraded"],
  "decide": ["determine", "resolve", "conclude"],
  "decides": ["determines", "resolves", "concludes"],
  "decided": ["determined", "resolved", "concluded"],
  "explain": ["clarify", "describe", "elucidate"],
  "explains": ["clarifies", "describes", "elucidates"],
  "explained": ["clarified", "described", "elucidated"],
  // Adjectives
  "good": ["excellent", "superior", "favorable"],
  "bad": ["poor", "inferior", "unfavorable"],
  "big": ["large", "substantial", "considerable"],
  "small": ["minor", "modest", "compact"],
  "important": ["significant", "crucial", "vital"],
  "interesting": ["engaging", "compelling", "intriguing"],
  "happy": ["pleased", "delighted", "content"],
  "sad": ["unhappy", "sorrowful", "downcast"],
  "fast": ["quick", "rapid", "swift"],
  "slow": ["gradual", "leisurely", "unhurried"],
  "easy": ["simple", "straightforward", "effortless"],
  "hard": ["difficult", "challenging", "demanding"],
  "new": ["novel", "fresh", "recent"],
  "old": ["aged", "vintage", "antique"],
  "rich": ["wealthy", "affluent", "prosperous"],
  "poor": ["destitute", "needy", "underprivileged"],
  "strong": ["powerful", "robust", "sturdy"],
  "weak": ["fragile", "feeble", "delicate"],
  "smart": ["intelligent", "clever", "astute"],
  "stupid": ["foolish", "unwise", "senseless"],
  "beautiful": ["attractive", "lovely", "gorgeous"],
  "ugly": ["unattractive", "unsightly", "unappealing"],
  "happy about": ["pleased with", "delighted by", "content with"],
  // Common adverbs / fillers
  "very": ["extremely", "particularly", "notably"],
  "really": ["truly", "genuinely", "actually"],
  "a lot": ["considerably", "substantially", "significantly"],
  // Nouns
  "problem": ["issue", "challenge", "difficulty"],
  "problems": ["issues", "challenges", "difficulties"],
  "idea": ["concept", "notion", "proposition"],
  "ideas": ["concepts", "notions", "propositions"],
  "thing": ["matter", "item", "element"],
  "things": ["matters", "items", "elements"],
  "way": ["method", "approach", "manner"],
  "ways": ["methods", "approaches", "manners"],
  "part": ["portion", "segment", "component"],
  "parts": ["portions", "segments", "components"],
  "people": ["individuals", "persons", "folks"],
  "person": ["individual", "human", "soul"],
  "world": ["globe", "earth", "planet"],
  "job": ["task", "duty", "responsibility"],
  "jobs": ["tasks", "duties", "responsibilities"],
  "place": ["location", "spot", "venue"],
  "places": ["locations", "spots", "venues"],
  "time": ["period", "duration", "interval"],
  "money": ["funds", "capital", "finances"],
  "information": ["data", "details", "facts"],
  "question": ["query", "inquiry", "matter"],
  "questions": ["queries", "inquiries", "matters"],
  "answer": ["response", "reply", "resolution"],
  "answers": ["responses", "replies", "resolutions"],
};

/** Formal-mode contractions to expand (casual→formal). */
export const CONTRACTIONS_EXPAND: Record<string, string> = {
  "don't": "do not",
  "doesn't": "does not",
  "didn't": "did not",
  "won't": "will not",
  "can't": "cannot",
  "couldn't": "could not",
  "shouldn't": "should not",
  "wouldn't": "would not",
  "isn't": "is not",
  "aren't": "are not",
  "wasn't": "was not",
  "weren't": "were not",
  "haven't": "have not",
  "hasn't": "has not",
  "hadn't": "had not",
  "i'm": "I am",
  "you're": "you are",
  "we're": "we are",
  "they're": "they are",
  "it's": "it is",
  "that's": "that is",
  "i've": "I have",
  "you've": "you have",
  "we've": "we have",
  "they've": "they have",
  "i'll": "I will",
  "you'll": "you will",
  "he'll": "he will",
  "she'll": "she will",
  "we'll": "we will",
  "they'll": "they will",
  "i'd": "I would",
  "you'd": "you would",
  "he'd": "he would",
  "she'd": "she would",
  "we'd": "we would",
  "they'd": "they would",
};

/** Casual-mode expansions to contract (formal→casual). */
export const CONTRACTIONS_CONTRACT: Record<string, string> = {
  "do not": "don't",
  "does not": "doesn't",
  "did not": "didn't",
  "will not": "won't",
  "cannot": "can't",
  "can not": "can't",
  "could not": "couldn't",
  "should not": "shouldn't",
  "would not": "wouldn't",
  "is not": "isn't",
  "are not": "aren't",
  "was not": "wasn't",
  "were not": "weren't",
  "have not": "haven't",
  "has not": "hasn't",
  "had not": "hadn't",
  "i am": "I'm",
  "you are": "you're",
  "we are": "we're",
  "they are": "they're",
  "it is": "it's",
  "that is": "that's",
  "i have": "I've",
  "you have": "you've",
  "we have": "we've",
  "they have": "they've",
  "i will": "I'll",
  "you will": "you'll",
  "he will": "he'll",
  "she will": "she'll",
  "we will": "we'll",
  "they will": "they'll",
  "i would": "I'd",
  "you would": "you'd",
  "he would": "he'd",
  "she would": "she'd",
  "we would": "we'd",
  "they would": "they'd",
};

/** Filler words removed in concise mode. */
export const FILLER_WORDS = new Set<string>([
  "very", "really", "quite", "rather", "somewhat", "fairly", "pretty",
  "just", "actually", "basically", "literally", "essentially",
  "totally", "absolutely", "definitely", "certainly", "probably",
  "perhaps", "maybe", "kind of", "sort of", "in order to",
]);

/** Elaboration phrases inserted in expand mode. */
export const EXPAND_PHRASES = [
  "in other words,",
  "to clarify,",
  "that is to say,",
  "more specifically,",
  "as a matter of fact,",
];

// ---------- Text splitting ----------

const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+(?=[A-Z0-9"'(\[])/g;

/** Split text into sentences. */
export function splitSentences(text: string): string[] {
  if (!text) return [];
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  return clean
    .split(SENTENCE_SPLIT_RE)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Tokenize a sentence into words + whitespace, preserving positions. */
export interface Token {
  text: string;
  isWord: boolean;
}

/** Tokenize into word/non-word tokens. */
export function tokenize(sentence: string): Token[] {
  const tokens: Token[] = [];
  const re = /([a-zA-Z][a-zA-Z'-]*|\s+|[^a-zA-Z\s]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sentence)) !== null) {
    tokens.push({ text: m[1], isWord: /^[a-zA-Z]/.test(m[1]) });
  }
  return tokens;
}

/** Count words in text. */
export function countWords(text: string): number {
  if (!text) return 0;
  const matches = text.toLowerCase().match(/[a-z][a-z'-]*/g);
  return matches ? matches.length : 0;
}

/** Count syllables in a word (rough heuristic). */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  // Remove silent 'e' at the end (but not 'le').
  let cleaned = w.replace(/(?:[^l]e|ed|es)$/, "");
  if (cleaned.length === 0) cleaned = w;
  const matches = cleaned.match(/[aeiouy]+/g);
  return matches ? matches.length : 1;
}

// ---------- Synonym substitution ----------

/** Find a synonym for a word, respecting variation rotation. */
export function findSynonym(
  word: string,
  variation: number,
  preserveSet: Set<string>,
): string | undefined {
  const lower = word.toLowerCase();
  if (preserveSet.has(lower)) return undefined;
  const syns = SYNONYMS[lower];
  if (!syns || syns.length === 0) return undefined;
  const idx = variation % syns.length;
  const syn = syns[idx];
  // Match the case of the original word.
  if (word[0] === word[0].toUpperCase()) {
    return syn.charAt(0).toUpperCase() + syn.slice(1);
  }
  return syn;
}

/** Apply synonym substitution to a sentence. */
export function applySynonyms(
  sentence: string,
  strength: number,
  variation: number,
  preserveTerms: string[] = [],
): string {
  if (strength <= 0) return sentence;
  const preserveSet = new Set(preserveTerms.map((t) => t.toLowerCase()));
  // Probability that any given eligible word is substituted.
  const prob = Math.min(1, strength / 5);
  const tokens = tokenize(sentence);
  let wordIndex = 0;
  return tokens.map((tok) => {
    if (!tok.isWord) return tok.text;
    // Deterministic pseudo-random based on word index + variation.
    const hash = ((wordIndex + 1) * 9301 + (variation + 1) * 49297) % 233280;
    const rand = hash / 233280;
    wordIndex++;
    if (rand > prob) return tok.text;
    const syn = findSynonym(tok.text, variation, preserveSet);
    return syn ?? tok.text;
  }).join("");
}

// ---------- Voice change ----------

const PASSIVE_RE =
  /\b(?:is|are|was|were|be|been|being)\s+([A-Za-z]\w*(?:ed|en|t|d|n|wn|ght|ght)?)\b\s+by\s+([A-Za-z][\w'-]*)/i;

const ACTIVE_SUBJECT_RE = /^([A-Z][\w'-]*)\s+(\w+)\s+([A-Za-z][\w'-]*)/

/** Detect if a sentence is in passive voice (rough heuristic). */
export function isPassive(sentence: string): boolean {
  return PASSIVE_RE.test(sentence);
}

/** Convert an active sentence to passive (best-effort, simple Subject-Verb-Object). */
export function toPassiveVoice(sentence: string): string {
  const m = sentence.match(ACTIVE_SUBJECT_RE);
  if (!m) return sentence;
  const subject = m[1];
  const verb = m[2];
  const object = m[3];
  const rest = sentence.slice(m[0].length);
  // Naive: "The dog bit the man." → "The man was bitten by the dog."
  const pastParticiple = toPastParticiple(verb);
  return `${object} was ${pastParticiple} by ${subject}${rest}`;
}

/** Convert a passive sentence to active (best-effort). */
export function toActiveVoice(sentence: string): string {
  const m = sentence.match(PASSIVE_RE);
  if (!m) return sentence;
  // After regex change: m[1] = pastParticiple, m[2] = agent (no aux group).
  const pastParticiple = m[1];
  const agent = m[2];
  const aux = "was";
  const before = sentence.slice(0, m.index);
  const after = sentence.slice((m.index ?? 0) + m[0].length);
  // Naive: "The man was bitten by the dog." → "The dog bit the man."
  const verb = fromPastParticiple(pastParticiple, aux);
  return `${before}${agent} ${verb} ${after}`.replace(/\s+/g, " ").trim();
}

/** Convert a base verb (or 3rd-person singular) to its past participle. */
export function toPastParticiple(verb: string): string {
  const v = verb.toLowerCase();
  const irregulars: Record<string, string> = {
    "write": "written", "do": "done", "make": "made", "take": "taken",
    "give": "given", "see": "seen", "know": "known", "show": "shown",
    "find": "found", "build": "built", "buy": "bought", "bring": "brought",
    "catch": "caught", "teach": "taught", "send": "sent", "spend": "spent",
    "pay": "paid", "say": "said", "tell": "told", "hold": "held",
    "keep": "kept", "leave": "left", "meet": "met", "put": "put",
    "read": "read", "set": "set", "go": "gone", "eat": "eaten",
    "break": "broken", "speak": "spoken", "steal": "stolen", "drive": "driven",
    "bite": "bitten", "beat": "beaten", "hide": "hidden", "weave": "woven",
  };
  // Strip third-person singular -s/-es/-ies to get the base form.
  let base = v;
  if (v.length > 3 && !v.endsWith("ss") && !v.endsWith("us") && !v.endsWith("is") && !v.endsWith("as")) {
    if (v.endsWith("ies")) {
      base = v.slice(0, -3) + "y";
    } else if (v.endsWith("es")) {
      // Some verbs keep the "e" (write → writes, take → takes, make → makes).
      // Others drop it (go → goes, watch → watches). Prefer the known-irregular
      // form; otherwise default to strip-s (most verbs keep the trailing "e").
      const stripS = v.slice(0, -1); // writes → write
      const stripEs = v.slice(0, -2); // goes → go
      base = irregulars[stripEs] ? stripEs : stripS;
    } else if (v.endsWith("s")) {
      base = v.slice(0, -1);
    }
  }
  if (irregulars[base]) return irregulars[base];
  if (base.endsWith("e")) return `${base}d`;
  if (base.endsWith("y")) return `${base.slice(0, -1)}ied`;
  return `${base}ed`;
}

/** Convert a past participle back to a present-tense verb (very rough). */
export function fromPastParticiple(pastParticiple: string, aux: string): string {
  const pp = pastParticiple.toLowerCase();
  const irregulars: Record<string, string> = {
    "written": "wrote", "done": "did", "made": "made", "taken": "took",
    "given": "gave", "seen": "saw", "known": "knew", "shown": "showed",
    "found": "found", "built": "built", "bought": "bought", "brought": "brought",
    "caught": "caught", "taught": "taught", "sent": "sent", "spent": "spent",
    "paid": "paid", "said": "said", "told": "told", "held": "held",
    "kept": "kept", "left": "left", "met": "met", "put": "put",
    "read": "read", "set": "set",
  };
  if (irregulars[pp]) return irregulars[pp];
  if (pp.endsWith("ied")) return `${pp.slice(0, -3)}y`;
  if (pp.endsWith("ed")) {
    // "wanted" → "wanted" (past); we keep the past form for simplicity.
    return pastParticiple;
  }
  // Fallback — use the past participle as-is.
  void aux;
  return pastParticiple;
}

// ---------- Tone transformations ----------

/** Expand contractions (formal mode). */
export function expandContractions(text: string): string {
  let out = text;
  for (const [contracted, expanded] of Object.entries(CONTRACTIONS_EXPAND)) {
    const re = new RegExp(`\\b${escapeRegex(contracted)}\\b`, "gi");
    out = out.replace(re, (match) => {
      // Preserve capitalization of the first letter.
      if (match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase()) {
        return expanded.charAt(0).toUpperCase() + expanded.slice(1);
      }
      return expanded;
    });
  }
  return out;
}

/** Contract phrases (casual mode). */
export function contractPhrases(text: string): string {
  let out = text;
  for (const [expanded, contracted] of Object.entries(CONTRACTIONS_CONTRACT)) {
    const re = new RegExp(`\\b${escapeRegex(expanded)}\\b`, "gi");
    out = out.replace(re, (match) => {
      // Preserve capitalization of first letter.
      if (match[0] === match[0].toUpperCase()) {
        return contracted.charAt(0).toUpperCase() + contracted.slice(1);
      }
      return contracted;
    });
  }
  return out;
}

/** Remove filler words (concise mode). */
export function removeFillers(text: string): string {
  let out = text;
  for (const filler of FILLER_WORDS) {
    const re = new RegExp(`\\b${escapeRegex(filler)}\\b\\s*`, "gi");
    out = out.replace(re, "");
  }
  return out.replace(/\s+/g, " ").trim();
}

/** Add elaboration phrases (expand mode). */
export function addElaboration(text: string, variation: number): string {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return text;
  const out = sentences.map((s, i) => {
    // Insert an elaboration phrase every 2-3 sentences.
    if (i > 0 && i % 2 === 0) {
      const phrase = EXPAND_PHRASES[(i + variation) % EXPAND_PHRASES.length];
      return `${phrase} ${s.charAt(0).toLowerCase()}${s.slice(1)}`;
    }
    return s;
  });
  return out.join(" ");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------- Per-sentence rewriting ----------

/** Rewrite a single sentence by mode. */
export function paraphraseSentence(
  sentence: string,
  options: RewriteOptions = {},
): string {
  const mode = options.mode ?? "standard";
  const strength = clamp(options.strength ?? 3, 1, 5);
  const voice = options.voice ?? "preserve";
  const variation = options.variation ?? 0;
  const preserveTerms = options.preserveTerms ?? [];

  let out = sentence;

  // Voice change first (operates on the original sentence structure).
  if (voice === "active" && isPassive(out)) {
    out = toActiveVoice(out);
  } else if (voice === "passive" && !isPassive(out)) {
    out = toPassiveVoice(out);
  }

  // Mode-specific pre-processing.
  if (mode === "formal") {
    out = expandContractions(out);
  } else if (mode === "casual") {
    out = contractPhrases(out);
  } else if (mode === "concise") {
    out = removeFillers(out);
  }

  // Synonym substitution.
  if (mode === "fluent") {
    // Lighter substitution: strength - 1 (min 1).
    out = applySynonyms(out, Math.max(1, strength - 1), variation, preserveTerms);
  } else if (mode === "concise") {
    // No synonyms in concise mode (already shortened).
  } else if (mode === "expand") {
    // Light synonyms first, then elaborate.
    out = applySynonyms(out, Math.max(1, strength - 1), variation, preserveTerms);
    out = addElaboration(out, variation);
  } else {
    // standard, formal, casual → full synonym substitution.
    out = applySynonyms(out, strength, variation, preserveTerms);
  }

  return out;
}

/** Generate N alternative rewrites for a sentence. */
export function generateAlternatives(
  sentence: string,
  options: RewriteOptions,
  count: number = 3,
): string[] {
  const alts: string[] = [];
  for (let i = 0; i < count; i++) {
    alts.push(paraphraseSentence(sentence, { ...options, variation: i }));
  }
  // Dedupe while preserving order.
  const seen = new Set<string>();
  return alts.filter((a) => {
    if (seen.has(a)) return false;
    seen.add(a);
    return true;
  });
}

// ---------- Main entry ----------

/** Rewrite text. Pure function — no DOM, no network. */
export function rewrite(text: string, options: RewriteOptions = {}): RewriteResult {
  const mode = options.mode ?? "standard";
  const strength = clamp(options.strength ?? 3, 1, 5);
  const voice = options.voice ?? "preserve";
  const variation = options.variation ?? 0;
  const preserveTerms = options.preserveTerms ?? [];

  const warnings: string[] = [];
  const cleaned = (text || "").trim();
  if (!cleaned) {
    return emptyResult(mode, strength, voice, variation);
  }

  const sentences = splitSentences(cleaned);
  if (sentences.length === 0) {
    return emptyResult(mode, strength, voice, variation);
  }

  const sentenceRewrites: SentenceRewrite[] = sentences.map((s) => {
    const rewritten = paraphraseSentence(s, {
      mode, strength, voice, variation, preserveTerms,
    });
    const alternatives = generateAlternatives(s, { mode, strength, voice, preserveTerms }, 3);
    return {
      original: s,
      rewritten,
      alternatives: alternatives.filter((a) => a !== rewritten).slice(0, 2),
      changed: rewritten !== s,
    };
  });

  const rewrittenText = sentenceRewrites.map((sr) => sr.rewritten).join(" ");
  const originalWordCount = countWords(cleaned);
  const rewrittenWordCount = countWords(rewrittenText);
  const originalReadability = fleschReadingEase(cleaned);
  const rewrittenReadability = fleschReadingEase(rewrittenText);

  if (voice === "active" && !sentences.some(isPassive)) {
    warnings.push("No passive sentences detected — voice change to active had no effect.");
  }
  if (mode === "expand" && sentences.length < 2) {
    warnings.push("Expand mode works best on 2+ sentences.");
  }
  if (preserveTerms.length > 0) {
    warnings.push(`${preserveTerms.length} preserve-term(s) active.`);
  }

  return {
    text: rewrittenText,
    sentences: sentenceRewrites,
    stats: {
      originalWordCount,
      rewrittenWordCount,
      originalReadability,
      rewrittenReadability,
      readabilityDelta: rewrittenReadability - originalReadability,
      mode,
      strength,
      voice,
      variation,
    },
    warnings,
  };
}

/** Empty result for blank input. */
function emptyResult(
  mode: ParaphraseMode,
  strength: number,
  voice: VoiceMode,
  variation: number,
): RewriteResult {
  return {
    text: "",
    sentences: [],
    stats: {
      originalWordCount: 0,
      rewrittenWordCount: 0,
      originalReadability: 0,
      rewrittenReadability: 0,
      readabilityDelta: 0,
      mode,
      strength,
      voice,
      variation,
    },
    warnings: [],
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// ---------- Readability ----------

/** Compute Flesch Reading Ease score (0–100, higher = easier). */
export function fleschReadingEase(text: string): number {
  const words = (text.toLowerCase().match(/[a-z][a-z'-]*/g)) || [];
  if (words.length === 0) return 0;
  const sentences = splitSentences(text);
  const sentenceCount = Math.max(sentences.length, 1);
  const syllableCount = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const score = 206.835 - 1.015 * (words.length / sentenceCount) - 84.6 * (syllableCount / words.length);
  return Math.max(0, Math.min(100, score));
}

// ---------- Diff ----------

/** Compute a word-level diff between original and rewritten text (LCS-based). */
export function computeDiff(original: string, rewritten: string): DiffToken[] {
  const origTokens = tokenize(original);
  const rewTokens = tokenize(rewritten);
  const origWords: { idx: number; text: string }[] = [];
  const rewWords: { idx: number; text: string }[] = [];
  for (let i = 0; i < origTokens.length; i++) if (origTokens[i].isWord) origWords.push({ idx: i, text: origTokens[i].text });
  for (let i = 0; i < rewTokens.length; i++) if (rewTokens[i].isWord) rewWords.push({ idx: i, text: rewTokens[i].text });

  // LCS table.
  const m = origWords.length;
  const n = rewWords.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (origWords[i].text.toLowerCase() === rewWords[j].text.toLowerCase()) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const out: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (origWords[i].text.toLowerCase() === rewWords[j].text.toLowerCase()) {
      out.push({ type: "equal", original: origWords[i].text, rewritten: rewWords[j].text });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "delete", original: origWords[i].text });
      i++;
    } else {
      out.push({ type: "insert", rewritten: rewWords[j].text });
      j++;
    }
  }
  while (i < m) {
    out.push({ type: "delete", original: origWords[i].text });
    i++;
  }
  while (j < n) {
    out.push({ type: "insert", rewritten: rewWords[j].text });
    j++;
  }
  // Collapse adjacent delete+insert into replace.
  const collapsed: DiffToken[] = [];
  for (let k = 0; k < out.length; k++) {
    const cur = out[k];
    const next = out[k + 1];
    if (cur.type === "delete" && next && next.type === "insert") {
      collapsed.push({ type: "replace", original: cur.original, rewritten: next.rewritten });
      k++;
    } else {
      collapsed.push(cur);
    }
  }
  return collapsed;
}

/** Render a diff as colored HTML string (escaped). */
export function renderDiffHtml(diff: DiffToken[]): string {
  return diff.map((d) => {
    if (d.type === "equal") return escapeHtml(d.original ?? "");
    if (d.type === "insert") return `<span class="diff-insert">${escapeHtml(d.rewritten ?? "")}</span>`;
    if (d.type === "delete") return `<span class="diff-delete">${escapeHtml(d.original ?? "")}</span>`;
    return `<span class="diff-replace">${escapeHtml(d.rewritten ?? "")}</span>`;
  }).join(" ");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---------- Markdown rendering ----------

export function renderMarkdown(result: RewriteResult): string {
  const lines: string[] = [];
  lines.push(`# Rewrite (${result.stats.mode}, strength ${result.stats.strength})`);
  lines.push("");
  lines.push(`**Words:** ${result.stats.originalWordCount} → ${result.stats.rewrittenWordCount}`);
  lines.push(`**Readability:** ${result.stats.originalReadability.toFixed(1)} → ${result.stats.rewrittenReadability.toFixed(1)} (Δ ${result.stats.readabilityDelta > 0 ? "+" : ""}${result.stats.readabilityDelta.toFixed(1)})`);
  lines.push(`**Voice:** ${result.stats.voice}`);
  lines.push(`**Variation:** ${result.stats.variation}`);
  lines.push("");
  lines.push("## Rewritten");
  lines.push("");
  lines.push(result.text);
  lines.push("");
  lines.push("## Per-sentence");
  lines.push("");
  for (const sr of result.sentences) {
    lines.push(`- **Original:** ${sr.original}`);
    lines.push(`  - **Rewritten:** ${sr.rewritten}`);
    if (sr.alternatives.length > 0) {
      lines.push(`  - **Alternatives:**`);
      for (const alt of sr.alternatives) lines.push(`    - ${alt}`);
    }
  }
  if (result.warnings.length > 0) {
    lines.push("");
    lines.push("## Notes");
    lines.push("");
    for (const w of result.warnings) lines.push(`- ${w}`);
  }
  return lines.join("\n");
}

// ---------- History (localStorage) ----------

const HISTORY_KEY = "unqtools:ai-paraphrasing-rewriter-tool:history";
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

// ---------- Shareable URL ----------

export function buildShareUrl(
  text: string,
  mode: ParaphraseMode,
  strength: number,
  voice: VoiceMode,
  variation: number,
): string {
  const params = new URLSearchParams();
  if (text) params.set("text", text);
  params.set("mode", mode);
  params.set("strength", String(strength));
  params.set("voice", voice);
  params.set("variation", String(variation));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): {
  text: string;
  mode: ParaphraseMode;
  strength: number;
  voice: VoiceMode;
  variation: number;
} {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const validModes: ParaphraseMode[] = ["standard", "fluent", "formal", "casual", "concise", "expand"];
  const validVoices: VoiceMode[] = ["preserve", "active", "passive"];
  if (!clean) return { text: "", mode: "standard", strength: 3, voice: "preserve", variation: 0 };
  const params = new URLSearchParams(clean);
  const text = params.get("text") ?? "";
  const modeRaw = params.get("mode") ?? "standard";
  const mode: ParaphraseMode = validModes.includes(modeRaw as ParaphraseMode)
    ? (modeRaw as ParaphraseMode)
    : "standard";
  const voiceRaw = params.get("voice") ?? "preserve";
  const voice: VoiceMode = validVoices.includes(voiceRaw as VoiceMode)
    ? (voiceRaw as VoiceMode)
    : "preserve";
  const strengthRaw = parseInt(params.get("strength") ?? "3", 10);
  const strength = Number.isFinite(strengthRaw) ? clamp(strengthRaw, 1, 5) : 3;
  const variationRaw = parseInt(params.get("variation") ?? "0", 10);
  const variation = Number.isFinite(variationRaw) && variationRaw >= 0 ? variationRaw : 0;
  return { text, mode, strength, voice, variation };
}

// ---------- BYO-key LLM prompt ----------

export function buildLlmPrompt(
  text: string,
  mode: ParaphraseMode,
  strength: number,
): { system: string; user: string } {
  const modeDesc: Record<ParaphraseMode, string> = {
    standard: "a balanced rewrite with synonym substitution",
    fluent: "a fluent, natural-sounding rewrite with light synonym substitution",
    formal: "a formal rewrite (no contractions, elevated vocabulary, no slang)",
    casual: "a casual, conversational rewrite (contractions OK, simpler vocabulary)",
    concise: "a concise rewrite that removes filler words and redundancy",
    expand: "an expanded rewrite that adds elaboration and clarification",
  };
  const modeText = modeDesc[mode];
  const strengthDesc =
    strength <= 1 ? "minimal changes" :
    strength <= 2 ? "light changes" :
    strength <= 3 ? "moderate changes" :
    strength <= 4 ? "substantial changes" :
    "heavy changes";
  return {
    system:
      "You are a paraphrasing assistant. Rewrite the user's text preserving meaning, facts, and named entities. Do not invent information or change the subject. Output only the rewritten text, no commentary.",
    user: `Rewrite the following text in ${modeText} with ${strengthDesc}.\n\nTEXT:\n"""\n${text}\n"""`,
  };
}
