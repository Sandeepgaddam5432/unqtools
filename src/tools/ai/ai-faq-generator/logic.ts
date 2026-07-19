/**
 * AI FAQ Generator — pure logic.
 *
 * Generate structured FAQs from a topic or pasted content. Eight question
 * types (What, How, Why, When, Where, Who, Which, Can) × topic keywords →
 * 10+ grounded Q&A pairs grouped by type. Outputs Markdown, HTML accordion,
 * and JSON-LD FAQPage schema. Pure functions only — no DOM, no network. The
 * optional LLM call (BYO API key) lives in ui.tsx because it touches the
 * network.
 */

// ---------- Types ----------

export type QuestionType =
  | "what"
  | "how"
  | "why"
  | "when"
  | "where"
  | "who"
  | "which"
  | "can";

export type Tone = "neutral" | "friendly" | "formal" | "concise";
export type Length = "short" | "standard" | "detailed";

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  type: QuestionType;
  topic: string;
  grounded: boolean;       // true if the answer is backed by source content
  sourceSnippet?: string;  // the snippet used to ground the answer
}

export interface FAQGroup {
  type: QuestionType;
  label: string;
  items: FAQItem[];
}

export interface FAQDocument {
  topic: string;
  source: string;          // pasted content (may be empty)
  tone: Tone;
  length: Length;
  voiceSearch: boolean;
  items: FAQItem[];
  generatedAt: number;
}

export interface Stats {
  totalQuestions: number;
  groundedCount: number;
  notGroundedCount: number;
  byType: Record<QuestionType, number>;
  wordCount: number;
  characterCount: number;
}

export interface HistoryEntry {
  ts: number;
  topic: string;
  tone: Tone;
  length: Length;
  questionCount: number;
  groundedCount: number;
  sourceChars: number;
}

export interface ShareState {
  topic: string;
  tone: Tone;
  length: Length;
  voiceSearch: boolean;
  count: number;
}

export interface LlmPrompt {
  system: string;
  user: string;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-faq-generator:history";
export const HISTORY_MAX = 20;

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  what: "What",
  how: "How",
  why: "Why",
  when: "When",
  where: "Where",
  who: "Who",
  which: "Which",
  can: "Can",
};

export const TONE_LABELS: Record<Tone, string> = {
  neutral: "Neutral",
  friendly: "Friendly",
  formal: "Formal",
  concise: "Concise",
};

export const LENGTH_LABELS: Record<Length, string> = {
  short: "Short (1–2 sentences)",
  standard: "Standard (2–4 sentences)",
  detailed: "Detailed (4–6 sentences)",
};

export const LENGTH_SENTENCE_TARGETS: Record<Length, [number, number]> = {
  short: [1, 2],
  standard: [2, 4],
  detailed: [4, 6],
};

export const SAMPLE_TOPICS: string[] = [
  "UnQTools — the privacy-first toolbox",
  "Acme Cloud Backup — encrypted offsite storage",
  "Mountain View Yoga Studio — weekly classes",
  "Open-source password manager Bitwarden",
  "The Mediterranean diet for beginners",
];

/** Stop words for keyword extraction. */
export const STOP_WORDS = new Set<string>([
  "the", "a", "an", "and", "or", "but", "if", "then", "else", "of", "in",
  "on", "at", "to", "for", "with", "without", "by", "from", "into", "onto",
  "is", "are", "was", "were", "be", "been", "being", "do", "does", "did",
  "have", "has", "had", "will", "would", "should", "could", "may", "might",
  "this", "that", "these", "those", "it", "its", "as", "so", "not", "no",
  "we", "you", "they", "he", "she", "him", "her", "our", "your", "their",
  "i", "me", "my", "us",
]);

