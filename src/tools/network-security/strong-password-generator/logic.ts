/**
 * Strong Password Generator — pure logic.
 *
 * CSPRNG (crypto.getRandomValues) + bias-free rejection sampling for
 * character-class passwords. EFF short wordlist for passphrase mode.
 * Pronounceable mode, per-class minimums, batch + CSV export, shareable
 * settings URL (NEVER the password). No network, no React.
 */

export interface PasswordOptions {
  length: number;
  upper: boolean;
  lower: boolean;
  digits: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
  customSymbols?: string;
  minUpper?: number;
  minLower?: number;
  minDigits?: number;
  minSymbols?: number;
}

export interface PassphraseOptions {
  wordCount: number;
  separator: string;
  capitalize: boolean;
  appendDigit: boolean;
  appendSymbol: boolean;
}

export interface GenerationResult {
  value: string;
  entropyBits: number;
  characterClasses: string[];
  mode: "password" | "passphrase" | "pronounceable";
}

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{}|;:,.<>?/~";
const AMBIGUOUS = new Set("0O1lI|`'\"");

/** EFF short wordlist (subset of 2016 EFF list by Joseph Bonneau, CC BY 3.0). */
const EFF_WORDLIST: readonly string[] = [
  "acid", "aged", "also", "anti", "aqua", "arch", "atom", "aunt", "auto", "away",
  "axis", "back", "bald", "band", "bank", "barn", "base", "bath", "beam", "bean",
  "bear", "beat", "been", "beer", "bell", "belt", "best", "bias", "bike", "bill",
  "bird", "bite", "black", "blame", "blank", "blast", "blend", "blind", "block", "blood",
  "blow", "blue", "board", "boat", "body", "bone", "book", "boom", "born", "boss",
  "both", "bowl", "bulk", "burn", "bush", "busy", "cake", "calm", "came", "camp",
  "card", "care", "case", "cash", "cast", "cell", "chat", "chip", "city", "claim",
  "class", "clean", "clear", "click", "climb", "clock", "close", "cloud", "coach", "coast",
  "coat", "code", "cold", "come", "cook", "cool", "copy", "core", "cost", "crew",
  "crop", "dark", "data", "date", "dawn", "deal", "dean", "dear", "debt", "deep",
  "deny", "desk", "diet", "disk", "does", "done", "door", "dose", "down", "draw",
  "drew", "drop", "drug", "drum", "dual", "duck", "duke", "dust", "duty", "each",
  "earn", "east", "easy", "edge", "else", "even", "ever", "evil", "exit", "face",
  "fact", "fade", "fail", "fair", "fall", "farm", "fast", "fate", "fear", "feed",
  "feel", "fell", "felt", "file", "fill", "film", "find", "fine", "fire", "firm",
  "fish", "five", "flag", "flat", "flaw", "fleet", "flew", "flow", "foam", "fold",
  "folk", "food", "foot", "ford", "form", "fort", "four", "free", "from", "fuel",
  "full", "fund", "gain", "game", "gate", "gave", "gear", "gene", "gift", "girl",
  "give", "glad", "goal", "goat", "gold", "golf", "gone", "good", "gray", "grew",
  "grid", "grin", "grip", "grow", "gulf", "hair", "half", "hall", "hand", "hang",
  "hard", "harm", "hate", "have", "head", "hear", "heat", "held", "hell", "help",
  "here", "hero", "high", "hill", "hint", "hire", "hold", "hole", "home", "hope",
  "horn", "host", "hour", "huge", "hung", "hunt", "hurt", "icon", "idea", "idle",
  "inch", "into", "iron", "item", "java", "jazz", "join", "july", "jump", "june",
  "jury", "just", "keen", "keep", "kick", "kill", "kind", "king", "knee", "knew",
  "know", "lack", "lady", "laid", "lake", "lamp", "land", "lane", "last", "late",
  "lawn", "lazy", "lead", "leaf", "lean", "left", "lend", "less", "lift", "like",
  "line", "link", "lion", "list", "live", "load", "loan", "lock", "logo", "long",
  "look", "lord", "lose", "loss", "lost", "loud", "love", "luck", "made", "mail",
  "main", "make", "male", "many", "mark", "mass", "mate", "math", "meal", "mean",
  "meat", "meet", "menu", "mere", "milk", "mind", "mine", "miss", "mode", "mood",
  "moon", "more", "most", "move", "much", "must", "name", "navy", "near", "neck",
  "need", "news", "next", "nice", "nick", "nine", "none", "nose", "note", "noun",
  "obey", "okay", "once", "only", "onto", "open", "oral", "over", "pace", "pack",
  "page", "paid", "pain", "pair", "palm", "park", "part", "pass", "past", "path",
  "peak", "peer", "pick", "pile", "pine", "pink", "pipe", "plan", "play", "plot",
  "plug", "plus", "poem", "poet", "poll", "pool", "poor", "port", "post", "pull",
  "pure", "push", "race", "rack", "rage", "rail", "rain", "rank", "rare", "rate",
  "read", "real", "rear", "rely", "rent", "rest", "rice", "rich", "ride", "ring",
  "rise", "risk", "road", "rock", "role", "roll", "roof", "room", "root", "rope",
  "rose", "ruby", "rule", "rush", "ruth", "safe", "said", "sail", "sake", "sale",
  "salt", "same", "sand", "save", "seed", "seek", "seem", "seen", "self", "sell",
  "send", "sent", "sept", "ship", "shoe", "shop", "shot", "show", "shut", "sick",
  "side", "sign", "silk", "sing", "sink", "site", "size", "skin", "slid", "slim",
  "slip", "slot", "slow", "snap", "snow", "soap", "soft", "soil", "sold", "sole",
  "some", "song", "soon", "sort", "soul", "soup", "spin", "spot", "star", "stay",
  "step", "stop", "such", "suit", "sure", "swim", "tail", "take", "tale", "talk",
  "tall", "tank", "tape", "task", "team", "tear", "tell", "tend", "term", "test",
  "text", "than", "that", "them", "then", "they", "thin", "this", "thus", "tide",
  "till", "time", "tiny", "told", "tone", "took", "tool", "torn", "tour", "town",
  "trap", "tree", "trim", "trip", "true", "tube", "tune", "turn", "twin", "type",
  "ugly", "unit", "upon", "used", "user", "vary", "vast", "very", "vibe", "view",
  "void", "vote", "wage", "wait", "wake", "walk", "wall", "want", "ward", "warm",
  "warn", "wash", "wave", "ways", "weak", "wear", "week", "well", "went", "were",
  "west", "what", "when", "whom", "wide", "wife", "wild", "will", "wind", "wine",
  "wing", "wire", "wise", "wish", "with", "wolf", "wood", "wool", "word", "wore",
  "work", "worm", "worn", "yard", "yarn", "year", "your", "zero", "zone",
];

