/**
 * AI CTA Generator — pure logic.
 *
 * Generate high-converting calls-to-action tuned to goal, product, audience,
 * and tone. Pure functions only — no DOM, no network. The optional LLM call
 * (BYO API key) lives in ui.tsx.
 */

// ---------- Types ----------

export type Goal =
  | "signup"
  | "purchase"
  | "trial"
  | "download"
  | "demo"
  | "subscribe"
  | "register"
  | "contact";

export type Tone =
  | "urgent"
  | "friendly"
  | "professional"
  | "playful"
  | "bold"
  | "premium";

export type Angle =
  | "urgency"
  | "curiosity"
  | "benefit"
  | "social-proof"
  | "scarcity"
  | "fomo"
  | "value"
  | "action"
  | "question"
  | "contrast";

export type Placement = "button" | "banner" | "email" | "inline" | "popup";
export type Platform =
  | "google-headline"
  | "google-description"
  | "facebook"
  | "email-subject"
  | "push"
  | "sms"
  | "twitter"
  | "button-micro";

export interface CtaVariant {
  id: string;
  text: string;
  angle: Angle;
  placement: Placement;
  platform: Platform;
  goal: Goal;
  tone: Tone;
  score: number;          // 0-100
  charCount: number;
  charLimit: number | null;
  exceedsLimit: boolean;
  powerWords: string[];
  framework: "AIDA" | "PAS" | "direct";
  rationale: string;
}

export interface AbPair {
  id: string;
  control: CtaVariant;
  challenger: CtaVariant;
  hypothesis: string;
  whatToMeasure: string;
}

export interface AnalysisReport {
  text: string;
  detectedAngles: Angle[];
  powerWords: string[];
  charCount: number;
  score: number;
  suggestions: string[];
}

