/**
 * AI Thesis Statement Generator — pure logic.
 *
 * Generate strong, arguable thesis statements from a topic, stance,
 * and essay type. Each thesis includes supporting-point scaffolds,
 * a counter-argument prompt, and a transparent rubric score
 * (clarity, specificity, arguability, scope). Pure-JS engine — no
 * DOM, no network. The optional LLM call (BYO API key) lives in
 * ui.tsx because it touches the network.
 *
 * Pure functions only.
 */

// ---------- Types ----------

export type EssayType = "argumentative" | "analytical" | "expository" | "compare-contrast";

export type Stance = "for" | "against" | "neutral";

export type AcademicLevel = "high-school" | "undergraduate" | "graduate";

export type CitationStyle = "apa" | "mla" | "chicago" | "harvard";

export interface ThesisInput {
  topic: string;
  stance: Stance;
  essayType: EssayType;
  academicLevel: AcademicLevel;
  citationStyle: CitationStyle;
}

export interface ThesisScores {
  clarity: number;        // 0-100
  specificity: number;    // 0-100
  arguability: number;    // 0-100
  scope: number;          // 0-100
  composite: number;      // weighted average
}

export interface SupportingPoint {
  label: string;
  template: string;       // contains [EVIDENCE], [REASONING] placeholders
  hint: string;
}

export interface ThesisOption {
  id: string;
  text: string;
  essayType: EssayType;
  stance: Stance;
  scores: ThesisScores;
  improvementTip: string;
  supportingPoints: SupportingPoint[];
  counterArgument: string;
  keywords: string[];
}

export interface ThesisResult {
  input: ThesisInput;
  theses: ThesisOption[];     // sorted by composite score desc
  topicKeywords: string[];
  scopeNarrowing: string[];
  generatedAt: number;
}

export interface HistoryEntry {
  ts: number;
  topic: string;
  stance: Stance;
  essayType: EssayType;
  thesisCount: number;
  topScore: number;
}

export interface ShareState {
  topic: string;
  stance: Stance;
  essayType: EssayType;
  academicLevel: AcademicLevel;
  citationStyle: CitationStyle;
}

export interface LlmRequestBody {
  model: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  temperature: number;
  max_tokens: number;
}

// ---------- Labels ----------

export const ESSAY_TYPE_LABELS: Record<EssayType, string> = {
  argumentative: "Argumentative",
  analytical: "Analytical",
  expository: "Expository",
  "compare-contrast": "Compare / Contrast",
};

export const STANCE_LABELS: Record<Stance, string> = {
  for: "For / Pro",
  against: "Against / Con",
  neutral: "Neutral / Exploratory",
};

export const ACADEMIC_LEVEL_LABELS: Record<AcademicLevel, string> = {
  "high-school": "High School",
  undergraduate: "Undergraduate",
  graduate: "Graduate",
};

export const CITATION_STYLE_LABELS: Record<CitationStyle, string> = {
  apa: "APA",
  mla: "MLA",
  chicago: "Chicago",
  harvard: "Harvard",
};

export const SAMPLE_TOPICS: string[] = [
  "Should social media platforms be regulated as utilities?",
  "The effects of remote work on urban economies",
  "Universal basic income as a response to automation",
  "Climate migration and international law",
  "The role of algorithms in shaping political discourse",
  "Standardized testing and educational equity",
  "Genetic engineering and the ethics of human enhancement",
  "The gig economy and labor rights",
  "Artificial intelligence in criminal sentencing",
  "The decline of local journalism and civic engagement",
  "Mental health impacts of always-on workplace culture",
  "The privacy trade-offs of smart city infrastructure",
];

// ---------- Topic helpers ----------

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for",
  "with", "without", "as", "by", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "should", "could", "may", "might", "can", "shall", "must", "that",
  "this", "these", "those", "it", "its", "they", "them", "their", "we",
  "us", "our", "you", "your", "he", "she", "him", "her", "his", "hers",
  "about", "into", "from", "at", "if", "than", "then", "so", "such",
  "not", "no", "yes", "vs", "versus", "on",
]);

export function normalizeTopic(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim().slice(0, 240);
}

export function normalizeStance(s: string): Stance {
  const t = (s || "").toLowerCase().trim();
  if (t === "for" || t === "pro" || t === "support" || t === "yes") return "for";
  if (t === "against" || t === "con" || t === "oppose" || t === "no") return "against";
  return "neutral";
}