export const EFF_WORD_COUNT = EFF_WORDLIST.length;
export const ENTROPY_PER_WORD = Math.log2(EFF_WORD_COUNT);

const CONSONANTS = "bcdfghjklmnpqrstvwxz";
const VOWELS = "aeiouy";

/** Filter out ambiguous characters from a class string. */
function filterAmbiguous(s: string): string {
  let out = "";
  for (const c of s) if (!AMBIGUOUS.has(c)) out += c;
  return out;
}

/** Build the active alphabet from the options. Returns array of {char, class}. */
export function buildAlphabet(opts: PasswordOptions): { chars: string; classes: string[] } {
  const parts: string[] = [];
  const classes: string[] = [];
  const sym = opts.customSymbols && opts.customSymbols.length > 0 ? opts.customSymbols : SYMBOLS;
  if (opts.upper) { parts.push(opts.excludeAmbiguous ? filterAmbiguous(UPPER) : UPPER); classes.push("upper"); }
  if (opts.lower) { parts.push(opts.excludeAmbiguous ? filterAmbiguous(LOWER) : LOWER); classes.push("lower"); }
  if (opts.digits) { parts.push(opts.excludeAmbiguous ? filterAmbiguous(DIGITS) : DIGITS); classes.push("digits"); }
  if (opts.symbols) { parts.push(opts.excludeAmbiguous ? filterAmbiguous(sym) : sym); classes.push("symbols"); }
  return { chars: parts.join(""), classes };
}