export interface CtaStats {
  angle: Angle;
  count: number;
  avgScore: number;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-cta:history";
export const HISTORY_MAX = 20;
export const FAVES_KEY = "unqtools:ai-cta:faves";

export const GOAL_LABELS: Record<Goal, string> = {
  signup: "Sign up",
  purchase: "Purchase",
  trial: "Start trial",
  download: "Download",
  demo: "Book demo",
  subscribe: "Subscribe",
  register: "Register",
  contact: "Contact",
};

export const TONE_LABELS: Record<Tone, string> = {
  urgent: "Urgent",
  friendly: "Friendly",
  professional: "Professional",
  playful: "Playful",
  bold: "Bold",
  premium: "Premium",
};

export const ANGLE_LABELS: Record<Angle, string> = {
  urgency: "Urgency",
  curiosity: "Curiosity",
  benefit: "Benefit",
  "social-proof": "Social proof",
  scarcity: "Scarcity",
  fomo: "FOMO",
  value: "Value",
  action: "Direct action",
  question: "Question",
  contrast: "Contrast",
};

export const ANGLE_DESCRIPTIONS: Record<Angle, string> = {
  urgency: "Time pressure — act now or miss out.",
  curiosity: "Spark intrigue — make them want to know more.",
  benefit: "Lead with the outcome the user gets.",
  "social-proof": "Show that others like them already did this.",
  scarcity: "Limited quantity — only a few spots left.",
  fomo: "Fear of missing out on what everyone else is doing.",
  value: "Frame the offer in terms of value (free, save, get).",
  action: "Direct, imperative verb — minimal friction.",
  question: "Engage with a question to prompt reflection.",
  contrast: "Compare before/after or us/them to make the gap visible.",
};

export const PLACEMENT_LABELS: Record<Placement, string> = {
  button: "Button microcopy",
  banner: "Banner",
  email: "Email CTA",
  inline: "Inline link",
  popup: "Popup",
};

export const PLATFORM_LIMITS: Record<Platform, number> = {
  "google-headline": 30,
  "google-description": 90,
  "facebook": 125,
  "email-subject": 50,
  "push": 40,
  "sms": 140,
  "twitter": 280,
  "button-micro": 24,
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  "google-headline": "Google Ads headline (30)",
  "google-description": "Google Ads description (90)",
  "facebook": "Facebook ad (125)",
  "email-subject": "Email subject (50)",
  "push": "Push notification (40)",
  "sms": "SMS (140)",
  "twitter": "Twitter/X (280)",
  "button-micro": "Button microcopy (24)",
};

export const FRAMEWORKS = ["AIDA", "PAS", "direct"] as const;

export const POWER_WORDS: string[] = [
  "free", "now", "today", "instant", "easy", "proven", "guaranteed",
  "exclusive", "limited", "new", "secret", "discover", "boost", "save",
  "win", "love", "instantly", "secure", "trusted", "official", "ultimate",
  "master", "unlock", "transform", "powerful", "fast", "simple", "smart",
  "best", "top", "premium", "expert", "results", "lifetime", "breakthrough",
];

export const PRODUCT_PRESETS: string[] = [
  "project management app",
  "fitness tracking app",
  "online course platform",
  "meal kit delivery service",
  "VPN service",
  "SaaS analytics dashboard",
  "ecommerce store for shoes",
  "weekly newsletter about AI",
  "personal finance app",
  "language learning app",
];

export const AUDIENCE_PRESETS: string[] = [
  "busy parents",
  "small business owners",
  "remote workers",
  "students",
  "freelance designers",
  "startup founders",
  "fitness enthusiasts",
  " retirees",
];

// ---------- Persuasion angle templates ----------

interface AngleTemplate {
  button: (ctx: TemplateContext) => string;
  banner: (ctx: TemplateContext) => string;
  email: (ctx: TemplateContext) => string;
  inline: (ctx: TemplateContext) => string;
  popup: (ctx: TemplateContext) => string;
}

interface TemplateContext {
  goal: Goal;
  product: string;
  audience: string;
  tone: Tone;
  goalVerb: string;       // "Sign up", "Buy", "Try", "Download"
  goalNoun: string;       // "signup", "purchase", "trial"
  audienceNoun: string;   // cleaned audience
  productNoun: string;    // cleaned product
}

const GOAL_VERB: Record<Goal, string> = {
  signup: "Sign up",
  purchase: "Buy",
  trial: "Try",
  download: "Download",
  demo: "Book",
  subscribe: "Subscribe",
  register: "Register",
  contact: "Get in touch",
};

const GOAL_NOUN: Record<Goal, string> = {
  signup: "signup",
  purchase: "purchase",
  trial: "trial",
  download: "download",
  demo: "demo",
  subscribe: "subscription",
  register: "registration",
  contact: "consultation",
};

const ANGLE_TEMPLATES: Record<Angle, AngleTemplate> = {
  urgency: {
    button: (c) => `${c.goalVerb} now`,
    banner: (c) => `Limited time: ${c.goalVerb.toLowerCase()} for ${c.productNoun} today and lock in 50% off.`,
    email: (c) => `${c.goalVerb} for ${c.productNoun} in the next 24 hours — offer ends midnight.`,
    inline: (c) => `Act now — ${c.goalVerb.toLowerCase()} for ${c.productNoun} before this offer disappears.`,
    popup: (c) => `Wait! Get ${c.productNoun} at 50% off — ${c.goalVerb.toLowerCase()} in the next 60 seconds.`,
  },
  curiosity: {
    button: (c) => `See how`,
    banner: (c) => `What if ${c.productNoun} could save ${c.audienceNoun} 10 hours a week? Find out how.`,
    email: (c) => `The one thing ${c.audienceNoun} get wrong about ${c.productNoun} — and how to fix it.`,
    inline: (c) => `Discover the ${c.productNoun} trick ${c.audienceNoun} are talking about.`,
    popup: (c) => `Curious? ${c.goalVerb} to reveal what's behind this.`,
  },
  benefit: {
    button: (c) => `Get more done`,
    banner: (c) => `${c.goalVerb} for ${c.productNoun} and ship work 2× faster — built for ${c.audienceNoun}.`,
    email: (c) => `${c.goalVerb} for ${c.productNoun}: the all-in-one tool ${c.audienceNoun} use to finish work early.`,
    inline: (c) => `${c.goalVerb} for ${c.productNoun} and reclaim your evenings.`,
    popup: (c) => `Ready to ship 2× faster? ${c.goalVerb} for ${c.productNoun} now.`,
  },
  "social-proof": {
    button: (c) => `Join 10,000+ users`,
    banner: (c) => `Trusted by 10,000+ ${c.audienceNoun} — ${c.goalVerb.toLowerCase()} for ${c.productNoun} today.`,
    email: (c) => `See why 10,000+ ${c.audienceNoun} chose ${c.productNoun}. ${c.goalVerb} to join them.`,
    inline: (c) => `10,000+ ${c.audienceNoun} already ${c.goalVerb.toLowerCase() || "use"} ${c.productNoun}.`,
    popup: (c) => `Join 10,000+ happy ${c.audienceNoun} — ${c.goalVerb.toLowerCase()} for ${c.productNoun}.`,
  },
  scarcity: {
    button: (c) => `Claim last spot`,
    banner: (c) => `Only 5 ${c.goalNoun} spots left for ${c.productNoun} — claim yours now.`,
    email: (c) => `Almost gone: only 5 ${c.goalNoun} spots for ${c.productNoun} remain. ${c.goalVerb} now.`,
    inline: (c) => `Hurry — only a few ${c.goalNoun} spots for ${c.productNoun} are left.`,
    popup: (c) => `Wait! Only 5 spots left for ${c.productNoun}. ${c.goalVerb} now.`,
  },
  fomo: {
    button: (c) => `Don't miss out`,
    banner: (c) => `${c.audienceNoun} everywhere are switching to ${c.productNoun}. ${c.goalVerb} before you're left behind.`,
    email: (c) => `Why are ${c.audienceNoun} raving about ${c.productNoun}? ${c.goalVerb} to find out what they see.`,
    inline: (c) => `Everyone's talking about ${c.productNoun}. ${c.goalVerb} to see why.`,
    popup: (c) => `Your friends are already using ${c.productNoun}. ${c.goalVerb} to catch up.`,
  },
  value: {
    button: (c) => `Get it free`,
    banner: (c) => `${c.goalVerb} for ${c.productNoun} free — no credit card, no catch.`,
    email: (c) => `Save $480/year with ${c.productNoun}. ${c.goalVerb} free today.`,
    inline: (c) => `Free for 14 days — ${c.goalVerb.toLowerCase()} for ${c.productNoun} now.`,
    popup: (c) => `Get ${c.productNoun} free for 14 days. ${c.goalVerb} — no card required.`,
  },
  action: {
    button: (c) => `${c.goalVerb}`,
    banner: (c) => `${c.goalVerb} for ${c.productNoun}.`,
    email: (c) => `${c.goalVerb} for ${c.productNoun} — built for ${c.audienceNoun}.`,
    inline: (c) => `${c.goalVerb} for ${c.productNoun}.`,
    popup: (c) => `${c.goalVerb} for ${c.productNoun} now.`,
  },
  question: {
    button: (c) => `Ready?`,
    banner: (c) => `Tired of slow workflows? ${c.goalVerb} for ${c.productNoun} and fix it.`,
    email: (c) => `What if ${c.productNoun} could give ${c.audienceNoun} their evenings back?`,
    inline: (c) => `Ready to try ${c.productNoun}? ${c.goalVerb} to start.`,
    popup: (c) => `Want to ship 2× faster? ${c.goalVerb} for ${c.productNoun}.`,
  },
  contrast: {
    button: (c) => `Switch today`,
    banner: (c) => `Stop wasting hours. ${c.goalVerb} for ${c.productNoun} and get them back.`,
    email: (c) => `Before ${c.productNoun}: chaos. After: clarity. ${c.goalVerb} to see the difference.`,
    inline: (c) => `Old way: 3 hours. With ${c.productNoun}: 30 minutes. ${c.goalVerb}.`,
    popup: (c) => `Without ${c.productNoun}: stuck. With it: shipped. ${c.goalVerb} now.`,
  },
};

// ---------- Utilities ----------

/** Clean and trim a free-text input. */
export function clean(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Lowercase + clean — for keyword matching. */
export function normalizeText(s: string): string {
  return clean(s).toLowerCase();
}

/** Extract the leading noun from a phrase (rough heuristic). */
export function leadNoun(s: string): string {
  const c = clean(s);
  if (!c) return "";
  // Drop common leading adjectives / articles
  const stripped = c.replace(/^(my|our|the|a|an|best|top|new|premium|free)\s+/i, "");
  return stripped || c;
}

function simpleHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0;
  }
  return h;
}

