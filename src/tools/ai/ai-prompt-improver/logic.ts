/**
 * AI Prompt Improver — pure logic.
 *
 * Six-dimension prompt analyzer (clarity, specificity, context, constraints,
 * format, examples) with a 0-100 score and per-dimension tips. Rule-based
 * rewriter that adds role framing, explicit task, context slots, constraints,
 * desired output format, and few-shot scaffolding. Four target-model presets
 * (GPT-4-class, Claude, Gemini, Small Local). Variable extraction, template
 * mode, diff view, token estimate, share URL, history (localStorage).
 *
 * Pure functions only — no DOM, no network. The optional LLM call (BYO API key)
 * lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type TargetModel = "gpt4" | "claude" | "gemini" | "local";

export type UseCase =
  | "general"
  | "coding"
  | "writing"
  | "image-gen"
  | "analysis"
  | "agent-system-prompt";

export interface DimensionScore {
  dimension: "clarity" | "specificity" | "context" | "constraints" | "format" | "examples";
  score: number;        // 0-100
  hasIt: boolean;
  tips: string[];
}

export interface PromptAnalysis {
  clarity: DimensionScore;
  specificity: DimensionScore;
  context: DimensionScore;
  constraints: DimensionScore;
  format: DimensionScore;
  examples: DimensionScore;
  overall: number;      // 0-100 weighted
  wordCount: number;
  charCount: number;
  hasRole: boolean;
  hasTask: boolean;
  hasFormat: boolean;
  hasExamples: boolean;
  hasConstraints: boolean;
  hasContext: boolean;
}

export interface Suggestion {
  id: string;
  type: "role" | "task" | "context" | "constraints" | "format" | "examples";
  title: string;
  reason: string;
  applied: boolean;
  snippet: string;        // text that would be added
}

export interface RewriteResult {
  original: string;
  improved: string;
  template: string;        // improved with {{placeholders}}
  variables: ExtractedVariable[];
  suggestions: Suggestion[];
  diff: DiffLine[];
  analysis: PromptAnalysis;
  targetModel: TargetModel;
  useCase: UseCase;
  tokenEstimate: number;
}

export interface ExtractedVariable {
  name: string;            // placeholder name, snake_case
  original: string;        // original literal value
  placeholder: string;     // {{name}}
}

export interface DiffLine {
  type: "added" | "removed" | "unchanged";
  text: string;
}

export interface HistoryEntry {
  ts: number;
  originalLength: number;
  improvedLength: number;
  overallScore: number;
  targetModel: TargetModel;
  useCase: UseCase;
  variableCount: number;
}

export interface ShareState {
  prompt: string;
  targetModel: TargetModel;
  useCase: UseCase;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-prompt-improver:history";
export const HISTORY_MAX = 20;

export const TARGET_MODEL_LABELS: Record<TargetModel, string> = {
  gpt4: "GPT-4-class",
  claude: "Claude",
  gemini: "Gemini",
  local: "Small Local",
};

export const USE_CASE_LABELS: Record<UseCase, string> = {
  general: "General",
  coding: "Coding",
  writing: "Writing",
  "image-gen": "Image Generation",
  analysis: "Analysis",
  "agent-system-prompt": "Agent System Prompt",
};

export const DEFAULT_OPTIONS = {
  targetModel: "gpt4" as TargetModel,
  useCase: "general" as UseCase,
};

// Use-case presets suggest a starting role and format hint.
export const USE_CASE_PRESETS: Record<UseCase, { role: string; format: string; constraints: string[] }> = {
  general: {
    role: "an expert assistant",
    format: "Reply with a concise answer; use bullet points where useful.",
    constraints: ["Avoid filler.", "Stay on topic."],
  },
  coding: {
    role: "a senior software engineer",
    format: "Reply with the code in a fenced block, then a short explanation.",
    constraints: ["Prefer modern idioms.", "Include error handling.", "Do not invent APIs."],
  },
  writing: {
    role: "a professional writer",
    format: "Reply with the rewritten text in prose; no commentary before or after.",
    constraints: ["Match the requested tone.", "Avoid clichés.", "Keep within the word count."],
  },
  "image-gen": {
    role: "an art director",
    format: "Reply with a single image-generation prompt, comma-separated tags.",
    constraints: ["Include subject, style, lighting, lens.", "Avoid brand names.", "Cap at 60 words."],
  },
  analysis: {
    role: "a rigorous analyst",
    format: "Reply with: (1) summary, (2) key findings as bullets, (3) recommendations.",
    constraints: ["Cite data when relevant.", "Flag assumptions.", "Do not overstate certainty."],
  },
  "agent-system-prompt": {
    role: "an autonomous agent",
    format: "Reply with a system prompt block: role, tools, constraints, output schema.",
    constraints: ["List available tools.", "Define stop conditions.", "Forbid unsafe actions."],
  },
};

// Cue phrases used to detect each dimension.
const ROLE_CUES = [
  /\bact as\b/i, /\byou are\b/i, /\bas a(n)?\b/i, /\bimagine you\b/i,
  /\brole:\b/i, /\bpretend\b/i,
];

const FORMAT_CUES = [
  /\b(json|xml|yaml|markdown|html|csv)\b/i,
  /\b(format|output|respond|reply|return|answer in)\b/i,
  /\btable\b/i, /\bbullet\b/i, /\blist\b/i,
  /```/, /\{\{.*?\}\}/, /<\w+>/,
];

const EXAMPLE_CUES = [
  /\bexample\b/i, /\bfor instance\b/i, /\be\.g\.\b/i,
  /\bsuch as\b/i, /\blike\b/i,
  /```/, /\bsample\b/i,
];

const CONSTRAINT_CUES = [
  /\b(must|should|do not|don't|avoid|never|always|limit|within|maximum|minimum|at most|at least|under|over)\b/i,
  /\b\d+\s*(words?|sentences?|paragraphs?|lines?|tokens?|characters?)\b/i,
  /\bword count\b/i, /\blength\b/i, /\btone\b/i,
];

const CONTEXT_CUES = [
  /\bcontext\b/i, /\bbackground\b/i, /\baudience\b/i,
  /\binput[:)]\b/i, /\bgiven\b/i, /\bsituation\b/i,
  /\bbecause\b/i, /\bso that\b/i,
];

const SPECIFICITY_CUES = [
  /\b\d+(\.\d+)?\b/,                       // numbers
  /\b(step|steps|version|v\d)\b/i,
  /\b(a|an|the)\s+\w{3,}/i,                // articles + descriptive noun
];

const VAGUE_WORDS = [
  "thing", "stuff", "things", "good", "nice", "great", "awesome", "cool",
  "very", "really", "kind of", "sort of", "etc", "whatever", "something",
];

// ---------- Utilities ----------

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function testCues(text: string, cues: RegExp[]): boolean {
  return cues.some((re) => re.test(text));
}

function countCues(text: string, cues: RegExp[]): number {
  return cues.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0);
}

/** Count occurrences of vague filler words. */
export function countVagueWords(text: string): number {
  const lower = text.toLowerCase();
  return VAGUE_WORDS.reduce((n, w) => {
    const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    const m = lower.match(re);
    return n + (m ? m.length : 0);
  }, 0);
}

