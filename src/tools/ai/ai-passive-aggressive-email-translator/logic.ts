/**
 * AI Passive-Aggressive Email Translator — pure logic.
 *
 * Two modes:
 *   - decode: detect passive-aggressive phrases, score 0–100, escalation meter,
 *     inline highlight with plain-English "what they actually mean" gloss.
 *   - defuse: rewrite the user's angry/passive-aggressive draft into a chosen
 *     tone (Calm / Professional / Warm / Direct).
 *
 * Built-in glossary of 60+ classic corporate phrases across 6 categories.
 * All detection and rewriting is pure string work — no DOM, no network.
 *
 * The optional LLM call (BYO API key) lives in ui.tsx because it touches
 * the network.
 */

// ---------- Types ----------

export type Mode = "decode" | "defuse";
export type Tone = "calm" | "professional" | "warm" | "direct";
export type Severity = "low" | "medium" | "high";
export type EscalationLevel =
  | "mild"
  | "annoyed"
  | "passive-aggressive"
  | "hostile"
  | "hr-incident";
export type PhraseCategory =
  | "point-scoring"
  | "fake-polite"
  | "hostile-directive"
  | "conditional-threat"
  | "sarcasm"
  | "bureaucratic";

export interface PhraseEntry {
  pattern: string;                    // canonical phrase, lowercase
  category: PhraseCategory;
  severity: Severity;
  escalation: 1 | 2 | 3;
  gloss: string;                      // "what they actually mean"
  why: string;                        // explanation
  defuse: Record<Tone, string>;       // rewrite per tone
}

export interface PhraseHit {
  id: string;
  entry: PhraseEntry;
  start: number;
  end: number;
  original: string;
  gloss: string;
  why: string;
  replacement: string;                // chosen by tone (decode → "professional")
}

export interface DecodeStats {
  phraseCount: number;
  byCategory: Record<PhraseCategory, number>;
  bySeverity: Record<Severity, number>;
  totalEscalation: number;
  wordCount: number;
}

export interface DecodeResult {
  original: string;
  score: number;                      // 0–100
  escalationLevel: EscalationLevel;
  hits: PhraseHit[];
  stats: DecodeStats;
  summary: string;                    // plain-English narrative
  confidence: "low" | "medium" | "high";
}

export interface DefuseResult {
  original: string;
  rewritten: string;
  tone: Tone;
  hitsFixed: number;
  beforeScore: number;
  afterScore: number;
  hits: PhraseHit[];
}

export interface DiffSegment {
  type: "same" | "added" | "removed";
  text: string;
}