function makeId(parts: string[]): string {
  return `cta-${simpleHash(parts.join("|")).toString(36)}`;
}

// ---------- Power-word detection ----------

/** Detect power words in a CTA string. Returns lowercase matches. */
export function detectPowerWords(text: string): string[] {
  const lower = normalizeText(text);
  const out: string[] = [];
  for (const w of POWER_WORDS) {
    const re = new RegExp(`\\b${w}\\b`, "i");
    if (re.test(lower)) out.push(w);
  }
  return out;
}

// ---------- CTA generation ----------

export interface GenerateOptions {
  goal: Goal;
  product: string;
  audience: string;
  tone: Tone;
  angles?: Angle[];
  placements?: Placement[];
  platform?: Platform;
  max?: number;
}

/** Pick framework for an angle. */
function pickFramework(angle: Angle): "AIDA" | "PAS" | "direct" {
  switch (angle) {
    case "urgency":
    case "scarcity":
    case "fomo":
      return "PAS"; // pain-of-missing-out → action
    case "benefit":
    case "value":
    case "social-proof":
      return "AIDA"; // attention → desire → action
    case "curiosity":
    case "question":
    case "contrast":
      return "AIDA";
    case "action":
      return "direct";
    default:
      return "direct";
  }
}

/** Build rationale for an angle + placement. */
function buildRationale(angle: Angle, placement: Placement, ctx: TemplateContext): string {
  const angleDesc = ANGLE_DESCRIPTIONS[angle];
  const placementHint: Record<Placement, string> = {
    button: "Short imperative — fits inside a button.",
    banner: "One-line headline with supporting context.",
    email: "Subject-line length, opens curiosity gap.",
    inline: "Fits mid-sentence as a link.",
    popup: "Disruptive, time-pressured, single clear action.",
  };
  return `${angleDesc} ${placementHint[placement]}`;
}

