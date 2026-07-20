/**
 * AI Passive→Active Voice Converter — pure logic.
 *
 * Detects passive voice sentence-by-sentence, identifies the hidden agent
 * (or flags agentless passives), proposes an active rewrite, and writes a
 * grammar explanation. Also supports active→passive conversion (bidirectional).
 * Preserves legitimate passives (unknown/irrelevant agent) instead of
 * blindly rewriting.
 *
 * All detection and rewriting is pure string work — no DOM, no network.
 * The optional LLM call (BYO API key) lives in ui.tsx because it touches
 * the network.
 */

// ---------- Types ----------

export type Direction = "to-active" | "to-passive";
export type StylePreset = "general" | "academic" | "journalism";

export interface PassiveClause {
  sentenceIndex: number;
  start: number;                          // char offset within the sentence
  end: number;
  beVerb: string;                         // "was", "is", "has been", "will be", etc.
  participle: string;                     // "written", "done", "delivered"
  baseVerb: string;                       // "write", "do", "deliver"
  tense: Tense;
  agent: string | null;                   // "Jane" (without "by"), or null
  agentSource: "by-phrase" | "inferred" | "agentless";
  originalClause: string;                 // the full matched clause text
  rewrite: string | null;                 // active rewrite, or null if cannot rewrite
  explanation: string;
  isLegitimate: boolean;                  // true if passive is fine here
  legitimateReason?: string;
}

export type Tense =
  | "simple-present"
  | "simple-past"
  | "present-perfect"
  | "past-perfect"
  | "future"
  | "modal"
  | "present-progressive"
  | "past-progressive";

export interface ActiveRewrite {
  sentenceIndex: number;
  original: string;
  passiveRewrite: string | null;          // null if no object found
  explanation: string;
}

export interface Sentence {
  index: number;
  text: string;
  start: number;                          // char offset in original text
  end: number;
  isPassive: boolean;
  clauses: PassiveClause[];               // for to-active
  activeRewrite?: ActiveRewrite;          // for to-passive
}

export interface ConvertResult {
  original: string;
  direction: Direction;
  style: StylePreset;
  sentences: Sentence[];
  converted: string;                      // text with all auto-applied rewrites
  stats: ConvertStats;
}

export interface ConvertStats {
  sentenceCount: number;
  wordCount: number;
  passiveCount: number;                   // passive clauses detected
  activeCount: number;                    // active sentences (for to-passive)
  convertedCount: number;                 // clauses/sentences successfully rewritten
  legitimateCount: number;
  passivePercentage: number;              // 0–100
}

