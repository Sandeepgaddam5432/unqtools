/**
 * AI Cover Letter Writer — pure logic.
 *
 * Draft a JD-tailored cover letter from the user's pasted experience
 * + the target job description. Deterministic JD keyword extraction
 * drives a requirement-to-evidence mapping; sentences are templated
 * from the user's actual experience — never fabricated.
 *
 * Honesty: this is a draft to personalize, not a submit-as-is letter.
 * We never invent credentials. Unmatched JD requirements are flagged
 * in the requirement checklist and the draft avoids claiming them.
 *
 * Pure functions only — no DOM, no network. The optional LLM call
 * (BYO API key) lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type Tone = "formal" | "warm" | "confident";

export type Length = "short" | "standard" | "detailed";

export interface CoverLetterInputs {
  /** Applicant name. */
  name: string;
  /** Applicant email (optional, shown in signature). */
  email?: string;
  /** Applicant phone (optional, shown in signature). */
  phone?: string;
  /** Past experience, skills, achievements — paste anything relevant. */
  experience: string;
  /** Target company name. */
  company: string;
  /** Target role / title. */
  role: string;
  /** Full job description text. */
  jobDescription: string;
}

export interface Requirement {
  /** The keyword or skill phrase extracted from the JD. */
  keyword: string;
  /** True if a match was found in the experience text. */
  matched: boolean;
  /** The snippet of experience text that matched, if any. */
  evidence?: string;
  /** Whether the requirement is addressed in the draft. */
  addressed: boolean;
}

export interface SectionBlock {
  /** Section label, e.g. 'Greeting' or 'Body'. */
  label: string;
  /** Lowercase slug, e.g. 'greeting' or 'body'. */
  slug: string;
  /** Section text. */
  text: string;
}

export interface CoverLetterDraft {
  sections: SectionBlock[];
  fullText: string;
  wordCount: number;
  requirements: Requirement[];
  unmatchedCount: number;
  warnings: string[];
}

export interface ClicheHit {
  /** The cliché phrase detected. */
  phrase: string;
  /** Suggested rewrite. */
  suggestion: string;
  /** Index in the source text where the phrase was found. */
  index: number;
}

export interface HistoryEntry {
  ts: number;
  name: string;
  company: string;
  role: string;
  tone: Tone;
  length: Length;
  matchedCount: number;
  unmatchedCount: number;
}

export interface ShareState {
  inputs: Partial<CoverLetterInputs>;
  tone: Tone;
  length: Length;
}