/** Apply tone to the CTA text. */
function applyTone(text: string, tone: Tone): string {
  // Friendly: add exclamation if none
  if (tone === "friendly" && !/[!?.]$/.test(text)) return `${text}!`;
  // Bold: uppercase the leading verb
  if (tone === "bold") return text.replace(/^(\w+)/, (m) => m.toUpperCase());
  // Premium: prefix with subtle cue
  if (tone === "premium" && !/^(introducing|discover|experience)/i.test(text)) {
    return `Introducing ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
  }
  // Urgent: append "now" if not present
  if (tone === "urgent" && !/\bnow\b/i.test(text) && !/[.!?]$/.test(text)) {
    return `${text} — now.`;
  }
  // Professional: keep as-is
  if (tone === "professional") return text.replace(/[!]+$/, ".");
  // Playful: add emoji-ish suffix
  if (tone === "playful" && !/[!?.]$/.test(text)) return `${text}!`;
  return text;
}

/**
 * Generate CTA variations. Defaults to all angles × all placements, capped
 * by `max` (default 10).
 */
export function generateCtas(opts: GenerateOptions): CtaVariant[] {
  const product = clean(opts.product) || "our product";
  const audience = clean(opts.audience) || "you";
  const goal = opts.goal;
  const tone = opts.tone;
  const ctx: TemplateContext = {
    goal,
    product,
    audience,
    tone,
    goalVerb: GOAL_VERB[goal],
    goalNoun: GOAL_NOUN[goal],
    audienceNoun: leadNoun(audience),
    productNoun: leadNoun(product),
  };
  const angles = opts.angles && opts.angles.length > 0
    ? opts.angles
    : (Object.keys(ANGLE_LABELS) as Angle[]);
  const placements = opts.placements && opts.placements.length > 0
    ? opts.placements
    : (Object.keys(PLACEMENT_LABELS) as Placement[]);
  const platform = opts.platform ?? "button-micro";
  const max = opts.max ?? 10;
  const out: CtaVariant[] = [];
  for (const angle of angles) {
    const tpl = ANGLE_TEMPLATES[angle];
    for (const placement of placements) {
      const raw = tpl[placement](ctx);
      const text = applyTone(raw, tone);
      const charCount = text.length;
      const charLimit = PLATFORM_LIMITS[platform];
      const exceedsLimit = charCount > charLimit;
      const powerWords = detectPowerWords(text);
      const framework = pickFramework(angle);
      const score = scoreCta({ text, angle, placement, tone, powerWords, charLimit });
      out.push({
        id: makeId([angle, placement, platform, goal, tone, text]),
        text,
        angle,
        placement,
        platform,
        goal,
        tone,
        score,
        charCount,
        charLimit,
        exceedsLimit,
        powerWords,
        framework,
        rationale: buildRationale(angle, placement, ctx),
      });
      if (out.length >= max) return out;
    }
  }
  return out;
}

/** Score a CTA 0-100 based on length, power-words, framework, and tone fit. */
export function scoreCta(opts: {
  text: string;
  angle: Angle;
  placement: Placement;
  tone: Tone;
  powerWords: string[];
  charLimit: number;
}): number {
  let s = 40;
  const len = opts.text.length;
  // Length sweet spot depends on placement
  if (opts.placement === "button") {
    if (len <= 24) s += 15;
    else if (len <= 30) s += 8;
    else s -= 8;
  } else if (opts.placement === "popup") {
    if (len <= 40) s += 12;
    else if (len <= 60) s += 4;
    else s -= 6;
  } else if (opts.placement === "inline") {
    if (len <= 80) s += 10;
    else s -= 4;
  } else {
    if (len >= 30 && len <= 120) s += 10;
    else if (len < 15) s -= 8;
  }
  // Character-limit penalty
  if (opts.charLimit > 0 && len > opts.charLimit) s -= 15;
  // Power words
  s += Math.min(15, opts.powerWords.length * 4);
  // Angle bonuses
  const strongAngles: Angle[] = ["urgency", "scarcity", "social-proof", "benefit", "fomo"];
  if (strongAngles.includes(opts.angle)) s += 5;
  // Tone fit: urgent + urgency angle
  if (opts.tone === "urgent" && (opts.angle === "urgency" || opts.angle === "scarcity")) s += 5;
  if (opts.tone === "premium" && (opts.angle === "value" || opts.angle === "benefit")) s += 5;
  if (opts.tone === "playful" && opts.angle === "question") s += 4;
  // Verb presence bonus
  if (/\b(get|try|start|join|see|discover|save|book|claim|unlock|switch)\b/i.test(opts.text)) s += 4;
  // Cap
  return Math.max(0, Math.min(100, s));
}

// ---------- A/B pair generation ----------

/** Generate an A/B pair from a list of variants. Picks two with different angles. */
export function generateAbPair(variants: CtaVariant[]): AbPair | null {
  if (variants.length < 2) return null;
  // Pick highest-scoring as control, then pick challenger with different angle
  const sorted = [...variants].sort((a, b) => b.score - a.score);
  const control = sorted[0];
  let challenger = sorted.find((v) => v.angle !== control.angle && v.id !== control.id);
  if (!challenger) challenger = sorted[1];
  const hypothesis = `Control uses ${ANGLE_LABELS[control.angle]} framing; challenger tests ${ANGLE_LABELS[challenger.angle]} framing. Hypothesis: ${ANGLE_DESCRIPTIONS[challenger.angle].replace(/\.$/, "")} ${control.placement === challenger.placement ? "with the same placement" : "with different placement"}.`;
  const whatToMeasure = "Click-through rate, conversion rate, and bounce rate. Run for at least 7 days or 1,000 visits for statistical significance.";
  return {
    id: makeId(["ab", control.id, challenger.id]),
    control,
    challenger,
    hypothesis,
    whatToMeasure,
  };
}

/** Generate multiple A/B pairs (rotating through top variants). */
export function generateAbPairs(variants: CtaVariant[], max = 3): AbPair[] {
  if (variants.length < 2) return [];
  const out: AbPair[] = [];
  const used = new Set<string>();
  const sorted = [...variants].sort((a, b) => b.score - a.score);
  for (const control of sorted) {
    if (used.has(control.id)) continue;
    const challenger = sorted.find((v) => v.angle !== control.angle && !used.has(v.id) && v.id !== control.id);
    if (!challenger) continue;
    used.add(control.id);
    used.add(challenger.id);
    out.push(generateAbPair([control, challenger])!);
    if (out.length >= max) break;
  }
  return out;
}

// ---------- Current-CTA analyzer ----------

/** Detect angles used in an existing CTA and give improvement suggestions. */
export function analyzeCta(text: string, goal?: Goal): AnalysisReport {
  const t = clean(text);
  const lower = t.toLowerCase();
  const detected: Angle[] = [];
  if (/\b(now|today|hurry|ends|expires?|deadline|final|last chance)\b/i.test(t)) detected.push("urgency");
  if (/\b(only \d+|just \d+ left|limited|few spots|almost gone)\b/i.test(t)) detected.push("scarcity");
  if (/\b(10,?000|trusted by|join.*users|everyone|millions|community)\b/i.test(t)) detected.push("social-proof");
  if (/\b(free|save|discount|off|value|bonus)\b/i.test(t)) detected.push("value");
  if (/\b(discover|secret|reveal|what if|find out|curious)\b/i.test(t)) detected.push("curiosity");
  if (/\b(don't miss|miss out|left behind|before it's too late)\b/i.test(t)) detected.push("fomo");
  if (/\?\s*$/.test(t) || /\b(what|why|how|ready|wondering)\b/i.test(t)) detected.push("question");
  if (/\b(before|after|without|with|vs\.?|versus|stop|instead)\b/i.test(t)) detected.push("contrast");
  if (/\b(get|save|reclaim|boost|improve|ship|finish)\b/i.test(t)) detected.push("benefit");
  if (detected.length === 0) detected.push("action");

  const powerWords = detectPowerWords(t);
  const charCount = t.length;
  const score = scoreCta({
    text: t,
    angle: detected[0],
    placement: charCount <= 24 ? "button" : charCount <= 80 ? "inline" : "banner",
    tone: /\b(now|today|hurry|ends)\b/i.test(t) ? "urgent" : "professional",
    powerWords,
    charLimit: 999,
  });

  const suggestions: string[] = [];
  if (powerWords.length === 0) suggestions.push("Add a power word (e.g., 'free', 'now', 'proven').");
  if (detected.length === 1 && detected[0] === "action") suggestions.push("Layer in an additional persuasion angle (urgency, benefit, or social proof).");
  if (charCount > 80) suggestions.push("Shorten to fit a button or push notification (< 40 chars).");
  if (charCount < 6) suggestions.push("CTA is very short — add context for clarity.");
  if (!/\b(get|try|start|join|see|discover|save|book|claim|unlock|switch|sign up|download|buy)\b/i.test(t)) {
    suggestions.push("Lead with a strong action verb.");
  }
  if (goal && suggestions.length === 0) {
    suggestions.push(`A/B test against a ${goal} angle variant for ${goal} conversions.`);
  }

  return {
    text: t,
    detectedAngles: detected,
    powerWords,
    charCount,
    score,
    suggestions,
  };
}

// ---------- Stats ----------

export function computeStats(variants: CtaVariant[]): CtaStats[] {
  const byAngle = new Map<Angle, CtaVariant[]>();
  for (const v of variants) {
    if (!byAngle.has(v.angle)) byAngle.set(v.angle, []);
    byAngle.get(v.angle)!.push(v);
  }
  const out: CtaStats[] = [];
  for (const [angle, list] of byAngle) {
    const avg = list.length > 0
      ? Math.round(list.reduce((a, b) => a + b.score, 0) / list.length)
      : 0;
    out.push({ angle, count: list.length, avgScore: avg });
  }
  out.sort((a, b) => b.avgScore - a.avgScore);
  return out;
}

// ---------- Renderers ----------

export function renderText(variants: CtaVariant[]): string {
  return variants.map((v) => {
    const lines = [
      `[${ANGLE_LABELS[v.angle]} · ${PLACEMENT_LABELS[v.placement]} · ${v.framework}] score ${v.score}/100`,
      v.text,
      `(${v.charCount}${v.charLimit ? `/${v.charLimit}` : ""} chars${v.exceedsLimit ? " — EXCEEDS LIMIT" : ""})`,
      v.rationale,
      v.powerWords.length > 0 ? `Power words: ${v.powerWords.join(", ")}` : "",
      "",
    ];
    return lines.filter(Boolean).join("\n");
  }).join("---\n");
}

export function renderMarkdown(variants: CtaVariant[]): string {
  return variants.map((v) => {
    const lines = [
      `### ${v.text}`,
      "",
      `- Angle: **${ANGLE_LABELS[v.angle]}**`,
      `- Placement: ${PLACEMENT_LABELS[v.placement]}`,
      `- Framework: ${v.framework}`,
      `- Score: **${v.score}/100**`,
      `- Length: ${v.charCount}${v.charLimit ? ` / ${v.charLimit}` : ""} chars${v.exceedsLimit ? " (EXCEEDS LIMIT)" : ""}`,
      `- Power words: ${v.powerWords.length > 0 ? v.powerWords.join(", ") : "—"}`,
      `- Rationale: ${v.rationale}`,
      "",
    ];
    return lines.join("\n");
  }).join("---\n\n");
}