/** Normalize whitespace and trim. */
export function normalizePrompt(s: string): string {
  return (s || "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

// ---------- Analyzer ----------

/** Analyze a prompt across six dimensions. */
export function analyzePrompt(input: string): PromptAnalysis {
  const text = normalizePrompt(input);
  const wc = wordCount(text);
  const cc = text.length;

  const hasRole = testCues(text, ROLE_CUES);
  const hasFormat = testCues(text, FORMAT_CUES);
  const hasExamples = testCues(text, EXAMPLE_CUES);
  const hasConstraints = testCues(text, CONSTRAINT_CUES);
  const hasContext = testCues(text, CONTEXT_CUES);
  const hasSpecificity = testCues(text, SPECIFICITY_CUES);

  const vague = countVagueWords(text);

  // Clarity: penalize vague words and very short prompts.
  let clarity = 50;
  if (wc >= 8) clarity += 15;
  if (wc >= 20) clarity += 10;
  clarity -= Math.min(30, vague * 10);
  if (hasRole) clarity += 10;
  clarity = clamp(clarity);

  // Specificity: numbers + descriptive nouns + low vague count.
  let specificity = 40;
  specificity += countCues(text, SPECIFICITY_CUES) * 10;
  specificity -= Math.min(25, vague * 8);
  if (hasSpecificity) specificity += 10;
  specificity = clamp(specificity);

  // Context: explicit context cues.
  let context = 25;
  if (hasContext) context += 40;
  context += countCues(text, CONTEXT_CUES) * 10;
  if (wc >= 30) context += 15;
  context = clamp(context);

  // Constraints: explicit constraint cues.
  let constraints = 25;
  if (hasConstraints) constraints += 40;
  constraints += countCues(text, CONSTRAINT_CUES) * 8;
  constraints = clamp(constraints);

  // Format: explicit format cues.
  let format = 25;
  if (hasFormat) format += 50;
  format += countCues(text, FORMAT_CUES) * 8;
  format = clamp(format);

  // Examples: explicit example cues.
  let examples = 20;
  if (hasExamples) examples += 55;
  examples += countCues(text, EXAMPLE_CUES) * 8;
  examples = clamp(examples);

  // Weighted overall — context + constraints + format are the heaviest.
  const overall = clamp(
    clarity * 0.15 +
    specificity * 0.15 +
    context * 0.20 +
    constraints * 0.20 +
    format * 0.20 +
    examples * 0.10,
  );

  const mk = (
    dimension: DimensionScore["dimension"],
    score: number,
    hasIt: boolean,
    tips: string[],
  ): DimensionScore => ({ dimension, score, hasIt, tips });

  return {
    clarity: mk("clarity", clarity, wc >= 8, clarityTips(text, wc, vague)),
    specificity: mk("specificity", specificity, hasSpecificity, specificityTips(text, vague)),
    context: mk("context", context, hasContext, contextTips(text, wc)),
    constraints: mk("constraints", constraints, hasConstraints, constraintsTips(text)),
    format: mk("format", format, hasFormat, formatTips(text)),
    examples: mk("examples", examples, hasExamples, examplesTips(text)),
    overall,
    wordCount: wc,
    charCount: cc,
    hasRole,
    hasTask: wc >= 4,
    hasFormat,
    hasExamples,
    hasConstraints,
    hasContext,
  };
}

function clarityTips(text: string, wc: number, vague: number): string[] {
  const tips: string[] = [];
  if (wc < 8) tips.push("Add more detail — single-line prompts rarely give enough signal.");
  if (vague > 0) tips.push(`Replace ${vague} vague word(s) like "thing", "good", "stuff" with concrete nouns.`);
  if (wc < 20) tips.push("Aim for 20-60 words for most tasks.");
  return tips.length ? tips : ["Clarity looks good — keep it concrete."];
}

function specificityTips(_text: string, vague: number): string[] {
  const tips: string[] = [];
  tips.push("Add concrete numbers, names, or versions where possible.");
  if (vague > 0) tips.push("Remove filler adjectives (very, really, etc.).");
  return tips;
}

function contextTips(_text: string, wc: number): string[] {
  const tips: string[] = [];
  tips.push("Add a 'Context:' line describing who the output is for and any background.");
  if (wc < 30) tips.push("Provide enough context that a stranger could complete the task.");
  return tips;
}

function constraintsTips(_text: string): string[] {
  const tips: string[] = [];
  tips.push("State explicit constraints: word count, tone, things to avoid.");
  tips.push("Add a 'Do not:' line listing forbidden behaviors.");
  return tips;
}

function formatTips(_text: string): string[] {
  const tips: string[] = [];
  tips.push("Specify the output format (JSON, Markdown table, bullet list, etc.).");
  tips.push("Show the desired structure with a small skeleton.");
  return tips;
}

function examplesTips(_text: string): string[] {
  const tips: string[] = [];
  tips.push("Add 1-2 example inputs and expected outputs (few-shot scaffolding).");
  return tips;
}

/** Compute a single 0-100 score. */
export function scorePrompt(input: string): number {
  return analyzePrompt(input).overall;
}

// ---------- Suggestions ----------

/** Build suggestions based on the analysis. */
export function suggestImprovements(
  input: string,
  useCase: UseCase = "general",
): Suggestion[] {
  const a = analyzePrompt(input);
  const preset = USE_CASE_PRESETS[useCase];
  const out: Suggestion[] = [];

  if (!a.hasRole) {
    out.push({
      id: "role",
      type: "role",
      title: "Add role framing",
      reason: "Telling the model who to be calibrates tone and depth. Use 'Act as <role>.'",
      applied: false,
      snippet: `Act as ${preset.role}.`,
    });
  }

  if (!a.hasContext) {
    out.push({
      id: "context",
      type: "context",
      title: "Add context",
      reason: "Context anchors the model: audience, background, and goal reduce off-target answers.",
      applied: false,
      snippet: "Context: <who this is for, what they already know, and why you need this>.",
    });
  }

  if (!a.hasConstraints) {
    out.push({
      id: "constraints",
      type: "constraints",
      title: "Add constraints",
      reason: "Explicit constraints prevent runaway length, off-topic answers, and bad tone.",
      applied: false,
      snippet: `Constraints:\n- ${preset.constraints.join("\n- ")}`,
    });
  }

  if (!a.hasFormat) {
    out.push({
      id: "format",
      type: "format",
      title: "Specify output format",
      reason: "Naming the format lets the model structure output the way you can consume it.",
      applied: false,
      snippet: `Format: ${preset.format}`,
    });
  }

  if (!a.hasExamples) {
    out.push({
      id: "examples",
      type: "examples",
      title: "Add an example",
      reason: "One example (input → output) dramatically improves adherence for non-trivial tasks.",
      applied: false,
      snippet: "Example:\nInput: <sample input>\nOutput: <sample output>",
    });
  }

  return out;
}

// ---------- Rewriter ----------

/** Rewrite a prompt into a structured, model-ready form. */
export function rewritePrompt(
  input: string,
  opts: { targetModel?: TargetModel; useCase?: UseCase } = {},
): RewriteResult {
  const targetModel = opts.targetModel ?? "gpt4";
  const useCase = opts.useCase ?? "general";
  const original = normalizePrompt(input);
  const analysis = analyzePrompt(original);
  const preset = USE_CASE_PRESETS[useCase];
  const suggestions = suggestImprovements(original, useCase).map((s) => ({ ...s, applied: true }));

  const sections = buildSections(original, analysis, preset, targetModel, useCase);
  const improved = sections.join("\n\n");

  const { template, variables } = extractVariables(improved);
  const diff = buildDiff(original, improved);
  const tokenEstimate = estimateTokens(improved);

  return {
    original,
    improved,
    template,
    variables,
    suggestions,
    diff,
    analysis,
    targetModel,
    useCase,
    tokenEstimate,
  };
}

function buildSections(
  original: string,
  a: PromptAnalysis,
  preset: { role: string; format: string; constraints: string[] },
  targetModel: TargetModel,
  useCase: UseCase,
): string[] {
  const useTag = targetModel === "claude";
  const tag = (name: string, body: string) =>
    useTag ? `<${name}>\n${body}\n</${name}>` : `${name.toUpperCase()}:\n${body}`;

  const sections: string[] = [];

  // Role
  if (!a.hasRole) {
    sections.push(useTag ? `<role>\nAct as ${preset.role}.\n</role>` : `Act as ${preset.role}.`);
  }

  // Task
  const taskBody = a.hasTask ? original : `${original} (clarify the requested task)`;
  sections.push(useTag ? `<task>\n${taskBody}\n</task>` : `TASK:\n${taskBody}`);

  // Context
  if (!a.hasContext) {
    sections.push(tag("context", "<who this is for, what they already know, and why you need this>"));
  }

  // Constraints
  if (!a.hasConstraints) {
    sections.push(tag("constraints", preset.constraints.join("\n")));
  } else if (useCase === "agent-system-prompt") {
    sections.push(tag("constraints", preset.constraints.join("\n")));
  }

  // Format
  if (!a.hasFormat) {
    sections.push(tag("format", preset.format));
  }

  // Examples
  if (!a.hasExamples) {
    if (useCase === "coding" || useCase === "analysis" || useCase === "writing") {
      sections.push(
        useTag
          ? `<examples>\nInput: <sample input>\nOutput: <sample output>\n</examples>`
          : `EXAMPLE:\nInput: <sample input>\nOutput: <sample output>`,
      );
    }
  }

  // Tail hint based on target model
  if (targetModel === "gpt4") {
    sections.push("Use step-by-step reasoning. Return the answer in the requested format only.");
  } else if (targetModel === "gemini") {
    sections.push("Be concise. Skip preamble.");
  } else if (targetModel === "local") {
    sections.push("Keep the answer under 200 tokens. Show the format explicitly.");
  } else if (targetModel === "claude") {
    sections.push("Think inside <thinking> tags before the final answer.");
  }

  return sections;
}

// ---------- Variable extraction ----------

/** Extract candidate variables from the improved prompt and replace with placeholders. */
export function extractVariables(improved: string): { template: string; variables: ExtractedVariable[] } {
  // Match numbers, capitalized names/technologies, file paths, quoted strings.
  const patterns: { re: RegExp; kind: string }[] = [
    { re: /`([A-Za-z0-9_\-./]+\.[a-z]{1,5})`/g, kind: "path" },        // `file.ts`
    { re: /\b(Python|JavaScript|TypeScript|Java|Go|Rust|Ruby|C\+\+|Kotlin|Swift)\b/g, kind: "tech" },
    { re: /\b(v\d+(?:\.\d+)*)\b/g, kind: "version" },                   // v1.2
    { re: /\b(\d{2,})\s*(?:words?|tokens?|sentences?|paragraphs?|items?)\b/gi, kind: "count" },
    { re: /"([^"]{3,30})"/g, kind: "quote" },                           // "literal"
  ];

  const used = new Set<string>();
  const variables: ExtractedVariable[] = [];
  let template = improved;

  for (const { re, kind } of patterns) {
    template = template.replace(re, (match, inner) => {
      const literal = (inner ?? match) as string;
      const name = makeVarName(kind, literal, used);
      if (!name) return match;
      used.add(name);
      variables.push({ name, original: literal, placeholder: `{{${name}}}` });
      return match.replace(literal, `{{${name}}}`);
    });
  }

  return { template, variables };
}

function makeVarName(kind: string, literal: string, used: Set<string>): string | null {
  const base = literal.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!base) return null;
  let name = `${kind}_${base}`.slice(0, 24);
  let i = 2;
  while (used.has(name)) {
    name = `${kind}_${base}_${i}`.slice(0, 24);
    i++;
  }
  return name;
}