export interface LlmEnhancement {
  polishedSections: SectionBlock[];
  polishedFullText: string;
  hookVariants: string[];
  suggestions: string[];
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-cover-letter-writer:history";
export const HISTORY_MAX = 20;
export const LLM_KEY_STORAGE = "unqtools:ai-cover-letter-writer:llm-key";

export const TONE_LABELS: Record<Tone, string> = {
  formal: "Formal",
  warm: "Warm",
  confident: "Confident",
};

export const LENGTH_LABELS: Record<Length, string> = {
  short: "Short (~150 words)",
  standard: "Standard (~250 words)",
  detailed: "Detailed (~400 words)",
};

/** Approximate target word count per length preset. */
export const LENGTH_TARGET: Record<Length, number> = {
  short: 150,
  standard: 250,
  detailed: 400,
};

/**
 * Stopwords filtered out of JD keyword extraction. Common English
 * stopwords + application-context filler words.
 */
export const STOPWORDS: ReadonlySet<string> = new Set([
  // English articles / conjunctions / prepositions
  "a", "an", "the", "and", "or", "but", "if", "then", "else", "for",
  "to", "of", "in", "on", "at", "by", "with", "without", "as", "is",
  "are", "be", "been", "being", "was", "were", "am", "do", "does",
  "did", "have", "has", "had", "having", "will", "would", "should",
  "could", "can", "may", "might", "must", "shall", "this", "that",
  "these", "those", "i", "you", "we", "they", "he", "she", "it",
  "your", "our", "their", "his", "her", "its", "my", "me", "us",
  "them", "him", "from", "into", "out", "up", "down", "over", "under",
  "about", "what", "which", "who", "whom", "when", "where", "why",
  "how", "all", "any", "both", "each", "few", "more", "most", "other",
  "some", "such", "no", "nor", "not", "only", "own", "same", "so",
  "than", "too", "very", "just", "also",
  // Cover-letter-context filler words
  "job", "role", "position", "opportunity", "company", "team", "work",
  "working", "candidate", "applicant", "apply", "application", "resume",
  "cv", "cover", "letter", "experience", "experiences", "skill",
  "skills", "year", "years", "ability", "must", "plus", "etc",
  "e.g", "i.e", "include", "including", "includes", "included",
  "looking", "seeking", "join", "help", "helps", "helped",
  "across", "within", "while", "well", "etc.",
  "preferred", "required", "requirements", "responsibilities",
  "qualification", "qualifications",
]);

/** Minimum keyword length (after lowercasing) to be considered. */
export const MIN_KEYWORD_LEN = 3;

/** Maximum number of requirements to extract. */
export const MAX_REQUIREMENTS = 12;

/**
 * Cover-letter clichés and AI-tell phrases the de-cliché pass flags.
 * Each entry is the phrase (case-insensitive, word-boundary) + a
 * suggested rewrite. Sourced from common cover-letter-advice lists.
 */
export const CLICHES: Array<{ phrase: string; suggestion: string }> = [
  { phrase: "i am writing to express my interest", suggestion: "Open with a specific reason you're reaching out — a recent company milestone, a problem you can solve, or a connection." },
  { phrase: "i am writing to apply", suggestion: "Open with a specific reason you're reaching out — a recent company milestone, a problem you can solve, or a connection." },
  { phrase: "please accept my application", suggestion: "Open with a specific reason you're reaching out — a recent company milestone, a problem you can solve, or a connection." },
  { phrase: "i am passionate about", suggestion: "Replace 'passionate about' with a concrete action — what you actually did in the domain." },
  { phrase: "passionate about", suggestion: "Replace 'passionate about' with a concrete action — what you actually did in the domain." },
  { phrase: "team player", suggestion: "Show the teamwork — name a specific cross-functional project and your role in it." },
  { phrase: "think outside the box", suggestion: "Show the creative outcome — what did you ship that wouldn't have existed otherwise?" },
  { phrase: "go above and beyond", suggestion: "Replace with a specific metric or outcome that exceeded expectations." },
  { phrase: "results-driven", suggestion: "Replace with the actual result and the metric that proves it." },
  { phrase: "detail-oriented", suggestion: "Show the detail — a specific catch, fix, or polish that mattered." },
  { phrase: "self-starter", suggestion: "Show the initiative — a project you started and the outcome." },
  { phrase: "perfect fit", suggestion: "Avoid 'perfect fit' — name two specific requirements from the JD and how you meet them." },
  { phrase: "excellent communication skills", suggestion: "Show the communication — a presentation, doc, or alignment you drove." },
  { phrase: "strong work ethic", suggestion: "Replace with a specific instance of going the extra mile." },
  { phrase: "fast-paced environment", suggestion: "Name the environment and what you shipped under the timeline." },
  { phrase: "hit the ground running", suggestion: "Show the comparable ramp you've done before." },
  { phrase: "i believe i would be a great addition", suggestion: "Make the case in two specifics — what you bring, what you'd do first." },
  { phrase: "i would welcome the opportunity", suggestion: "Replace with a specific question or a concrete next step you'd take." },
  { phrase: "thank you for your consideration", suggestion: "Close with a forward-looking line — what you'd do in the first 30 days, or a specific question." },
  { phrase: "thank you in advance", suggestion: "Close with a forward-looking line — what you'd do in the first 30 days, or a specific question." },
  { phrase: "i am excited to apply", suggestion: "Open with a specific reason — what about the company or role is genuinely interesting to you?" },
  { phrase: "leveraging my", suggestion: "Replace 'leveraging' with the concrete action — what you did with the skill." },
  { phrase: "leverage my", suggestion: "Replace 'leverage' with the concrete action — what you did with the skill." },
  { phrase: "with my background in", suggestion: "Show the background — name the most relevant project and the outcome." },
  { phrase: "proven track record", suggestion: "Show the track record — name the metric and the timeframe." },
  { phrase: "extensive experience", suggestion: "Quantify — how many years, in what domain, with what outcome?" },
  { phrase: "in today's fast-paced", suggestion: "Cut the throat-clearing — open with the specific reason you're reaching out." },
  { phrase: "dynamic environment", suggestion: "Name the environment and what you shipped in it." },
  { phrase: "i am confident that", suggestion: "Make the case directly — what specifically can you do?" },
  { phrase: "i would be honored", suggestion: "Cut the deference — make the case for what you'd do." },
  { phrase: "as a highly motivated", suggestion: "Show the motivation — a specific initiative you took." },
  { phrase: "i am writing to express my", suggestion: "Open with a specific reason — a recent company milestone, a problem you can solve, or a connection." },
];

// ---------- Helpers ----------

/** Escape a string for use in a RegExp. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Lowercase the first character of a string. */
function lcFirst(s: string): string {
  return s && s.length > 0 ? s[0].toLowerCase() + s.slice(1) : s;
}

/** Capitalize the first character of a string. */
function capFirst(s: string): string {
  return s && s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Count words in a text. */
export function countWords(text: string): number {
  if (!text) return 0;
  return (text.trim().match(/\S+/g) ?? []).length;
}

// ---------- JD keyword extraction ----------

/** Tokenize a string into lowercased word tokens (alphanumeric). */
export function tokenize(text: string): string[] {
  if (!text) return [];
  return (text.toLowerCase().match(/[a-z0-9+#.]+/g) ?? []);
}

/**
 * Extract keywords from the JD by tokenizing, dropping stopwords and
 * short tokens, counting frequencies, and returning the top N.
 * Deterministic — same input always returns same output.
 */
export function extractKeywords(jd: string, max: number = MAX_REQUIREMENTS): string[] {
  const tokens = tokenize(jd);
  const freq = new Map<string, number>();
  for (const t of tokens) {
    if (t.length < MIN_KEYWORD_LEN) continue;
    if (STOPWORDS.has(t)) continue;
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  // Sort by frequency desc, then alphabetically for stable order.
  const sorted = [...freq.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  return sorted.slice(0, max).map(([w]) => w);
}

/**
 * Map JD keywords to evidence in the user's experience text.
 * Match is case-insensitive, word-boundary on the keyword.
 */
export function mapRequirements(jd: string, experience: string): Requirement[] {
  const keywords = extractKeywords(jd);
  const expLower = (experience || "").toLowerCase();
  return keywords.map((keyword) => {
    const re = new RegExp(`\\b${escapeRegex(keyword)}\\b`, "i");
    const m = re.exec(experience || "");
    if (m) {
      // Extract a ~12-word window around the match as evidence.
      const start = Math.max(0, m.index - 40);
      const end = Math.min((experience || "").length, m.index + keyword.length + 60);
      let snippet = (experience || "").slice(start, end).trim();
      if (start > 0) snippet = `…${snippet}`;
      if (end < (experience || "").length) snippet = `${snippet}…`;
      return { keyword, matched: true, evidence: snippet, addressed: false };
    }
    // Even without evidence, mark as addressed=false initially.
    return { keyword, matched: false, addressed: false };
  });
}

// ---------- Draft building ----------

/** Build the greeting section. */
export function buildGreeting(inputs: CoverLetterInputs, tone: Tone): string {
  const company = inputs.company || "[Company]";
  if (tone === "formal") return `Dear Hiring Manager at ${company},`;
  if (tone === "warm") return `Hello ${company} team,`;
  return `Hi ${company} hiring team,`;
}

/** Build the opening hook — three tone-flavored variants. */
export function buildHook(inputs: CoverLetterInputs, tone: Tone, variant: number): string {
  const role = inputs.role || "[role]";
  const company = inputs.company || "[company]";
  const name = inputs.name || "[your name]";
  const variants: Record<Tone, string[]> = {
    formal: [
      `I am submitting my application for the ${role} position at ${company}. My background aligns with the role's core requirements, and I would welcome the chance to discuss how I can contribute.`,
      `I would like to be considered for the ${role} role at ${company}. My experience maps closely to the qualifications listed, and I am eager to discuss the fit in detail.`,
      `I am applying for the ${role} opening at ${company}. After reviewing the role, I see a clear match between its requirements and my background.`,
    ],
    warm: [
      `The ${role} role at ${company} caught my eye — the requirements line up closely with work I've already done, and I'd love the chance to talk through how I could help.`,
      `I came across the ${role} opening at ${company} and immediately saw the overlap with my background. I'd welcome a conversation about how I could contribute.`,
      `Reading the ${role} description at ${company}, I kept nodding — the requirements match work I've shipped before. I'd love to explore the fit.`,
    ],
    confident: [
      `I'm applying for the ${role} role at ${company}. The requirements read like a description of work I've already done, and I'm ready to bring that experience to your team.`,
      `The ${role} role at ${company} is a strong match for my background — I've done the work the JD describes, and I can show the receipts. I'd like to be considered.`,
      `I'm reaching out about the ${role} position at ${company}. The requirements map directly to my experience; I'd welcome the chance to make the case in person.`,
    ],
  };
  const list = variants[tone];
  return list[variant % list.length];
}

/**
 * Build the body section. The body addresses matched requirements
 * in the user's words; unmatched requirements are NOT claimed.
 * Length controls how many matched requirements are addressed and
 * how long each sentence is.
 */
export function buildBody(
  inputs: CoverLetterInputs,
  requirements: Requirement[],
  tone: Tone,
  length: Length,
): string {
  const matched = requirements.filter((r) => r.matched);
  if (matched.length === 0) {
    // No evidence — be honest about it.
    return `My background includes work that I believe is relevant to the ${inputs.role || "[role]"} role, and I would welcome the chance to walk through it with you in detail rather than list it here. I have reviewed the job description and see a strong alignment I'd like to discuss.`;
  }
  // Determine how many requirements to address.
  const limit = length === "short" ? 3 : length === "standard" ? 5 : Math.min(8, matched.length);
  const chosen = matched.slice(0, limit);
  const sentences: string[] = [];
  for (const r of chosen) {
    const lead: Record<Tone, string> = {
      formal: `My experience includes work involving ${r.keyword}`,
      warm: `I've worked with ${r.keyword} before`,
      confident: `I've shipped work involving ${r.keyword}`,
    };
    let sentence: string;
    if (r.evidence) {
      sentence = `${lead[tone]} — ${lcFirst(r.evidence.replace(/^…|…$/g, "").trim())}.`;
    } else {
      sentence = `${lead[tone]}.`;
    }
    // Clean up double periods and stray ellipses inside the sentence.
    sentence = sentence.replace(/\.{2,}/g, ".").replace(/\s+\./g, ".");
    sentences.push(sentence);
  }
  let body = sentences.join(" ");
  if (length === "detailed") {
    body += ` I am also comfortable picking up adjacent skills quickly; I would be glad to share specific examples in a conversation.`;
  }
  return body;
}

/** Build the closing section. */
export function buildClosing(inputs: CoverLetterInputs, tone: Tone): string {
  const company = inputs.company || "[company]";
  const role = inputs.role || "[role]";
  if (tone === "formal") {
    return `I would welcome the opportunity to discuss how my background could contribute to ${company}'s goals for the ${role} role. Thank you for considering my application.`;
  }
  if (tone === "warm") {
    return `I'd love to chat about how my background could help ${company} with the ${role} role. Thanks for taking the time to read this — I appreciate it.`;
  }
  return `I'd welcome a conversation about how my background maps to the ${role} role at ${company}. I'm confident I can contribute from week one and I'd be glad to make that case in person.`;
}

/** Build the signature block. */
export function buildSignature(inputs: CoverLetterInputs): string {
  const name = inputs.name || "[your name]";
  const lines = [name];
  if (inputs.email) lines.push(inputs.email);
  if (inputs.phone) lines.push(inputs.phone);
  return lines.join("\n");
}

// ---------- Top-level draft generation ----------

/**
 * Generate the full cover-letter draft. The intro uses hook variant 0
 * by default; the body addresses matched requirements only; the
 * closing is tone-aware. Each requirement's `addressed` flag is set
 * to true when the keyword appears in the body text.
 */
export function generateDraft(
  inputs: CoverLetterInputs,
  tone: Tone,
  length: Length,
): CoverLetterDraft {
  const warnings: string[] = [];
  if (!inputs.name || !inputs.name.trim()) warnings.push("Your name is required for the signature.");
  if (!inputs.experience || inputs.experience.trim().length < 30) {
    warnings.push("Experience is thin — paste at least a few sentences so the tool can map your skills to the JD.");
  }
  if (!inputs.company || !inputs.company.trim()) warnings.push("Company name is required for the greeting.");
  if (!inputs.role || !inputs.role.trim()) warnings.push("Role / title is required.");
  if (!inputs.jobDescription || inputs.jobDescription.trim().length < 50) {
    warnings.push("Job description is thin — paste the full JD so the requirement extractor has something to work with.");
  }

  const requirements = mapRequirements(inputs.jobDescription || "", inputs.experience || "");
  const unmatchedCount = requirements.filter((r) => !r.matched).length;
  if (requirements.length === 0) {
    warnings.push("No requirements were extracted from the JD — paste a fuller job description.");
  } else if (unmatchedCount === requirements.length) {
    warnings.push("None of the extracted requirements matched your experience — paste more relevant experience or check the JD text.");
  }

  const greeting = buildGreeting(inputs, tone);
  const hook = buildHook(inputs, tone, 0);
  const body = buildBody(inputs, requirements, tone, length);
  const closing = buildClosing(inputs, tone);
  const signature = buildSignature(inputs);

  // Mark each matched requirement as addressed if its keyword appears in body (case-insensitive).
  const bodyLower = body.toLowerCase();
  for (const r of requirements) {
    if (r.matched) {
      r.addressed = bodyLower.includes(r.keyword.toLowerCase());
    }
  }

  const sections: SectionBlock[] = [
    { label: "Greeting", slug: "greeting", text: greeting },
    { label: "Opening", slug: "opening", text: hook },
    { label: "Body", slug: "body", text: body },
    { label: "Closing", slug: "closing", text: closing },
    { label: "Signature", slug: "signature", text: signature },
  ];

  const fullText = [greeting, "", hook, "", body, "", closing, "", signature].join("\n");
  return {
    sections,
    fullText,
    wordCount: countWords(fullText),
    requirements,
    unmatchedCount,
    warnings,
  };
}

/** Regenerate just the hook with a different variant. */
export function regenerateHook(
  draft: CoverLetterDraft,
  inputs: CoverLetterInputs,
  tone: Tone,
  variant: number,
): CoverLetterDraft {
  const hook = buildHook(inputs, tone, variant);
  const sections = draft.sections.map((s) =>
    s.slug === "opening" ? { ...s, text: hook } : s,
  );
  const fullText = sections.map((s) => s.text).join("\n\n");
  return { ...draft, sections, fullText, wordCount: countWords(fullText) };
}

// ---------- De-cliché pass ----------

/**
 * Scan the draft for cliché phrases. Returns one ClicheHit per
 * occurrence (case-insensitive, but only the first occurrence of
 * each phrase is reported to keep the UI clean).
 */
export function detectCliches(text: string): ClicheHit[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const hits: ClicheHit[] = [];
  const seen = new Set<string>();
  for (const c of CLICHES) {
    const idx = lower.indexOf(c.phrase);
    if (idx >= 0 && !seen.has(c.phrase)) {
      hits.push({ phrase: c.phrase, suggestion: c.suggestion, index: idx });
      seen.add(c.phrase);
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

/**
 * Apply all cliché suggestions by replacing each flagged phrase with
 * a rewrite placeholder. The `ClicheHit.suggestion` text is advice for
 * the user (shown in the UI) — it is NOT used as the replacement
 * because many suggestions reference the cliché phrase itself
 * (e.g., "Replace 'passionate about' with a concrete action…").
 *
 * The placeholder `[your specific example]` signals to the user where
 * they need to rewrite. The accompanying UI panel shows the per-phrase
 * advice so the user knows what kind of rewrite to write.
 */
export function applyClicheSuggestions(text: string, hits: ClicheHit[]): string {
  if (hits.length === 0) return text;
  // Replace from end to start so indices don't shift.
  const sorted = [...hits].sort((a, b) => b.index - a.index);
  let out = text;
  for (const h of sorted) {
    const before = out.slice(0, h.index);
    const after = out.slice(h.index);
    const re = new RegExp(escapeRegex(h.phrase), "i");
    out = before + after.replace(re, "[your specific example]");
  }
  return out;
}

// ---------- Markdown / JSON ----------

/** Render the draft as a Markdown document. */
export function renderMarkdown(draft: CoverLetterDraft, inputs: CoverLetterInputs, tone: Tone, length: Length): string {
  const lines: string[] = [];
  lines.push(`# Cover letter — ${inputs.name || "[your name]"} → ${inputs.company || "[company]"} · ${inputs.role || "[role]"}`);
  lines.push("");
  lines.push("_Generated by UnQTools AI Cover Letter Writer. This is a draft to personalize — verify every claim before sending. We never invent credentials._");
  lines.push("");
  lines.push(`**Tone:** ${TONE_LABELS[tone]} · **Length:** ${LENGTH_LABELS[length]} · **Words:** ${draft.wordCount}`);
  lines.push("");
  if (draft.warnings.length > 0) {
    lines.push("## Warnings");
    lines.push("");
    for (const w of draft.warnings) lines.push(`- ${w}`);
    lines.push("");
  }
  if (draft.requirements.length > 0) {
    lines.push("## Requirement checklist");
    lines.push("");
    for (const r of draft.requirements) {
      const mark = r.matched ? "x" : " ";
      lines.push(`- [${mark}] \`${r.keyword}\`${r.evidence ? ` — ${r.evidence}` : " — unmatched"}`);
    }
    lines.push("");
  }
  lines.push("## Draft");
  lines.push("");
  lines.push("```");
  lines.push(draft.fullText);
  lines.push("```");
  return lines.join("\n");
}

/** Render the draft as JSON. */
export function renderJson(draft: CoverLetterDraft, inputs: CoverLetterInputs, tone: Tone, length: Length): string {
  return JSON.stringify({
    inputs,
    tone,
    length,
    draft,
    generatedAt: new Date().toISOString(),
  }, null, 2);
}

/** Render the requirements list as CSV. */
export function renderRequirementsCsv(draft: CoverLetterDraft): string {
  const lines = ["keyword,matched,addressed,evidence"];
  for (const r of draft.requirements) {
    lines.push([
      escapeCsv(r.keyword),
      r.matched ? "yes" : "no",
      r.addressed ? "yes" : "no",
      escapeCsv(r.evidence ?? ""),
    ].join(","));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  const cleaned = s.replace(/\n/g, " ");
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

export function buildShareUrl(inputs: CoverLetterInputs, tone: Tone, length: Length): string {
  const params = new URLSearchParams();
  if (inputs.name) params.set("n", inputs.name);
  if (inputs.email) params.set("e", inputs.email);
  if (inputs.phone) params.set("ph", inputs.phone);
  if (inputs.experience) params.set("x", inputs.experience);
  if (inputs.company) params.set("co", inputs.company);
  if (inputs.role) params.set("r", inputs.role);
  if (inputs.jobDescription) params.set("jd", inputs.jobDescription);
  if (tone !== "formal") params.set("t", tone);
  if (length !== "standard") params.set("l", length);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  let clean = hash;
  if (clean.startsWith("#") || clean.startsWith("?")) clean = clean.slice(1);
  if (!clean) {
    return { inputs: {}, tone: "formal", length: "standard" };
  }
  const params = new URLSearchParams(clean);
  const inputs: Partial<CoverLetterInputs> = {};
  if (params.get("n")) inputs.name = params.get("n")!;
  if (params.get("e")) inputs.email = params.get("e")!;
  if (params.get("ph")) inputs.phone = params.get("ph")!;
  if (params.get("x")) inputs.experience = params.get("x")!;
  if (params.get("co")) inputs.company = params.get("co")!;
  if (params.get("r")) inputs.role = params.get("r")!;
  if (params.get("jd")) inputs.jobDescription = params.get("jd")!;
  const tRaw = params.get("t");
  const tone: Tone = ["formal", "warm", "confident"].includes(tRaw ?? "")
    ? (tRaw as Tone)
    : "formal";
  const lRaw = params.get("l");
  const length: Length = ["short", "standard", "detailed"].includes(lRaw ?? "")
    ? (lRaw as Length)
    : "standard";
  return { inputs, tone, length };
}

// ---------- Optional LLM enhancement ----------

export function buildLlmPrompt(inputs: CoverLetterInputs, tone: Tone, length: Length): string {
  return [
    "You are an expert cover-letter editor. Polish the inputs below into a single cover letter tailored to the job description, in the named tone and length.",
    "",
    "Tone: " + TONE_LABELS[tone],
    "Length target: " + LENGTH_TARGET[length] + " words",
    "",
    "Applicant:",
    `- Name: ${inputs.name || "(empty)"}`,
    `- Email: ${inputs.email || "(empty)"}`,
    `- Phone: ${inputs.phone || "(empty)"}`,
    `- Experience: ${inputs.experience || "(empty)"}`,
    "",
    "Target:",
    `- Company: ${inputs.company || "(empty)"}`,
    `- Role: ${inputs.role || "(empty)"}`,
    `- Job description: ${inputs.jobDescription || "(empty)"}`,
    "",
    "Constraints: do NOT invent credentials, employers, metrics, or dates that are not in the experience text. If a JD requirement has no matching evidence, do not claim it. Avoid cover-letter clichés ('I am writing to express my interest', 'passionate about', 'team player', 'perfect fit', etc.). Structure as Greeting, Opening, Body, Closing, Signature.",
    "",
    'Output a JSON object with:',
    '- "polishedSections": array of { label, slug, text } — one per section (greeting, opening, body, closing, signature)',
    '- "polishedFullText": string — the full letter with blank lines between sections',
    '- "hookVariants": array of 3 strings — alternate opening lines',
    '- "suggestions": array of strings — specific improvements the user could make to the inputs',
    "",
    "Be honest. If the experience is thin, say so in suggestions. Do not fabricate.",
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
  const validSlugs = new Set(["greeting", "opening", "body", "closing", "signature"]);
  const sectionsRaw = Array.isArray(o.polishedSections) ? (o.polishedSections as unknown[]) : [];
  const polishedSections: SectionBlock[] = sectionsRaw
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .map((x) => ({
      label: typeof x.label === "string" ? x.label : "",
      slug: typeof x.slug === "string" && validSlugs.has(x.slug) ? x.slug : "",
      text: typeof x.text === "string" ? x.text : "",
    }))
    .filter((s2) => s2.label || s2.text);
  const polishedFullText = typeof o.polishedFullText === "string" ? o.polishedFullText : "";
  const hookVariants = Array.isArray(o.hookVariants)
    ? (o.hookVariants as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  const suggestions = Array.isArray(o.suggestions)
    ? (o.suggestions as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  return {
    ok: true,
    result: { polishedSections, polishedFullText, hookVariants, suggestions },
  };
}

// ---------- Misc utilities exported for tests/UI ----------

/** Sentence-case a label (used by UI section headers). */
export function titleCaseLabel(slug: string): string {
  if (!slug) return "";
  return capFirst(slug);
}