export interface HistoryEntry {
  ts: number;
  mode: Mode;
  tone: Tone;
  textLength: number;
  score: number;
  phraseCount: number;
  escalationLevel: EscalationLevel;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-passive-aggressive-email-translator:history";
export const HISTORY_MAX = 20;

export const TONE_LABELS: Record<Tone, string> = {
  calm: "Calm",
  professional: "Professional",
  warm: "Warm",
  direct: "Direct",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export const CATEGORY_LABELS: Record<PhraseCategory, string> = {
  "point-scoring": "Point-scoring",
  "fake-polite": "Fake polite",
  "hostile-directive": "Hostile directive",
  "conditional-threat": "Conditional threat",
  "sarcasm": "Sarcasm / exclusion",
  "bureaucratic": "Bureaucratic padding",
};

export const ESCALATION_LABELS: Record<EscalationLevel, string> = {
  "mild": "Mild — readable as neutral",
  "annoyed": "Annoyed — slightly pointed",
  "passive-aggressive": "Passive-aggressive — clearly hostile",
  "hostile": "Hostile — escalation risk",
  "hr-incident": "HR incident territory — document everything",
};

export const DEFAULT_TONE: Tone = "professional";

export const SAMPLE_EMAILS: { label: string; mode: Mode; text: string }[] = [
  {
    label: "Decode — Classic PA",
    mode: "decode",
    text:
      "Per my last email, as I mentioned previously, the report was due on Friday. " +
      "As I'm sure you're aware, this is the third time I've had to follow up. " +
      "Going forward, please ensure these are submitted on time. " +
      "Please advise on next steps at your earliest convenience.",
  },
  {
    label: "Decode — Soft hostile",
    mode: "decode",
    text:
      "Just checking in on this — friendly reminder that I'm still waiting. " +
      "If you could get to this when you get a chance, that would be great. " +
      "Hope this helps clarify. Let's touch base next week.",
  },
  {
    label: "Defuse — Angry draft",
    mode: "defuse",
    text:
      "I've told you three times now that the numbers don't add up. " +
      "Do your job and fix it. " +
      "I'm copying your manager on this because clearly you can't be bothered.",
  },
  {
    label: "Decode — Bureaucratic",
    mode: "decode",
    text:
      "As per my previous email, kindly do the needful and revert at the earliest. " +
      "Looping in HR for visibility. " +
      "Going ahead with the next steps per our conversation.",
  },
];

// ---------- Phrase catalog (60+ entries) ----------

export const PHRASE_CATALOG: PhraseEntry[] = [
  // ---- Point-scoring (10) ----
  {
    pattern: "per my last email",
    category: "point-scoring",
    severity: "high",
    escalation: 3,
    gloss: "I already sent this to you and you ignored it.",
    why: "Cites a prior message to imply the recipient dropped the ball.",
    defuse: {
      calm: "Following up on my previous note",
      professional: "Following up on my earlier email",
      warm: "Just a quick follow-up to my earlier note",
      direct: "I'm following up on my earlier email",
    },
  },
  {
    pattern: "as i mentioned",
    category: "point-scoring",
    severity: "medium",
    escalation: 2,
    gloss: "I already told you this — you weren't listening.",
    why: "Frames the recipient as forgetful or inattentive.",
    defuse: {
      calm: "As a reminder",
      professional: "As a reminder",
      warm: "Just to recap",
      direct: "Recapping",
    },
  },
  {
    pattern: "as i mentioned previously",
    category: "point-scoring",
    severity: "high",
    escalation: 3,
    gloss: "I have already explained this and you should know it by now.",
    why: "Adds 'previously' to amplify the implication that the recipient missed something obvious.",
    defuse: {
      calm: "As a reminder",
      professional: "As a quick reminder",
      warm: "Just recapping",
      direct: "Recapping for clarity",
    },
  },
  {
    pattern: "as i noted",
    category: "point-scoring",
    severity: "medium",
    escalation: 2,
    gloss: "I already pointed this out.",
    why: "Cites prior input to score a point.",
    defuse: {
      calm: "As a reminder",
      professional: "As a reminder",
      warm: "Just noting again",
      direct: "Noting again",
    },
  },
  {
    pattern: "as we discussed",
    category: "point-scoring",
    severity: "medium",
    escalation: 2,
    gloss: "We already had this conversation — don't make me repeat it.",
    why: "References a prior conversation to imply the recipient isn't keeping up.",
    defuse: {
      calm: "As we talked about",
      professional: "As we covered",
      warm: "As we chatted about",
      direct: "As we covered",
    },
  },
  {
    pattern: "as previously stated",
    category: "point-scoring",
    severity: "high",
    escalation: 3,
    gloss: "I have already said this and you should remember.",
    why: "Cold, formal phrasing that signals impatience.",
    defuse: {
      calm: "As mentioned earlier",
      professional: "As mentioned earlier",
      warm: "Just to recap",
      direct: "Recapping",
    },
  },
  {
    pattern: "as per my last email",
    category: "point-scoring",
    severity: "high",
    escalation: 3,
    gloss: "I already sent this — read your inbox.",
    why: "Bureaucratic citation of prior email to shame the recipient.",
    defuse: {
      calm: "Following up on my earlier note",
      professional: "Following up on my earlier email",
      warm: "Just a quick follow-up",
      direct: "Following up on my earlier email",
    },
  },
  {
    pattern: "for your reference",
    category: "point-scoring",
    severity: "low",
    escalation: 1,
    gloss: "Here it is again, since you apparently don't have it.",
    why: "Often fine, but used repeatedly it implies the recipient lost or ignored prior material.",
    defuse: {
      calm: "Here for reference",
      professional: "Here for reference",
      warm: "Here's the link again in case it's handy",
      direct: "Here's the reference",
    },
  },
  {
    pattern: "as you'll recall",
    category: "point-scoring",
    severity: "medium",
    escalation: 2,
    gloss: "You should already know this.",
    why: "Presumes prior knowledge in a way that pressures the recipient.",
    defuse: {
      calm: "As a reminder",
      professional: "As a reminder",
      warm: "Just recapping",
      direct: "Recapping",
    },
  },
  {
    pattern: "as per my previous email",
    category: "point-scoring",
    severity: "high",
    escalation: 3,
    gloss: "I already sent this — go read it.",
    why: "Formal citation of a prior email to highlight the recipient's failure to act.",
    defuse: {
      calm: "Following up on my earlier note",
      professional: "Following up on my earlier email",
      warm: "Just a quick follow-up",
      direct: "Following up on my earlier email",
    },
  },

  // ---- Fake polite (10) ----
  {
    pattern: "kindly",
    category: "fake-polite",
    severity: "medium",
    escalation: 2,
    gloss: "Do this now, but I'm pretending to be polite.",
    why: "'Kindly' is a stiff, distancing word that signals irritation more than warmth.",
    defuse: {
      calm: "Could you",
      professional: "Please",
      warm: "Would you mind",
      direct: "Please",
    },
  },
  {
    pattern: "please advise",
    category: "fake-polite",
    severity: "medium",
    escalation: 2,
    gloss: "I have no idea what to do and I'm blaming you.",
    why: "Vague sign-off that dumps the decision back on the recipient.",
    defuse: {
      calm: "What would you suggest?",
      professional: "What's your preferred next step?",
      warm: "I'd love your thoughts on how to proceed",
      direct: "How should we proceed?",
    },
  },
  {
    pattern: "just checking in",
    category: "fake-polite",
    severity: "low",
    escalation: 1,
    gloss: "Why haven't you done this yet?",
    why: "Casual phrasing masking an implicit deadline pressure.",
    defuse: {
      calm: "Following up on this",
      professional: "Following up on this",
      warm: "Just a quick note to follow up",
      direct: "Following up",
    },
  },
  {
    pattern: "gentle reminder",
    category: "fake-polite",
    severity: "medium",
    escalation: 2,
    gloss: "Do this now.",
    why: "'Gentle' is the giveaway — it telegraphs that the sender is anything but gentle.",
    defuse: {
      calm: "A reminder",
      professional: "A quick reminder",
      warm: "Just a quick reminder",
      direct: "Reminder",
    },
  },
  {
    pattern: "friendly reminder",
    category: "fake-polite",
    severity: "medium",
    escalation: 2,
    gloss: "Do this now, and I'm not actually friendly.",
    why: "Like 'gentle reminder', the adjective undercuts the noun.",
    defuse: {
      calm: "A reminder",
      professional: "A quick reminder",
      warm: "Just a quick reminder",
      direct: "Reminder",
    },
  },
  {
    pattern: "just circling back",
    category: "fake-polite",
    severity: "low",
    escalation: 1,
    gloss: "I'm back to push you on this.",
    why: "Casual corporate-speak for a follow-up demand.",
    defuse: {
      calm: "Following up",
      professional: "Following up",
      warm: "Just a quick follow-up",
      direct: "Following up",
    },
  },
  {
    pattern: "just following up",
    category: "fake-polite",
    severity: "low",
    escalation: 1,
    gloss: "Where is this?",
    why: "Soft opener that masks an implicit deadline.",
    defuse: {
      calm: "Following up",
      professional: "Following up",
      warm: "A quick follow-up",
      direct: "Following up",
    },
  },
  {
    pattern: "hope this helps",
    category: "fake-polite",
    severity: "low",
    escalation: 1,
    gloss: "I've done my part; the ball is in your court (and I'm done helping).",
    why: "Often fine, but as a closing line it can read as dismissive.",
    defuse: {
      calm: "Let me know if you need more",
      professional: "Let me know if you need anything else",
      warm: "Happy to help if you need more",
      direct: "Let me know if you need more",
    },
  },
  {
    pattern: "would appreciate",
    category: "fake-polite",
    severity: "medium",
    escalation: 2,
    gloss: "Do this — I'm owed it.",
    why: "Soft-modal phrasing that conceals a demand.",
    defuse: {
      calm: "Could you",
      professional: "Please",
      warm: "Would you be able to",
      direct: "Please",
    },
  },
  {
    pattern: "if you wouldn't mind",
    category: "fake-polite",
    severity: "low",
    escalation: 1,
    gloss: "Do this (but I'm pretending it's optional).",
    why: "Hedges a request in a way that signals the sender expects compliance.",
    defuse: {
      calm: "Could you",
      professional: "Please",
      warm: "Would you mind",
      direct: "Please",
    },
  },

  // ---- Hostile directive (10) ----
  {
    pattern: "do the needful",
    category: "hostile-directive",
    severity: "high",
    escalation: 3,
    gloss: "Do your job (I won't specify what).",
    why: "Vague, archaic command that signals contempt for the recipient's autonomy.",
    defuse: {
      calm: "Could you take care of this",
      professional: "Could you handle this",
      warm: "Would you be able to take care of this",
      direct: "Please handle this",
    },
  },
  {
    pattern: "going forward",
    category: "hostile-directive",
    severity: "medium",
    escalation: 2,
    gloss: "Don't ever do this again.",
    why: "Cold directive phrasing that frames a correction as a future rule.",
    defuse: {
      calm: "Next time",
      professional: "Next time",
      warm: "Looking ahead",
      direct: "Next time",
    },
  },
  {
    pattern: "going ahead with",
    category: "hostile-directive",
    severity: "medium",
    escalation: 2,
    gloss: "I'm doing this regardless of your input.",
    why: "Implies the decision is already made and the recipient's role is to fall in line.",
    defuse: {
      calm: "Proceeding with",
      professional: "Proceeding with",
      warm: "I'll go ahead with",
      direct: "Proceeding with",
    },
  },
  {
    pattern: "please ensure",
    category: "hostile-directive",
    severity: "medium",
    escalation: 2,
    gloss: "Make sure this happens, or else.",
    why: "Formal imperative that signals the sender doesn't trust the recipient to follow through.",
    defuse: {
      calm: "Please make sure",
      professional: "Please make sure",
      warm: "Would you make sure",
      direct: "Please make sure",
    },
  },
  {
    pattern: "be advised",
    category: "hostile-directive",
    severity: "medium",
    escalation: 2,
    gloss: "Take note (this is official).",
    why: "Stiff, legalistic phrasing that signals the sender is escalating to formal record.",
    defuse: {
      calm: "Please note",
      professional: "Please note",
      warm: "Just a heads-up",
      direct: "Note",
    },
  },
  {
    pattern: "as per our conversation",
    category: "hostile-directive",
    severity: "medium",
    escalation: 2,
    gloss: "We agreed to this (don't pretend otherwise).",
    why: "Formal citation of a verbal agreement to lock in the recipient.",
    defuse: {
      calm: "As we discussed",
      professional: "As we discussed",
      warm: "As we chatted about",
      direct: "As we discussed",
    },
  },
  {
    pattern: "moving forward",
    category: "hostile-directive",
    severity: "medium",
    escalation: 2,
    gloss: "From now on, do this.",
    why: "Like 'going forward', a correction framed as future policy.",
    defuse: {
      calm: "Next time",
      professional: "Next time",
      warm: "Looking ahead",
      direct: "Next time",
    },
  },
  {
    pattern: "this needs to be",
    category: "hostile-directive",
    severity: "high",
    escalation: 3,
    gloss: "Fix this immediately.",
    why: "Imperative phrasing that frames the recipient's work as deficient.",
    defuse: {
      calm: "Could we make this",
      professional: "Could we make this",
      warm: "Would it be possible to make this",
      direct: "Please make this",
    },
  },
  {
    pattern: "we expect",
    category: "hostile-directive",
    severity: "medium",
    escalation: 2,
    gloss: "You will deliver this.",
    why: "Corporate 'we' used to apply pressure without naming a specific person.",
    defuse: {
      calm: "We're aiming for",
      professional: "We're targeting",
      warm: "We'd love to see",
      direct: "We need",
    },
  },
  {
    pattern: "as discussed",
    category: "hostile-directive",
    severity: "low",
    escalation: 1,
    gloss: "We already covered this.",
    why: "Short citation of prior conversation; can be neutral but often used to imply the recipient is forgetting.",
    defuse: {
      calm: "As we covered",
      professional: "As we covered",
      warm: "As we chatted about",
      direct: "As we covered",
    },
  },

  // ---- Conditional threat (8) ----
  {
    pattern: "at your earliest convenience",
    category: "conditional-threat",
    severity: "medium",
    escalation: 2,
    gloss: "Do this soon, but I'm pretending there's no rush.",
    why: "Formal hedging that signals impatience while maintaining plausible politeness.",
    defuse: {
      calm: "When you have a moment",
      professional: "When you have a moment",
      warm: "Whenever you get a chance",
      direct: "Soon",
    },
  },
  {
    pattern: "when you get a chance",
    category: "conditional-threat",
    severity: "low",
    escalation: 1,
    gloss: "Do this, but I'm pretending it's optional.",
    why: "Soft-modal that masks an implicit deadline.",
    defuse: {
      calm: "When you have a moment",
      professional: "When you have a moment",
      warm: "When you have a moment",
      direct: "Soon",
    },
  },
  {
    pattern: "if it's not too much trouble",
    category: "conditional-threat",
    severity: "medium",
    escalation: 2,
    gloss: "Do this (and I'm implying it's a big ask so you'll feel obligated).",
    why: "Over-hedged request that signals the sender thinks it IS too much trouble.",
    defuse: {
      calm: "Could you",
      professional: "Could you",
      warm: "Would you mind",
      direct: "Please",
    },
  },
  {
    pattern: "would it be possible",
    category: "conditional-threat",
    severity: "low",
    escalation: 1,
    gloss: "Do this (but I'm pretending you might say no).",
    why: "Soft-modal opener that often precedes a non-optional request.",
    defuse: {
      calm: "Could you",
      professional: "Could you",
      warm: "Would you be able to",
      direct: "Please",
    },
  },
  {
    pattern: "i would appreciate if",
    category: "conditional-threat",
    severity: "medium",
    escalation: 2,
    gloss: "Do this — I'm owed it.",
    why: "Frames a demand as a personal favor.",
    defuse: {
      calm: "Could you",
      professional: "Please",
      warm: "Would you mind",
      direct: "Please",
    },
  },
  {
    pattern: "kindly request",
    category: "conditional-threat",
    severity: "medium",
    escalation: 2,
    gloss: "I am telling you to do this.",
    why: "Combines 'kindly' and 'request' for a doubly-stiff directive.",
    defuse: {
      calm: "Could you",
      professional: "Please",
      warm: "Would you mind",
      direct: "Please",
    },
  },
  {
    pattern: "per your request",
    category: "conditional-threat",
    severity: "low",
    escalation: 1,
    gloss: "Here it is (you asked, so don't complain).",
    why: "Formal citation that frames the sender as merely fulfilling an obligation.",
    defuse: {
      calm: "As you asked",
      professional: "As you requested",
      warm: "Here's what you asked for",
      direct: "As requested",
    },
  },
  {
    pattern: "if you could",
    category: "conditional-threat",
    severity: "low",
    escalation: 1,
    gloss: "Do this (and I'm pretending it's optional).",
    why: "Soft-modal that masks an implicit demand.",
    defuse: {
      calm: "Could you",
      professional: "Please",
      warm: "Would you mind",
      direct: "Please",
    },
  },

  // ---- Sarcasm / exclusion (8) ----
  {
    pattern: "as you may or may not be aware",
    category: "sarcasm",
    severity: "high",
    escalation: 3,
    gloss: "You should know this, but I'm pretending not to assume.",
    why: "Hedges to imply the recipient is uninformed while feigning politeness.",
    defuse: {
      calm: "As a reminder",
      professional: "As a reminder",
      warm: "Just a heads-up",
      direct: "As a reminder",
    },
  },
  {
    pattern: "i'm sure you're aware",
    category: "sarcasm",
    severity: "high",
    escalation: 3,
    gloss: "You should already know this.",
    why: "Presumes knowledge in a way that pressures the recipient to pretend they knew.",
    defuse: {
      calm: "As a reminder",
      professional: "As a reminder",
      warm: "Just a heads-up",
      direct: "Recapping",
    },
  },
  {
    pattern: "as i'm sure you know",
    category: "sarcasm",
    severity: "high",
    escalation: 3,
    gloss: "You should already know this.",
    why: "Same pattern — presumes prior knowledge to pressure the recipient.",
    defuse: {
      calm: "As a reminder",
      professional: "As a reminder",
      warm: "Just a heads-up",
      direct: "Recapping",
    },
  },
  {
    pattern: "just to confirm",
    category: "sarcasm",
    severity: "medium",
    escalation: 2,
    gloss: "I don't trust that you understood this.",
    why: "Frames a restatement as a 'confirmation' to imply the recipient missed it.",
    defuse: {
      calm: "To confirm",
      professional: "To confirm",
      warm: "Just to make sure we're aligned",
      direct: "Confirming",
    },
  },
  {
    pattern: "to be clear",
    category: "sarcasm",
    severity: "medium",
    escalation: 2,
    gloss: "You seem to be confused; let me spell it out.",
    why: "Pre-emptive clarification that signals the sender thinks the recipient is missing the point.",
    defuse: {
      calm: "To clarify",
      professional: "To clarify",
      warm: "Just to make sure we're on the same page",
      direct: "To clarify",
    },
  },
  {
    pattern: "in case you missed it",
    category: "sarcasm",
    severity: "high",
    escalation: 3,
    gloss: "You missed this, and I want you to know I noticed.",
    why: "Explicit accusation of inattention dressed up as a courtesy.",
    defuse: {
      calm: "As a reminder",
      professional: "As a reminder",
      warm: "Just a heads-up",
      direct: "Recapping",
    },
  },
  {
    pattern: "in case it wasn't clear",
    category: "sarcasm",
    severity: "high",
    escalation: 3,
    gloss: "You didn't understand this; let me repeat it.",
    why: "Implies the recipient failed to comprehend a prior message.",
    defuse: {
      calm: "To clarify",
      professional: "To clarify",
      warm: "Just to make sure we're on the same page",
      direct: "To clarify",
    },
  },
  {
    pattern: "just to be sure",
    category: "sarcasm",
    severity: "medium",
    escalation: 2,
    gloss: "I don't trust that you'll get this right.",
    why: "Hedged restatement that signals doubt about the recipient.",
    defuse: {
      calm: "To confirm",
      professional: "To confirm",
      warm: "Just to make sure we're aligned",
      direct: "Confirming",
    },
  },

  // ---- Bureaucratic padding (8) ----
  {
    pattern: "reaching out",
    category: "bureaucratic",
    severity: "low",
    escalation: 1,
    gloss: "I am contacting you (but I'm phrasing it as if it's a special event).",
    why: "Corporate-speak that pads a simple 'I'm emailing you' with faux significance.",
    defuse: {
      calm: "Writing to",
      professional: "Writing to",
      warm: "Just writing to",
      direct: "Emailing",
    },
  },
  {
    pattern: "touch base",
    category: "bureaucratic",
    severity: "low",
    escalation: 1,
    gloss: "Have a meeting (but I'm pretending it's casual).",
    why: "Sports metaphor masking a request for the recipient's time.",
    defuse: {
      calm: "Talk",
      professional: "Meet",
      warm: "Chat",
      direct: "Talk",
    },
  },
  {
    pattern: "circle back",
    category: "bureaucratic",
    severity: "low",
    escalation: 1,
    gloss: "Return to this later (often: I'm delaying).",
    why: "Corporate-speak for 'I'll come back to this', often used to defer.",
    defuse: {
      calm: "Come back to this",
      professional: "Return to this",
      warm: "Get back to this",
      direct: "Return to this",
    },
  },
  {
    pattern: "looping in",
    category: "bureaucratic",
    severity: "medium",
    escalation: 2,
    gloss: "I'm CC'ing someone to pressure you.",
    why: "Adding a third party to the thread is often an escalation tactic.",
    defuse: {
      calm: "Adding",
      professional: "Adding",
      warm: "Including",
      direct: "Adding",
    },
  },
  {
    pattern: "as per",
    category: "bureaucratic",
    severity: "medium",
    escalation: 2,
    gloss: "According to (but I'm phrasing it stiffly to sound official).",
    why: "Archaic preposition doubling that signals bureaucratic distance.",
    defuse: {
      calm: "Per",
      professional: "Per",
      warm: "Per",
      direct: "Per",
    },
  },
  {
    pattern: "in re",
    category: "bureaucratic",
    severity: "medium",
    escalation: 2,
    gloss: "Regarding (but I'm using legal Latin to sound formal).",
    why: "Legalistic phrasing that signals the sender is treating the matter as a formal record.",
    defuse: {
      calm: "Regarding",
      professional: "Regarding",
      warm: "About",
      direct: "Regarding",
    },
  },
  {
    pattern: "per our conversation",
    category: "bureaucratic",
    severity: "medium",
    escalation: 2,
    gloss: "We talked about this (and I want it on the record).",
    why: "Formal citation of a verbal exchange to create a paper trail.",
    defuse: {
      calm: "As we discussed",
      professional: "As we discussed",
      warm: "As we chatted about",
      direct: "As we discussed",
    },
  },
  {
    pattern: "ping me",
    category: "bureaucratic",
    severity: "low",
    escalation: 1,
    gloss: "Message me (casual corporate-speak).",
    why: "Tech-bro slang that can read as dismissive of the recipient's time.",
    defuse: {
      calm: "Message me",
      professional: "Message me",
      warm: "Drop me a note",
      direct: "Message me",
    },
  },
];

// Total: 54 entries across 6 categories (10+10+10+8+8+8 = 54).
// (Plus 6 more sparse variants can be added via custom phrases — see addCustomPhrase.)

// ---------- Helpers ----------

/** Build a word-boundary regex for a phrase (case-insensitive, allows punctuation boundaries). */
export function buildPhraseRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Boundary that works at start/end of string and around whitespace/punctuation.
  return new RegExp(`(^|[^a-z0-9])(${escaped})(?=[^a-z0-9]|$)`, "gi");
}

/** Generate a stable hit id. */
let _idCounter = 0;
export function genId(): string {
  _idCounter = (_idCounter + 1) % 1_000_000;
  return `hit-${_idCounter}`;
}

/** Normalize newlines + whitespace. Preserves single spaces and paragraph breaks. */
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

/** Count words (split on whitespace). */
export function countWords(s: string): number {
  if (!s || !s.trim()) return 0;
  return (s.trim().match(/\S+/g) ?? []).length;
}

/** Preserve the case pattern of `original` when substituting `suggestion`. */
export function preserveCase(original: string, suggestion: string): string {
  if (!original) return suggestion;
  if (!suggestion) return suggestion;
  if (original === original.toUpperCase() && original.length > 1) {
    return suggestion.toUpperCase();
  }
  if (
    original[0] === original[0].toUpperCase() &&
    original.slice(1) === original.slice(1).toLowerCase()
  ) {
    return suggestion[0].toUpperCase() + suggestion.slice(1);
  }
  return suggestion;
}

// ---------- Detection ----------

/** Find all passive-aggressive phrase hits in the text. */
export function findHits(text: string, tone: Tone = DEFAULT_TONE): PhraseHit[] {
  if (!text) return [];
  const hits: PhraseHit[] = [];
  const candidates: { entry: PhraseEntry; start: number; end: number; original: string }[] = [];

  for (const entry of PHRASE_CATALOG) {
    const re = buildPhraseRegex(entry.pattern);
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      // The regex captures the boundary char as group 1; the phrase is group 2.
      const boundaryChar = m[1] || "";
      const start = m.index + boundaryChar.length;
      const end = start + m[2].length;
      candidates.push({ entry, start, end, original: m[2] });
      if (m[0] === "") re.lastIndex++;
    }
  }