export interface HistoryEntry {
  ts: number;
  direction: Direction;
  style: StylePreset;
  textLength: number;
  sentenceCount: number;
  passiveCount: number;
  convertedCount: number;
  passivePercentage: number;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-passive-active-voice-converter:history";
export const HISTORY_MAX = 20;

export const STYLE_LABELS: Record<StylePreset, string> = {
  general: "General (rewrite all passives)",
  academic: "Academic (allow agentless passives)",
  journalism: "Journalism (rewrite aggressively)",
};

export const DIRECTION_LABELS: Record<Direction, string> = {
  "to-active": "Passive → Active",
  "to-passive": "Active → Passive",
};

export const TENSE_LABELS: Record<Tense, string> = {
  "simple-present": "Simple present",
  "simple-past": "Simple past",
  "present-perfect": "Present perfect",
  "past-perfect": "Past perfect",
  "future": "Future",
  "modal": "Modal",
  "present-progressive": "Present progressive",
  "past-progressive": "Past progressive",
};

export const SAMPLE_TEXTS: { label: string; direction: Direction; text: string }[] = [
  {
    label: "P→A — Mixed passive",
    direction: "to-active",
    text:
      "The report was written by Jane. The data has been analyzed by the team. " +
      "The results were presented at the meeting. The mixture was heated to 80°C.",
  },
  {
    label: "P→A — Scientific",
    direction: "to-active",
    text:
      "The samples were collected at dawn. Each sample was tested for purity. " +
      "The reaction was observed for 30 minutes.",
  },
  {
    label: "A→P — Simple active",
    direction: "to-passive",
    text:
      "Jane wrote the report. The team analyzed the data. The manager approved the budget.",
  },
];

// ---------- Irregular verbs (~120 common English irregulars) ----------
//
// Two separate maps:
//   - PAST_PARTICIPLE_TO_BASE: maps past-participle form → base (for detection).
//   - BASE_TO_PAST_TENSE: maps base → simple-past form (for active rewrites).
//
// Regular verbs ending in -ed are handled by the `-ed` fallback in findBaseVerb
// and the regular -ed rule in simplePastForm.

/**
 * Map of past-participle form → base form, for irregular verbs.
 * Only the past-participle form is here (NOT the simple past).
 */
export const PAST_PARTICIPLE_TO_BASE: Record<string, string> = {
  // -en endings (verbal past participles)
  written: "write", eaten: "eat", taken: "take", given: "give", driven: "drive",
  ridden: "ride", risen: "rise", broken: "break", chosen: "choose", spoken: "speak",
  stolen: "steal", woken: "wake", woven: "weave", frozen: "freeze", bitten: "bite",
  hidden: "hide", forbidden: "forbid", forgiven: "forgive", arisen: "arise",
  blown: "blow", drawn: "draw", flown: "fly", grown: "grow", known: "know",
  thrown: "throw", borne: "bear", born: "bear", sworn: "swear", torn: "tear",
  worn: "wear", shown: "show", sown: "sow", hewn: "hew", shaken: "shake",
  forsaken: "forsake", mistaken: "mistake", undertaken: "undertake", overtaken: "overtake",
  shrunk: "shrink", sunk: "sink", drunk: "drink", sung: "sing", rung: "ring",
  swung: "swing", flung: "fling", slung: "sling", wrung: "wring", stung: "sting",
  strung: "string", hung: "hang", stricken: "strike", struck: "strike",
  forgotten: "forget", trodden: "tread", cloven: "cleave", cleft: "cleave",
  striven: "strive", thriven: "thrive", graven: "grave", proven: "prove",
  hoven: "heave", shrunken: "shrink", sunken: "sink", drunken: "drink",
  // -t/-d endings (often same as past tense for these verbs)
  built: "build", burnt: "burn", dreamt: "dream", leant: "lean", learnt: "learn",
  spoilt: "spoil", spelt: "spell", smelt: "smell", spilt: "spill", spent: "spend",
  lent: "lend", sent: "send", meant: "mean", dealt: "deal", felt: "feel",
  left: "leave", kept: "keep", slept: "sleep", swept: "sweep", wept: "weep",
  crept: "creep", knelt: "kneel", brought: "bring", bought: "buy", fought: "fight",
  sought: "seek", caught: "catch", taught: "teach", thought: "think", wrought: "work",
  bent: "bend", rent: "rend", beaten: "beat",
  // no-change verbs (past tense == past participle == base)
  put: "put", set: "set", let: "let", cut: "cut", shut: "shut", hit: "hit",
  cost: "cost", cast: "cast", broadcast: "broadcast", read: "read", spread: "spread",
  shed: "shed", bid: "bid", rid: "rid", slit: "slit", split: "split",
  hurt: "hurt", bet: "bet", quit: "quit", burst: "burst", sweat: "sweat", wed: "wed",
  // -d endings where past participle differs from base
  paid: "pay", laid: "lay", said: "say", heard: "hear", made: "make", told: "tell",
  sold: "sell", held: "hold", fed: "feed", led: "lead", bled: "bleed", bred: "breed",
  fled: "flee", sped: "speed", met: "meet", sat: "sit", had: "have", found: "find",
  bound: "bind", wound: "wind", ground: "grind", stood: "stand", understood: "understand",
  withstood: "withstand", misunderstood: "misunderstand", lost: "lose", shot: "shoot",
  got: "get", gotten: "get", lit: "light", lighted: "light", won: "win", run: "run",
  begun: "begin", done: "do", gone: "go", seen: "see", been: "be", come: "come",
  become: "become", overcome: "overcome", fallen: "fall", slid: "slide", slidden: "slide",
  // Common verbs ending in -e (where -ed form is just +d, so naive -ed strip loses the "e").
  analyzed: "analyze", organised: "organise", organized: "organize",
  summarised: "summarise", summarized: "summarize", prioritised: "prioritise",
  prioritized: "prioritize", finalised: "finalise", finalized: "finalize",
  generated: "generate", created: "create", located: "locate",
  allocated: "allocate", evaluated: "evaluate", calculated: "calculate",
  isolated: "isolate", migrated: "migrate", navigated: "navigate",
  motivated: "motivate", activated: "activate", negotiated: "negotiate",
  simulated: "simulate", circulated: "circulate", communicated: "communicate",
  duplicated: "duplicate", eliminated: "eliminate", evacuated: "evacuate",
  escalated: "escalate", facilitated: "facilitate", illustrated: "illustrate",
  indicated: "indicate", initiated: "initiate", integrated: "integrate",
  investigated: "investigate", moderated: "moderate", operated: "operate",
  populated: "populate", regulated: "regulate", related: "relate",
  replicated: "replicate", separated: "separate", tolerated: "tolerate",
  translated: "translate", validated: "validate", vibrated: "vibrate",
  updated: "update", upgraded: "upgrade", degraded: "degrade",
  documented: "document", implemented: "implement",
  deployed: "deploy", enjoyed: "enjoy", employed: "employ", destroyed: "destroy",
  fixed: "fix", mixed: "mix", boxed: "box", taxed: "tax", faxed: "fax",
  released: "release", increased: "increase", decreased: "decrease",
  raised: "raise", praised: "praise", appraised: "appraise", compromised: "compromise",
  proposed: "propose", opposed: "oppose", supposed: "suppose", imposed: "impose",
  exposed: "expose", composed: "compose", disposed: "dispose", enclosed: "enclose",
  disclosed: "disclose", achieved: "achieve", believed: "believe", received: "receive",
  conceived: "conceive", deceived: "deceive", perceived: "perceive", relieved: "relieve",
  served: "serve", deserved: "deserve", preserved: "preserve", reserved: "reserve",
  observed: "observe", conserved: "conserve", solved: "solve", resolved: "resolve",
  evolved: "evolve", involved: "involve", revolved: "revolve", devoted: "devote",
  noted: "note", quoted: "quote", voted: "vote", toted: "tote",
  cultivated: "cultivate", dominated: "dominate", nominated: "nominate",
  accommodated: "accommodate", accumulated: "accumulate",
  animated: "animate", anticipated: "anticipate", appreciated: "appreciate",
  appropriated: "appropriate", articulated: "articulate", assassinated: "assassinate",
  assembled: "assemble", associated: "associate", assumed: "assume", assured: "assure",
  attached: "attach", attained: "attain", attempted: "attempt", attended: "attend",
  attracted: "attract", attributed: "attribute", authorized: "authorize",
  automated: "automate",
  approved: "approve", improved: "improve", proved: "prove",
  removed: "remove", moved: "move", saved: "save", carved: "carve",
  shaped: "shape", dated: "date", rated: "rate",
  argued: "argue", continued: "continue", pursued: "pursue",
  issued: "issue", acquired: "acquire", required: "require",
  inquired: "inquire", admired: "admire", desired: "desire",
  retired: "retire", hired: "hire", fired: "fire", inspired: "inspire",
  declined: "decline", defined: "define", refined: "refine",
  combined: "combine", imagined: "imagine", examined: "examine",
  determined: "determine", maintained: "maintain", sustained: "sustain",
  obtained: "obtain", retained: "retain", contained: "contain",
  entertained: "entertain", remained: "remain", explained: "explain",
  complained: "complain", trained: "train", joined: "join",
};

/**
 * Map of base form → simple-past form, for irregular verbs.
 * Regular verbs use the -ed fallback in simplePastForm.
 */
export const BASE_TO_PAST_TENSE: Record<string, string> = {
  write: "wrote", eat: "ate", take: "took", give: "gave", drive: "drove",
  ride: "rode", rise: "rose", break: "broke", choose: "chose", speak: "spoke",
  steal: "stole", wake: "woke", weave: "wove", freeze: "froze", bite: "bit",
  hide: "hid", forbid: "forbade", forgive: "forgave", arise: "arose",
  blow: "blew", draw: "drew", fly: "flew", grow: "grew", know: "knew",
  throw: "threw", bear: "bore", swear: "swore", tear: "tore", wear: "wore",
  show: "showed", shake: "shook", forsake: "forsook", mistake: "mistook",
  undertake: "undertook", overtake: "overtook",
  shrink: "shrank", sink: "sank", drink: "drank", sing: "sang", ring: "rang",
  swing: "swung", fling: "flung", sling: "slung", wring: "wrung", sting: "stung",
  string: "strung", hang: "hung", strike: "struck",
  build: "built", burn: "burnt", dream: "dreamt", lean: "leant", learn: "learnt",
  spoil: "spoilt", spell: "spelt", smell: "smelt", spill: "spilt", spend: "spent",
  lend: "lent", send: "sent", mean: "meant", deal: "dealt", feel: "felt",
  leave: "left", keep: "kept", sleep: "slept", sweep: "swept", weep: "wept",
  creep: "crept", kneel: "knelt", bring: "brought", buy: "bought", fight: "fought",
  seek: "sought", catch: "caught", teach: "taught", think: "thought",
  bend: "bent", rend: "rent", beat: "beat",
  pay: "paid", lay: "laid", say: "said", hear: "heard", make: "made", tell: "told",
  sell: "sold", hold: "held", feed: "fed", lead: "led", bleed: "bled", breed: "bred",
  flee: "fled", speed: "sped", meet: "met", sit: "sat", have: "had", find: "found",
  bind: "bound", wind: "wound", grind: "ground", stand: "stood",
  understand: "understood", withstand: "withstood", misunderstand: "misunderstood",
  lose: "lost", shoot: "shot", get: "got", light: "lit", win: "won", run: "ran",
  begin: "began", do: "did", go: "went", see: "saw", be: "was", come: "came",
  become: "became", overcome: "overcame", fall: "fell", slide: "slid",
  forget: "forgot", prove: "proved", strive: "strove", tread: "trod",
  cleave: "clove", thrive: "throve", grave: "graved",
};

/**
 * Reverse map of BASE_TO_PAST_TENSE: simple-past form → base form.
 * Built at module load time. For regular -ed verbs, use findBaseFromPastTense()
 * which has the smarter -ed stripping logic.
 */
export const PAST_TENSE_TO_BASE: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [base, past] of Object.entries(BASE_TO_PAST_TENSE)) {
    out[past] = base;
  }
  // Also add common regular -ed past tenses (especially -e ending verbs where the
  // naive -ed strip loses the final "e": analyzed → analyze, not analyz).
  const edVerbs: [string, string][] = [
    ["analyzed", "analyze"], ["organised", "organise"], ["organized", "organize"],
    ["summarised", "summarise"], ["summarized", "summarize"],
    ["prioritised", "prioritise"], ["prioritized", "prioritize"],
    ["finalised", "finalise"], ["finalized", "finalize"],
    ["generated", "generate"], ["created", "create"], ["located", "locate"],
    ["allocated", "allocate"], ["evaluated", "evaluate"], ["calculated", "calculate"],
    ["isolated", "isolate"], ["migrated", "migrate"], ["navigated", "navigate"],
    ["motivated", "motivate"], ["activated", "activate"], ["negotiated", "negotiate"],
    ["simulated", "simulate"], ["circulated", "circulate"], ["communicated", "communicate"],
    ["duplicated", "duplicate"], ["eliminated", "eliminate"], ["evacuated", "evacuate"],
    ["escalated", "escalate"], ["facilitated", "facilitate"], ["illustrated", "illustrate"],
    ["indicated", "indicate"], ["initiated", "initiate"], ["integrated", "integrate"],
    ["investigated", "investigate"], ["moderated", "moderate"], ["operated", "operate"],
    ["populated", "populate"], ["regulated", "regulate"], ["related", "relate"],
    ["replicated", "replicate"], ["separated", "separate"], ["tolerated", "tolerate"],
    ["translated", "translate"], ["validated", "validate"], ["vibrated", "vibrate"],
    ["updated", "update"], ["upgraded", "upgrade"], ["degraded", "degrade"],
    ["documented", "document"], ["implemented", "implement"],
    ["deployed", "deploy"], ["enjoyed", "enjoy"], ["employed", "employ"], ["destroyed", "destroy"],
    ["fixed", "fix"], ["mixed", "mix"], ["boxed", "box"], ["taxed", "tax"], ["faxed", "fax"],
    ["released", "release"], ["increased", "increase"], ["decreased", "decrease"],
    ["raised", "raise"], ["praised", "praise"], ["appraised", "appraise"],
    ["compromised", "compromise"], ["proposed", "propose"], ["opposed", "oppose"],
    ["supposed", "suppose"], ["imposed", "impose"], ["exposed", "expose"],
    ["composed", "compose"], ["disposed", "dispose"], ["enclosed", "enclose"],
    ["disclosed", "disclose"], ["achieved", "achieve"], ["believed", "believe"],
    ["received", "receive"], ["conceived", "conceive"], ["deceived", "deceive"],
    ["perceived", "perceive"], ["relieved", "relieve"], ["served", "serve"],
    ["deserved", "deserve"], ["preserved", "preserve"], ["reserved", "reserve"],
    ["observed", "observe"], ["conserved", "conserve"], ["solved", "solve"],
    ["resolved", "resolve"], ["evolved", "evolve"], ["involved", "involve"],
    ["revolved", "revolve"], ["devoted", "devote"], ["noted", "note"],
    ["quoted", "quote"], ["voted", "vote"],
    ["approved", "approve"], ["improved", "improve"], ["proved", "prove"],
    ["removed", "remove"], ["moved", "move"], ["saved", "save"], ["carved", "carve"],
    ["shaped", "shape"], ["dated", "date"], ["rated", "rate"],
    ["argued", "argue"], ["continued", "continue"], ["pursued", "pursue"],
    ["issued", "issue"], ["acquired", "acquire"], ["required", "require"],
    ["inquired", "inquire"], ["admired", "admire"], ["desired", "desire"],
    ["retired", "retire"], ["hired", "hire"], ["fired", "fire"], ["inspired", "inspire"],
    ["declined", "decline"], ["defined", "define"], ["refined", "refine"],
    ["combined", "combine"], ["imagined", "imagine"], ["examined", "examine"],
    ["determined", "determine"], ["maintained", "maintain"], ["sustained", "sustain"],
    ["obtained", "obtain"], ["retained", "retain"], ["contained", "contain"],
    ["entertained", "entertain"], ["remained", "remain"], ["explained", "explain"],
    ["complained", "complain"], ["trained", "train"], ["joined", "join"],
  ];
  for (const [past, base] of edVerbs) out[past] = base;
  return out;
})();