/** Bias-free random integer in [0, max) using rejection sampling. */
export function randomInt(max: number): number {
  if (max <= 0) throw new Error("max must be > 0");
  if (max === 1) return 0;
  const cryptoMax = 256;
  // limit = floor(cryptoMax / max) * max — accept only values below this
  const limit = Math.floor(cryptoMax / max) * max;
  const buf = new Uint8Array(1);
  while (true) {
    crypto.getRandomValues(buf);
    const v = buf[0]!;
    if (v < limit) return v % max;
  }
}

/** Pick a random character from a string. */
function randomChar(s: string): string {
  return s.charAt(randomInt(s.length));
}

/** Fisher-Yates shuffle (in-place) using CSPRNG. */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/** Generate a random password from options. */
export function generatePassword(opts: PasswordOptions): string {
  const { chars, classes } = buildAlphabet(opts);
  if (chars.length === 0) throw new Error("Select at least one character class.");
  const length = Math.max(1, Math.min(128, Math.floor(opts.length)));
  // Build minimum-required characters first
  const required: string[] = [];
  const minUpper = opts.minUpper ?? 0;
  const minLower = opts.minLower ?? 0;
  const minDigits = opts.minDigits ?? 0;
  const minSymbols = opts.minSymbols ?? 0;
  if (opts.upper && minUpper > 0) {
    const u = opts.excludeAmbiguous ? filterAmbiguous(UPPER) : UPPER;
    for (let i = 0; i < minUpper; i++) required.push(randomChar(u));
  }
  if (opts.lower && minLower > 0) {
    const l = opts.excludeAmbiguous ? filterAmbiguous(LOWER) : LOWER;
    for (let i = 0; i < minLower; i++) required.push(randomChar(l));
  }
  if (opts.digits && minDigits > 0) {
    const d = opts.excludeAmbiguous ? filterAmbiguous(DIGITS) : DIGITS;
    for (let i = 0; i < minDigits; i++) required.push(randomChar(d));
  }
  if (opts.symbols && minSymbols > 0) {
    const s = opts.customSymbols && opts.customSymbols.length > 0 ? opts.customSymbols : SYMBOLS;
    const sf = opts.excludeAmbiguous ? filterAmbiguous(s) : s;
    for (let i = 0; i < minSymbols; i++) required.push(randomChar(sf));
  }
  // Fill the rest from the full alphabet
  const remaining = Math.max(0, length - required.length);
  for (let i = 0; i < remaining; i++) required.push(randomChar(chars));
  // Shuffle so minimums aren't always at the start
  return shuffle(required).slice(0, length).join("");
}

/** Generate a pronounceable password (consonant-vowel pattern). */
export function generatePronounceable(length: number, opts: PasswordOptions): string {
  const len = Math.max(4, Math.min(64, Math.floor(length)));
  let out = "";
  for (let i = 0; i < len; i++) {
    // alternate consonant-vowel with some randomness
    const useVowel = i % 2 === 1;
    const src = useVowel ? VOWELS : CONSONANTS;
    out += randomChar(src);
  }
  // Optionally inject a digit and uppercase the first letter
  if (opts.digits) {
    const pos = randomInt(out.length);
    out = out.substring(0, pos) + randomChar(DIGITS) + out.substring(pos + 1);
  }
  if (opts.upper) out = out.charAt(0).toUpperCase() + out.substring(1);
  return out;
}

/** Generate a passphrase from the EFF wordlist. */
export function generatePassphrase(opts: PassphraseOptions): string {
  const wc = Math.max(2, Math.min(20, Math.floor(opts.wordCount)));
  const words: string[] = [];
  for (let i = 0; i < wc; i++) {
    const w = EFF_WORDLIST[randomInt(EFF_WORDLIST.length)]!;
    words.push(opts.capitalize ? w.charAt(0).toUpperCase() + w.substring(1) : w);
  }
  let out = words.join(opts.separator);
  if (opts.appendDigit) out += opts.separator + randomChar(DIGITS);
  if (opts.appendSymbol) out += randomChar(SYMBOLS);
  return out;
}

/** Calculate entropy in bits for a password given its alphabet. */
export function passwordEntropy(value: string, alphabetSize: number): number {
  if (value.length === 0 || alphabetSize === 0) return 0;
  return Math.floor(value.length * Math.log2(alphabetSize) * 10) / 10;
}