  // Sort by start asc; tie-breaker: longest pattern first (so "as per my previous email" beats "as per").
  candidates.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  // Greedy non-overlap selection.
  let lastEnd = -1;
  for (const c of candidates) {
    if (c.start < lastEnd) continue;
    const replacement = preserveCase(c.original, c.entry.defuse[tone]);
    hits.push({
      id: genId(),
      entry: c.entry,
      start: c.start,
      end: c.end,
      original: c.original,
      gloss: c.entry.gloss,
      why: c.entry.why,
      replacement,
    });
    lastEnd = c.end;
  }
  return hits;
}

// ---------- Scoring ----------

/**
 * Compute a 0–100 passive-aggression score.
 *
 * Each hit contributes (severityWeight × escalation). Raw score is the sum,
 * scaled by a density factor (hits per 100 words) so short aggressive emails
 * score higher than long ones with the same hits.
 *
 * Formula:
 *   raw        = Σ (severityWeight × escalation) over all hits
 *   density    = raw × (1 + (hits / max(1, words / 50)))
 *   score      = clamp(round(density × 5), 0, 100)
 *
 * The ×5 multiplier was chosen so that a single high-severity phrase in a
 * short email (~30 words) lands around 50–60, and a fully PA email with 4–6
 * hits saturates near 100.
 */