/** Tokenize a topic into lowercase words (preserves hyphenated compounds). */
export function tokenizeTopic(topic: string): string[] {
  const t = normalizeTopic(topic);
  if (!t) return [];
  return t
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Extract significant keywords (drops stop words, picks nouns/long words). */
export function extractKeywords(topic: string, max = 6): string[] {
  const tokens = tokenizeTopic(topic);
  const scored = tokens
    .filter((w) => !STOP_WORDS.has(w) && w.length > 2)
    .map((w) => ({ w, score: w.length + (w.includes("-") ? 2 : 0) + (tokens.filter((x) => x === w).length > 1 ? 3 : 0) }));
  scored.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of scored) {
    if (!seen.has(s.w)) {
      seen.add(s.w);
      out.push(s.w);
    }
    if (out.length >= max) break;
  }
  return out;
}

export function titleCase(s: string): string {
  if (!s) return s;
  return s
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function topicToPhrase(topic: string): string {
  return normalizeTopic(topic).toLowerCase();
}

/** Detect essay type from topic heuristics; returns null if ambiguous. */
export function detectEssayType(topic: string): EssayType | null {
  const t = normalizeTopic(topic).toLowerCase();
  if (!t) return null;
  if (/^(should|must|ought|why .+ should|why .+ must|argue|position on)/.test(t)) return "argumentative";
  if (/\b(analyze|analysis|mechanism|how .+ works|why .+ happens|causes? of|effects? of)\b/.test(t)) return "analytical";
  if (/\b(explain|what is|history of|define|overview of|introduction to)\b/.test(t)) return "expository";
  if (/\b(vs\.?|versus|compared? to|comparing|difference between|similarities? between)\b/.test(t)) return "compare-contrast";
  return null;
}

// ---------- Scope narrowing ----------

export function suggestScopeNarrowing(topic: string): string[] {
  const t = normalizeTopic(topic);
  if (!t) return [];
  const tokens = tokenizeTopic(t);
  const out: string[] = [];
  // Very short topic → suggest angle
  if (tokens.length <= 3) {
    out.push(`Narrow "${t}" by adding a population, time period, or context (e.g. "${t} among first-generation college students").`);
  }
  // Very long topic → suggest focus
  if (tokens.length >= 14) {
    out.push(`"${t}" is broad. Try focusing on a single dimension — a specific outcome, actor, or context.`);
  }
  // Generic single-word topic
  if (tokens.length === 1) {
    out.push(`"${t}" alone is too broad. Pick a specific case, debate, or consequence of ${t}.`);
  }
  // No debatable verb
  if (!/\b(should|must|ought|argue|claim|because|causes?|leads? to|results? in)\b/i.test(t)) {
    out.push(`Your topic is descriptive. Add a debatable angle: "${t} should be reconsidered because…" or "${t} is best understood as…".`);
  }
  // Always suggest one quality check
  out.push(`Ask: who would disagree, and why? If no reasonable person would disagree, your thesis is too factual — sharpen the claim.`);
  return out;
}

// ---------- Thesis templates ----------

interface ThesisTemplate {
  id: string;
  essayType: EssayType;
  stance: Stance;
  build: (topic: string, kw: string[], level: AcademicLevel) => string;
}

function kwOr(kw: string[], idx: number, fallback: string): string {
  return kw[idx] ?? fallback;
}

const TEMPLATES: ThesisTemplate[] = [
  // Argumentative — for
  {
    id: "arg-for-1",
    essayType: "argumentative",
    stance: "for",
    build: (t, kw) =>
      `${titleCase(t)} should be embraced because ${kwOr(kw, 0, t)} produces measurable benefits for ${kwOr(kw, 1, "those it serves")}, and the alternatives carry greater costs than the change itself.`,
  },
  {
    id: "arg-for-2",
    essayType: "argumentative",
    stance: "for",
    build: (t, kw) =>
      `Although critics raise legitimate concerns, ${t.toLowerCase()} remains the better course because the evidence on ${kwOr(kw, 0, t)} demonstrates that its benefits outweigh its risks when implemented responsibly.`,
  },
  {
    id: "arg-for-3",
    essayType: "argumentative",
    stance: "for",
    build: (t, kw, level) =>
      level === "graduate"
        ? `The case for ${t.toLowerCase()} rests not on optimistic projections but on convergent evidence across ${kwOr(kw, 0, "the field")} and ${kwOr(kw, 1, "neighboring literatures")}, which together warrant a decisive shift in current policy.`
        : `The evidence supports ${t.toLowerCase()} as the right choice: research on ${kwOr(kw, 0, t)} shows clear benefits that critics have not yet refuted.`,
  },
  // Argumentative — against
  {
    id: "arg-against-1",
    essayType: "argumentative",
    stance: "against",
    build: (t, kw) =>
      `${titleCase(t)} should be rejected because, despite its appeal, the costs — measured in ${kwOr(kw, 1, "unintended consequences")} and unequal burdens — exceed the claimed benefits of ${kwOr(kw, 0, t)}.`,
  },
  {
    id: "arg-against-2",
    essayType: "argumentative",
    stance: "against",
    build: (t, kw) =>
      `Although ${t.toLowerCase()} is often defended on principled grounds, a closer look at ${kwOr(kw, 0, t)} in practice reveals structural failures that make reform preferable to expansion.`,
  },
  {
    id: "arg-against-3",
    essayType: "argumentative",
    stance: "against",
    build: (t) =>
      `The case against ${t.toLowerCase()} is not that its goals are unworthy, but that its mechanisms are unsound: the means it relies on cannot deliver the ends it promises, and the gap between them is widening.`,
  },
  // Analytical — neutral
  {
    id: "ana-1",
    essayType: "analytical",
    stance: "neutral",
    build: (t, kw) =>
      `${titleCase(t)} operates through three interconnected mechanisms — ${kwOr(kw, 0, t)}, ${kwOr(kw, 1, "context")}, and ${kwOr(kw, 2, "consequence")} — that together explain why its effects are both durable and difficult to reverse.`,
  },
  {
    id: "ana-2",
    essayType: "analytical",
    stance: "neutral",
    build: (t, kw) =>
      `Rather than a single cause, ${t.toLowerCase()} emerges from the interaction of ${kwOr(kw, 0, t)} and ${kwOr(kw, 1, "structural conditions")}, a dynamic that becomes visible only when the analysis moves beyond surface explanations.`,
  },
  {
    id: "ana-3",
    essayType: "analytical",
    stance: "neutral",
    build: (t) =>
      `${titleCase(t)} is best understood not as an isolated phenomenon but as the visible edge of deeper forces; tracing those forces reveals both why it persists and why it resists simple solutions.`,
  },
  // Expository — neutral
  {
    id: "exp-1",
    essayType: "expository",
    stance: "neutral",
    build: (t, kw) =>
      `${titleCase(t)} can be understood through its origins in ${kwOr(kw, 0, t)}, its current mechanisms, and its consequences for ${kwOr(kw, 1, "those it affects")}.`,
  },
  {
    id: "exp-2",
    essayType: "expository",
    stance: "neutral",
    build: (t) =>
      `${titleCase(t)}, once examined closely, reveals itself as both more ordinary and more consequential than its common portrayals suggest; this essay traces that gap between appearance and substance.`,
  },
  {
    id: "exp-3",
    essayType: "expository",
    stance: "neutral",
    build: (t, kw) =>
      `To explain ${t.toLowerCase()} is to explain something important about ${kwOr(kw, 1, "the modern world")}: its history, its present shape, and its likely future each carry lessons that extend beyond the subject itself.`,
  },
  // Compare-contrast — neutral
  {
    id: "cc-1",
    essayType: "compare-contrast",
    stance: "neutral",
    build: (t, kw) =>
      `Comparing ${kwOr(kw, 0, t)} and ${kwOr(kw, 1, "its counterpart")} reveals more similarities than surface differences suggest, particularly in their underlying assumptions and long-term effects.`,
  },
  {
    id: "cc-2",
    essayType: "compare-contrast",
    stance: "neutral",
    build: (t, kw) =>
      `Although ${kwOr(kw, 0, t)} and ${kwOr(kw, 1, "its counterpart")} appear to differ fundamentally, they converge on the same underlying principle when examined closely — a convergence that reorders the usual comparison.`,
  },
  {
    id: "cc-3",
    essayType: "compare-contrast",
    stance: "neutral",
    build: (t, kw) =>
      `${titleCase(kwOr(kw, 0, t))} and ${kwOr(kw, 1, "its counterpart")} diverge most sharply in their treatment of ${kwOr(kw, 2, "consequences")}, a difference that ultimately determines which is preferable in practice.`,
  },
  {
    id: "cc-4",
    essayType: "compare-contrast",
    stance: "neutral",
    build: (t, kw) =>
      `When compared on the dimension of ${kwOr(kw, 2, "their core mechanism")}, ${kwOr(kw, 0, t)} and ${kwOr(kw, 1, "its counterpart")} differ less in aim than in method — and the method, not the aim, decides which serves its purpose better.`,
  },
  {
    id: "cc-5",
    essayType: "compare-contrast",
    stance: "neutral",
    build: (t, kw) =>
      `Side by side, ${kwOr(kw, 0, t)} and ${kwOr(kw, 1, "its counterpart")} expose a shared assumption neither names openly: that ${kwOr(kw, 2, "the underlying trade-off")} is acceptable, an assumption worth examining before either is chosen.`,
  },
  // Additional analytical — neutral
  {
    id: "ana-4",
    essayType: "analytical",
    stance: "neutral",
    build: (t, kw) =>
      `${titleCase(t)} is best analyzed as a feedback loop: ${kwOr(kw, 0, t)} reinforces ${kwOr(kw, 1, "its context")}, which in turn amplifies ${kwOr(kw, 0, t)} — a cycle visible only when the analysis spans enough time.`,
  },
  {
    id: "ana-5",
    essayType: "analytical",
    stance: "neutral",
    build: (t, kw) =>
      `What makes ${t.toLowerCase()} difficult to change is not its visible structure but its hidden dependencies on ${kwOr(kw, 0, t)} and ${kwOr(kw, 1, "the conditions that produced it")}; tracing those dependencies reveals where intervention is possible.`,
  },
  // Additional expository — neutral
  {
    id: "exp-4",
    essayType: "expository",
    stance: "neutral",
    build: (t, kw) =>
      `To understand ${t.toLowerCase()} is to trace a path from ${kwOr(kw, 0, t)} as it was, through ${kwOr(kw, 1, "the forces that shaped it")}, to ${kwOr(kw, 2, "what it has become")} — a path that explains both the present and the trajectory ahead.`,
  },
  {
    id: "exp-5",
    essayType: "expository",
    stance: "neutral",
    build: (t, kw) =>
      `${titleCase(t)} is, at heart, an answer to a question that ${kwOr(kw, 1, "its field")} has asked for generations; examining that question reveals not just what ${t.toLowerCase()} is, but why it matters now.`,
  },
  // Additional argumentative — for and against
  {
    id: "arg-for-4",
    essayType: "argumentative",
    stance: "for",
    build: (t, kw) =>
      `The weight of evidence on ${kwOr(kw, 0, t)} leaves little room for the status quo: ${t.toLowerCase()} should be pursued because the cost of inaction now exceeds the cost of the change itself.`,
  },
  {
    id: "arg-against-4",
    essayType: "argumentative",
    stance: "against",
    build: (t, kw) =>
      `Even on its own terms, ${t.toLowerCase()} fails: the very ${kwOr(kw, 0, t)} it promises to improve shows that the proposed remedy would deepen the problem rather than solve it.`,
  },
  {
    id: "arg-against-5",
    essayType: "argumentative",
    stance: "against",
    build: (t, kw) =>
      `The case against ${t.toLowerCase()} rests not on nostalgia but on evidence: where it has been tried, ${kwOr(kw, 0, t)} has consistently produced ${kwOr(kw, 1, "outcomes opposite to those promised")}, and the pattern is now too consistent to dismiss.`,
  },
];

// ---------- Rubric scoring ----------

const HEDGE_WORDS = [
  "maybe", "perhaps", "might", "possibly", "seems", "appears", "i think",
  "i believe", "kind of", "sort of", "probably", "arguably",
];

const DEBATABLE_VERBS = [
  "should", "must", "ought", "need to", "have to", "is wrong",
  "is right", "is preferable", "is better", "is worse", "is the best",
  "is the worst", "fails", "succeeds", "deserves", "warrants",
];

const FACTUAL_CUES = [
  "is defined as", "consists of", "is a", "are a", "is the study of",
  "is the practice of", "is located", "was born", "was published",
];

export interface ClaritySignals {
  sentenceLength: number;
  wordCount: number;
  hedgeCount: number;
  commaCount: number;
}

export function analyzeClarity(text: string): ClaritySignals {
  const words = text.split(/\s+/).filter(Boolean);
  const sentenceLength = words.length;
  const lower = text.toLowerCase();
  let hedgeCount = 0;
  for (const h of HEDGE_WORDS) {
    const re = new RegExp(`\\b${h.replace(/\s+/g, "\\s+")}\\b`, "gi");
    const m = lower.match(re);
    if (m) hedgeCount += m.length;
  }
  const commaCount = (text.match(/,/g) || []).length;
  return { sentenceLength, wordCount: words.length, hedgeCount, commaCount };
}

export function scoreClarity(text: string): number {
  const s = analyzeClarity(text);
  let score = 100;
  // Too long → penalize
  if (s.sentenceLength > 35) score -= (s.sentenceLength - 35) * 1.5;
  if (s.sentenceLength < 12) score -= (12 - s.sentenceLength) * 2;
  // Hedges → penalize
  score -= s.hedgeCount * 8;
  // Too many commas → penalize slightly
  if (s.commaCount > 4) score -= (s.commaCount - 4) * 3;
  return clamp(score);
}

export interface SpecificitySignals {
  namedEntities: number;
  numbers: number;
  concreteNouns: number;
  abstractNouns: number;
}

const ABSTRACT_NOUNS = new Set([
  "issue", "problem", "thing", "matter", "concept", "idea", "factor",
  "aspect", "element", "situation", "phenomenon", "case", "topic",
  "subject", "field", "area", "domain",
]);

export function analyzeSpecificity(text: string, kw: string[]): SpecificitySignals {
  const words = text.toLowerCase().split(/[^a-z-]+/).filter(Boolean);
  const namedEntities = (text.match(/\b[A-Z][a-z]+/g) || []).length;
  const numbers = (text.match(/\b\d+(\.\d+)?%?\b/g) || []).length;
  let concreteNouns = 0;
  let abstractNouns = 0;
  for (const w of words) {
    if (kw.includes(w)) concreteNouns += 1;
    else if (ABSTRACT_NOUNS.has(w)) abstractNouns += 1;
  }
  return { namedEntities, numbers, concreteNouns, abstractNouns };
}

export function scoreSpecificity(text: string, kw: string[]): number {
  const s = analyzeSpecificity(text, kw);
  let score = 50;
  score += s.concreteNouns * 6;
  score += s.namedEntities * 4;
  score += s.numbers * 5;
  score -= s.abstractNouns * 5;
  return clamp(score);
}

export function analyzeArguability(text: string): { debatableVerbCount: number; factualCueCount: number } {
  const lower = text.toLowerCase();
  let debatableVerbCount = 0;
  for (const v of DEBATABLE_VERBS) {
    const re = new RegExp(`\\b${v.replace(/\s+/g, "\\s+")}\\b`, "gi");
    const m = lower.match(re);
    if (m) debatableVerbCount += m.length;
  }
  let factualCueCount = 0;
  for (const c of FACTUAL_CUES) {
    const re = new RegExp(`\\b${c.replace(/\s+/g, "\\s+")}\\b`, "gi");
    const m = lower.match(re);
    if (m) factualCueCount += m.length;
  }
  return { debatableVerbCount, factualCueCount };
}

export function scoreArguability(text: string, essayType: EssayType, stance: Stance): number {
  const a = analyzeArguability(text);
  let score = 40;
  if (essayType === "argumentative") {
    score += a.debatableVerbCount * 20;
    score -= a.factualCueCount * 15;
    if (stance === "neutral") score -= 15; // argumentative should take a side
  } else if (essayType === "expository") {
    // Expository is fine being descriptive; small bonus for clarity
    score += 10;
    score += a.factualCueCount * 3;
  } else if (essayType === "analytical") {
    score += 10;
    score += a.debatableVerbCount * 8;
  } else if (essayType === "compare-contrast") {
    score += 10;
    if (/\b(converge|diverge|similar|differ|compar)/i.test(text)) score += 10;
  }
  return clamp(score);
}

export function analyzeScope(text: string): { wordCount: number; claimCount: number; conjunctionCount: number } {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const claimCount = (text.match(/\b(should|must|because|by|through|via)\b/gi) || []).length;
  const conjunctionCount = (text.match(/\b(and|or|but|while|whereas|although)\b/gi) || []).length;
  return { wordCount, claimCount, conjunctionCount };
}

export function scoreScope(text: string): number {
  const s = analyzeScope(text);
  let score = 70;
  if (s.wordCount > 50) score -= (s.wordCount - 50) * 1.2;
  if (s.wordCount < 12) score -= (12 - s.wordCount) * 2;
  if (s.conjunctionCount > 3) score -= (s.conjunctionCount - 3) * 4;
  if (s.claimCount >= 1 && s.claimCount <= 3) score += 10;
  return clamp(score);
}

export function scoreThesis(text: string, essayType: EssayType, stance: Stance, kw: string[]): ThesisScores {
  const clarity = scoreClarity(text);
  const specificity = scoreSpecificity(text, kw);
  const arguability = scoreArguability(text, essayType, stance);
  const scope = scoreScope(text);
  // Weighted composite: arguability matters most for argumentative
  const weights = essayType === "argumentative"
    ? { clarity: 0.25, specificity: 0.25, arguability: 0.35, scope: 0.15 }
    : essayType === "expository"
      ? { clarity: 0.35, specificity: 0.25, arguability: 0.10, scope: 0.30 }
      : { clarity: 0.30, specificity: 0.25, arguability: 0.20, scope: 0.25 };
  const composite = Math.round(
    clarity * weights.clarity +
    specificity * weights.specificity +
    arguability * weights.arguability +
    scope * weights.scope,
  );
  return { clarity, specificity, arguability, scope, composite };
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

// ---------- Improvement tips ----------

export function suggestImprovement(text: string, scores: ThesisScores, essayType: EssayType): string {
  const lowest = Object.entries(scores)
    .filter(([k]) => k !== "composite")
    .sort((a, b) => a[1] - b[1])[0];
  const [lowestKey, lowestVal] = lowest;
  if (lowestVal >= 80) return "Strong thesis across all four rubric dimensions — refine for voice and flow.";
  switch (lowestKey) {
    case "clarity":
      return "Tighten the sentence: cut hedges, shorten clauses, aim for 18–28 words with at most 2 commas.";
    case "specificity":
      return "Add a concrete noun, named actor, or measurable qualifier. Replace abstract terms (issue, factor, concept) with the specific thing you mean.";
    case "arguability":
      return essayType === "argumentative"
        ? "Sharpen the debatable verb ('should', 'must', 'ought'). Avoid factual definitions — name the stance someone could oppose."
        : "Make the analytical claim sharper: name the mechanism, not just the topic. Someone should be able to disagree with your reading.";
    case "scope":
      return "Right-size the claim. If too broad, narrow to one mechanism or population. If too narrow, connect to a wider implication.";
    default:
      return "Refine for clarity and specificity.";
  }
}

// ---------- Supporting points ----------

export function generateSupportingPoints(thesis: string, kw: string[], essayType: EssayType): SupportingPoint[] {
  const main = kwOr(kw, 0, "the topic");
  const second = kwOr(kw, 1, "the affected group");
  if (essayType === "argumentative") {
    return [
      {
        label: "Evidence of benefit",
        template: `[EVIDENCE: peer-reviewed study on ${main}] demonstrates that the claim holds because [REASONING: causal mechanism].`,
        hint: "Find a study or dataset that quantifies the benefit.",
      },
      {
        label: "Real-world example",
        template: `The case of [EXAMPLE: real-world case] illustrates the thesis because [REASONING: how it instantiates the mechanism].`,
        hint: "Pick a case where the mechanism is visible.",
      },
      {
        label: "Rebuttal of counter",
        template: `Although critics cite [COUNTER: strongest objection], this objection fails because [REASONING: why the counter is incomplete].`,
        hint: "Steel-man the objection before answering it.",
      },
    ];
  }
  if (essayType === "analytical") {
    return [
      {
        label: "Mechanism step 1",
        template: `${titleCase(main)} begins with [EVIDENCE: structural condition], which sets the stage for what follows.`,
        hint: "Identify the originating condition.",
      },
      {
        label: "Mechanism step 2",
        template: `Under that condition, [EVIDENCE: causal chain] produces ${second} as a downstream effect.`,
        hint: "Trace the cause-and-effect.",
      },
      {
        label: "Consequence",
        template: `The result is [EVIDENCE: measurable outcome], which confirms the analytical claim that ${main} operates through this mechanism.`,
        hint: "Name a measurable consequence.",
      },
    ];
  }
  if (essayType === "expository") {
    return [
      {
        label: "Definition",
        template: `${titleCase(main)} is best defined as [DEFINITION: precise definition from authoritative source], which distinguishes it from [CONTRAST: neighboring concept].`,
        hint: "Cite an authoritative definition.",
      },
      {
        label: "Background",
        template: `Historically, ${main} emerged from [EVIDENCE: historical context], which shaped its current form.`,
        hint: "Provide origin and context.",
      },
      {
        label: "Significance",
        template: `Today, ${main} matters because [EVIDENCE: measurable impact on ${second}].`,
        hint: "Name the measurable impact.",
      },
    ];
  }
  // compare-contrast
  return [
    {
      label: "Point of comparison",
      template: `On the dimension of [DIMENSION: criterion], ${main} and ${second} [EVIDENCE: similar or different] in a way that [REASONING: reshapes the comparison].`,
      hint: "Pick one comparison criterion at a time.",
    },
    {
      label: "Underlying assumption",
      template: `Beneath the surface, both ${main} and ${second} assume [EVIDENCE: shared assumption], which becomes visible when [REASONING: how it surfaces].`,
      hint: "Surface the unstated shared premise.",
    },
    {
      label: "Practical implication",
      template: `Because they [EVIDENCE: converge or diverge] on this assumption, the choice between ${main} and ${second} turns on [REASONING: which implication matters more].`,
      hint: "End with which option is preferable and why.",
    },
  ];
}

// ---------- Counter-argument ----------

export function generateCounterArgument(thesis: string, kw: string[], essayType: EssayType, stance: Stance): string {
  const main = kwOr(kw, 0, "the topic");
  const oppositeStance = stance === "for" ? "reject" : stance === "against" ? "defend" : "complicate";
  if (essayType === "argumentative") {
    return `Critics who ${oppositeStance} ${main} would argue that the benefits you cite are overstated, the costs you minimize are greater than you allow, or the mechanism you describe does not generalize beyond the cases you selected. Steel-man this objection before answering it.`;
  }
  if (essayType === "analytical") {
    return `A skeptic might challenge your mechanism by arguing that ${main} is better explained by an alternative cause — perhaps a structural condition you did not foreground. Name the strongest alternative explanation and show why your mechanism is more compelling.`;
  }
  if (essayType === "expository") {
    return `A reader may push back that your explanation of ${main} is incomplete — that it omits a key historical force, a competing definition, or a counterexample. Pre-empt this by naming what you are leaving out and why.`;
  }
  return `A critic could argue that your comparison of ${main} and ${kwOr(kw, 1, "its counterpart")} rests on a single dimension and that on a different dimension the conclusion reverses. Acknowledge the dimension you chose and justify it.`;
}

// ---------- Thesis generation ----------

export function generateTheses(input: ThesisInput): ThesisResult {
  const topic = normalizeTopic(input.topic);
  const kw = extractKeywords(topic);
  // Filter templates by essay type and stance (with fallback to neutral)
  let pool = TEMPLATES.filter((t) => t.essayType === input.essayType && t.stance === input.stance);
  if (pool.length < 3) {
    // Fall back to any stance for this essay type
    pool = TEMPLATES.filter((t) => t.essayType === input.essayType);
  }
  // Ensure at least 5 theses; if pool < 5, duplicate by varying academic level
  const theses: ThesisOption[] = pool.map((tpl) => {
    const text = tpl.build(topic, kw, input.academicLevel);
    const scores = scoreThesis(text, input.essayType, input.stance, kw);
    return {
      id: tpl.id,
      text,
      essayType: tpl.essayType,
      stance: tpl.stance,
      scores,
      improvementTip: suggestImprovement(text, scores, input.essayType),
      supportingPoints: generateSupportingPoints(text, kw, input.essayType),
      counterArgument: generateCounterArgument(text, kw, input.essayType, input.stance),
      keywords: kw,
    };
  });
  // If we have fewer than 5, generate variants by varying the academic level wording
  if (theses.length < 5) {
    const levels: AcademicLevel[] = ["high-school", "undergraduate", "graduate"];
    let i = 0;
    while (theses.length < 5 && i < pool.length * 3) {
      const tpl = pool[i % pool.length];
      const lvl = levels[i % levels.length];
      const text = tpl.build(topic, kw, lvl);
      // skip exact duplicates
      if (theses.some((t) => t.text === text)) { i += 1; continue; }
      const scores = scoreThesis(text, input.essayType, input.stance, kw);
      theses.push({
        id: `${tpl.id}-v${i}`,
        text,
        essayType: tpl.essayType,
        stance: tpl.stance,
        scores,
        improvementTip: suggestImprovement(text, scores, input.essayType),
        supportingPoints: generateSupportingPoints(text, kw, input.essayType),
        counterArgument: generateCounterArgument(text, kw, input.essayType, input.stance),
        keywords: kw,
      });
      i += 1;
    }
  }
  // Sort by composite score desc
  theses.sort((a, b) => b.scores.composite - a.scores.composite);
  return {
    input,
    theses,
    topicKeywords: kw,
    scopeNarrowing: suggestScopeNarrowing(topic),
    generatedAt: Date.now(),
  };
}

/** Compute aggregate stats for a result. */
export interface ResultStats {
  thesisCount: number;
  topScore: number;
  avgScore: number;
  essayTypeLabel: string;
  stanceLabel: string;
}

export function computeStats(result: ThesisResult): ResultStats {
  const scores = result.theses.map((t) => t.scores.composite);
  const topScore = scores.length ? Math.max(...scores) : 0;
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  return {
    thesisCount: result.theses.length,
    topScore,
    avgScore,
    essayTypeLabel: ESSAY_TYPE_LABELS[result.input.essayType],
    stanceLabel: STANCE_LABELS[result.input.stance],
  };
}

// ---------- Rendering ----------

export function renderThesesText(result: ThesisResult): string {
  const lines: string[] = [];
  lines.push(`Thesis Statements: ${result.input.topic}`);
  lines.push(`Type: ${ESSAY_TYPE_LABELS[result.input.essayType]} · Stance: ${STANCE_LABELS[result.input.stance]}`);
  lines.push("");
  result.theses.forEach((t, i) => {
    lines.push(`${i + 1}. [Score: ${t.scores.composite}/100] ${t.text}`);
    lines.push(`   Clarity ${t.scores.clarity} · Specificity ${t.scores.specificity} · Arguability ${t.scores.arguability} · Scope ${t.scores.scope}`);
    lines.push(`   Tip: ${t.improvementTip}`);
    lines.push(`   Counter: ${t.counterArgument}`);
    lines.push("");
  });
  return lines.join("\n");
}

export function renderThesesMarkdown(result: ThesisResult): string {
  const lines: string[] = [];
  lines.push(`# Thesis Statements: ${result.input.topic}`);
  lines.push(`> Type: **${ESSAY_TYPE_LABELS[result.input.essayType]}** · Stance: **${STANCE_LABELS[result.input.stance]}** · Level: **${ACADEMIC_LEVEL_LABELS[result.input.academicLevel]}**`);
  lines.push("");
  if (result.scopeNarrowing.length > 0) {
    lines.push(`## Scope suggestions`);
    for (const s of result.scopeNarrowing) lines.push(`- ${s}`);
    lines.push("");
  }
  result.theses.forEach((t, i) => {
    lines.push(`## ${i + 1}. Score: ${t.scores.composite}/100`);
    lines.push(`> ${t.text}`);
    lines.push("");
    lines.push(`**Scores:** Clarity ${t.scores.clarity} · Specificity ${t.scores.specificity} · Arguability ${t.scores.arguability} · Scope ${t.scores.scope}`);
    lines.push("");
    lines.push(`**Tip:** ${t.improvementTip}`);
    lines.push("");
    lines.push(`### Supporting points`);
    for (const p of t.supportingPoints) {
      lines.push(`- **${p.label}** — ${p.template}`);
      lines.push(`  - _${p.hint}_`);
    }
    lines.push("");
    lines.push(`### Counter-argument`);
    lines.push(`> ${t.counterArgument}`);
    lines.push("");
  });
  return lines.join("\n");
}

export function renderThesesJson(result: ThesisResult): string {
  return JSON.stringify(result, null, 2);
}

// ---------- Outline handoff ----------

export function buildOutlineHandoffUrl(result: ThesisResult): string {
  const top = result.theses[0];
  if (!top) return "";
  const params = new URLSearchParams();
  params.set("topic", result.input.topic);
  params.set("type", result.input.essayType);
  params.set("thesis", top.text);
  if (typeof window === "undefined") return `/tools/ai-essay-outline-generator?${params.toString()}`;
  return `${window.location.origin}/tools/ai-essay-outline-generator?${params.toString()}`;
}

// ---------- History (localStorage) ----------

const HISTORY_KEY = "unqtools:thesis-generator:history";
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

// ---------- Share URL ----------

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.topic) params.set("topic", state.topic);
  if (state.stance) params.set("stance", state.stance);
  if (state.essayType) params.set("type", state.essayType);
  if (state.academicLevel) params.set("level", state.academicLevel);
  if (state.citationStyle) params.set("cite", state.citationStyle);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {
    topic: "",
    stance: "for",
    essayType: "argumentative",
    academicLevel: "undergraduate",
    citationStyle: "apa",
  };
  const params = new URLSearchParams(clean);
  const validStances: Stance[] = ["for", "against", "neutral"];
  const validTypes: EssayType[] = ["argumentative", "analytical", "expository", "compare-contrast"];
  const validLevels: AcademicLevel[] = ["high-school", "undergraduate", "graduate"];
  const validStyles: CitationStyle[] = ["apa", "mla", "chicago", "harvard"];
  return {
    topic: params.get("topic") ?? "",
    stance: (validStances.includes(params.get("stance") as Stance) ? params.get("stance") : "for") as Stance,
    essayType: (validTypes.includes(params.get("type") as EssayType) ? params.get("type") : "argumentative") as EssayType,
    academicLevel: (validLevels.includes(params.get("level") as AcademicLevel) ? params.get("level") : "undergraduate") as AcademicLevel,
    citationStyle: (validStyles.includes(params.get("cite") as CitationStyle) ? params.get("cite") : "apa") as CitationStyle,
  };
}