/** Find the base form from a simple-past tense form. */
export function findBaseFromPastTense(pastTense: string): string | null {
  const w = pastTense.toLowerCase();
  if (PAST_TENSE_TO_BASE[w]) return PAST_TENSE_TO_BASE[w];
  // Regular -ed fallback.
  if (w.endsWith("ied")) return w.slice(0, -3) + "y"; // studied → study
  if (w.endsWith("ed")) {
    const stem = w.slice(0, -2);
    // Doubled consonant: stopped → stop
    if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2] &&
        !isVowel(stem[stem.length - 1]) && isVowel(stem[stem.length - 3])) {
      return stem.slice(0, -1);
    }
    return stem;
  }
  return null;
}

/**
 * Common adjectives that look like past participles. The detector skips these
 * to avoid false positives on stative-adjective uses like "is interested in",
 * "was tired", "are concerned about".
 */
export const ADJECTIVE_DENYLIST: ReadonlySet<string> = new Set([
  "tired", "interested", "bored", "excited", "surprised", "confused", "annoyed",
  "frustrated", "exhausted", "delighted", "pleased", "satisfied", "disappointed",
  "concerned", "worried", "scared", "frightened", "terrified", "alarmed", "amazed",
  "astonished", "shocked", "embarrassed", "offended", "insulted", "threatened",
  "thrilled", "relieved", "shocked", "stunned", "horrified", "disgusted",
  "committed", "dedicated", "devoted", "engaged", "involved", "located",
  "situated", "associated", "related", "connected", "linked", "limited",
  "restricted", "complicated", "sophisticated", "outdated", "outmoded",
  "advanced", "refined", "detailed", "marked", "pronounced", "advanced",
  "accustomed", "used", "familiarized", "experienced", "qualified", "trained",
  "skilled", "talented", "gifted", "blessed", "cursed", "doomed", "wretched",
  "wicked", "wretched", "naked", "bare", "shaven", "sunken", "drunken",
  "shrunken", "retired", "deceased", "departed", "fallen", "missing",
  "haunted", "blessed", "cursed", "wicked", "rotten", "swollen",
]);