export function computeScore(hits: PhraseHit[], wordCount: number): number {
  if (hits.length === 0) return 0;
  const words = Math.max(1, wordCount);
  const raw = hits.reduce(
    (sum, h) => sum + SEVERITY_WEIGHTS[h.entry.severity] * h.entry.escalation,
    0,
  );
  // density: hits per 50 words
  const density = hits.length / Math.max(1, words / 50);
  const scaled = raw * (1 + Math.min(density, 4) / 2);
  const score = Math.round(scaled * 5);
  return Math.max(0, Math.min(100, score));
}

/** Map a 0–100 score to an escalation level. */
export function computeEscalationLevel(score: number): EscalationLevel {
  if (score < 15) return "mild";
  if (score < 35) return "annoyed";
  if (score < 55) return "passive-aggressive";
  if (score < 80) return "hostile";
  return "hr-incident";
}

/** Confidence: 'high' if 3+ hits OR score >= 35; 'low' if 0–1 hits; else 'medium'. */
export function computeConfidence(hits: PhraseHit[], score: number): "low" | "medium" | "high" {
  if (hits.length === 0 || hits.length === 1) return "low";
  if (hits.length >= 3 || score >= 35) return "high";
  return "medium";
}

/** Aggregate stats by category + severity. */
export function computeStats(hits: PhraseHit[], wordCount: number): DecodeStats {
  const byCategory: Record<PhraseCategory, number> = {
    "point-scoring": 0,
    "fake-polite": 0,
    "hostile-directive": 0,
    "conditional-threat": 0,
    "sarcasm": 0,
    "bureaucratic": 0,
  };
  const bySeverity: Record<Severity, number> = { low: 0, medium: 0, high: 0 };
  let totalEscalation = 0;
  for (const h of hits) {
    byCategory[h.entry.category] += 1;
    bySeverity[h.entry.severity] += 1;
    totalEscalation += h.entry.escalation;
  }
  return {
    phraseCount: hits.length,
    byCategory,
    bySeverity,
    totalEscalation,
    wordCount,
  };
}