export function renderCsv(variants: CtaVariant[]): string {
  const lines = ["text,angle,placement,platform,goal,tone,score,char_count,char_limit,exceeds_limit,power_words,framework"];
  for (const v of variants) {
    lines.push([
      escapeCsv(v.text),
      v.angle,
      v.placement,
      v.platform,
      v.goal,
      v.tone,
      String(v.score),
      String(v.charCount),
      v.charLimit ? String(v.charLimit) : "",
      String(v.exceedsLimit),
      escapeCsv(v.powerWords.join("; ")),
      v.framework,
    ].join(","));
  }
  return lines.join("\n");
}

export function renderJson(variants: CtaVariant[]): string {
  return JSON.stringify(variants, null, 2);
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------- History (localStorage) ----------

export interface HistoryEntry {
  ts: number;
  goal: Goal;
  product: string;
  audience: string;
  tone: Tone;
  variantCount: number;
  avgScore: number;
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

// ---------- Swipe file / favorites (localStorage) ----------

export interface FavoriteEntry {
  id: string;
  ts: number;
  text: string;
  angle: Angle;
  placement: Placement;
  goal: Goal;
  tone: Tone;
  score: number;
}

export function loadFavorites(): FavoriteEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as FavoriteEntry[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveFavorite(entry: FavoriteEntry): FavoriteEntry[] {
  const current = loadFavorites().filter((f) => f.id !== entry.id);
  const next = [entry, ...current].slice(0, 50);
  if (typeof localStorage !== "undefined") {
    try { localStorage.setItem(FAVES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  return next;
}

export function removeFavorite(id: string): FavoriteEntry[] {
  const next = loadFavorites().filter((f) => f.id !== id);
  if (typeof localStorage !== "undefined") {
    try { localStorage.setItem(FAVES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  return next;
}

export function clearFavorites(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(FAVES_KEY); } catch { /* ignore */ }
}

// ---------- Shareable URL ----------

export interface ShareState {
  goal: Goal;
  product: string;
  audience: string;
  tone: Tone;
  platform: Platform;
  currentCta: string;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.goal) params.set("g", state.goal);
  if (state.product) params.set("p", state.product);
  if (state.audience) params.set("a", state.audience);
  if (state.tone) params.set("t", state.tone);
  if (state.platform) params.set("pl", state.platform);
  if (state.currentCta) params.set("cur", state.currentCta);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareState> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareState> = {};
  const g = params.get("g") as Goal | null;
  if (g && g in GOAL_LABELS) out.goal = g;
  const p = params.get("p");
  if (p) out.product = p;
  const a = params.get("a");
  if (a) out.audience = a;
  const t = params.get("t") as Tone | null;
  if (t && t in TONE_LABELS) out.tone = t;
  const pl = params.get("pl") as Platform | null;
  if (pl && pl in PLATFORM_LABELS) out.platform = pl;
  const cur = params.get("cur");
  if (cur) out.currentCta = cur;
  return out;
}

// ---------- LLM prompt builder (optional BYO-key enhancement) ----------

export function buildLlmPrompt(
  goal: Goal,
  product: string,
  audience: string,
  tone: Tone,
  platform: Platform,
): string {
  return [
    "You are an expert direct-response copywriter who writes high-converting calls-to-action.",
    `Goal: ${GOAL_LABELS[goal]} (${goal}).`,
    `Product: ${product}.`,
    `Audience: ${audience}.`,
    `Tone: ${TONE_LABELS[tone]}.`,
    `Platform: ${PLATFORM_LABELS[platform]} (max ${PLATFORM_LIMITS[platform]} chars).`,
    "",
    "Use the AIDA or PAS framework where appropriate. Generate 5-7 CTA variations.",
    "For each, output a JSON object with:",
    '- "text": the CTA copy (must respect the platform character limit)',
    '- "angle": one of urgency | curiosity | benefit | social-proof | scarcity | fomo | value | action | question | contrast',
    '- "framework": AIDA | PAS | direct',
    '- "rationale": one sentence explaining why this works',
    "",
    "Rules:",
    "- Use at least one power word per CTA (free, now, today, proven, exclusive, etc.).",
    "- Vary the angles across the variations.",
    "- Output ONLY a JSON array — no markdown fences, no commentary.",
  ].join("\n");
}

export function renderLlmResult(rawText: string):
  | { ok: true; variants: Array<{ text: string; angle: Angle; framework: "AIDA" | "PAS" | "direct"; rationale: string }> }
  | { ok: false; error: string } {
  let s = (rawText || "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  let arr: unknown;
  try {
    arr = JSON.parse(s);
  } catch {
    return { ok: false, error: "Could not parse LLM output as JSON. Try again or edit manually." };
  }
  if (!Array.isArray(arr)) {
    return { ok: false, error: "LLM output was not a JSON array." };
  }
  const validAngles = new Set(Object.keys(ANGLE_LABELS));
  const out: Array<{ text: string; angle: Angle; framework: "AIDA" | "PAS" | "direct"; rationale: string }> = [];
  for (const item of arr) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const text = typeof o.text === "string" ? o.text : "";
    if (!text) continue;
    const angle = (typeof o.angle === "string" && validAngles.has(o.angle)) ? o.angle as Angle : "action";
    const framework = (o.framework === "AIDA" || o.framework === "PAS" || o.framework === "direct")
      ? o.framework
      : "direct";
    const rationale = typeof o.rationale === "string" ? o.rationale : "";
    out.push({ text, angle, framework, rationale });
  }
  if (out.length === 0) {
    return { ok: false, error: "LLM output contained no valid CTA objects." };
  }
  return { ok: true, variants: out };
}