/** Question template library: 8 types × multiple templates each. */
export const QUESTION_TEMPLATES: Record<QuestionType, string[]> = {
  what: [
    "What is {topic}?",
    "What are the key features of {topic}?",
    "What makes {topic} different from alternatives?",
    "What should I know about {topic} before getting started?",
    "What are the main benefits of using {topic}?",
    "What does {topic} cost?",
  ],
  how: [
    "How does {topic} work?",
    "How do I get started with {topic}?",
    "How can I use {topic} effectively?",
    "How much does {topic} cost?",
    "How long does it take to see results from {topic}?",
    "How is {topic} different from other options?",
  ],
  why: [
    "Why is {topic} important?",
    "Why should I choose {topic}?",
    "Why does {topic} matter?",
    "Why might {topic} not be right for me?",
  ],
  when: [
    "When should I use {topic}?",
    "When is the best time to start with {topic}?",
    "When should I avoid {topic}?",
  ],
  where: [
    "Where can I find more information about {topic}?",
    "Where is {topic} available?",
    "Where can I get support for {topic}?",
  ],
  who: [
    "Who is {topic} designed for?",
    "Who benefits most from {topic}?",
    "Who should not use {topic}?",
  ],
  which: [
    "Which {topic} plan is right for me?",
    "Which features does {topic} include?",
    "Which alternatives to {topic} exist?",
  ],
  can: [
    "Can {topic} be customized?",
    "Can I cancel {topic} at any time?",
    "Can I use {topic} on mobile devices?",
    "Can {topic} integrate with other tools?",
  ],
};

// ---------- Normalization ----------

