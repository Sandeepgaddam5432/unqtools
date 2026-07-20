/**
 * AI Reddit Post Title Optimizer — pure logic.
 *
 * Subreddit-aware, non-clickbait Reddit title generator. Five title formulas
 * (question, story, list, controversy, AMA) applied to a user's draft +
 * target subreddit. Authenticity + clickbait-risk scoring, rule-risk flags,
 * 'why it fits' notes, A/B pair generation, per-subreddit char limits.
 *
 * Pure functions only — no DOM, no network. The optional LLM call (BYO API
 * key) lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type Angle = "question" | "story" | "list" | "controversy" | "ama";

export type RuleRisk = "self-promo" | "editorializing" | "low-effort" | "clickbait" | "all-caps" | "clickbait-punctuation";

export interface SubredditPreset {
  name: string;             // canonical name, e.g. "AskReddit"
  aliases: string[];        // lowercase alternates
  charLimit: number;        // recommended max title length
  preferredAngles: Angle[];
  tone: string;             // one-line tone description
  rules: string[];          // rule reminders
  hotButtons: RuleRisk[];   // risks to flag extra-hard here
}

export interface TitleOption {
  angle: Angle;
  text: string;
  charCount: number;
  charLimit: number;
  overLimit: boolean;
  authenticity: number;          // 0-100
  clickbaitRisk: number;         // 0-100
  ruleRisks: RuleRisk[];
  whyItFits: string;
  score: number;                 // composite
}

export interface OptimizationResult {
  subreddit: string;
  canonicalSubreddit: string;    // matched preset name or "unknown"
  known: boolean;                // was the subreddit found in presets
  draft: string;
  topic: string;                 // extracted core topic
  titles: TitleOption[];
  abPair: [TitleOption, TitleOption] | null;
  rulesReminder: string[];
  generatedAt: number;
}

export interface HistoryEntry {
  ts: number;
  subreddit: string;
  topic: string;
  titleCount: number;
  topScore: number;
  topTitle: string;
}

export interface ShareState {
  draft: string;
  subreddit: string;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-reddit-post-title-optimizer:history";
export const HISTORY_MAX = 20;

export const REDDIT_HARD_CHAR_LIMIT = 300;
export const DEFAULT_CHAR_LIMIT = 120;

export const ANGLE_LABELS: Record<Angle, string> = {
  question: "Question",
  story: "Story",
  list: "List",
  controversy: "Controversy",
  ama: "AMA",
};

export const ANGLE_DESCRIPTIONS: Record<Angle, string> = {
  question: "Open with a question that invites discussion and answers.",
  story: "Lead with a personal anecdote hook in one sentence.",
  list: "Promise a specific number of items, lessons, or examples.",
  controversy: "Politely contrarian take that sparks debate — not flame.",
  ama: "Introduce yourself and invite questions, AMA-style.",
};

export const ALL_ANGLES: Angle[] = ["question", "story", "list", "controversy", "ama"];

export const RULE_RISK_LABELS: Record<RuleRisk, string> = {
  "self-promo": "Self-promotion",
  "editorializing": "Editorializing",
  "low-effort": "Low-effort / vague",
  "clickbait": "Clickbait phrasing",
  "all-caps": "All-caps shouting",
  "clickbait-punctuation": "Excessive punctuation",
};

// Subreddit preset library — popular communities with documented norms.
export const SUBREDDIT_PRESETS: SubredditPreset[] = [
  {
    name: "AskReddit",
    aliases: ["askreddit"],
    charLimit: 200,
    preferredAngles: ["question", "controversy"],
    tone: "Conversational, open-ended, broad appeal.",
    rules: ["Must be a question.", "No personal advice (use r/Advice).", "No yes/no questions."],
    hotButtons: ["low-effort", "clickbait"],
  },
  {
    name: "IAmA",
    aliases: ["iama", "ama"],
    charLimit: 200,
    preferredAngles: ["ama"],
    tone: "Authoritative first-person; verification-eligible.",
    rules: ["Must be an AMA.", "Proof encouraged in comments.", "Title must say who you are."],
    hotButtons: ["self-promo", "low-effort"],
  },
  {
    name: "todayilearned",
    aliases: ["til", "todayilearned"],
    charLimit: 200,
    preferredAngles: ["list", "story"],
    tone: "Factual, sourced, single surprising fact.",
    rules: ["Must start with 'TIL'.", "No personal anecdotes.", "No recent politics (last 2 months)."],
    hotButtons: ["editorializing", "clickbait"],
  },
  {
    name: "science",
    aliases: ["science"],
    charLimit: 200,
    preferredAngles: ["list", "story"],
    tone: "Formal, peer-reviewed, neutral.",
    rules: ["Peer-reviewed research only.", "Title must match the paper.", "No editorializing."],
    hotButtons: ["editorializing", "clickbait"],
  },
  {
    name: "technology",
    aliases: ["technology", "tech"],
    charLimit: 200,
    preferredAngles: ["list", "story"],
    tone: "Industry-savvy, neutral, no flame.",
    rules: ["No editorializing.", "No personal blogs.", "Original sources only."],
    hotButtons: ["editorializing", "clickbait"],
  },
  {
    name: "explainlikeimfive",
    aliases: ["eli5", "explainlikeimfive"],
    charLimit: 200,
    preferredAngles: ["question"],
    tone: "Curious, friendly, jargon-free.",
    rules: ["Must be a question.", "No leading questions.", "No personal situations."],
    hotButtons: ["low-effort", "clickbait"],
  },
  {
    name: "programming",
    aliases: ["programming"],
    charLimit: 200,
    preferredAngles: ["list", "story", "controversy"],
    tone: "Practitioner-focused, technical, no tutorial spam.",
    rules: ["No tutorial spam.", "Original sources only.", "No blog aggregation."],
    hotButtons: ["self-promo", "clickbait"],
  },
  {
    name: "personalfinance",
    aliases: ["personalfinance", "finance", "pf"],
    charLimit: 200,
    preferredAngles: ["question", "list"],
    tone: "Practical, neutral, situation-focused.",
    rules: ["Must include context (age, income, debt).", "No investing hype.", "No market timing."],
    hotButtons: ["self-promo", "clickbait"],
  },
  {
    name: "fitness",
    aliases: ["fitness"],
    charLimit: 200,
    preferredAngles: ["question", "list"],
    tone: "Encouraging, evidence-based, no bro-science.",
    rules: ["Read the wiki first.", "No medical advice.", "No supplement promotion."],
    hotButtons: ["self-promo", "clickbait"],
  },
  {
    name: "relationships",
    aliases: ["relationships", "relationship_advice"],
    charLimit: 200,
    preferredAngles: ["story", "question"],
    tone: "Empathetic, situation-focused, age in title.",
    rules: ["Age + gender + relationship length in title.", "No violence promotion.", "No name-calling."],
    hotButtons: ["low-effort", "clickbait"],
  },
  {
    name: "WritingPrompts",
    aliases: ["writingprompts", "wp"],
    charLimit: 200,
    preferredAngles: ["story"],
    tone: "Creative, hook-driven, evocative.",
    rules: ["Must be a prompt.", "No political/religious prompts.", "No personal situations."],
    hotButtons: ["low-effort"],
  },
  {
    name: "dataisbeautiful",
    aliases: ["dataisbeautiful", "dib"],
    charLimit: 200,
    preferredAngles: ["list", "story"],
    tone: "Data-forward, neutral, source-cited.",
    rules: ["OC encouraged.", "Original source required.", "No editorializing titles."],
    hotButtons: ["editorializing", "clickbait"],
  },
];

// Clickbait phrases / patterns that Redditors downvote.
const CLICKBAIT_PHRASES = [
  "you won't believe", "this will change your life", "mind blowing", "mind-blowing",
  "shocking", "incredible", "unbelievable", "the ultimate", "game changer",
  "game-changer", "jaw dropping", "jaw-dropping", "this is why you", "what happens when",
  "number one", "the truth about", "they don't want you to know", "do this every day",
];

const CLICKBAIT_PUNCT_RE = /[!?]{2,}|!{2,}|\?!\?!?/;

const LOW_EFFORT_PHRASES = [
  "thoughts?", "what do you think", "discuss", "any advice", "help me",
  "is this normal", "am i the only one", "anyone else",
];

const SELF_PROMO_CUES = [
  /\b(my (blog|website|youtube|channel|podcast|course|book|product|startup|app))\b/i,
  /\b(check out|subscribe|follow me|sign up|buy my|download my)\b/i,
  /\b(affiliate|promo code|discount code)\b/i,
];

const EDITORIALIZING_CUES = [
  /\b(shocking|outrageous|disgusting|terrifying|horrifying|insane|crazy|unbelievable|mind-blowing)\b/i,
  /\b(this is (why|how|the reason))\b/i,
  /\b(you (need to|should|must))\b/i,
];

// ---------- Utilities ----------

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function firstSentence(s: string, maxWords = 12): string {
  const words = s.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(" ");
}

/** Strip leading TIL/ELI5/LPT-style tags. */
function stripPrefixTags(s: string): string {
  return s.replace(/^(TIL|ELI5|LPT|PSA|YSK|AMA|CMV|AITA|AITH|WIBTA)[:\s-]*/i, "").trim();
}