/** Fill template variables with provided values. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name) => {
    const v = values[name];
    return v !== undefined && v !== "" ? v : match;
  });
}

// ---------- Diff ----------

/** Build a simple line-level diff between original and improved. */
export function buildDiff(original: string, improved: string): DiffLine[] {
  const origLines = original.split("\n");
  const newLines = improved.split("\n");
  const out: DiffLine[] = [];

  // Mark original as removed if it's just the task body (already present in improved).
  const origJoined = origLines.join(" ").trim();
  const newJoined = newLines.join(" ");
  if (origJoined && newJoined.includes(origJoined)) {
    // original text is contained in improved — don't double-show.
  } else {
    for (const line of origLines) {
      if (line.trim()) out.push({ type: "removed", text: line });
    }
  }
  for (const line of newLines) {
    out.push({ type: "added", text: line });
  }
  return out;
}

// ---------- Token estimate ----------

/** Rough token estimate (~4 chars per token for English). */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

// ---------- Negative-constraint builder ----------

/** Build a 'Do not:' block from a list of forbidden items. */
export function buildNegativeConstraints(items: string[]): string {
  const clean = items.map((s) => s.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  return `Do not:\n- ${clean.join("\n- ")}`;
}

// ---------- Renderers ----------

/** Render analysis as plain text. */
export function renderAnalysisText(a: PromptAnalysis): string {
  const lines = [
    `Overall score: ${a.overall}/100`,
    `Words: ${a.wordCount} · Characters: ${a.charCount}`,
    "",
    "Dimension breakdown:",
    `  Clarity:      ${a.clarity.score}/100 ${a.clarity.hasIt ? "[has]" : "[missing]"}`,
    `  Specificity:  ${a.specificity.score}/100 ${a.specificity.hasIt ? "[has]" : "[missing]"}`,
    `  Context:      ${a.context.score}/100 ${a.context.hasIt ? "[has]" : "[missing]"}`,
    `  Constraints:  ${a.constraints.score}/100 ${a.constraints.hasIt ? "[has]" : "[missing]"}`,
    `  Format:       ${a.format.score}/100 ${a.format.hasIt ? "[has]" : "[missing]"}`,
    `  Examples:     ${a.examples.score}/100 ${a.examples.hasIt ? "[has]" : "[missing]"}`,
    "",
    "Tips:",
  ];
  for (const d of [a.clarity, a.specificity, a.context, a.constraints, a.format, a.examples]) {
    for (const t of d.tips) lines.push(`  [${d.dimension}] ${t}`);
  }
  return lines.join("\n");
}

/** Render suggestions as plain text. */
export function renderSuggestionsText(suggestions: Suggestion[]): string {
  if (suggestions.length === 0) return "No suggestions — prompt already strong.";
  const lines = ["Suggestions:"];
  for (const s of suggestions) {
    lines.push(`- [${s.type}] ${s.title}: ${s.reason}`);
    lines.push(`    snippet: ${s.snippet}`);
  }
  return lines.join("\n");
}

/** Render full result as Markdown. */
export function renderMarkdown(r: RewriteResult): string {
  const lines: string[] = [];
  lines.push("# Improved Prompt");
  lines.push("");
  lines.push("```");
  lines.push(r.improved);
  lines.push("```");
  lines.push("");
  lines.push("## Score");
  lines.push("");
  lines.push(`Overall: **${r.analysis.overall}/100**`);
  lines.push("");
  lines.push("| Dimension | Score | Status |");
  lines.push("|---|---|---|");
  for (const d of [r.analysis.clarity, r.analysis.specificity, r.analysis.context, r.analysis.constraints, r.analysis.format, r.analysis.examples]) {
    lines.push(`| ${d.dimension} | ${d.score}/100 | ${d.hasIt ? "present" : "missing"} |`);
  }
  lines.push("");
  lines.push("## Suggestions applied");
  lines.push("");
  for (const s of r.suggestions) {
    lines.push(`- **${s.title}** — ${s.reason}`);
  }
  if (r.variables.length > 0) {
    lines.push("");
    lines.push("## Variables");
    lines.push("");
    for (const v of r.variables) {
      lines.push(`- \`{{${v.name}}}\` — was: \`${v.original}\``);
    }
  }
  lines.push("");
  lines.push("## Template");
  lines.push("");
  lines.push("```");
  lines.push(r.template);
  lines.push("```");
  lines.push("");
  lines.push(`_Estimated tokens: ${r.tokenEstimate}_`);
  return lines.join("\n");
}

/** Render result as JSON. */
export function renderJson(r: RewriteResult): string {
  return JSON.stringify({
    original: r.original,
    improved: r.improved,
    template: r.template,
    variables: r.variables,
    suggestions: r.suggestions,
    analysis: r.analysis,
    targetModel: r.targetModel,
    useCase: r.useCase,
    tokenEstimate: r.tokenEstimate,
  }, null, 2);
}

/** Render the diff as plain text. */
export function renderDiffText(diff: DiffLine[]): string {
  return diff.map((d) => {
    const prefix = d.type === "added" ? "+ " : d.type === "removed" ? "- " : "  ";
    return `${prefix}${d.text}`;
  }).join("\n");
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

export function buildShareUrl(prompt: string, targetModel: TargetModel, useCase: UseCase): string {
  const params = new URLSearchParams();
  if (prompt) params.set("p", prompt);
  params.set("m", targetModel);
  params.set("u", useCase);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { prompt: "", targetModel: "gpt4", useCase: "general" };
  const params = new URLSearchParams(clean);
  const prompt = params.get("p") ?? "";
  const m = params.get("m") ?? "gpt4";
  const u = params.get("u") ?? "general";
  const validM: TargetModel[] = ["gpt4", "claude", "gemini", "local"];
  const validU: UseCase[] = ["general", "coding", "writing", "image-gen", "analysis", "agent-system-prompt"];
  return {
    prompt,
    targetModel: validM.includes(m as TargetModel) ? (m as TargetModel) : "gpt4",
    useCase: validU.includes(u as UseCase) ? (u as UseCase) : "general",
  };
}

// ---------- LLM helpers (UI-only — pure prompt builder) ----------

/** Build the prompt to send to an LLM for richer rewriting (BYO key). */
export function buildLlmPrompt(original: string, targetModel: TargetModel, useCase: UseCase): string {
  return [
    "You are an expert prompt engineer.",
    "Rewrite the user's prompt into a structured, model-ready prompt.",
    `Target model family: ${TARGET_MODEL_LABELS[targetModel]}.`,
    `Use case: ${USE_CASE_LABELS[useCase]}.`,
    "Keep the user's intent. Add: role, context, constraints, format, and one example.",
    "Do not add invented facts. Use placeholders like {{topic}} for unknowns.",
    "Return ONLY the rewritten prompt, no commentary.",
    "",
    "USER PROMPT:",
    original,
  ].join("\n");
}

/** Render an LLM-returned string as a minimal RewriteResult-style improvement. */
export function renderLlmResult(llmText: string, original: string): { improved: string; template: string; variables: ExtractedVariable[] } {
  const improved = normalizePrompt(llmText) || original;
  const { template, variables } = extractVariables(improved);
  return { improved, template, variables };
}