// ---------- Be-verb patterns ----------

/** Be-verbs and their tense. Ordered: most complex first (multiword before single). */
export const BE_VERB_PATTERNS: { beVerb: string; tense: Tense; regex: RegExp }[] = [
  // Perfect: has/have/had been + participle
  { beVerb: "had been", tense: "past-perfect", regex: /\b(had)\s+been\s+(\w+)/gi },
  { beVerb: "has been", tense: "present-perfect", regex: /\b(has)\s+been\s+(\w+)/gi },
  { beVerb: "have been", tense: "present-perfect", regex: /\b(have)\s+been\s+(\w+)/gi },
  // Progressive passive: is/are/was/were being + participle
  { beVerb: "is being", tense: "present-progressive", regex: /\b(is)\s+being\s+(\w+)/gi },
  { beVerb: "are being", tense: "present-progressive", regex: /\b(are)\s+being\s+(\w+)/gi },
  { beVerb: "was being", tense: "past-progressive", regex: /\b(was)\s+being\s+(\w+)/gi },
  { beVerb: "were being", tense: "past-progressive", regex: /\b(were)\s+being\s+(\w+)/gi },
  // Modal: can/could/will/would/should/must/may/might/shall + be + participle
  {
    beVerb: "modal be",
    tense: "modal",
    regex: /\b(can|could|will|would|should|must|may|might|shall)\s+be\s+(\w+)/gi,
  },
  // Simple be + participle
  { beVerb: "is", tense: "simple-present", regex: /\b(is)\s+(\w+)/gi },
  { beVerb: "are", tense: "simple-present", regex: /\b(are)\s+(\w+)/gi },
  { beVerb: "was", tense: "simple-past", regex: /\b(was)\s+(\w+)/gi },
  { beVerb: "were", tense: "simple-past", regex: /\b(were)\s+(\w+)/gi },
  { beVerb: "am", tense: "simple-present", regex: /\b(am)\s+(\w+)/gi },
  // 'been' alone (rare as main verb) - skip
];

// ---------- Helpers ----------