// ---------- LLM (BYO key) ----------

export function buildLlmRequestBody(
  input: ThesisInput,
  model = "gpt-4o-mini",
): LlmRequestBody {
  const system =
    `You are an academic writing tutor. Generate 5 strong, arguable thesis statements for the given topic. ` +
    `Essay type: ${ESSAY_TYPE_LABELS[input.essayType]}. Stance: ${STANCE_LABELS[input.stance]}. ` +
    `Academic level: ${ACADEMIC_LEVEL_LABELS[input.academicLevel]}. Citation style: ${CITATION_STYLE_LABELS[input.citationStyle]}. ` +
    `Each thesis must be a single sentence, 18–32 words, debatable (for argumentative) or analytical (for analytical/expository/compare-contrast). ` +
    `Return each thesis on its own line, prefixed "1. ", "2. ", etc. Do not add commentary. Do not fabricate citations.`;
  return {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: input.topic },
    ],
    temperature: 0.7,
    max_tokens: 800,
  };
}

export function extractLlmTheses(resp: unknown): string[] {
  if (!resp || typeof resp !== "object") return [];
  const r = resp as Record<string, unknown>;
  const choices = r.choices as Array<{ message?: { content?: string } }> | undefined;
  if (!Array.isArray(choices) || choices.length === 0) return [];
  const content = choices[0]?.message?.content;
  if (typeof content !== "string") return [];
  return content
    .split(/\n+/)
    .map((l) => l.replace(/^\s*\d+\.\s*/, "").trim())
    .filter((l) => l.length > 10 && !l.toLowerCase().startsWith("here are") && !l.toLowerCase().startsWith("sure,"));
}