/** Normalize a topic string. */
export function normalizeTopic(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Normalize pasted source content (preserve newlines, collapse internal spaces). */
export function normalizeContent(s: string): string {
  if (!s) return "";
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Title-case a phrase (used for placeholder topics). */
export function titleCase(s: string): string {
  if (!s) return "";
  return s.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

/** Extract lowercased keywords from a string, filtering stop words and short tokens. */
export function extractKeywords(s: string): string[] {
  if (!s) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const words = s.toLowerCase().match(/[a-z0-9]{2,}/g) ?? [];
  for (const w of words) {
    if (STOP_WORDS.has(w)) continue;
    if (w.length < 2) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}

/** Split content into sentences (rough heuristic). */
export function splitSentences(content: string): string[] {
  if (!content) return [];
  // Normalize whitespace within sentences then split on sentence terminators.
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const parts = normalized.split(/(?<=[.!?])\s+(?=[A-Z0-9"'`(])/);
  return parts
    .map((s) => s.trim())
    .filter((s) => s.length >= 8);
}

// ---------- Question generation ----------

/** Detect the question type from a question string. */
export function detectQuestionType(question: string): QuestionType {
  const q = (question || "").trim().toLowerCase();
  if (!q) return "what";
  const first = q.split(/\s+/)[0] ?? "";
  const mapping: Record<string, QuestionType> = {
    what: "what", how: "how", why: "why", when: "when",
    where: "where", who: "who", whom: "who", whose: "who",
    which: "which", can: "can", could: "can", do: "can",
    does: "can", did: "can", is: "can", are: "can",
  };
  return mapping[first] ?? "what";
}

/** Get the raw question template list for a type. */
export function getTemplates(type: QuestionType): string[] {
  return QUESTION_TEMPLATES[type] ?? [];
}

/** Pick templates for a type, returning at most `count`. */
export function pickTemplates(type: QuestionType, count: number): string[] {
  const all = getTemplates(type);
  if (count <= 0) return [];
  if (count >= all.length) return all.slice();
  // Evenly spaced pick across the available templates.
  const out: string[] = [];
  const step = all.length / count;
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(i * step);
    out.push(all[idx]);
  }
  // Dedupe in case rounding causes collisions.
  return Array.from(new Set(out));
}

/** Fill a question template with the topic. */
export function fillTemplate(template: string, topic: string): string {
  return template.replace(/\{topic\}/g, topic || "this topic");
}

/** Apply voice-search phrasing — converts "What is X?" to "What's X?" style. */
export function voiceStyle(question: string): string {
  // Voice-search users speak contractions and shorter forms.
  return question
    .replace(/\bWhat is\b/gi, "What's")
    .replace(/\bWhere is\b/gi, "Where's")
    .replace(/\bHow do\b/gi, "How do")
    .replace(/\bWhy do\b/gi, "Why do");
}

// ---------- Answer generation (grounded) ----------

/** Score a sentence for relevance to a question + topic keywords. */
export function scoreSentence(sentence: string, queryKeywords: string[]): number {
  if (!sentence || queryKeywords.length === 0) return 0;
  const lower = sentence.toLowerCase();
  let score = 0;
  for (const kw of queryKeywords) {
    if (lower.includes(kw)) score += 1;
  }
  return score;
}

/** Find the best sentence in content matching the query keywords. */
export function findBestSnippet(content: string, queryKeywords: string[]): string | null {
  const sentences = splitSentences(content);
  if (sentences.length === 0) return null;
  let best: string | null = null;
  let bestScore = 0;
  for (const s of sentences) {
    const score = scoreSentence(s, queryKeywords);
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  // Require at least one keyword match to consider grounded.
  return bestScore > 0 ? best : null;
}

/** Build an honest "not grounded" answer — never fabricates facts. */
export function buildUngroundedAnswer(question: string, topic: string, tone: Tone, length: Length): string {
  const qType = detectQuestionType(question);
  const topicLabel = topic || "this topic";
  const prefix = TONE_PREFIX[tone];
  const frames: Record<QuestionType, string[]> = {
    what: [
      `${topicLabel} covers the core features, scope, and intended use cases described in your source material.`,
      `The defining characteristics of ${topicLabel} depend on the specifics you provide; without source content we can't list them accurately.`,
    ],
    how: [
      `The way ${topicLabel} works depends on its design and configuration, which should be documented in your source material.`,
      `To use ${topicLabel}, follow the steps outlined in your source content; we don't fabricate instructions.`,
    ],
    why: [
      `${topicLabel} matters for reasons that depend on your context — your source material should articulate the specific motivation.`,
      `Choosing ${topicLabel} depends on the trade-offs you're willing to accept; consult your source for the rationale.`,
    ],
    when: [
      `The right time to use ${topicLabel} depends on your use case; refer to your source material for timing guidance.`,
      `Avoid ${topicLabel} when its prerequisites aren't met — check your source for those requirements.`,
    ],
    where: [
      `More information about ${topicLabel} should be available in your source content or its official documentation.`,
      `Support for ${topicLabel} is described in the source material you provide.`,
    ],
    who: [
      `${topicLabel} is designed for the audience described in your source material; without that, we can't specify who.`,
      `People who benefit from ${topicLabel} are typically those whose needs match its capabilities — check your source.`,
    ],
    which: [
      `Which option of ${topicLabel} fits you depends on your requirements; your source should describe the differences.`,
      `The features of ${topicLabel} are listed in your source content; we don't invent feature lists.`,
    ],
    can: [
      `Whether ${topicLabel} supports this depends on its documented capabilities — check your source material.`,
      `Customization, cancellation, and integration details for ${topicLabel} come from your source content, not from us.`,
    ],
  };
  const opts = frames[qType];
  const [lo, hi] = LENGTH_SENTENCE_TARGETS[length];
  const target = Math.max(lo, Math.min(hi, 2));
  const out: string[] = [];
  out.push(prefix ? `${prefix} ${opts[0]}` : opts[0]);
  if (target >= 2) out.push(opts[1]);
  out.push("Please verify against your source before publishing.");
  return out.join(" ");
}

const TONE_PREFIX: Record<Tone, string> = {
  neutral: "",
  friendly: "Great question!",
  formal: "In summary,",
  concise: "Briefly,",
};

/** Trim or pad a snippet-based answer to roughly the length target. */
export function shapeAnswer(snippet: string, tone: Tone, length: Length, topic: string): string {
  const [lo, hi] = LENGTH_SENTENCE_TARGETS[length];
  const prefix = TONE_PREFIX[tone];
  const sentences = splitSentences(snippet);
  if (sentences.length === 0) {
    // Snippet had no sentence-ending punctuation — wrap it.
    const wrapped = `${snippet.trim()}.`;
    return prefix ? `${prefix} ${wrapped}` : wrapped;
  }
  const picked = sentences.slice(0, Math.min(hi, Math.max(lo, 1)));
  let body = picked.join(" ");
  // Ensure the body ends with sentence punctuation.
  if (!/[.!?]["')\]]?$/.test(body)) body = `${body}.`;
  return prefix ? `${prefix} ${body}` : body;
}

/** Build the answer for a single question, grounded in content when possible. */
export function generateAnswer(
  question: string,
  topic: string,
  content: string,
  tone: Tone,
  length: Length,
): { answer: string; grounded: boolean; snippet: string | null } {
  if (!content) {
    return {
      answer: buildUngroundedAnswer(question, topic, tone, length),
      grounded: false,
      snippet: null,
    };
  }
  // Build the query keywords: topic keywords + question's key nouns.
  const topicKw = extractKeywords(topic);
  const qKw = extractKeywords(question).filter((w) => w.length >= 3);
  const queryKw = Array.from(new Set([...topicKw, ...qKw]));
  const snippet = findBestSnippet(content, queryKw);
  if (!snippet) {
    return {
      answer: buildUngroundedAnswer(question, topic, tone, length),
      grounded: false,
      snippet: null,
    };
  }
  return {
    answer: shapeAnswer(snippet, tone, length, topic),
    grounded: true,
    snippet,
  };
}

// ---------- FAQ generation ----------

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `faq-${idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Reset the internal id counter (for deterministic tests). */
export function resetIdCounter(): void {
  idCounter = 0;
}

export interface GenerateOptions {
  tone?: Tone;
  length?: Length;
  voiceSearch?: boolean;
  count?: number;        // total questions to generate (default 12)
  types?: QuestionType[]; // restrict to specific types
}

/** Generate a complete FAQ document from a topic and optional content. */
export function generateFaq(topic: string, content: string, opts: GenerateOptions = {}): FAQDocument {
  const t = normalizeTopic(topic);
  const c = normalizeContent(content);
  const tone = opts.tone ?? "neutral";
  const length = opts.length ?? "standard";
  const voiceSearch = opts.voiceSearch ?? false;
  const count = opts.count && opts.count > 0 ? opts.count : 12;
  const allTypes = (Object.keys(QUESTION_TEMPLATES) as QuestionType[]);
  const requestedTypes = opts.types && opts.types.length > 0 ? opts.types : allTypes;
  // If count is less than the number of types, trim the types list to count
  // so we never produce more items than requested.
  const types = requestedTypes.length > count ? requestedTypes.slice(0, count) : requestedTypes;

  // Evenly distribute count questions across selected types.
  const perType = Math.max(1, Math.floor(count / types.length));
  const remainder = count - perType * types.length;

  const items: FAQItem[] = [];
  for (let ti = 0; ti < types.length; ti++) {
    const type = types[ti];
    const n = perType + (ti < remainder ? 1 : 0);
    const templates = pickTemplates(type, n);
    for (const tpl of templates) {
      let question = fillTemplate(tpl, t || "this topic");
      if (voiceSearch) question = voiceStyle(question);
      const { answer, grounded, snippet } = generateAnswer(question, t, c, tone, length);
      items.push({
        id: nextId(),
        question,
        answer,
        type,
        topic: t,
        grounded,
        sourceSnippet: snippet ?? undefined,
      });
    }
  }

  return {
    topic: t,
    source: c,
    tone,
    length,
    voiceSearch,
    items,
    generatedAt: Date.now(),
  };
}

/** Group FAQ items by question type, preserving QUESTION_TYPE order. */
export function groupByType(items: FAQItem[]): FAQGroup[] {
  const order = Object.keys(QUESTION_TYPE_LABELS) as QuestionType[];
  const groups: FAQGroup[] = [];
  for (const type of order) {
    const typeItems = items.filter((i) => i.type === type);
    if (typeItems.length > 0) {
      groups.push({
        type,
        label: QUESTION_TYPE_LABELS[type],
        items: typeItems,
      });
    }
  }
  return groups;
}

/** Regenerate a single FAQ item by id (returns a new FAQDocument). */
export function regenerateItem(faq: FAQDocument, id: string): FAQDocument {
  const idx = faq.items.findIndex((i) => i.id === id);
  if (idx < 0) return faq;
  const old = faq.items[idx];
  // Pick a different template for the same type if possible.
  const all = getTemplates(old.type);
  const usedTemplates = new Set(faq.items.filter((i) => i.type === old.type).map((i) => i.question));
  const candidate = all.find((t) => !usedTemplates.has(fillTemplate(t, old.topic))) ?? all[0];
  const question = faq.voiceSearch
    ? voiceStyle(fillTemplate(candidate, old.topic || "this topic"))
    : fillTemplate(candidate, old.topic || "this topic");
  const { answer, grounded, snippet } = generateAnswer(question, old.topic, faq.source, faq.tone, faq.length);
  const next: FAQItem = {
    id: old.id,
    question,
    answer,
    type: old.type,
    topic: old.topic,
    grounded,
    sourceSnippet: snippet ?? undefined,
  };
  const items = faq.items.slice();
  items[idx] = next;
  return { ...faq, items, generatedAt: Date.now() };
}

/** Compute stats for a FAQ document. */
export function computeStats(faq: FAQDocument): Stats {
  const byType: Record<QuestionType, number> = {
    what: 0, how: 0, why: 0, when: 0, where: 0, who: 0, which: 0, can: 0,
  };
  let grounded = 0;
  let wordCount = 0;
  let charCount = 0;
  for (const i of faq.items) {
    byType[i.type] += 1;
    if (i.grounded) grounded += 1;
    wordCount += i.answer.split(/\s+/).filter(Boolean).length;
    charCount += i.answer.length;
  }
  return {
    totalQuestions: faq.items.length,
    groundedCount: grounded,
    notGroundedCount: faq.items.length - grounded,
    byType,
    wordCount,
    characterCount: charCount,
  };
}

// ---------- Rendering ----------

/** Render FAQ as plain text (one Q / one A per block). */
export function renderText(faq: FAQDocument): string {
  const lines: string[] = [];
  lines.push(`FAQ: ${faq.topic || "Untitled"}`);
  lines.push("=".repeat(Math.max(8, (faq.topic || "Untitled").length + 5)));
  lines.push("");
  for (const i of faq.items) {
    lines.push(`Q: ${i.question}`);
    lines.push(`A: ${i.answer}`);
    if (!i.grounded) lines.push("   (⚠ not grounded — verify before publishing)");
    lines.push("");
  }
  return lines.join("\n");
}

/** Render FAQ as Markdown with type headings. */
export function renderMarkdown(faq: FAQDocument): string {
  const lines: string[] = [];
  lines.push(`# FAQ: ${faq.topic || "Untitled"}`);
  lines.push("");
  const groups = groupByType(faq.items);
  for (const g of groups) {
    lines.push(`## ${g.label}`);
    lines.push("");
    for (const i of g.items) {
      lines.push(`### ${i.question}`);
      lines.push("");
      lines.push(i.answer);
      if (!i.grounded) {
        lines.push("");
        lines.push("> ⚠ **Not grounded in source content** — verify before publishing.");
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

/** Escape HTML special characters. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Render FAQ as an HTML accordion (uses native <details>/<summary>). */
export function renderHtmlAccordion(faq: FAQDocument): string {
  const groups = groupByType(faq.items);
  const sections: string[] = [];
  sections.push(`<section class="faq" aria-label="FAQ for ${escapeHtml(faq.topic || "Untitled")}">`);
  sections.push(`  <h2>FAQ: ${escapeHtml(faq.topic || "Untitled")}</h2>`);
  for (const g of groups) {
    sections.push(`  <h3>${escapeHtml(g.label)}</h3>`);
    for (const i of g.items) {
      sections.push(`  <details>`);
      sections.push(`    <summary>${escapeHtml(i.question)}</summary>`);
      sections.push(`    <p>${escapeHtml(i.answer)}</p>`);
      if (!i.grounded) {
        sections.push(`    <p><em>⚠ Not grounded in source content — verify before publishing.</em></p>`);
      }
      sections.push(`  </details>`);
    }
  }
  sections.push(`</section>`);
  return sections.join("\n");
}

/** Render FAQ as JSON-LD FAQPage schema (valid for Google rich results). */
export function renderJsonLd(faq: FAQDocument): string {
  const mainEntity = faq.items.map((i) => ({
    "@type": "Question",
    name: i.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: i.answer,
    },
  }));
  const obj = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    name: faq.topic || "FAQ",
    mainEntity,
  };
  return JSON.stringify(obj, null, 2);
}

/** Validate a JSON-LD string: returns null if valid, error message otherwise. */
export function validateJsonLd(json: string): string | null {
  if (!json.trim()) return "Empty JSON-LD";
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e: unknown) {
    return e instanceof Error ? `Invalid JSON: ${e.message}` : "Invalid JSON";
  }
  if (typeof parsed !== "object" || parsed === null) return "Root must be an object";
  const obj = parsed as Record<string, unknown>;
  if (obj["@type"] !== "FAQPage") return "Missing or wrong @type (expected FAQPage)";
  if (!Array.isArray(obj.mainEntity)) return "mainEntity must be an array";
  for (let i = 0; i < obj.mainEntity.length; i++) {
    const q = obj.mainEntity[i] as Record<string, unknown>;
    if (typeof q !== "object" || q === null) return `mainEntity[${i}] must be an object`;
    if (q["@type"] !== "Question") return `mainEntity[${i}].@type must be Question`;
    if (typeof q.name !== "string" || !q.name) return `mainEntity[${i}].name must be a non-empty string`;
    const ans = q.acceptedAnswer as Record<string, unknown> | undefined;
    if (typeof ans !== "object" || ans === null) return `mainEntity[${i}].acceptedAnswer must be an object`;
    if (ans["@type"] !== "Answer") return `mainEntity[${i}].acceptedAnswer.@type must be Answer`;
    if (typeof ans.text !== "string" || !ans.text) return `mainEntity[${i}].acceptedAnswer.text must be a non-empty string`;
  }
  return null;
}

/** Render FAQ as a raw JSON object (for the .json download). */
export function renderJson(faq: FAQDocument): string {
  return JSON.stringify(faq, null, 2);
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

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.topic) params.set("topic", state.topic);
  if (state.tone && state.tone !== "neutral") params.set("tone", state.tone);
  if (state.length && state.length !== "standard") params.set("length", state.length);
  if (state.voiceSearch) params.set("voice", "1");
  if (state.count && state.count !== 12) params.set("count", String(state.count));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { topic: "", tone: "neutral", length: "standard", voiceSearch: false, count: 12 };
  const params = new URLSearchParams(clean);
  const topic = params.get("topic") ?? "";
  const validTones = Object.keys(TONE_LABELS) as Tone[];
  const toneParam = params.get("tone") ?? "neutral";
  const tone = validTones.includes(toneParam as Tone) ? (toneParam as Tone) : "neutral";
  const validLengths = Object.keys(LENGTH_LABELS) as Length[];
  const lengthParam = params.get("length") ?? "standard";
  const length = validLengths.includes(lengthParam as Length) ? (lengthParam as Length) : "standard";
  const voiceSearch = params.get("voice") === "1";
  const countRaw = Number.parseInt(params.get("count") ?? "12", 10);
  const count = Number.isFinite(countRaw) && countRaw >= 4 && countRaw <= 48 ? countRaw : 12;
  return { topic, tone, length, voiceSearch, count };
}

// ---------- Optional LLM prompt builder ----------

export function buildLlmPrompt(topic: string, content: string, tone: Tone, length: Length): LlmPrompt {
  const system = [
    "You are an FAQ generator.",
    `Write in a ${tone} tone.`,
    `Each answer should be ${LENGTH_LABELS[length].toLowerCase()}.`,
    "If source content is provided, ground every answer in it. If an answer cannot be grounded, mark it (⚠ not grounded) and give a brief, honest generic answer that does not fabricate facts.",
    "Output one question per line as 'Q: <question>' followed by 'A: <answer>'.",
  ].join(" ");
  const user = [
    `Topic: ${topic || "(none — derive from content)"}`,
    content ? `Source content:\n"""\n${content}\n"""` : "(no source content provided — generate grounded-skeptic answers only)",
    "Generate 10–12 diverse FAQ pairs across the question types: What, How, Why, When, Where, Who, Which, Can.",
  ].join("\n\n");
  return { system, user };
}

export function renderLlmResult(raw: string): string {
  return (raw || "").trim();
}