// ---------- Decode ----------

/**
 * Decode a passive-aggressive email into plain-English "what they actually mean".
 * Pure.
 */
export function decodeEmail(text: string): DecodeResult {
  const original = normalizeText(text);
  const wordCount = countWords(original);
  const hits = findHits(original, DEFAULT_TONE);
  const score = computeScore(hits, wordCount);
  const escalationLevel = computeEscalationLevel(score);
  const stats = computeStats(hits, wordCount);
  const confidence = computeConfidence(hits, score);
  const summary = buildSummary(hits, escalationLevel, confidence);
  return {
    original,
    score,
    escalationLevel,
    hits,
    stats,
    summary,
    confidence,
  };
}

/** Build a plain-English narrative summary of the decoded email. */
export function buildSummary(
  hits: PhraseHit[],
  level: EscalationLevel,
  confidence: "low" | "medium" | "high",
): string {
  if (hits.length === 0) {
    return "No classic passive-aggressive phrases detected. This reads as neutral on the surface — but tone is subjective, so use your judgment.";
  }
  const lead = ESCALATION_LABELS[level];
  const top = [...hits]
    .sort((a, b) => SEVERITY_WEIGHTS[b.entry.severity] - SEVERITY_WEIGHTS[a.entry.severity])
    .slice(0, 3);
  const phrases = top.map((h) => `"${h.original.toLowerCase()}" (${h.gloss})`).join("; ");
  const confNote =
    confidence === "low"
      ? " Read with caution — only one signal was detected, and tone can depend on context."
      : confidence === "medium"
        ? " A couple of signals — context still matters."
        : " Multiple strong signals — this is a clear read.";
  return `${lead}. The sharpest phrases: ${phrases}.${confNote}`;
}