/** Calculate entropy for a passphrase based on word count + extras. */
export function passphraseEntropy(opts: PassphraseOptions): number {
  const wordBits = opts.wordCount * ENTROPY_PER_WORD;
  const sepBits = Math.log2(opts.separator.length || 1);
  const capBits = opts.capitalize ? 1 : 0; // ~1 bit decision
  const digitBits = opts.appendDigit ? Math.log2(10) : 0;
  const symbolBits = opts.appendSymbol ? Math.log2(SYMBOLS.length) : 0;
  return Math.floor((wordBits + sepBits + capBits + digitBits + symbolBits) * 10) / 10;
}

/** Generate N passwords in batch. */
export function generateBatch(opts: PasswordOptions, count: number): string[] {
  const n = Math.max(1, Math.min(1000, Math.floor(count)));
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(generatePassword(opts));
  return out;
}

/** Convert a batch to CSV with entropy + class breakdown. */
export function batchToCsv(batch: string[], opts: PasswordOptions): string {
  const { chars: alphabet, classes } = buildAlphabet(opts);
  const alphaSize = alphabet.length;
  const header = "Index,Password,EntropyBits,Length,Classes";
  const rows = batch.map((p, i) => `${i + 1},"${p.replace(/"/g, '""')}",${passwordEntropy(p, alphaSize)},${p.length},"${classes.join("|")}"`);
  return [header, ...rows].join("\n");
}

/** Encode generation settings (NOT the password) into a URL fragment. */
export function encodeSettings(opts: PasswordOptions): string {
  const o: Record<string, unknown> = {
    L: opts.length,
    U: opts.upper ? 1 : 0,
    l: opts.lower ? 1 : 0,
    d: opts.digits ? 1 : 0,
    s: opts.symbols ? 1 : 0,
    a: opts.excludeAmbiguous ? 1 : 0,
  };
  if (opts.customSymbols) o.sy = opts.customSymbols;
  if (opts.minUpper) o.mu = opts.minUpper;
  if (opts.minLower) o.ml = opts.minLower;
  if (opts.minDigits) o.md = opts.minDigits;
  if (opts.minSymbols) o.ms = opts.minSymbols;
  return `#p=${encodeURIComponent(JSON.stringify(o))}`;
}

/** Decode settings from a URL fragment. */
export function decodeSettings(fragment: string): PasswordOptions | null {
  const m = /#p=(.+)$/.exec(fragment);
  if (!m) return null;
  try {
    const o = JSON.parse(decodeURIComponent(m[1]!));
    return {
      length: typeof o.L === "number" ? o.L : 16,
      upper: Boolean(o.U),
      lower: Boolean(o.l),
      digits: Boolean(o.d),
      symbols: Boolean(o.s),
      excludeAmbiguous: Boolean(o.a),
      customSymbols: typeof o.sy === "string" ? o.sy : undefined,
      minUpper: typeof o.mu === "number" ? o.mu : 0,
      minLower: typeof o.ml === "number" ? o.ml : 0,
      minDigits: typeof o.md === "number" ? o.md : 0,
      minSymbols: typeof o.ms === "number" ? o.ms : 0,
    };
  } catch {
    return null;
  }
}

/** Human-readable label for character-class breakdown. */
export function classLabel(opts: PasswordOptions): string {
  const parts: string[] = [];
  if (opts.upper) parts.push("A-Z");
  if (opts.lower) parts.push("a-z");
  if (opts.digits) parts.push("0-9");
  if (opts.symbols) parts.push("!@#");
  return parts.length ? parts.join(" + ") : "(none)";
}

/** Compute entropy for a generated result given options. */
export function computeResultEntropy(value: string, opts: PasswordOptions): number {
  const { chars } = buildAlphabet(opts);
  return passwordEntropy(value, chars.length);
}

/** Auto-clear clipboard after delay (returns a cancel function). */
export function autoClearClipboard(delayMs = 30000): () => void {
  const t = setTimeout(() => {
    navigator.clipboard.writeText("").catch(() => { /* ignore */ });
  }, delayMs);
  return () => clearTimeout(t);
}
