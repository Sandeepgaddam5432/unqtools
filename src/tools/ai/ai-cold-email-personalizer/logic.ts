/**
 * AI Cold Email Personalizer — pure logic.
 *
 * Generate research-grounded cold emails from prospect context the user
 * pastes (no scraping). Build a strong first line, tight body, clear CTA
 * across multiple tones; produce 5+ variations, a follow-up sequence,
 * and a merge-field template. Lint for spam triggers and readability.
 * Pure functions only — no DOM, no network. The optional LLM call
 * (BYO API key) lives in ui.tsx because it touches the network.
 *
 * Honesty: this tool personalizes from *what you provide* — it does not
 * scrape or fabricate details. You must have a lawful basis to email
 * (CAN-SPAM/GDPR), include an opt-out, and personalize from public info.
 */

// ---------- Types ----------

export type Tone = "concise" | "friendly" | "formal";

export interface ProspectInputs {
  /** Recipient first name or handle. */
  name: string;
  /** Recipient company name. */
  company: string;
  /** Industry or vertical the prospect operates in. */
  industry: string;
  /** Prospect role / title (e.g., 'Head of Marketing'). */
  role: string;
  /** Public context you paste: bio, recent post, news, etc. */
  context: string;
  /** Pain points you can solve, in the prospect's words. */
  painPoints: string;
}

export interface SenderInputs {
  /** Your name. */
  name: string;
  /** Your company. */
  company: string;
  /** Your offer / value proposition, one or two sentences. */
  offer: string;
  /** Social proof: a customer, a metric, a result. */
  socialProof: string;
  /** Type of CTA you want. */
  ctaType: CtaType;
}

export type CtaType = "demo" | "call" | "reply" | "resource";

export interface EmailInputs {
  prospect: ProspectInputs;
  sender: SenderInputs;
}

export interface EmailVariation {
  id: string;
  tone: Tone;
  opener: string;
  body: string;
  cta: string;
  fullText: string;
  spamRisk: SpamRisk;
  readability: Readability;
  primary: boolean;
}

export interface SpamRisk {
  level: "low" | "medium" | "high";
  triggers: string[];
  score: number; // 0..100, higher = riskier
}

export interface Readability {
  wordCount: number;
  sentenceCount: number;
  readingTimeSec: number;
  note: "short" | "on-target" | "too-long";
}

export interface FollowUpTouch {
  touch: number; // 1..4
  subject: string;
  body: string;
  cta: string;
  fullText: string;
}

export interface PersonalizerOutput {
  variations: EmailVariation[];
  followUpSequence: FollowUpTouch[];
  mergeFieldTemplate: string;
  warnings: string[];
}

export interface HistoryEntry {
  ts: number;
  prospectName: string;
  prospectCompany: string;
  tone: Tone;
  primaryExcerpt: string;
}

export interface ShareState {
  prospect: Partial<ProspectInputs>;
  sender: Partial<SenderInputs>;
  tone: Tone;
}