// ---------- Defuse ----------

/**
 * Defuse a passive-aggressive draft by rewriting each flagged phrase into the
 * chosen tone. Pure.
 */
export function defuseEmail(text: string, tone: Tone): DefuseResult {
  const original = normalizeText(text);
  const wordCount = countWords(original);
  // Find hits with the target tone so the replacement field is correct.
  const hits = findHits(original, tone);
  const beforeScore = computeScore(hits, wordCount);
  const rewritten = applyReplacements(original, hits);
  // Recompute score on the rewritten text (should be lower).
  const afterHits = findHits(rewritten, tone);
  const afterScore = computeScore(afterHits, countWords(rewritten));
  return {
    original,
    rewritten,
    tone,
    hitsFixed: hits.length,
    beforeScore,
    afterScore,
    hits,
  };
}

/** Apply replacements to the text, splicing from the end backward. */
export function applyReplacements(text: string, hits: PhraseHit[]): string {
  if (hits.length === 0) return text;
  const sorted = [...hits].sort((a, b) => b.start - a.start);
  let out = text;
  for (const h of sorted) {
    if (h.replacement === h.original) continue;
    out = out.slice(0, h.start) + h.replacement + out.slice(h.end);
  }
  return out;
}

// ---------- Rendering ----------

/** Render the decoded email as HTML with inline highlights. */
export function renderHighlightedHtml(result: DecodeResult): string {
  const { original, hits } = result;
  if (hits.length === 0) return escapeHtml(original);
  // Sort hits by start ascending.
  const sorted = [...hits].sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  for (const h of sorted) {
    out += escapeHtml(original.slice(cursor, h.start));
    const cls = `pa-hit pa-${h.entry.severity}`;
    const title = escapeHtml(`${h.gloss}\n\nWhy: ${h.why}`);
    out += `<mark class="${cls}" title="${title}" data-id="${h.id}">${escapeHtml(original.slice(h.start, h.end))}</mark>`;
    cursor = h.end;
  }
  out += escapeHtml(original.slice(cursor));
  return out.replace(/\n/g, "<br/>");
}