/** Normalize newlines + whitespace. */
export function normalizeText(s: string): string {
  if (!s) return "";
  return s.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/** Escape HTML special characters. */
export function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Count words. */
export function countWords(s: string): number {
  if (!s || !s.trim()) return 0;
  return (s.trim().match(/\S+/g) ?? []).length;
}

/**
 * Split text into sentences on terminal punctuation (. ! ?), preserving the
 * trailing punctuation. Returns sentences with their start/end offsets in the
 * original text.
 */
export function splitSentences(text: string): { text: string; start: number; end: number }[] {
  if (!text) return [];
  const out: { text: string; start: number; end: number }[] = [];
  // Match sentence: non-greedy run of chars, then terminal punctuation, then optional closing quote/paren.
  const re = /[^.!?]*[.!?]+["')\]]?(?:\s|$)|[^.!?]+$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    if (!raw.trim()) continue;
    const start = m.index;
    const end = start + raw.length;
    out.push({ text: raw.trim(), start, end });
    if (m[0] === "") re.lastIndex++;
  }
  return out;
}

/** Tokenize a sentence into words (preserves case). */
export function tokenizeWords(s: string): string[] {
  return s.match(/[A-Za-z']+/g) ?? [];
}

/** Check whether a word looks like a regular past participle (ends in -ed, excluding common adjectives). */
export function isRegularParticiple(word: string): boolean {
  const w = word.toLowerCase();
  if (w.length < 4) return false;
  if (!/(?:ed)$/.test(w)) return false;
  if (ADJECTIVE_DENYLIST.has(w)) return false;
  // Skip if word is actually a noun/adjective ending in -ed (heuristic: in dictionary? hard to tell — just trust the denylist).
  return true;
}

/** Find the base form of a past participle. */
export function findBaseVerb(participle: string): string | null {
  const w = participle.toLowerCase();
  if (ADJECTIVE_DENYLIST.has(w)) return null;
  // Check irregular table first.
  if (PAST_PARTICIPLE_TO_BASE[w]) return PAST_PARTICIPLE_TO_BASE[w];
  // Regular: strip -ed.
  if (w.endsWith("ied")) return w.slice(0, -3) + "y"; // studied → study
  if (w.endsWith("ed")) {
    const stem = w.slice(0, -2);
    // Doubled consonant: stopped → stop
    if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2] &&
        !isVowel(stem[stem.length - 1]) && isVowel(stem[stem.length - 3])) {
      return stem.slice(0, -1);
    }
    return stem;
  }
  return null;
}

function isVowel(ch: string): boolean {
  return "aeiou".includes(ch.toLowerCase());
}

/** Is the word a past participle (regular or irregular)? */
export function isPastParticiple(word: string): boolean {
  return findBaseVerb(word) !== null;
}

// ---------- Detection ----------

/**
 * Detect all passive clauses in a sentence.
 * Returns clauses in order of appearance, with non-overlapping matches.
 */
export function detectPassiveClauses(sentence: string, sentenceIndex: number): PassiveClause[] {
  if (!sentence) return [];
  const clauses: PassiveClause[] = [];
  // Collect all candidate matches across all be-verb patterns.
  type Candidate = {
    beVerb: string;
    tense: Tense;
    participle: string;
    baseVerb: string;
    start: number;       // start of be-verb
    end: number;         // end of participle
    fullMatch: string;
  };
  const candidates: Candidate[] = [];

  for (const pat of BE_VERB_PATTERNS) {
    pat.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pat.regex.exec(sentence)) !== null) {
      const participle = m[2];
      const baseVerb = findBaseVerb(participle);
      if (!baseVerb) continue;
      // For simple be + participle (is/are/was/were), the regex group 2 is the word after.
      // For complex patterns, group 2 is also the participle.
      const beStart = m.index;
      const beEnd = m.index + m[1].length; // end of "was"/"is"/"has" (single word)
      // For multiword patterns, extend beEnd to include "been"/"being"/etc.
      const fullMatch = m[0];
      const participleStart = m.index + fullMatch.length - participle.length;
      const participleEnd = participleStart + participle.length;
      candidates.push({
        beVerb: pat.beVerb === "modal be" ? m[1] + " be" : pat.beVerb,
        tense: pat.tense,
        participle,
        baseVerb,
        start: beStart,
        end: participleEnd,
        fullMatch,
      });
      if (m[0] === "") pat.regex.lastIndex++;
    }
  }

  // Sort by start asc; prefer the longest match (most auxiliaries).
  candidates.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  // Greedy non-overlap selection.
  let lastEnd = -1;
  for (const c of candidates) {
    if (c.start < lastEnd) continue;
    // Look for "by [agent]" after the participle.
    const after = sentence.slice(c.end);
    const agentMatch = after.match(/^\s*,?\s+by\s+([A-Za-z][A-Za-z\s'-]+?)(?:[.,;:!?\n]|$)/i);
    let agent: string | null = null;
    let agentSource: "by-phrase" | "inferred" | "agentless" = "agentless";
    if (agentMatch) {
      agent = agentMatch[1].trim();
      agentSource = "by-phrase";
    }
    const originalClause = sentence.slice(c.start, c.end);
    const tense = c.tense;
    const rewrite = rewritePassiveToActive(sentence, c, agent, agentSource);
    const isLegitimate = agent === null && (tense === "simple-past" || tense === "simple-present" || tense === "present-perfect");
    const legitimateReason = isLegitimate
      ? "Agentless passive — the agent is unknown or irrelevant. Often fine in scientific/process writing."
      : undefined;
    clauses.push({
      sentenceIndex,
      start: c.start,
      end: c.end,
      beVerb: c.beVerb,
      participle: c.participle,
      baseVerb: c.baseVerb,
      tense,
      agent,
      agentSource,
      originalClause,
      rewrite,
      explanation: buildExplanation(c, agent, agentSource),
      isLegitimate,
      legitimateReason,
    });
    lastEnd = c.end;
  }
  return clauses;
}

/** Build a grammar explanation for the clause. */
export function buildExplanation(
  c: { beVerb: string; participle: string; baseVerb: string; tense: Tense },
  agent: string | null,
  agentSource: "by-phrase" | "inferred" | "agentless",
): string {
  const tenseLabel = TENSE_LABELS[c.tense].toLowerCase();
  if (agent && agentSource === "by-phrase") {
    return `Passive (${tenseLabel}): "${c.beVerb} ${c.participle}" → active "${agent} ${conjugateForTense(c.baseVerb, c.tense, agent)}". The "by ${agent}" phrase becomes the new subject, and "${c.participle}" becomes "${conjugateForTense(c.baseVerb, c.tense, agent)}".`;
  }
  if (agentSource === "agentless") {
    return `Passive (${tenseLabel}): "${c.beVerb} ${c.participle}" with no stated agent. Base verb: ${c.baseVerb}. An agentless passive is often legitimate when the actor is unknown or irrelevant.`;
  }
  return `Passive (${tenseLabel}): "${c.beVerb} ${c.participle}" → active "${agent} ${conjugateForTense(c.baseVerb, c.tense, agent ?? "someone")}".`;
}

/** Conjugate a base verb to the active form matching the passive tense. */
export function conjugateForTense(baseVerb: string, tense: Tense, subject: string): string {
  const subj = subject.toLowerCase();
  const isThirdSingular =
    subj === "he" || subj === "she" || subj === "it" ||
    (subj.length > 0 && !["i", "you", "we", "they"].includes(subj.split(/\s+/)[0] ?? "") &&
     !subj.endsWith("s") && !subj.endsWith("they"));
  switch (tense) {
    case "simple-present":
      return isThirdSingular ? thirdSingularForm(baseVerb) : baseVerb;
    case "simple-past":
      return simplePastForm(baseVerb);
    case "present-perfect":
      return `${isThirdSingular ? "has" : "have"} ${pastParticipleForm(baseVerb)}`;
    case "past-perfect":
      return `had ${pastParticipleForm(baseVerb)}`;
    case "future":
      return `will ${baseVerb}`;
    case "modal":
      // Caller (rewritePassiveToActive) handles the modal.
      return baseVerb;
    case "present-progressive":
      return `${isThirdSingular ? "is" : "are"} ${presentParticipleForm(baseVerb)}`;
    case "past-progressive":
      return `${isThirdSingular ? "was" : "were"} ${presentParticipleForm(baseVerb)}`;
  }
}

/** Form the third-person singular present of a base verb. */
export function thirdSingularForm(baseVerb: string): string {
  if (baseVerb.endsWith("s") || baseVerb.endsWith("sh") || baseVerb.endsWith("ch") ||
      baseVerb.endsWith("x") || baseVerb.endsWith("z") || baseVerb.endsWith("o")) {
    return baseVerb + "es";
  }
  if (baseVerb.endsWith("y") && baseVerb.length > 1 && !isVowel(baseVerb[baseVerb.length - 2])) {
    return baseVerb.slice(0, -1) + "ies";
  }
  return baseVerb + "s";
}

/** Count vowel groups in a word (rough syllable counter). */
export function countVowelGroups(word: string): number {
  const matches = word.toLowerCase().match(/[aeiouy]+/g);
  return matches ? matches.length : 0;
}

/** Form the simple past of a base verb (regular only; for irregulars we expect the caller to have looked it up). */
export function simplePastForm(baseVerb: string): string {
  // Look up irregular past tense.
  if (BASE_TO_PAST_TENSE[baseVerb]) return BASE_TO_PAST_TENSE[baseVerb];
  // Regular -ed.
  if (baseVerb.endsWith("e")) return baseVerb + "d";
  if (baseVerb.endsWith("y") && baseVerb.length > 1 && !isVowel(baseVerb[baseVerb.length - 2])) {
    return baseVerb.slice(0, -1) + "ied";
  }
  // Doubled consonant for CVC pattern — but only on single-syllable words
  // (multi-syllable words like "deliver" or "happen" don't double: delivered, happened).
  if (baseVerb.length >= 3 &&
      countVowelGroups(baseVerb) === 1 &&
      !isVowel(baseVerb[baseVerb.length - 1]) &&
      isVowel(baseVerb[baseVerb.length - 2]) &&
      !isVowel(baseVerb[baseVerb.length - 3]) &&
      !"wxy".includes(baseVerb[baseVerb.length - 1])) {
    return baseVerb + baseVerb[baseVerb.length - 1] + "ed";
  }
  return baseVerb + "ed";
}

/** Form the past participle of a base verb (regular only). */
export function pastParticipleForm(baseVerb: string): string {
  // Look up irregular past participle.
  for (const [participle, base] of Object.entries(PAST_PARTICIPLE_TO_BASE)) {
    if (base === baseVerb) return participle;
  }
  // Same as simplePastForm for regular verbs.
  return simplePastForm(baseVerb);
}

/** Form the present participle (-ing) of a base verb. */
export function presentParticipleForm(baseVerb: string): string {
  if (baseVerb.endsWith("ie")) return baseVerb.slice(0, -2) + "ying";
  if (baseVerb.endsWith("e") && !baseVerb.endsWith("ee")) return baseVerb.slice(0, -1) + "ing";
  if (baseVerb.length >= 3 &&
      !isVowel(baseVerb[baseVerb.length - 1]) &&
      isVowel(baseVerb[baseVerb.length - 2]) &&
      !isVowel(baseVerb[baseVerb.length - 3]) &&
      !"wxy".includes(baseVerb[baseVerb.length - 1])) {
    return baseVerb + baseVerb[baseVerb.length - 1] + "ing";
  }
  return baseVerb + "ing";
}

/**
 * Rewrite a passive clause as active. Returns null if a confident rewrite is
 * not possible (e.g., agentless passive).
 */
export function rewritePassiveToActive(
  sentence: string,
  c: { beVerb: string; participle: string; baseVerb: string; tense: Tense; start: number; end: number; fullMatch: string },
  agent: string | null,
  agentSource: "by-phrase" | "inferred" | "agentless",
): string | null {
  if (!agent || agentSource !== "by-phrase") return null;
  // Subject = the noun phrase before the be-verb (everything from sentence start to be-verb).
  const subjectPhrase = sentence.slice(0, c.start).trim();
  if (!subjectPhrase) return null;
  // Strip a leading conjunction if present.
  const subject = subjectPhrase.replace(/^(?:and|but|so|or|yet)\s+/i, "").trim();
  if (!subject) return null;
  // What comes after the agent (the rest of the sentence past the "by X" phrase).
  const afterParticiple = sentence.slice(c.end);
  const agentMatch = afterParticiple.match(/^\s*,?\s+by\s+([A-Za-z][A-Za-z\s'-]+?)([.,;:!?\n]|$)/i);
  if (!agentMatch) return null;
  const afterAgent = afterParticiple.slice(agentMatch[0].length - 1).trim(); // keep the trailing punctuation
  // Pick the active verb conjugated to the tense.
  const activeVerb = c.tense === "modal"
    ? `${c.beVerb} ${c.baseVerb}`  // e.g. "should write"
    : conjugateForTense(c.baseVerb, c.tense, agent);
  // Capitalize the agent if it starts the new sentence.
  const agentCap = agent.charAt(0).toUpperCase() + agent.slice(1);
  // Assemble: [Agent] [activeVerb] [subject] [rest]
  const lowerSubject = subject.charAt(0).toLowerCase() + subject.slice(1);
  let rewrite = `${agentCap} ${activeVerb} ${lowerSubject}`;
  // Append trailing rest (cleanly).
  const rest = afterAgent.trim();
  if (rest && rest !== "." && rest !== "") {
    // Lowercase first letter if needed and ensure spacing.
    rewrite += " " + rest.charAt(0).toLowerCase() + rest.slice(1);
  } else {
    rewrite += ".";
  }
  return rewrite;
}

// ---------- Active → Passive ----------

/**
 * Attempt an active→passive rewrite for a single sentence.
 * Looks for: [Subject] [past-tense verb] [object]
 * Produces:  [Object] was [past participle] by [Subject]
 *
 * Returns null if no clear subject/verb/object is found, or if the verb is
 * not in our past-tense table (we can't confidently form the participle).
 */
export function rewriteActiveToPassive(
  sentence: string,
  sentenceIndex: number,
): ActiveRewrite | null {
  if (!sentence) return null;
  // Skip if sentence already has a passive construction.
  const passives = detectPassiveClauses(sentence, sentenceIndex);
  if (passives.length > 0) return null;
  // Tokenize words (drop leading/trailing punctuation).
  const words = tokenizeWords(sentence);
  // Need at least subject + verb + article + object-noun (4 words).
  if (words.length < 4) return null;

  // Find the first word that's a known past-tense verb. Skip articles,
  // auxiliaries, and the first/last word (we need subject before + object after).
  const skipWords = new Set([
    "is", "are", "was", "were", "am", "be", "been", "being", "has", "have", "had",
    "can", "could", "will", "would", "should", "must", "may", "might", "shall",
    "do", "does", "did", "the", "a", "an", "and", "but", "or", "yet", "so",
  ]);
  let verbIdx = -1;
  let baseVerb: string | null = null;
  for (let i = 1; i < words.length - 1; i++) {
    const w = words[i].toLowerCase();
    if (skipWords.has(w)) continue;
    const base = findBaseFromPastTense(w);
    if (base) {
      verbIdx = i;
      baseVerb = base;
      break;
    }
  }
  if (verbIdx === -1 || !baseVerb) return null;

  // Subject = everything before the verb.
  const subjectWords = words.slice(0, verbIdx);
  if (subjectWords.length === 0) return null;

  // Object = everything after the verb, until a preposition/conjunction or end.
  const stopWords = new Set([
    "in", "on", "at", "by", "for", "with", "to", "from", "and", "but", "or",
    "yet", "so", "because", "while", "although", "since", "unless", "if", "when",
    "where", "after", "before", "as", "than", "that", "which", "who", "whom",
  ]);
  const objectWords: string[] = [];
  for (let i = verbIdx + 1; i < words.length; i++) {
    const w = words[i].toLowerCase();
    if (stopWords.has(w)) break;
    objectWords.push(words[i]);
  }
  if (objectWords.length < 1) return null;

  // Form the past participle of the base verb.
  const participle = pastParticipleForm(baseVerb);

  // Subject phrase (preserve original case — proper nouns like "Jane" stay capitalized,
  // common nouns like "The team" stay as written).
  const subjectPhrase = subjectWords.join(" ");
  // Object phrase (capitalized first letter for the new subject).
  const objectPhrase = objectWords.join(" ");
  const objectCap = objectPhrase.charAt(0).toUpperCase() + objectPhrase.slice(1);

  const verbWord = words[verbIdx];
  const rewrite = `${objectCap} was ${participle} by ${subjectPhrase}.`;
  return {
    sentenceIndex,
    original: sentence,
    passiveRewrite: rewrite,
    explanation:
      `Active → passive: "${subjectWords.join(" ")} ${verbWord} ${objectPhrase}" → ` +
      `"${objectCap} was ${participle} by ${subjectPhrase}". The object becomes the subject ` +
      `and the original subject follows "by".`,
  };
}

// ---------- Main convert ----------

/**
 * Convert text in the chosen direction. Pure.
 */
export function convertVoice(text: string, direction: Direction, style: StylePreset): ConvertResult {
  const original = normalizeText(text);
  const sentenceList = splitSentences(original);
  const sentences: Sentence[] = [];
  let passiveCount = 0;
  let convertedCount = 0;
  let legitimateCount = 0;

  for (let i = 0; i < sentenceList.length; i++) {
    const s = sentenceList[i];
    if (direction === "to-active") {
      const clauses = detectPassiveClauses(s.text, i);
      // Apply style filter: academic allows agentless passives.
      const autoApply = style === "academic"
        ? clauses.filter((c) => !c.isLegitimate)
        : clauses;
      const isPassive = clauses.length > 0;
      if (isPassive) passiveCount += clauses.length;
      convertedCount += autoApply.filter((c) => c.rewrite !== null).length;
      legitimateCount += clauses.filter((c) => c.isLegitimate).length;
      sentences.push({
        index: i,
        text: s.text,
        start: s.start,
        end: s.end,
        isPassive,
        clauses,
      });
    } else {
      // to-passive
      const rewrite = rewriteActiveToPassive(s.text, i);
      const isPassive = false;
      if (rewrite && rewrite.passiveRewrite) convertedCount += 1;
      sentences.push({
        index: i,
        text: s.text,
        start: s.start,
        end: s.end,
        isPassive,
        clauses: [],
        activeRewrite: rewrite ?? undefined,
      });
    }
  }

  const wordCount = countWords(original);
  const sentenceCount = sentenceList.length;
  // Passive percentage: for to-active, % of sentences with at least one passive clause.
  // For to-passive, % of sentences with a successful rewrite.
  const passiveSentences = direction === "to-active"
    ? sentences.filter((s) => s.isPassive).length
    : sentences.filter((s) => s.activeRewrite && s.activeRewrite.passiveRewrite).length;
  const passivePercentage = sentenceCount > 0
    ? Math.round((passiveSentences / sentenceCount) * 100)
    : 0;
  const activeCount = direction === "to-passive"
    ? sentences.filter((s) => s.activeRewrite && s.activeRewrite.passiveRewrite).length
    : 0;

  const converted = buildConvertedText(sentences, direction, style);

  return {
    original,
    direction,
    style,
    sentences,
    converted,
    stats: {
      sentenceCount,
      wordCount,
      passiveCount,
      activeCount,
      convertedCount,
      legitimateCount,
      passivePercentage,
    },
  };
}

/** Build the converted text by applying each non-legitimate rewrite. */
export function buildConvertedText(sentences: Sentence[], direction: Direction, style: StylePreset): string {
  const parts: string[] = [];
  for (const s of sentences) {
    if (direction === "to-active") {
      let text = s.text;
      // Apply rewrites from the end backward.
      const rewrites = s.clauses
        .filter((c) => c.rewrite !== null && !(style === "academic" && c.isLegitimate));
      if (rewrites.length === 0) {
        parts.push(text);
        continue;
      }
      // For now, if a sentence has any applicable rewrite, replace the entire sentence with the first rewrite.
      // (Per-clause splicing across multi-clause sentences is left as a future enhancement.)
      const first = rewrites[0];
      if (first && first.rewrite) {
        parts.push(first.rewrite);
      } else {
        parts.push(text);
      }
    } else {
      // to-passive
      if (s.activeRewrite && s.activeRewrite.passiveRewrite) {
        parts.push(s.activeRewrite.passiveRewrite);
      } else {
        parts.push(s.text);
      }
    }
  }
  return parts.join(" ");
}

// ---------- Rendering ----------

/** Render the original text with passive clauses highlighted inline. */
export function renderHighlightedHtml(result: ConvertResult): string {
  if (result.direction !== "to-active") return escapeHtml(result.original);
  let out = "";
  let cursor = 0;
  // Collect all clauses across sentences with absolute offsets.
  const all = result.sentences.flatMap((s) =>
    s.clauses.map((c) => ({ absStart: s.start + c.start, absEnd: s.start + c.end, c })),
  );
  all.sort((a, b) => a.absStart - b.absStart);
  for (const { absStart, absEnd, c } of all) {
    out += escapeHtml(result.original.slice(cursor, absStart));
    const cls = c.isLegitimate ? "pa-passive pa-legit" : "pa-passive pa-flag";
    const title = escapeHtml(`${c.beVerb} ${c.participle}\n${c.explanation}`);
    out += `<mark class="${cls}" title="${title}">${escapeHtml(result.original.slice(absStart, absEnd))}</mark>`;
    cursor = absEnd;
  }
  out += escapeHtml(result.original.slice(cursor));
  return out.replace(/\n/g, "<br/>");
}

/** Render a CSV of all suggestions. */
export function renderSuggestionsCsv(result: ConvertResult): string {
  const lines = ["sentence_index,direction,clause,rewrite,explanation,legitimate"];
  for (const s of result.sentences) {
    if (result.direction === "to-active") {
      for (const c of s.clauses) {
        lines.push([
          String(s.index),
          "to-active",
          escapeCsv(c.originalClause),
          escapeCsv(c.rewrite ?? ""),
          escapeCsv(c.explanation),
          String(c.isLegitimate),
        ].join(","));
      }
    } else {
      if (s.activeRewrite && s.activeRewrite.passiveRewrite) {
        lines.push([
          String(s.index),
          "to-passive",
          escapeCsv(s.activeRewrite.original),
          escapeCsv(s.activeRewrite.passiveRewrite),
          escapeCsv(s.activeRewrite.explanation),
          "false",
        ].join(","));
      }
    }
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------- LLM prompt builder ----------

export function buildLlmPrompt(text: string, direction: Direction): string {
  if (direction === "to-active") {
    return (
      "You are a grammar editor. Identify each passive-voice construction in the text below, " +
      "explain the agent (or note if it is agentless), and provide an active-voice rewrite that " +
      "preserves meaning. Preserve legitimate passives (unknown/irrelevant agent) rather than forcing a rewrite.\n\n" +
      `Text:\n"""\n${text}\n"""`
    );
  }
  return (
    "You are a grammar editor. Identify each active-voice sentence in the text below that has " +
    "a clear subject, transitive verb, and object, and provide a passive-voice rewrite. " +
    "Skip sentences where the passive would be awkward.\n\n" +
    `Text:\n"""\n${text}\n"""`
  );
}

export function renderLlmResult(text: string): string {
  return (text || "").trim();
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

export function buildShareUrl(text: string, direction: Direction, style: StylePreset): string {
  const params = new URLSearchParams();
  if (text) params.set("text", text);
  if (direction) params.set("dir", direction);
  if (style) params.set("style", style);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export interface ShareState {
  text: string;
  direction: Direction;
  style: StylePreset;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { text: "", direction: "to-active", style: "general" };
  const params = new URLSearchParams(clean);
  const text = params.get("text") ?? "";
  const dirParam = params.get("dir");
  const styleParam = params.get("style");
  const direction: Direction = dirParam === "to-passive" ? "to-passive" : "to-active";
  const validStyles: StylePreset[] = ["general", "academic", "journalism"];
  const style: StylePreset = validStyles.includes(styleParam as StylePreset)
    ? (styleParam as StylePreset)
    : "general";
  return { text, direction, style };
}