/** Normalize whitespace and trim. */
export function normalizeInput(s: string): string {
  return (s || "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

/** Normalize a subreddit string: strip r/, lowercase, trim. */
export function normalizeSubreddit(s: string): string {
  const cleaned = (s || "").trim().replace(/^r\//i, "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  return cleaned;
}

/** Look up a subreddit preset by name or alias. */
export function lookupSubreddit(raw: string): { preset: SubredditPreset | null; canonical: string } {
  const key = normalizeSubreddit(raw);
  if (!key) return { preset: null, canonical: "" };
  for (const p of SUBREDDIT_PRESETS) {
    if (p.aliases.includes(key)) return { preset: p, canonical: p.name };
  }
  return { preset: null, canonical: key };
}

/** Extract a short core topic from the draft. */
export function extractTopic(draft: string): string {
  const text = normalizeInput(draft);
  if (!text) return "";
  const stripped = stripPrefixTags(text);
  // Take the first meaningful sentence, capped.
  const sentence = firstSentence(stripped, 14);
  return sentence.replace(/[.!?]+$/, "").trim() || firstSentence(stripped, 8);
}

/** Pull the leading noun phrase (very rough). */
function leadingNounPhrase(s: string, maxWords = 6): string {
  const words = s.trim().split(/\s+/).filter(Boolean).slice(0, maxWords);
  return words.join(" ");
}

/** Count keywords in the draft (for listicle numbers). */
export function countBullets(draft: string): number {
  const text = normalizeInput(draft);
  const lines = text.split(/\n+/).filter((l) => /^[-*•]\s+/.test(l.trim()) || /^\d+[.)]\s+/.test(l.trim()));
  if (lines.length >= 2) return lines.length;
  // count commas as a soft hint
  const commas = (text.match(/,/g) ?? []).length;
  if (commas >= 2) return Math.min(10, commas + 1);
  return 3; // default
}

// ---------- Clickbait / rule-risk detectors ----------

/** Detect clickbait risk on a 0-100 scale plus matched cues. */
export function detectClickbaitRisk(title: string): { score: number; cues: string[] } {
  const lower = title.toLowerCase();
  const cues: string[] = [];
  for (const phrase of CLICKBAIT_PHRASES) {
    if (lower.includes(phrase)) cues.push(phrase);
  }
  if (CLICKBAIT_PUNCT_RE.test(title)) cues.push("excessive punctuation");
  // ALL CAPS words (>= 4 letters)
  const caps = (title.match(/\b[A-Z]{4,}\b/g) ?? []).filter((w) => w !== "AMA" && w !== "TIL");
  if (caps.length > 0) cues.push(`${caps.length} all-caps word(s)`);

  let score = 0;
  score += cues.length * 22;
  if (CLICKBAIT_PUNCT_RE.test(title)) score += 15;
  if (caps.length >= 2) score += 15;
  // Title length penalty for very short titles with clickbait phrases
  if (title.length < 30 && cues.length > 0) score += 10;
  return { score: clamp(score), cues };
}

/** Detect rule-risk flags from phrasing. */
export function detectRuleRisk(title: string): RuleRisk[] {
  const out: RuleRisk[] = [];
  const lower = title.toLowerCase();

  if (SELF_PROMO_CUES.some((re) => re.test(title))) out.push("self-promo");
  if (EDITORIALIZING_CUES.some((re) => re.test(title))) out.push("editorializing");
  if (LOW_EFFORT_PHRASES.some((p) => lower.includes(p))) out.push("low-effort");
  if (CLICKBAIT_PUNCT_RE.test(title)) out.push("clickbait-punctuation");
  const caps = (title.match(/\b[A-Z]{4,}\b/g) ?? []).filter((w) => w !== "AMA" && w !== "TIL");
  if (caps.length >= 2) out.push("all-caps");
  if (CLICKBAIT_PHRASES.some((p) => lower.includes(p))) out.push("clickbait");

  return Array.from(new Set(out));
}

// ---------- Authenticity scorer ----------

/** Score authenticity 0-100 — higher = more genuine, less marketing. */
export function scoreAuthenticity(title: string): number {
  if (!title.trim()) return 0;
  let score = 60;
  // Length sweet spot 40-180
  if (title.length >= 40 && title.length <= 180) score += 15;
  else if (title.length < 20 || title.length > 250) score -= 15;
  // Has a concrete word (number or proper noun)
  if (/\b\d+\b/.test(title) || /\b[A-Z][a-z]+\b/.test(title)) score += 8;
  // Clickbait penalty
  const cb = detectClickbaitRisk(title).score;
  score -= Math.round(cb * 0.5);
  // Self-promo penalty
  const risks = detectRuleRisk(title);
  if (risks.includes("self-promo")) score -= 35;
  if (risks.includes("all-caps")) score -= 12;
  if (risks.includes("clickbait")) score -= 18;
  // First-person authenticity bonus
  if (/\b(i|i'm|i've|i'll|my|me|we|our)\b/i.test(title)) score += 6;
  // Ends with a question mark for question angle? bonus later.
  return clamp(score);
}

// ---------- Title generators ----------

/** Generate a title for a specific angle. */
export function generateTitle(
  draft: string,
  angle: Angle,
  preset: SubredditPreset | null,
): TitleOption {
  const topic = extractTopic(draft);
  const phrase = leadingNounPhrase(topic, 5);
  const num = countBullets(draft);
  const charLimit = preset?.charLimit ?? DEFAULT_CHAR_LIMIT;
  let text = "";

  switch (angle) {
    case "question": {
      const subject = phrase || topic || "this";
      // Try to phrase a discussion-inviting question.
      text = `Has anyone else tried ${subject}? What worked?`;
      if (text.length > charLimit) text = `What's your take on ${subject}?`;
      break;
    }
    case "story": {
      const hook = topic || "this happened to me";
      text = `I ${hook.replace(/\.$/, "")} — here's what I learned`;
      if (text.length > charLimit) text = `How I dealt with ${phrase || "this"}`;
      break;
    }
    case "list": {
      text = `${num} things I learned about ${phrase || topic || "this"}`;
      if (text.length > charLimit) text = `${num} takeaways on ${phrase || "this"}`;
      break;
    }
    case "controversy": {
      text = `Unpopular opinion: ${topic || "we need to rethink this"}`;
      if (text.length > charLimit) text = `Hot take: ${phrase || "this is overrated"}`;
      break;
    }
    case "ama": {
      text = `I am ${topic || "someone who did this"}, ask me anything`;
      if (text.length > charLimit) text = `AMA: ${phrase || "I did a thing"}`;
      break;
    }
    default:
      text = topic;
  }

  // TIL / ELI5 prefix handling for known subreddits
  if (preset?.name === "todayilearned" && !/^TIL\b/i.test(text)) {
    text = `TIL ${text.replace(/^TIL\s+/i, "")}`;
  }
  if (preset?.name === "explainlikeimfive" && !/^ELI5\b/i.test(text)) {
    text = `ELI5: ${text.replace(/^ELI5:?\s*/i, "")}`;
  }

  return finalizeTitle(text, angle, preset, charLimit);
}

function finalizeTitle(
  text: string,
  angle: Angle,
  preset: SubredditPreset | null,
  charLimit: number,
): TitleOption {
  const charCount = text.length;
  const overLimit = charCount > charLimit;
  const authenticity = scoreAuthenticity(text);
  const cb = detectClickbaitRisk(text);
  let ruleRisks = detectRuleRisk(text);

  // Hot buttons: bump risk weight if preset flags this.
  if (preset) {
    for (const hb of preset.hotButtons) {
      if (!ruleRisks.includes(hb)) {
        // Check if the title would trigger the hot button.
        const lower = text.toLowerCase();
        if (hb === "editorializing" && EDITORIALIZING_CUES.some((re) => re.test(text))) ruleRisks.push("editorializing");
        else if (hb === "clickbait" && (cb.cues.length > 0 || CLICKBAIT_PUNCT_RE.test(text))) ruleRisks.push("clickbait");
        else if (hb === "self-promo" && SELF_PROMO_CUES.some((re) => re.test(text))) ruleRisks.push("self-promo");
        else if (hb === "low-effort" && LOW_EFFORT_PHRASES.some((p) => lower.includes(p))) ruleRisks.push("low-effort");
      }
    }
  }
  ruleRisks = Array.from(new Set(ruleRisks));

  // Composite score: authenticity minus weighted risks minus over-limit penalty.
  let score = authenticity;
  score -= Math.round(cb.score * 0.5);
  score -= ruleRisks.length * 6;
  if (overLimit) score -= 15;

  // Bonus if angle is preferred by the subreddit preset.
  if (preset?.preferredAngles.includes(angle)) score += 8;

  score = clamp(score);

  const whyItFits = buildWhyItFits(angle, preset, ruleRisks, authenticity, overLimit);

  return {
    angle,
    text,
    charCount,
    charLimit,
    overLimit,
    authenticity,
    clickbaitRisk: cb.score,
    ruleRisks,
    whyItFits,
    score,
  };
}

function buildWhyItFits(
  angle: Angle,
  preset: SubredditPreset | null,
  risks: RuleRisk[],
  authenticity: number,
  overLimit: boolean,
): string {
  const parts: string[] = [];
  parts.push(`${ANGLE_DESCRIPTIONS[angle]}`);
  if (preset) {
    if (preset.preferredAngles.includes(angle)) {
      parts.push(`Matches r/${preset.name}'s preferred ${angle} style.`);
    } else {
      parts.push(`r/${preset.name} prefers ${preset.preferredAngles.join("/")}; this works but isn't the community's go-to.`);
    }
  } else {
    parts.push("No subreddit preset matched — general best practice applied.");
  }
  if (risks.length > 0) {
    parts.push(`Flagged: ${risks.map((r) => RULE_RISK_LABELS[r]).join(", ").toLowerCase()}.`);
  } else {
    parts.push("No rule-risk flags.");
  }
  if (overLimit) parts.push("Over the recommended char limit — trim before posting.");
  parts.push(authenticity >= 75 ? "Sounds authentic and human." : authenticity >= 50 ? "Authenticity moderate — review the tone." : "Authenticity low — rephrase to sound less promotional.");
  return parts.join(" ");
}

// ---------- Top-level orchestrator ----------

/** Generate all title options for a draft + subreddit. */
export function optimizeTitles(draft: string, subreddit: string): OptimizationResult {
  const clean = normalizeInput(draft);
  const { preset, canonical } = lookupSubreddit(subreddit);
  const topic = extractTopic(clean);
  const titles: TitleOption[] = ALL_ANGLES.map((a) => generateTitle(clean, a, preset));
  // Sort by score desc
  titles.sort((a, b) => b.score - a.score);

  const abPair = pickABPair(titles);

  const rulesReminder = preset?.rules ?? [
    "Read the subreddit rules before posting.",
    "Avoid clickbait and self-promotion.",
    "Match the community's typical tone.",
  ];

  return {
    subreddit: subreddit.trim(),
    canonicalSubreddit: canonical || subreddit.trim(),
    known: preset !== null,
    draft: clean,
    topic,
    titles,
    abPair,
    rulesReminder,
    generatedAt: Date.now(),
  };
}

/** Pick the best two titles with different angles for an A/B test. */
export function pickABPair(titles: TitleOption[]): [TitleOption, TitleOption] | null {
  if (titles.length < 2) return null;
  const sorted = [...titles].sort((a, b) => b.score - a.score);
  const a = sorted[0];
  // Find the next-highest title with a different angle.
  const b = sorted.find((t) => t.angle !== a.angle);
  if (!b) return null;
  return [a, b];
}

// ---------- Renderers ----------

/** Render the result as plain text (one title per line + score). */
export function renderText(r: OptimizationResult): string {
  const lines: string[] = [];
  lines.push(`# Reddit Title Options for r/${r.canonicalSubreddit}`);
  lines.push(`Topic: ${r.topic || "(empty)"}`);
  lines.push(`Known subreddit: ${r.known ? "yes" : "no"}`);
  lines.push("");
  for (const t of r.titles) {
    lines.push(`[${ANGLE_LABELS[t.angle]}] ${t.score}/100 — ${t.text}`);
    lines.push(`  authenticity ${t.authenticity} · clickbait ${t.clickbaitRisk} · risks ${t.ruleRisks.length}`);
    lines.push(`  ${t.whyItFits}`);
    lines.push("");
  }
  if (r.abPair) {
    lines.push("A/B pair:");
    lines.push(`  A [${ANGLE_LABELS[r.abPair[0].angle]}]: ${r.abPair[0].text}`);
    lines.push(`  B [${ANGLE_LABELS[r.abPair[1].angle]}]: ${r.abPair[1].text}`);
  }
  return lines.join("\n");
}

/** Render the result as Markdown. */
export function renderMarkdown(r: OptimizationResult): string {
  const lines: string[] = [];
  lines.push(`# Reddit Title Options for r/${r.canonicalSubreddit}`);
  lines.push("");
  lines.push(`**Topic:** ${r.topic || "(empty)"}`);
  lines.push(`**Subreddit preset matched:** ${r.known ? "yes" : "no — using generic best practices"}`);
  lines.push("");
  lines.push("| # | Angle | Score | Authenticity | Clickbait | Char | Title |");
  lines.push("|---|---|---|---|---|---|---|");
  r.titles.forEach((t, i) => {
    lines.push(`| ${i + 1} | ${ANGLE_LABELS[t.angle]} | ${t.score} | ${t.authenticity} | ${t.clickbaitRisk} | ${t.charCount}/${t.charLimit} | ${t.text} |`);
  });
  lines.push("");
  if (r.abPair) {
    lines.push("## A/B pair");
    lines.push("");
    lines.push(`**A — ${ANGLE_LABELS[r.abPair[0].angle]}:** ${r.abPair[0].text}`);
    lines.push(`**B — ${ANGLE_LABELS[r.abPair[1].angle]}:** ${r.abPair[1].text}`);
    lines.push("");
  }
  lines.push("## Rule reminders");
  lines.push("");
  for (const rule of r.rulesReminder) lines.push(`- ${rule}`);
  lines.push("");
  return lines.join("\n");
}

/** Render the result as JSON. */
export function renderJson(r: OptimizationResult): string {
  return JSON.stringify(r, null, 2);
}

/** Render only the title strings (one per line) for easy copy. */
export function renderTitlesOnly(r: OptimizationResult): string {
  return r.titles.map((t) => t.text).join("\n");
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

export function buildShareUrl(draft: string, subreddit: string): string {
  const params = new URLSearchParams();
  if (draft) params.set("d", draft);
  if (subreddit) params.set("r", subreddit);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { draft: "", subreddit: "" };
  const params = new URLSearchParams(clean);
  return {
    draft: params.get("d") ?? "",
    subreddit: params.get("r") ?? "",
  };
}

// ---------- Sample drafts ----------

export const SAMPLE_DRAFTS: { label: string; subreddit: string; draft: string }[] = [
  {
    label: "TIL — history fact",
    subreddit: "todayilearned",
    draft: "TIL that during the Apollo 11 mission, the onboard computer had less processing power than a modern calculator, yet it safely landed humans on the Moon.",
  },
  {
    label: "Fitness question",
    subreddit: "fitness",
    draft: "I've been lifting for 6 months and my squat stalled. Eating at maintenance, sleeping 7 hours. What helped you break a squat plateau?",
  },
  {
    label: "Programming discussion",
    subreddit: "programming",
    draft: "After 5 years of using Redux I switched to Zustand and cut my boilerplate by 60%. Sharing the migration patterns that worked.",
  },
  {
    label: "ELI5 question",
    subreddit: "explainlikeimfive",
    draft: "How do credit card chips actually work, and why are they more secure than the magnetic stripe?",
  },
];

// ---------- LLM helpers (UI-only — pure prompt builder) ----------

/** Build the prompt to send to an LLM for richer title generation (BYO key). */
export function buildLlmPrompt(draft: string, subreddit: string): string {
  const preset = lookupSubreddit(subreddit).preset;
  const rules = preset ? preset.rules : ["(no subreddit preset matched — apply Reddit general best practices)"];
  return [
    "You are an expert Reddit strategist.",
    `Generate 5 subreddit-aware, non-clickbait post titles for r/${subreddit || "general"}.`,
    "Use one of these angles per title: question, story, list, controversy, AMA.",
    `Apply the community rules: ${rules.join(" ")}.`,
    `Recommended char limit: ${preset?.charLimit ?? DEFAULT_CHAR_LIMIT}.`,
    "Return ONLY a JSON array of {angle, title} objects — no commentary.",
    "",
    "USER DRAFT:",
    draft,
  ].join("\n");
}

/** Render an LLM-returned JSON array as a list of (angle, title) tuples. */
export function parseLlmResult(llmText: string): { angle: string; title: string }[] {
  try {
    const arr = JSON.parse(llmText);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((it: unknown) => {
        if (typeof it !== "object" || it === null) return null;
        const obj = it as Record<string, unknown>;
        const angle = typeof obj.angle === "string" ? obj.angle : "question";
        const title = typeof obj.title === "string" ? obj.title : "";
        return { angle, title };
      })
      .filter((x): x is { angle: string; title: string } => x !== null && Boolean(x.title));
  } catch {
    return [];
  }
}

// Re-export titleCase for UI/testing convenience.
export { titleCase as _titleCase };