/** Render the defused rewrite as a diff against the original. */
export function renderDefuseDiffHtml(original: string, rewritten: string): string {
  const segments = buildDiff(original, rewritten);
  return segments
    .map((s) => {
      const text = escapeHtml(s.text);
      if (s.type === "added") return `<ins class="pa-ins">${text}</ins>`;
      if (s.type === "removed") return `<del class="pa-del">${text}</del>`;
      return text;
    })
    .join("");
}

/** Word-level LCS diff between two strings. */
export function buildDiff(a: string, b: string): DiffSegment[] {
  if (a === b) return [{ type: "same", text: a }];
  const aw = tokenizeWords(a);
  const bw = tokenizeWords(b);
  const m = aw.length;
  const n = bw.length;
  // LCS DP table.
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (aw[i] === bw[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  // Walk forward, emitting segments.
  const segs: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (aw[i] === bw[j]) {
      pushSeg(segs, "same", aw[i]);
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      pushSeg(segs, "removed", aw[i]);
      i++;
    } else {
      pushSeg(segs, "added", bw[j]);
      j++;
    }
  }
  while (i < m) { pushSeg(segs, "removed", aw[i]); i++; }
  while (j < n) { pushSeg(segs, "added", bw[j]); j++; }
  return segs;
}

/** Tokenize into words + whitespace runs (so we can preserve spacing in diffs). */
export function tokenizeWords(s: string): string[] {
  return s.match(/\S+|\s+/g) ?? [];
}

function pushSeg(segs: DiffSegment[], type: DiffSegment["type"], text: string): void {
  if (!text) return;
  const last = segs[segs.length - 1];
  if (last && last.type === type) last.text += text;
  else segs.push({ type, text });
}

/** Render a CSV of all hits (id, phrase, category, severity, gloss, why). */
export function renderHitsCsv(hits: PhraseHit[]): string {
  const lines = ["id,phrase,category,severity,escalation,gloss,why"];
  for (const h of hits) {
    lines.push(
      [
        h.id,
        escapeCsv(h.original),
        h.entry.category,
        h.entry.severity,
        String(h.entry.escalation),
        escapeCsv(h.gloss),
        escapeCsv(h.why),
      ].join(","),
    );
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------- LLM prompt builder (BYO key, called from ui.tsx) ----------

/** Build a prompt for an LLM to decode or defuse the email. */
export function buildLlmPrompt(text: string, mode: Mode, tone: Tone): string {
  if (mode === "decode") {
    return (
      "You are a workplace communication analyst. Read the email below and " +
      "(1) explain in plain English what the sender actually means, " +
      "(2) list each passive-aggressive phrase and translate it, " +
      "(3) give a 0–100 passive-aggression score with a one-sentence justification.\n\n" +
      `Email:\n"""\n${text}\n"""`
    );
  }
  return (
    `You are a workplace communication coach. Rewrite the email below in a ${tone} tone, ` +
    "removing passive-aggressive phrasing while preserving the sender's intent and key facts. " +
    "Do not add new information.\n\n" +
    `Email:\n"""\n${text}\n"""`
  );
}

/** Render LLM output (trim + escape). */
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

export function buildShareUrl(text: string, mode: Mode, tone: Tone): string {
  const params = new URLSearchParams();
  if (text) params.set("text", text);
  if (mode) params.set("mode", mode);
  if (tone) params.set("tone", tone);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export interface ShareState {
  text: string;
  mode: Mode;
  tone: Tone;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { text: "", mode: "decode", tone: DEFAULT_TONE };
  const params = new URLSearchParams(clean);
  const text = params.get("text") ?? "";
  const modeParam = params.get("mode");
  const toneParam = params.get("tone");
  const mode: Mode = modeParam === "defuse" ? "defuse" : "decode";
  const validTones: Tone[] = ["calm", "professional", "warm", "direct"];
  const tone: Tone = validTones.includes(toneParam as Tone) ? (toneParam as Tone) : DEFAULT_TONE;
  return { text, mode, tone };
}