export interface LlmEnhancement {
  polishedOpener: string;
  polishedBody: string;
  polishedCta: string;
  polishedFullText: string;
  subjectLines: string[];
  suggestions: string[];
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-cold-email-personalizer:history";
export const HISTORY_MAX = 20;
export const LLM_KEY_STORAGE = "unqtools:ai-cold-email-personalizer:llm-key";

export const TONE_LABELS: Record<Tone, string> = {
  concise: "Concise",
  friendly: "Friendly",
  formal: "Formal",
};

export const CTA_LABELS: Record<CtaType, string> = {
  demo: "Book a demo",
  call: "Quick call",
  reply: "Reply",
  resource: "Send resource",
};

/**
 * Spam-trigger words and phrases. Detected in lowercase; words that are
 * commonly safe in moderation are weighted, but presence still flagged.
 * Sourced from common cold-email deliverability guidance.
 */
export const SPAM_WORDS: string[] = [
  "free", "guarantee", "guaranteed", "risk free", "risk-free",
  "no obligation", "no-obligation", "act now", "act today",
  "limited time", "limited-time", "urgent", "asap",
  "click here", "click below", "click now", "buy now",
  "order now", "subscribe now", "sign up now",
  "winner", "win", "you have been selected", "congratulations",
  "best price", "lowest price", "save money", "save $",
  "earn money", "make money", "income", "profit",
  "discount", "deal", "bargain",
  "100% free", "100 percent free", "all natural", "all-natural",
  "amazing", "incredible", "miracle", "cures",
  "viagra", "cialis", "casino", "lottery",
  "!!!", "$$$", "earn extra cash", "work from home",
  "weight loss", "lose weight", "obligation",
  "credit", "loan", "debt", "investment",
  "buy", "purchase", "cash bonus",
];

/** Inline hint + sample for each input field. */
export const FIELD_HINTS: Record<string, { hint: string; sample: string }> = {
  prospectName: { hint: "First name or handle. Required to greet them.", sample: "Priya" },
  prospectCompany: { hint: "Their company. Used in opener and CTA.", sample: "Northwind Labs" },
  prospectIndustry: { hint: "Their industry or vertical. Helps angle the offer.", sample: "B2B SaaS" },
  prospectRole: { hint: "Their title or role. Helps angle the offer.", sample: "VP of Marketing" },
  prospectContext: {
    hint: "Public context you paste: a bio line, a recent post, news, a launch. The first line of the email is grounded here — not fabricated.",
    sample: "Just published a post on why attribution dashboards break at $10M ARR.",
  },
  prospectPainPoints: {
    hint: "Pain points you can solve, in their words. Becomes the value-prop hook.",
    sample: "Spending 4+ hours/week stitching ad spend data in spreadsheets.",
  },
  senderName: { hint: "Your name.", sample: "Sam Rivera" },
  senderCompany: { hint: "Your company.", sample: "Acme Attribution" },
  senderOffer: {
    hint: "Your offer in one or two sentences. Lead with the outcome.",
    sample: "Acme gives revenue teams a single live source of truth for ad spend and pipeline, no SQL required.",
  },
  senderSocialProof: {
    hint: "A concrete proof point: a customer, a metric, a result.",
    sample: "Helped Loom cut reporting time from 8 hours to 20 minutes/week.",
  },
  senderCtaType: { hint: "Type of ask.", sample: "demo" },
};

// ---------- Validation ----------

/** Validate inputs and return human-readable warnings. */
export function validateInputs(inputs: EmailInputs): string[] {
  const warnings: string[] = [];
  const p = inputs.prospect;
  const s = inputs.sender;
  if (!p.name || !p.name.trim()) warnings.push("Prospect name is required to greet them.");
  if (!p.company || !p.company.trim()) warnings.push("Prospect company is required to ground the opener.");
  if (!p.context || p.context.trim().length < 20) {
    warnings.push("Prospect context is thin — add at least one specific public detail to ground the first line. Don't fake one.");
  }
  if (!p.painPoints || p.painPoints.trim().length < 10) {
    warnings.push("Prospect pain points are thin — name the specific problem you can solve.");
  }
  if (!s.name || !s.name.trim()) warnings.push("Your name is required for the signature.");
  if (!s.company || !s.company.trim()) warnings.push("Your company is required for the signature.");
  if (!s.offer || s.offer.trim().length < 20) {
    warnings.push("Your offer is short — describe the outcome the prospect gets.");
  }
  if (s.offer && /(\b(best|amazing|world-class|game-changing|revolutionary|cutting-edge)\b)/i.test(s.offer)) {
    warnings.push("Your offer contains generic superlatives — replace with a concrete proof point.");
  }
  return warnings;
}

// ---------- Spam / readability linter ----------

/** Escape a string for use in a RegExp. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Detect spam-trigger phrases in text. Returns matched phrases in order of first appearance. */
export function detectSpamWords(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const found: string[] = [];
  const seenRanges: Array<[number, number]> = [];
  const sorted = [...SPAM_WORDS].sort((a, b) => b.length - a.length);
  for (const phrase of sorted) {
    const re = new RegExp(escapeRegex(phrase), "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(lower)) !== null) {
      const start = m.index;
      const end = start + phrase.length;
      // Word-boundary check for alphabetic phrases to avoid partial matches.
      if (/^[a-z]/i.test(phrase) && start > 0 && /[a-z0-9]/i.test(lower[start - 1])) continue;
      if (/^[a-z]/i.test(phrase) && end < lower.length && /[a-z0-9]/i.test(lower[end])) continue;
      const overlaps = seenRanges.some(([rs, re2]) => start < re2 && end > rs);
      if (!overlaps) {
        found.push(phrase);
        seenRanges.push([start, end]);
      }
      re.lastIndex = end;
    }
  }
  return found.sort((a, b) => lower.indexOf(a) - lower.indexOf(b));
}

/** Compute spam risk (0..100) and level from a list of triggers. */
export function computeSpamRisk(text: string): SpamRisk {
  const triggers = detectSpamWords(text);
  const score = Math.min(100, triggers.length * 18);
  const level: SpamRisk["level"] = score >= 50 ? "high" : score >= 24 ? "medium" : "low";
  return { level, triggers, score };
}

/** Count sentences in a text (rough: split on ., !, ?). */
export function countSentences(text: string): number {
  if (!text) return 0;
  const matches = text.match(/[.!?]+/g);
  return matches ? matches.length : 1;
}

/** Count words in a text. */
export function countWords(text: string): number {
  if (!text) return 0;
  return (text.trim().match(/\S+/g) ?? []).length;
}

/** Compute readability metrics for an email body. */
export function computeReadability(text: string): Readability {
  const wordCount = countWords(text);
  const sentenceCount = Math.max(1, countSentences(text));
  const readingTimeSec = Math.round((wordCount / 200) * 60); // ~200 wpm
  let note: Readability["note"] = "on-target";
  if (wordCount < 30) note = "short";
  else if (wordCount > 150) note = "too-long";
  return { wordCount, sentenceCount, readingTimeSec, note };
}

// ---------- Email building blocks ----------

/** Lowercase the first character of a string. */
function lcFirst(s: string): string {
  return s && s.length > 0 ? s[0].toLowerCase() + s.slice(1) : s;
}

/** Pick a short context hook from the prospect's pasted context. */
export function extractContextHook(context: string): string {
  const c = (context || "").trim();
  if (!c) return "";
  // Take the first ~16 words, trim to last full word.
  const words = c.split(/\s+/).slice(0, 16);
  let joined = words.join(" ");
  if (joined.length > 140) joined = joined.slice(0, 137).replace(/\s+\S*$/, "") + "…";
  return joined;
}

/** Build a first-line (opener) grounded in prospect context. */
export function buildOpener(
  prospect: ProspectInputs,
  tone: Tone,
  variant: number,
): string {
  const name = prospect.name || "there";
  const company = prospect.company || "[company]";
  const hook = extractContextHook(prospect.context);
  const hookClause = hook ? ` — "${hook}"` : "";
  const variants: Record<Tone, string[]> = {
    concise: [
      `Hi ${name} — saw your work at ${company}${hookClause}.`,
      `${name}, your recent ${company} update caught my eye${hookClause}.`,
      `Hi ${name}, quick note re: ${company}${hookClause}.`,
    ],
    friendly: [
      `Hey ${name}! Loved what you all are doing at ${company}${hookClause}.`,
      `Hi ${name} — a quick note. I came across your ${company} work${hookClause} and had to reach out.`,
      `Hey ${name}, hope you're well. The ${company} post${hookClause} got me thinking.`,
    ],
    formal: [
      `Hello ${name}, I read your recent ${company} content${hookClause} and wanted to connect.`,
      `Dear ${name}, I am writing regarding your work at ${company}${hookClause}.`,
      `Hi ${name}, I noticed your ${company} announcement${hookClause} and wanted to introduce myself.`,
    ],
  };
  const list = variants[tone];
  return list[variant % list.length];
}

/** Build the value proposition body. */
export function buildBody(
  inputs: EmailInputs,
  tone: Tone,
): string {
  const p = inputs.prospect;
  const s = inputs.sender;
  const pain = p.painPoints || "[pain]";
  const offer = s.offer || "[offer]";
  const proof = s.socialProof ? ` ${s.socialProof}.` : "";
  if (tone === "concise") {
    return `You mentioned ${lcFirst(pain)}. ${offer}.${proof}`;
  }
  if (tone === "friendly") {
    return `Sounds like you're wrestling with ${lcFirst(pain)}. Here's the short version: ${lcFirst(offer)}.${proof ? " " + proof.trim() : ""}`;
  }
  return `You have noted ${lcFirst(pain)}. ${offer}.${proof ? " " + proof.trim() : ""}`;
}

/** Build the CTA line by type and tone. */
export function buildCta(
  inputs: EmailInputs,
  tone: Tone,
): string {
  const name = inputs.prospect.name || "there";
  const company = inputs.prospect.company || "your team";
  const type = inputs.sender.ctaType;
  const leads: Record<Tone, string> = {
    concise: "Worth a 15-min look?",
    friendly: "Want me to walk you through it?",
    formal: "Would a brief call be of interest?",
  };
  switch (type) {
    case "demo":
      return tone === "formal"
        ? `I can show you a 15-minute demo tailored to ${company}. ${leads[tone]}`
        : `Open to a 15-min demo for ${company}? ${leads[tone]}`;
    case "call":
      return tone === "formal"
        ? `I would welcome a brief call to compare notes. ${leads[tone]}`
        : `Up for a quick call this week? ${leads[tone]}`;
    case "reply":
      return tone === "formal"
        ? `If this is of interest, a brief reply would help me tailor next steps.`
        : `Reply with a yes/no and I'll tailor the next step for ${company}.`;
    case "resource":
      return tone === "formal"
        ? `May I send a one-page case study relevant to ${company}?`
        : `Want me to send a 1-page case study for ${company}? ${leads[tone]}`;
    default:
      return leads[tone];
  }
}

/** Build a full email body (opener + body + CTA + signature placeholder). */
export function buildEmailText(
  inputs: EmailInputs,
  tone: Tone,
  openerVariant: number,
): string {
  const opener = buildOpener(inputs.prospect, tone, openerVariant);
  const body = buildBody(inputs, tone);
  const cta = buildCta(inputs, tone);
  const sig = `\n— ${inputs.sender.name || "[you]"}, ${inputs.sender.company || "[your company]"}`;
  const footer = "\n\n[Add your CAN-SPAM/GDPR opt-out footer here]";
  return `${opener}\n\n${body}\n\n${cta}${sig}${footer}`;
}

/** Build the subject line for a tone. */
export function buildSubject(inputs: EmailInputs, tone: Tone): string {
  const name = inputs.prospect.name || "there";
  const company = inputs.prospect.company || "your team";
  if (tone === "concise") return `${company} × ${inputs.sender.company || "[your company]"}`;
  if (tone === "friendly") return `quick idea for ${company}`;
  return `Introduction: ${inputs.sender.company || "[your company]"} × ${company}`;
}

// ---------- Variation generation ----------

/** Generate 5+ email variations across tones and opener variants. */
export function generateVariations(inputs: EmailInputs, primaryTone: Tone): EmailVariation[] {
  const out: EmailVariation[] = [];
  const tones: Tone[] = [primaryTone, ...(["concise", "friendly", "formal"] as Tone[]).filter((t) => t !== primaryTone)];
  let id = 0;
  for (const tone of tones) {
    // 2 opener variants per tone, except primary tone which gets 3 → ensures 5+ total.
    const variants = tone === primaryTone ? 3 : 2;
    for (let v = 0; v < variants; v++) {
      const fullText = buildEmailText(inputs, tone, v);
      const opener = buildOpener(inputs.prospect, tone, v);
      const body = buildBody(inputs, tone);
      const cta = buildCta(inputs, tone);
      const spamRisk = computeSpamRisk(fullText);
      const readability = computeReadability(fullText);
      out.push({
        id: `v${++id}`,
        tone,
        opener,
        body,
        cta,
        fullText,
        spamRisk,
        readability,
        primary: tone === primaryTone && v === 0,
      });
    }
  }
  return out;
}

// ---------- Follow-up sequence ----------

/** Generate a 4-touch follow-up sequence (touch 1 = primary email). */
export function generateFollowUpSequence(inputs: EmailInputs, primaryTone: Tone): FollowUpTouch[] {
  const sender = inputs.sender.name || "[you]";
  const company = inputs.prospect.company || "[company]";
  const first = buildEmailText(inputs, primaryTone, 0);
  const cta1 = buildCta(inputs, primaryTone);
  const touch1: FollowUpTouch = {
    touch: 1,
    subject: buildSubject(inputs, primaryTone),
    body: first,
    cta: cta1,
    fullText: `Subject: ${buildSubject(inputs, primaryTone)}\n\n${first}`,
  };
  const touch2: FollowUpTouch = {
    touch: 2,
    subject: `re: ${buildSubject(inputs, primaryTone)}`,
    body: `Hi ${inputs.prospect.name || "there"},\n\nQuick bump on my last note. Happy to send a 2-minute Loom instead of a call if that's easier.\n\n${sender}`,
    cta: "Want the Loom?",
    fullText: `Subject: re: ${buildSubject(inputs, primaryTone)}\n\nHi ${inputs.prospect.name || "there"},\n\nQuick bump on my last note. Happy to send a 2-minute Loom instead of a call if that's easier.\n\n${sender}`,
  };
  const touch3: FollowUpTouch = {
    touch: 3,
    subject: `different angle for ${company}`,
    body: `Hi ${inputs.prospect.name || "there"},\n\nDifferent angle: ${inputs.sender.offer || "[offer]"}.\n\nIf ${company} is the wrong fit, no worries — let me know and I'll stop.\n\n${sender}`,
    cta: "Worth a look?",
    fullText: `Subject: different angle for ${company}\n\nHi ${inputs.prospect.name || "there"},\n\nDifferent angle: ${inputs.sender.offer || "[offer]"}.\n\nIf ${company} is the wrong fit, no worries — let me know and I'll stop.\n\n${sender}`,
  };
  const touch4: FollowUpTouch = {
    touch: 4,
    subject: `closing the loop`,
    body: `Hi ${inputs.prospect.name || "there"},\n\nI'll assume now isn't the right time and close the loop here. If that changes, my inbox is open.\n\nBest of luck at ${company}.\n${sender}`,
    cta: "(break-up email)",
    fullText: `Subject: closing the loop\n\nHi ${inputs.prospect.name || "there"},\n\nI'll assume now isn't the right time and close the loop here. If that changes, my inbox is open.\n\nBest of luck at ${company}.\n${sender}`,
  };
  return [touch1, touch2, touch3, touch4];
}

// ---------- Merge-field template ----------

/** Build a merge-field template for use with common sending tools. */
export function buildMergeFieldTemplate(inputs: EmailInputs, tone: Tone): string {
  const p = inputs.prospect;
  const s = inputs.sender;
  const opener = buildOpener(p, tone, 0);
  const body = buildBody(inputs, tone);
  const cta = buildCta(inputs, tone);
  return [
    "Subject: {{subject}}",
    "",
    opener
      .replace(p.name || "there", "{{first_name}}")
      .replace(p.company || "[company]", "{{company}}"),
    "",
    body
      .replace(p.company || "[company]", "{{company}}")
      .replace(p.industry || "[industry]", "{{industry}}"),
    "",
    cta.replace(p.company || "[company]", "{{company}}"),
    "",
    "— {{sender_name}}, {{sender_company}}",
    "",
    "{{opt_out_footer}}",
  ].join("\n");
}

// ---------- Top-level generate ----------

/** Generate the full output: variations + follow-up sequence + merge template + warnings. */
export function generate(inputs: EmailInputs, primaryTone: Tone): PersonalizerOutput {
  const warnings = validateInputs(inputs);
  const variations = generateVariations(inputs, primaryTone);
  const followUpSequence = generateFollowUpSequence(inputs, primaryTone);
  const mergeFieldTemplate = buildMergeFieldTemplate(inputs, primaryTone);
  return { variations, followUpSequence, mergeFieldTemplate, warnings };
}

// ---------- Render ----------

/** Render the full output as a Markdown sequence document. */
export function renderMarkdown(output: PersonalizerOutput, inputs: EmailInputs, primaryTone: Tone): string {
  const lines: string[] = [];
  lines.push(`# Cold email sequence — ${inputs.prospect.company || "[company]"}`);
  lines.push("");
  lines.push(`_Generated by UnQTools AI Cold Email Personalizer. Personalization is grounded in context you provided — verify before sending. You must have a lawful basis to email (CAN-SPAM/GDPR) and include an opt-out._`);
  lines.push("");
  lines.push("## Prospect");
  lines.push("");
  lines.push(`- **Name:** ${inputs.prospect.name || "—"}`);
  lines.push(`- **Company:** ${inputs.prospect.company || "—"}`);
  lines.push(`- **Industry:** ${inputs.prospect.industry || "—"}`);
  lines.push(`- **Role:** ${inputs.prospect.role || "—"}`);
  lines.push(`- **Context:** ${inputs.prospect.context || "—"}`);
  lines.push(`- **Pain points:** ${inputs.prospect.painPoints || "—"}`);
  lines.push("");
  lines.push("## Sender");
  lines.push("");
  lines.push(`- **Name:** ${inputs.sender.name || "—"}`);
  lines.push(`- **Company:** ${inputs.sender.company || "—"}`);
  lines.push(`- **Offer:** ${inputs.sender.offer || "—"}`);
  lines.push(`- **Social proof:** ${inputs.sender.socialProof || "—"}`);
  lines.push(`- **Primary tone:** ${TONE_LABELS[primaryTone]}`);
  lines.push("");
  if (output.warnings.length > 0) {
    lines.push("## Warnings");
    lines.push("");
    for (const w of output.warnings) lines.push(`- ${w}`);
    lines.push("");
  }
  lines.push("## Variations");
  lines.push("");
  for (const v of output.variations) {
    lines.push(`### ${v.id} — ${TONE_LABELS[v.tone]}${v.primary ? " (primary)" : ""}`);
    lines.push("");
    lines.push("```");
    lines.push(v.fullText);
    lines.push("```");
    lines.push("");
    lines.push(`_Spam risk: ${v.spamRisk.level} (${v.spamRisk.score}) · ${v.readability.wordCount} words · ${v.readability.sentenceCount} sentences · ${v.readability.note}_`);
    if (v.spamRisk.triggers.length > 0) {
      lines.push("");
      lines.push(`Triggers: ${v.spamRisk.triggers.map((t) => `\`${t}\``).join(", ")}`);
    }
    lines.push("");
  }
  lines.push("## Follow-up sequence");
  lines.push("");
  for (const t of output.followUpSequence) {
    lines.push(`### Touch ${t.touch} — ${t.subject}`);
    lines.push("");
    lines.push("```");
    lines.push(t.fullText);
    lines.push("```");
    lines.push("");
  }
  lines.push("## Merge-field template");
  lines.push("");
  lines.push("```");
  lines.push(output.mergeFieldTemplate);
  lines.push("```");
  return lines.join("\n");
}

/** Render the full output as JSON. */
export function renderJson(output: PersonalizerOutput, inputs: EmailInputs, primaryTone: Tone): string {
  return JSON.stringify({ inputs, primaryTone, output, generatedAt: new Date().toISOString() }, null, 2);
}

/** Render variations as CSV (one row per variation). */
export function renderCsv(output: PersonalizerOutput): string {
  const lines = ["id,tone,primary,word_count,spam_risk,spam_score,triggers,full_text"];
  for (const v of output.variations) {
    lines.push([
      v.id,
      v.tone,
      v.primary ? "yes" : "no",
      String(v.readability.wordCount),
      v.spamRisk.level,
      String(v.spamRisk.score),
      escapeCsv(v.spamRisk.triggers.join("; ")),
      escapeCsv(v.fullText),
    ].join(","));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  // Replace newlines with literal \n so each row stays on one line.
  const cleaned = s.replace(/\n/g, "\\n");
  if (/[",]/.test(cleaned)) return `"${cleaned.replace(/"/g, '""')}"`;
  return cleaned;
}

/** Split a CSV row with quoted values. */
export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      out.push(cur); cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
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

export function buildShareUrl(inputs: EmailInputs, tone: Tone): string {
  const p = inputs.prospect;
  const s = inputs.sender;
  const params = new URLSearchParams();
  if (p.name) params.set("pname", p.name);
  if (p.company) params.set("pco", p.company);
  if (p.industry) params.set("pind", p.industry);
  if (p.role) params.set("prole", p.role);
  if (p.context) params.set("pctx", p.context);
  if (p.painPoints) params.set("ppain", p.painPoints);
  if (s.name) params.set("sname", s.name);
  if (s.company) params.set("sco", s.company);
  if (s.offer) params.set("soff", s.offer);
  if (s.socialProof) params.set("sproof", s.socialProof);
  if (s.ctaType) params.set("scta", s.ctaType);
  if (tone !== "concise") params.set("tone", tone);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  let clean = hash;
  if (clean.startsWith("#") || clean.startsWith("?")) clean = clean.slice(1);
  if (!clean) return { prospect: {}, sender: {}, tone: "concise" };
  const params = new URLSearchParams(clean);
  const prospect: Partial<ProspectInputs> = {};
  if (params.get("pname")) prospect.name = params.get("pname")!;
  if (params.get("pco")) prospect.company = params.get("pco")!;
  if (params.get("pind")) prospect.industry = params.get("pind")!;
  if (params.get("prole")) prospect.role = params.get("prole")!;
  if (params.get("pctx")) prospect.context = params.get("pctx")!;
  if (params.get("ppain")) prospect.painPoints = params.get("ppain")!;
  const sender: Partial<SenderInputs> = {};
  if (params.get("sname")) sender.name = params.get("sname")!;
  if (params.get("sco")) sender.company = params.get("sco")!;
  if (params.get("soff")) sender.offer = params.get("soff")!;
  if (params.get("sproof")) sender.socialProof = params.get("sproof")!;
  const ctaRaw = params.get("scta");
  if (ctaRaw && ["demo", "call", "reply", "resource"].includes(ctaRaw)) {
    sender.ctaType = ctaRaw as CtaType;
  }
  const toneRaw = params.get("tone");
  const tone: Tone = toneRaw === "friendly" || toneRaw === "formal" ? toneRaw : "concise";
  return { prospect, sender, tone };
}

// ---------- Optional LLM enhancement ----------

export function buildLlmPrompt(inputs: EmailInputs, tone: Tone): string {
  const p = inputs.prospect;
  const s = inputs.sender;
  return [
    "You are an expert B2B cold-email copywriter. Polish the inputs below into a single concise cold email plus 3 subject-line options. The email must be grounded only in the provided context — do not fabricate prospect details.",
    "",
    "Prospect:",
    `- Name: ${p.name || "(empty)"}`,
    `- Company: ${p.company || "(empty)"}`,
    `- Industry: ${p.industry || "(empty)"}`,
    `- Role: ${p.role || "(empty)"}`,
    `- Context: ${p.context || "(empty)"}`,
    `- Pain points: ${p.painPoints || "(empty)"}`,
    "",
    "Sender:",
    `- Name: ${s.name || "(empty)"}`,
    `- Company: ${s.company || "(empty)"}`,
    `- Offer: ${s.offer || "(empty)"}`,
    `- Social proof: ${s.socialProof || "(empty)"}`,
    `- CTA type: ${s.ctaType || "demo"}`,
    `- Tone: ${TONE_LABELS[tone]}`,
    "",
    "Constraints: 50–125 words, one CTA, no spam-trigger words (free, guarantee, act now, !!!, etc.), include opt-out footer placeholder.",
    "",
    "Output a JSON object with:",
    '- "polishedOpener": string (1 sentence, grounded in provided context)',
    '- "polishedBody": string (1–2 sentences)',
    '- "polishedCta": string (single ask)',
    '- "polishedFullText": string (full email, with signature and [opt-out footer] placeholder)',
    '- "subjectLines": array of 3 strings',
    '- "suggestions": array of strings (specific improvements the user could make to the inputs)',
    "",
    "Be honest. If the context is thin, say so in suggestions. Do not invent prospect details.",
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
  const result: LlmEnhancement = {
    polishedOpener: typeof o.polishedOpener === "string" ? o.polishedOpener : "",
    polishedBody: typeof o.polishedBody === "string" ? o.polishedBody : "",
    polishedCta: typeof o.polishedCta === "string" ? o.polishedCta : "",
    polishedFullText: typeof o.polishedFullText === "string" ? o.polishedFullText : "",
    subjectLines: Array.isArray(o.subjectLines)
      ? (o.subjectLines as unknown[]).filter((x) => typeof x === "string") as string[]
      : [],
    suggestions: Array.isArray(o.suggestions)
      ? (o.suggestions as unknown[]).filter((x) => typeof x === "string") as string[]
      : [],
  };
  return { ok: true, result };
}
