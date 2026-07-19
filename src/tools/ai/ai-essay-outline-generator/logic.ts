/**
 * AI Essay Outline Generator — pure logic.
 *
 * Generate thesis-driven hierarchical essay outlines from a topic. Pure
 * functions only — no DOM, no network. The optional LLM call (BYO API key)
 * lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type EssayType =
  | "argumentative"
  | "expository"
  | "narrative"
  | "compare-contrast"
  | "persuasive";

export type EssayLength = "short" | "standard" | "long" | "extended";
export type CompareStructure = "block" | "point-by-point";
export type HookStyle = "question" | "quote" | "statistic" | "anecdote" | "definition";

export interface OutlineSlot {
  kind: "evidence" | "cite";
  label: string;       // e.g. "Statistic supporting the main claim"
  placeholder: string; // e.g. "[EVIDENCE: statistic]"
}

export interface OutlineSection {
  id: string;
  heading: string;            // e.g. "Body 1: Background"
  topicSentence: string;      // one-sentence topic sentence
  bulletPoints: string[];     // sub-points to cover
  slots: OutlineSlot[];       // evidence + citation placeholders
  wordEstimate: number;
  type: "intro" | "body" | "counterargument" | "rebuttal" | "conclusion";
}

export interface ThesisVariant {
  text: string;
  stance: "for" | "against" | "neutral";
}

export interface Outline {
  topic: string;
  type: EssayType;
  length: EssayLength;
  wordCount: number;
  thesisVariants: ThesisVariant[];
  chosenThesis: string;
  hook: { style: HookStyle; text: string };
  sections: OutlineSection[];
  closingThought: string;
  compareStructure?: CompareStructure;
  generatedAt: number;
}

export interface Stats {
  totalSections: number;
  totalBullets: number;
  totalSlots: number;
  totalWords: number;
  typeLabel: string;
}

export interface HistoryEntry {
  ts: number;
  topic: string;
  type: EssayType;
  length: EssayLength;
  thesis: string;
  sectionCount: number;
  wordCount: number;
}

export interface ShareState {
  topic: string;
  type: EssayType;
  length: EssayLength;
  compareStructure?: CompareStructure;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-essay-outline-generator:history";
export const HISTORY_MAX = 20;

export const TYPE_LABELS: Record<EssayType, string> = {
  argumentative: "Argumentative (take a stance)",
  expository: "Expository (explain / inform)",
  narrative: "Narrative (tell a story)",
  "compare-contrast": "Compare & Contrast",
  persuasive: "Persuasive (call to action)",
};

export const LENGTH_LABELS: Record<EssayLength, string> = {
  short: "Short (~500 words)",
  standard: "Standard (~1000 words)",
  long: "Long (~2000 words)",
  extended: "Extended (~3000+ words)",
};

export const LENGTH_TARGETS: Record<EssayLength, number> = {
  short: 500,
  standard: 1000,
  long: 2000,
  extended: 3000,
};

export const COMPARE_STRUCTURE_LABELS: Record<CompareStructure, string> = {
  block: "Block (all of A, then all of B)",
  "point-by-point": "Point-by-point (criterion by criterion)",
};

export const HOOK_LABELS: Record<HookStyle, string> = {
  question: "Question",
  quote: "Quote",
  statistic: "Statistic",
  anecdote: "Anecdote",
  definition: "Definition",
};

export const SAMPLE_TOPICS: string[] = [
  "Should social media platforms be regulated as utilities?",
  "The impact of remote work on urban economies",
  "Renewable energy vs nuclear energy: which is the better bridge?",
  "How the printing press changed human cognition",
  "Universal basic income: a moral imperative or economic risk?",
  "The role of failure in developing expertise",
  "Comparing online learning with traditional classroom instruction",
  "Why sleep matters more than we admit",
  "The ethics of AI in criminal justice",
  "Climate migration in the 21st century",
];

// ---------- Pure helpers ----------

/** Normalize a topic string. */
export function normalizeTopic(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Extract content keywords from a topic (stop-word filtered). */
export function extractKeywords(topic: string): string[] {
  const t = normalizeTopic(topic);
  if (!t) return [];
  const STOP = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "and", "or", "but", "if", "then", "else", "when", "where", "why", "how",
    "of", "in", "on", "at", "to", "for", "with", "by", "from", "as", "into",
    "that", "this", "these", "those", "it", "its", "they", "them", "their",
    "we", "us", "our", "you", "your", "he", "she", "him", "her", "his",
    "should", "would", "could", "can", "may", "might", "must", "shall",
    "not", "no", "yes", "do", "does", "did", "have", "has", "had",
    "what", "which", "who", "whom", "whose", "will",
    "me", "so", "up", "out", "it's",
  ]);
  const words = t
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP.has(w));
  return Array.from(new Set(words));
}

/** Title-case a topic. */
export function titleCase(s: string): string {
  const t = normalizeTopic(s);
  if (!t) return "";
  return t
    .split(" ")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Detect essay type from topic phrasing (heuristic). */
export function detectEssayType(topic: string): EssayType {
  const t = normalizeTopic(topic).toLowerCase();
  if (!t) return "expository";
  if (/^(should|must|ought to|why we should|why i (think|believe))\b/.test(t)) return "argumentative";
  if (/\b(vs|versus|compared? to|compare|contrast|difference|similarities)\b/.test(t)) return "compare-contrast";
  if (/^(how|why|the (impact|effect|cause|role|history|story) of)\b/.test(t)) return "expository";
  if (/\b(story|day i|time when|my (first|last|best|worst))\b/.test(t)) return "narrative";
  if (/\b(must|need to|should|have to|urgent|now is the time)\b/.test(t)) return "persuasive";
  return "expository";
}

/** Suggest sharper angles for a vague topic. */
export function suggestAngles(topic: string): string[] {
  const t = normalizeTopic(topic);
  if (!t) return [];
  const kw = extractKeywords(t);
  const main = kw[0] ?? t;
  return [
    `${titleCase(main)}: a historical perspective`,
    `The economic case for ${main.toLowerCase()}`,
    `How ${main.toLowerCase()} affects everyday life`,
    `${titleCase(main)}: benefits and drawbacks`,
    `The future of ${main.toLowerCase()}`,
  ];
}

// ---------- Thesis generation ----------

/** Generate 1–3 thesis variants for an essay type. */
export function generateThesisVariants(topic: string, type: EssayType): ThesisVariant[] {
  const t = titleCase(topic);
  const kw = extractKeywords(topic);
  const main = kw[0] ? titleCase(kw[0]) : t;
  const second = kw[1] ? titleCase(kw[1]) : "the issue";
  switch (type) {
    case "argumentative":
      return [
        { text: `${t} ought to be embraced because the evidence demonstrates that ${main.toLowerCase()} produces measurable benefits for ${second.toLowerCase()}.`, stance: "for" },
        { text: `Although critics argue otherwise, ${t} remains a defensible position because ${main.toLowerCase()} outweighs the alternatives when measured by long-term outcomes.`, stance: "for" },
        { text: `${t} should be rejected because the costs — measured in ${second.toLowerCase()} and unintended consequences — exceed the claimed benefits.`, stance: "against" },
      ];
    case "expository":
      return [
        { text: `This essay explains ${t} by examining its origins, mechanisms, and consequences.`, stance: "neutral" },
        { text: `${titleCase(main)} operates through three interconnected processes that together shape ${second.toLowerCase()}.`, stance: "neutral" },
      ];
    case "narrative":
      return [
        { text: `Through the story of ${main.toLowerCase()}, this essay illustrates how ${second.toLowerCase()} can transform a moment, a relationship, or a life.`, stance: "neutral" },
        { text: `The moment I encountered ${main.toLowerCase()} taught me that ${second.toLowerCase()} is rarely what we expect.`, stance: "neutral" },
      ];
    case "compare-contrast":
      return [
        { text: `Comparing ${main.toLowerCase()} and ${second.toLowerCase()} reveals more similarities than surface differences suggest, particularly in their underlying assumptions and long-term effects.`, stance: "neutral" },
        { text: `Although ${main.toLowerCase()} and ${second.toLowerCase()} appear to differ fundamentally, they converge on the same underlying principle when examined closely.`, stance: "neutral" },
        { text: `${titleCase(main)} and ${second.toLowerCase()} diverge most sharply in their treatment of consequences — a difference that determines which is preferable in practice.`, stance: "neutral" },
      ];
    case "persuasive":
      return [
        { text: `We must act on ${t} now — not because it is convenient, but because the cost of waiting has already become greater than the cost of change.`, stance: "for" },
        { text: `Every reason to delay on ${main.toLowerCase()} has been exhausted; what remains is the choice between voluntary action and forced consequence.`, stance: "for" },
      ];
  }
}

// ---------- Hook generation ----------

/** Generate a hook for the chosen style. */
export function generateHook(topic: string, type: EssayType, style: HookStyle): { style: HookStyle; text: string } {
  const kw = extractKeywords(topic);
  const main = kw[0] ? titleCase(kw[0]) : titleCase(topic);
  switch (style) {
    case "question":
      return { style, text: `What if everything we assume about ${main.toLowerCase()} is wrong?` };
    case "quote":
      return { style, text: `"The unexamined life is not worth living," Socrates said — and the same could be said of ${main.toLowerCase()} today.` };
    case "statistic":
      return { style, text: `Consider this: studies suggest that ${main.toLowerCase()} now touches nearly every aspect of modern life, yet most of us rarely pause to ask why.` };
    case "anecdote":
      return { style, text: `Last year, a single decision about ${main.toLowerCase()} changed how an entire community saw itself.` };
    case "definition":
      return { style, text: `${titleCase(main)} is, at its core, less a fixed idea than a living negotiation between what we intend and what we get.` };
  }
}

/** Suggest the best hook style for an essay type. */
export function suggestHookStyle(type: EssayType): HookStyle {
  switch (type) {
    case "argumentative": return "question";
    case "expository": return "definition";
    case "narrative": return "anecdote";
    case "compare-contrast": return "quote";
    case "persuasive": return "statistic";
  }
}

// ---------- Section templates ----------

interface SectionTemplate {
  id: string;
  heading: (topic: string, idx: number) => string;
  topicSentence: (topic: string, kw: string[], idx: number) => string;
  bulletPoints: (topic: string, kw: string[], idx: number) => string[];
  slots: (idx: number) => OutlineSlot[];
  weight: number; // proportion of total word count
  type: OutlineSection["type"];
}

const ARGUMENTATIVE_SECTIONS: SectionTemplate[] = [
  {
    id: "arg-intro",
    type: "intro",
    weight: 0.15,
    heading: () => "Introduction",
    topicSentence: (t) => `The debate over ${t.toLowerCase()} is not merely academic — it shapes policy, identity, and daily life.`,
    bulletPoints: (t, kw) => [
      `Define key terms (${kw.slice(0, 2).join(", ") || t}).`,
      "Establish why this debate matters now.",
      "Preview the argument: claim, counter, rebuttal.",
    ],
    slots: () => [
      { kind: "cite", label: "Cite a recent news hook or defining event", placeholder: "[CITE: recent event]" },
    ],
  },
  {
    id: "arg-body-1",
    type: "body",
    weight: 0.18,
    heading: (_t, i) => `Body ${i}: The Case For`,
    topicSentence: (t) => `The strongest argument in favor of ${t.toLowerCase()} rests on outcomes that are measurable and consequential.`,
    bulletPoints: (_t, kw) => [
      `Lead with the most compelling evidence (${kw[0] ?? "the central claim"}).`,
      "Trace the causal chain from action to outcome.",
      "Address the most likely skeptical question preemptively.",
    ],
    slots: () => [
      { kind: "evidence", label: "A peer-reviewed study supporting the claim", placeholder: "[EVIDENCE: study]" },
      { kind: "cite", label: "Source citation for the study", placeholder: "[CITE: study]" },
      { kind: "evidence", label: "A real-world example illustrating the claim", placeholder: "[EVIDENCE: example]" },
    ],
  },
  {
    id: "arg-body-2",
    type: "body",
    weight: 0.15,
    heading: (_t, i) => `Body ${i}: Addressing Costs`,
    topicSentence: (t) => `Honesty requires acknowledging that ${t.toLowerCase()} carries real costs — and then weighing them against the alternative.`,
    bulletPoints: () => [
      "Name the strongest objection fairly.",
      "Quantify the cost where possible.",
      "Show why the net balance still favors the position.",
    ],
    slots: () => [
      { kind: "evidence", label: "A counter-statistic or contrary case", placeholder: "[EVIDENCE: counterexample]" },
      { kind: "cite", label: "Cite the source of the counter-evidence", placeholder: "[CITE: counter-source]" },
    ],
  },
  {
    id: "arg-counter",
    type: "counterargument",
    weight: 0.15,
    heading: () => "Counterargument",
    topicSentence: (t) => `Critics of ${t.toLowerCase()} raise a serious objection that deserves a fair hearing before it can be answered.`,
    bulletPoints: () => [
      "State the opposing view in its strongest form (steelman, not strawman).",
      "Identify the value or principle underlying the objection.",
      "Acknowledge any part of the objection that is correct.",
    ],
    slots: () => [
      { kind: "cite", label: "Cite a prominent critic or opposing source", placeholder: "[CITE: opposing source]" },
    ],
  },
  {
    id: "arg-rebuttal",
    type: "rebuttal",
    weight: 0.15,
    heading: () => "Rebuttal",
    topicSentence: (t) => `The objection, however, ultimately fails because it mistakes a partial truth for the whole truth about ${t.toLowerCase()}.`,
    bulletPoints: () => [
      "Pinpoint where the objection overreaches.",
      "Introduce evidence the objection overlooks.",
      "Show how your position accommodates the kernel of truth in the objection.",
    ],
    slots: () => [
      { kind: "evidence", label: "Evidence the objection overlooked", placeholder: "[EVIDENCE: overlooked evidence]" },
      { kind: "cite", label: "Cite the source of the overlooked evidence", placeholder: "[CITE: source]" },
    ],
  },
  {
    id: "arg-conclusion",
    type: "conclusion",
    weight: 0.22,
    heading: () => "Conclusion",
    topicSentence: (t) => `Taken together, the evidence shows that ${t.toLowerCase()} is not just defensible — it is the better course.`,
    bulletPoints: () => [
      "Restate the thesis in stronger terms.",
      "Synthesize the strongest evidence (do not merely list it).",
      "End with the implications: what should change, and why now.",
    ],
    slots: () => [],
  },
];

const EXPOSITORY_SECTIONS: SectionTemplate[] = [
  {
    id: "exp-intro",
    type: "intro",
    weight: 0.15,
    heading: () => "Introduction",
    topicSentence: (t) => `To understand ${t.toLowerCase()} is to understand something important about how the modern world works.`,
    bulletPoints: (t, kw) => [
      `Define ${kw[0] ?? t} precisely.`,
      "Explain why this subject is worth understanding.",
      "Preview the structure: definition → mechanism → consequences.",
    ],
    slots: () => [
      { kind: "cite", label: "Cite an authoritative definition", placeholder: "[CITE: definition source]" },
    ],
  },
  {
    id: "exp-body-1",
    type: "body",
    weight: 0.2,
    heading: (_t, i) => `Body ${i}: Definition and Origins`,
    topicSentence: (t) => `${titleCase(t)} did not appear from nowhere — it emerged from specific historical and structural conditions.`,
    bulletPoints: () => [
      "Trace the origin and early development.",
      "Distinguish the concept from neighboring ideas.",
      "Explain the conditions that made it possible.",
    ],
    slots: () => [
      { kind: "evidence", label: "A historical fact or founding document", placeholder: "[EVIDENCE: historical fact]" },
      { kind: "cite", label: "Cite the historical source", placeholder: "[CITE: historical source]" },
    ],
  },
  {
    id: "exp-body-2",
    type: "body",
    weight: 0.25,
    heading: (_t, i) => `Body ${i}: How It Works`,
    topicSentence: (t) => `The mechanism behind ${t.toLowerCase()} is best understood as a sequence of causes and effects.`,
    bulletPoints: () => [
      "Walk through the step-by-step process.",
      "Identify the key actors and their roles.",
      "Explain why the mechanism is stable or unstable.",
    ],
    slots: () => [
      { kind: "evidence", label: "A diagram, statistic, or worked example", placeholder: "[EVIDENCE: example]" },
      { kind: "cite", label: "Cite the source for the mechanism", placeholder: "[CITE: mechanism source]" },
      { kind: "evidence", label: "A second corroborating example", placeholder: "[EVIDENCE: corroborating example]" },
    ],
  },
  {
    id: "exp-body-3",
    type: "body",
    weight: 0.2,
    heading: (_t, i) => `Body ${i}: Consequences and Significance`,
    topicSentence: (t) => `What makes ${t.toLowerCase()} worth studying is the cascade of consequences it produces.`,
    bulletPoints: () => [
      "Identify the primary, intended consequences.",
      "Surface the secondary, unintended consequences.",
      "Assess the overall significance for the reader.",
    ],
    slots: () => [
      { kind: "evidence", label: "A measurable consequence with a number", placeholder: "[EVIDENCE: statistic]" },
      { kind: "cite", label: "Cite the source of the statistic", placeholder: "[CITE: statistic source]" },
    ],
  },
  {
    id: "exp-conclusion",
    type: "conclusion",
    weight: 0.2,
    heading: () => "Conclusion",
    topicSentence: (t) => `${titleCase(t)}, once unpacked, reveals itself as both more ordinary and more consequential than it first appears.`,
    bulletPoints: () => [
      "Restate the definition with the depth now earned.",
      "Summarize the mechanism and consequences without merely listing.",
      "End with the wider question this subject raises.",
    ],
    slots: () => [],
  },
];

const NARRATIVE_SECTIONS: SectionTemplate[] = [
  {
    id: "nar-intro",
    type: "intro",
    weight: 0.15,
    heading: () => "Introduction: Setup",
    topicSentence: (t) => `The story of ${t.toLowerCase()} begins in a place and time that, in retrospect, was quieter than it should have been.`,
    bulletPoints: () => [
      "Set the scene: where, when, who.",
      "Establish the narrator's initial state.",
      "Plant a detail that will pay off later.",
    ],
    slots: () => [],
  },
  {
    id: "nar-incite",
    type: "body",
    weight: 0.15,
    heading: () => "Inciting Incident",
    topicSentence: (t) => `Then ${t.toLowerCase()} entered the picture — and nothing was quite the same after.`,
    bulletPoints: () => [
      "Describe the moment that disrupts the status quo.",
      "Show the narrator's immediate reaction.",
      "Make clear what is now at stake.",
    ],
    slots: () => [],
  },
  {
    id: "nar-rising",
    type: "body",
    weight: 0.25,
    heading: () => "Rising Action",
    topicSentence: () => `What followed was a series of small escalations, each pushing the narrator further from where they began.`,
    bulletPoints: () => [
      "Present 2–3 escalating events in chronological order.",
      "Build tension through specific sensory detail.",
      "Show the narrator's internal conflict growing.",
    ],
    slots: () => [],
  },
  {
    id: "nar-climax",
    type: "body",
    weight: 0.2,
    heading: () => "Climax",
    topicSentence: (t) => `The turning point arrived without warning — the moment ${t.toLowerCase()} demanded a decision.`,
    bulletPoints: () => [
      "Slow time down: this is the moment of maximum stakes.",
      "Reveal the choice the narrator must make.",
      "Make the consequence of the choice irreversible.",
    ],
    slots: () => [],
  },
  {
    id: "nar-falling",
    type: "body",
    weight: 0.1,
    heading: () => "Falling Action",
    topicSentence: () => `After the climax came the slow unwinding — the parts of a story that decide what the climax actually meant.`,
    bulletPoints: () => [
      "Show the immediate aftermath of the decision.",
      "Resolve the secondary tensions.",
      "Set up the lesson or realization that will close the story.",
    ],
    slots: () => [],
  },
  {
    id: "nar-conclusion",
    type: "conclusion",
    weight: 0.15,
    heading: () => "Resolution",
    topicSentence: (t) => `Looking back, the story of ${t.toLowerCase()} was never really about ${t.toLowerCase()} — it was about what ${t.toLowerCase()} forced me to see.`,
    bulletPoints: () => [
      "Land the emotional resolution.",
      "State the lesson without preaching.",
      "End on an image that echoes the opening detail.",
    ],
    slots: () => [],
  },
];

const COMPARE_CONTRAST_SECTIONS: SectionTemplate[] = [
  {
    id: "cc-intro",
    type: "intro",
    weight: 0.15,
    heading: () => "Introduction",
    topicSentence: (t, kw) => `At first glance, ${kw[0] ?? "the first subject"} and ${kw[1] ?? "the second subject"} seem to share little — but the comparison is more revealing than either subject alone.`,
    bulletPoints: (t, kw) => [
      `Introduce ${kw[0] ?? "subject A"} and ${kw[1] ?? "subject B"}.`,
      "State why the comparison is worth making.",
      "Preview the criteria you will use to compare.",
    ],
    slots: () => [
      { kind: "cite", label: "Cite an authoritative source on each subject", placeholder: "[CITE: subject source]" },
    ],
  },
  {
    id: "cc-criteria-1",
    type: "body",
    weight: 0.2,
    heading: (_t, i) => `Body ${i}: Criterion 1 — Underlying Assumptions`,
    topicSentence: (t, kw) => `On the level of underlying assumptions, ${kw[0] ?? "A"} and ${kw[1] ?? "B"} diverge in ways that determine everything else.`,
    bulletPoints: (t, kw) => [
      `Lay out the core assumption behind ${kw[0] ?? "A"}.`,
      `Lay out the core assumption behind ${kw[1] ?? "B"}.`,
      "Identify where the assumptions clash directly.",
    ],
    slots: () => [
      { kind: "evidence", label: "Evidence for A's assumption", placeholder: "[EVIDENCE: A's assumption]" },
      { kind: "evidence", label: "Evidence for B's assumption", placeholder: "[EVIDENCE: B's assumption]" },
      { kind: "cite", label: "Cite both sources", placeholder: "[CITE: sources]" },
    ],
  },
  {
    id: "cc-criteria-2",
    type: "body",
    weight: 0.2,
    heading: (_t, i) => `Body ${i}: Criterion 2 — Mechanisms`,
    topicSentence: () => `When we examine how each operates in practice, the comparison becomes more textured.`,
    bulletPoints: (t, kw) => [
      `Describe the mechanism of ${kw[0] ?? "A"}.`,
      `Describe the mechanism of ${kw[1] ?? "B"}.`,
      "Note where the mechanisms converge or diverge.",
    ],
    slots: () => [
      { kind: "evidence", label: "A worked example for A", placeholder: "[EVIDENCE: A example]" },
      { kind: "evidence", label: "A worked example for B", placeholder: "[EVIDENCE: B example]" },
    ],
  },
  {
    id: "cc-criteria-3",
    type: "body",
    weight: 0.2,
    heading: (_t, i) => `Body ${i}: Criterion 3 — Consequences`,
    topicSentence: () => `The most decisive differences emerge when we look at the consequences each produces.`,
    bulletPoints: (t, kw) => [
      `Catalog the consequences of ${kw[0] ?? "A"}.`,
      `Catalog the consequences of ${kw[1] ?? "B"}.`,
      "Weigh which set of consequences is preferable — and for whom.",
    ],
    slots: () => [
      { kind: "evidence", label: "A measurable consequence for A", placeholder: "[EVIDENCE: A statistic]" },
      { kind: "evidence", label: "A measurable consequence for B", placeholder: "[EVIDENCE: B statistic]" },
      { kind: "cite", label: "Cite both consequence sources", placeholder: "[CITE: consequence sources]" },
    ],
  },
  {
    id: "cc-conclusion",
    type: "conclusion",
    weight: 0.25,
    heading: () => "Conclusion",
    topicSentence: (t, kw) => `Taken across all three criteria, ${kw[0] ?? "A"} and ${kw[1] ?? "B"} emerge as more alike — and more different — than the surface comparison suggested.`,
    bulletPoints: () => [
      "Synthesize: where do they converge, where do they diverge?",
      "State which is preferable, under which conditions.",
      "End with the larger principle the comparison reveals.",
    ],
    slots: () => [],
  },
];

const COMPARE_BLOCK_SECTIONS: SectionTemplate[] = [
  {
    id: "ccb-intro",
    type: "intro",
    weight: 0.15,
    heading: () => "Introduction",
    topicSentence: (t, kw) => `${titleCase(kw[0] ?? "subject A")} and ${titleCase(kw[1] ?? "subject B")} are best understood by looking at each in full before comparing.`,
    bulletPoints: () => [
      "Introduce both subjects briefly.",
      "State the purpose of the comparison.",
      "Preview the block structure: all of A, then all of B, then synthesis.",
    ],
    slots: () => [],
  },
  {
    id: "ccb-block-a",
    type: "body",
    weight: 0.3,
    heading: (_t, i) => `Body ${i}: ${"Subject A in Full"}`,
    topicSentence: (t, kw) => `${titleCase(kw[0] ?? "Subject A")} is, taken on its own terms, a coherent position with its own logic.`,
    bulletPoints: () => [
      "Origins and definition.",
      "Mechanism and key examples.",
      "Strengths and weaknesses.",
    ],
    slots: () => [
      { kind: "evidence", label: "A defining example for A", placeholder: "[EVIDENCE: A example]" },
      { kind: "cite", label: "Cite A's authoritative source", placeholder: "[CITE: A source]" },
    ],
  },
  {
    id: "ccb-block-b",
    type: "body",
    weight: 0.3,
    heading: (_t, i) => `Body ${i}: ${"Subject B in Full"}`,
    topicSentence: (t, kw) => `${titleCase(kw[1] ?? "Subject B")}, by contrast, operates by a different logic that is best appreciated on its own.`,
    bulletPoints: () => [
      "Origins and definition.",
      "Mechanism and key examples.",
      "Strengths and weaknesses.",
    ],
    slots: () => [
      { kind: "evidence", label: "A defining example for B", placeholder: "[EVIDENCE: B example]" },
      { kind: "cite", label: "Cite B's authoritative source", placeholder: "[CITE: B source]" },
    ],
  },
  {
    id: "ccb-conclusion",
    type: "conclusion",
    weight: 0.25,
    heading: () => "Conclusion: Synthesis",
    topicSentence: (t, kw) => `Having examined ${kw[0] ?? "A"} and ${kw[1] ?? "B"} in full, the comparison reduces to a single decisive question.`,
    bulletPoints: () => [
      "Summarize the strongest version of each.",
      "Identify the decisive point of divergence.",
      "End with a principle that generalizes beyond this comparison.",
    ],
    slots: () => [],
  },
];

const PERSUASIVE_SECTIONS: SectionTemplate[] = [
  {
    id: "pers-intro",
    type: "intro",
    weight: 0.15,
    heading: () => "Introduction",
    topicSentence: (t) => `The time for half-measures on ${t.toLowerCase()} has run out.`,
    bulletPoints: () => [
      "Open with the stakes: what is at risk if we do nothing?",
      "Name the obstacle (apathy, misinformation, inertia).",
      "Preview the call to action.",
    ],
    slots: () => [
      { kind: "evidence", label: "A statistic showing urgency", placeholder: "[EVIDENCE: urgency statistic]" },
      { kind: "cite", label: "Cite the source of the statistic", placeholder: "[CITE: statistic source]" },
    ],
  },
  {
    id: "pers-body-1",
    type: "body",
    weight: 0.2,
    heading: (_t, i) => `Body ${i}: The Problem Demands Action`,
    topicSentence: (t) => `The case for acting on ${t.toLowerCase()} rests on three converging facts that together leave no room for delay.`,
    bulletPoints: () => [
      "State the most measurable harm.",
      "Show the trend line (getting worse, not better).",
      "Identify who is most affected and why that should matter to the reader.",
    ],
    slots: () => [
      { kind: "evidence", label: "A trend statistic", placeholder: "[EVIDENCE: trend statistic]" },
      { kind: "cite", label: "Cite the trend source", placeholder: "[CITE: trend source]" },
      { kind: "evidence", label: "A specific affected group", placeholder: "[EVIDENCE: affected group]" },
    ],
  },
  {
    id: "pers-body-2",
    type: "body",
    weight: 0.2,
    heading: (_t, i) => `Body ${i}: The Solution Is Achievable`,
    topicSentence: () => `The objection that nothing can be done is contradicted by precedent: similar problems have been solved before.`,
    bulletPoints: () => [
      "Cite a precedent where a comparable problem was solved.",
      "Show that the proposed solution is feasible and affordable.",
      "Address the most common practical objection.",
    ],
    slots: () => [
      { kind: "evidence", label: "A precedent case", placeholder: "[EVIDENCE: precedent]" },
      { kind: "cite", label: "Cite the precedent source", placeholder: "[CITE: precedent source]" },
    ],
  },
  {
    id: "pers-urgency",
    type: "body",
    weight: 0.15,
    heading: () => "Why Now",
    topicSentence: (t) => `Acting on ${t.toLowerCase()} today is cheaper, easier, and more effective than acting tomorrow — and the gap widens every day we wait.`,
    bulletPoints: () => [
      "Quantify the cost of delay.",
      "Name the window of opportunity that is closing.",
      "Make the reader feel the deadline.",
    ],
    slots: () => [
      { kind: "evidence", label: "A cost-of-delay statistic", placeholder: "[EVIDENCE: cost of delay]" },
      { kind: "cite", label: "Cite the source", placeholder: "[CITE: source]" },
    ],
  },
  {
    id: "pers-cta",
    type: "conclusion",
    weight: 0.3,
    heading: () => "Conclusion: The Call to Action",
    topicSentence: (t) => `The argument for ${t.toLowerCase()} reduces to a choice: act now, or explain later why we did not.`,
    bulletPoints: () => [
      "Restate the urgency in concrete terms.",
      "Specify the action the reader should take (vote, donate, change a habit, contact a representative).",
      "End with a line the reader will remember in a week.",
    ],
    slots: () => [],
  },
];

function sectionTemplatesForType(type: EssayType, compareStructure?: CompareStructure): SectionTemplate[] {
  switch (type) {
    case "argumentative": return ARGUMENTATIVE_SECTIONS;
    case "expository": return EXPOSITORY_SECTIONS;
    case "narrative": return NARRATIVE_SECTIONS;
    case "compare-contrast":
      return compareStructure === "block" ? COMPARE_BLOCK_SECTIONS : COMPARE_CONTRAST_SECTIONS;
    case "persuasive": return PERSUASIVE_SECTIONS;
  }
}

// ---------- Outline generation ----------

/** Compute a per-section word estimate based on its weight and the length target. */
export function estimateSectionWords(weight: number, totalWords: number): number {
  return Math.max(50, Math.round(weight * totalWords));
}

/** Generate a full outline. */
export function generateOutline(
  topic: string,
  type: EssayType,
  length: EssayLength,
  compareStructure?: CompareStructure,
): Outline {
  const t = normalizeTopic(topic);
  const targetWords = LENGTH_TARGETS[length];
  const kw = extractKeywords(t);
  const templates = sectionTemplatesForType(type, compareStructure);
  const thesisVariants = generateThesisVariants(t, type);
  const chosenThesis = thesisVariants[0]?.text ?? "";
  const hookStyle = suggestHookStyle(type);
  const hook = generateHook(t, type, hookStyle);

  let bodyIdx = 0;
  const sections: OutlineSection[] = templates.map((tpl) => {
    if (tpl.type === "body") bodyIdx += 1;
    const idx = tpl.type === "body" ? bodyIdx : 0;
    return {
      id: tpl.id,
      heading: tpl.heading(t, idx),
      topicSentence: tpl.topicSentence(t, kw, idx),
      bulletPoints: tpl.bulletPoints(t, kw, idx),
      slots: tpl.slots(idx),
      wordEstimate: estimateSectionWords(tpl.weight, targetWords),
      type: tpl.type,
    };
  });

  const closingThought = generateClosingThought(t, type);

  return {
    topic: t,
    type,
    length,
    wordCount: sections.reduce((sum, s) => sum + s.wordEstimate, 0),
    thesisVariants,
    chosenThesis,
    hook,
    sections,
    closingThought,
    compareStructure: type === "compare-contrast" ? (compareStructure ?? "point-by-point") : undefined,
    generatedAt: Date.now(),
  };
}

/** Generate a closing thought for the essay type. */
export function generateClosingThought(topic: string, type: EssayType): string {
  const t = titleCase(topic);
  switch (type) {
    case "argumentative": return `If this essay is right, then the question is not whether ${t.toLowerCase()} will be decided, but which side of history we want to be on when it is.`;
    case "expository": return `Understanding ${t.toLowerCase()} is, in the end, an invitation to look again at things we thought we already knew.`;
    case "narrative": return `Stories like this one do not end so much as they hand the next decision back to us.`;
    case "compare-contrast": return `The point of comparing is not to crown a winner but to see both subjects — and ourselves — more clearly.`;
    case "persuasive": return `The case has been made. What happens next is no longer a question of evidence — it is a question of will.`;
  }
}

// ---------- Section operations ----------

/** Reorder sections by id list. */
export function reorderSections(outline: Outline, orderedIds: string[]): Outline {
  const map = new Map(outline.sections.map((s) => [s.id, s]));
  const next: OutlineSection[] = [];
  for (const id of orderedIds) {
    const s = map.get(id);
    if (s) {
      next.push(s);
      map.delete(id);
    }
  }
  // Append any remaining (in original order)
  for (const s of map.values()) next.push(s);
  return { ...outline, sections: next };
}

/** Expand a section by adding deeper sub-points. */
export function expandSection(outline: Outline, sectionId: string): Outline {
  const sections = outline.sections.map((s) => {
    if (s.id !== sectionId) return s;
    const extra: string[] = [
      `Sub-point: a specific case study illustrating "${s.heading}".`,
      `Sub-point: a counter-example that tests the limits of this section.`,
      `Sub-point: a transition sentence linking this section to the next.`,
    ];
    return {
      ...s,
      bulletPoints: [...s.bulletPoints, ...extra],
      wordEstimate: Math.round(s.wordEstimate * 1.25),
    };
  });
  const wordCount = sections.reduce((sum, s) => sum + s.wordEstimate, 0);
  return { ...outline, sections, wordCount };
}

/** Pick a different thesis variant by index. */
export function chooseThesis(outline: Outline, idx: number): Outline {
  const variant = outline.thesisVariants[idx];
  if (!variant) return outline;
  return { ...outline, chosenThesis: variant.text };
}

// ---------- Stats ----------

export function computeStats(outline: Outline): Stats {
  return {
    totalSections: outline.sections.length,
    totalBullets: outline.sections.reduce((s, x) => s + x.bulletPoints.length, 0),
    totalSlots: outline.sections.reduce((s, x) => s + x.slots.length, 0),
    totalWords: outline.wordCount,
    typeLabel: TYPE_LABELS[outline.type],
  };
}

// ---------- Rendering ----------

export function renderText(outline: Outline): string {
  const lines: string[] = [];
  lines.push(`ESSAY OUTLINE — ${TYPE_LABELS[outline.type]}`);
  lines.push(`Topic: ${outline.topic}`);
  lines.push(`Target length: ~${LENGTH_TARGETS[outline.length]} words (estimated: ${outline.wordCount} words)`);
  if (outline.compareStructure) {
    lines.push(`Compare structure: ${COMPARE_STRUCTURE_LABELS[outline.compareStructure]}`);
  }
  lines.push("");
  lines.push(`THESIS: ${outline.chosenThesis}`);
  lines.push("");
  lines.push(`HOOK (${HOOK_LABELS[outline.hook.style]}): ${outline.hook.text}`);
  lines.push("");
  for (const s of outline.sections) {
    lines.push(`## ${s.heading}  (~${s.wordEstimate} words)`);
    lines.push(`Topic sentence: ${s.topicSentence}`);
    lines.push("");
    for (const b of s.bulletPoints) lines.push(`  - ${b}`);
    for (const slot of s.slots) lines.push(`  - ${slot.placeholder}`);
    lines.push("");
  }
  lines.push(`CLOSING THOUGHT: ${outline.closingThought}`);
  return lines.join("\n");
}

export function renderMarkdown(outline: Outline): string {
  const lines: string[] = [];
  lines.push(`# Essay Outline: ${outline.topic}`);
  lines.push("");
  lines.push(`**Type:** ${TYPE_LABELS[outline.type]}  `);
  lines.push(`**Target length:** ~${LENGTH_TARGETS[outline.length]} words (estimated: ${outline.wordCount} words)  `);
  if (outline.compareStructure) {
    lines.push(`**Compare structure:** ${COMPARE_STRUCTURE_LABELS[outline.compareStructure]}  `);
  }
  lines.push("");
  lines.push(`## Thesis`);
  lines.push("");
  lines.push(`> ${outline.chosenThesis}`);
  lines.push("");
  lines.push(`**Alternative thesis variants:**`);
  outline.thesisVariants.slice(1).forEach((v, i) => {
    lines.push(`${i + 2}. ${v.text}  *(${v.stance})*`);
  });
  lines.push("");
  lines.push(`## Hook (${HOOK_LABELS[outline.hook.style]})`);
  lines.push("");
  lines.push(`> ${outline.hook.text}`);
  lines.push("");
  for (const s of outline.sections) {
    lines.push(`## ${s.heading}`);
    lines.push(`*~${s.wordEstimate} words*`);
    lines.push("");
    lines.push(`**Topic sentence:** ${s.topicSentence}`);
    lines.push("");
    lines.push(`**Cover:**`);
    for (const b of s.bulletPoints) lines.push(`- ${b}`);
    if (s.slots.length > 0) {
      lines.push("");
      lines.push(`**Evidence / citations to fill in:**`);
      for (const slot of s.slots) lines.push(`- ${slot.placeholder} — ${slot.label}`);
    }
    lines.push("");
  }
  lines.push(`## Closing Thought`);
  lines.push("");
  lines.push(`> ${outline.closingThought}`);
  return lines.join("\n");
}

export function renderJson(outline: Outline): string {
  return JSON.stringify(outline, null, 2);
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
  if (state.type) params.set("type", state.type);
  if (state.length) params.set("length", state.length);
  if (state.compareStructure) params.set("cmp", state.compareStructure);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { topic: "", type: "argumentative", length: "standard" };
  const params = new URLSearchParams(clean);
  const topic = params.get("topic") ?? "";
  const type = params.get("type") as EssayType | null;
  const length = params.get("length") as EssayLength | null;
  const cmp = params.get("cmp") as CompareStructure | null;
  const validTypes: EssayType[] = ["argumentative", "expository", "narrative", "compare-contrast", "persuasive"];
  const validLengths: EssayLength[] = ["short", "standard", "long", "extended"];
  const validCmps: CompareStructure[] = ["block", "point-by-point"];
  return {
    topic,
    type: type && validTypes.includes(type) ? type : "argumentative",
    length: length && validLengths.includes(length) ? length : "standard",
    compareStructure: cmp && validCmps.includes(cmp) ? cmp : undefined,
  };
}

// ---------- Optional LLM prompt builder ----------

export interface LlmPrompt {
  system: string;
  user: string;
}

export function buildLlmPrompt(
  topic: string,
  type: EssayType,
  length: EssayLength,
  compareStructure?: CompareStructure,
): LlmPrompt {
  const system = `You are an expert essay-outline generator. Produce a ${type} essay outline on the user's topic, targeting ~${LENGTH_TARGETS[length]} words.${type === "compare-contrast" && compareStructure ? ` Use ${compareStructure} structure.` : ""} Return a hierarchical outline: thesis (1 sentence), hook (1 sentence), 4-6 body sections each with a topic sentence and 2-4 evidence/citation placeholders marked [EVIDENCE] and [CITE], and a closing thought. Mark placeholders explicitly so the user knows where to add real sources. Do not fabricate citations.`;
  const user = `Topic: ${topic}`;
  return { system, user };
}

export function renderLlmResult(raw: string): string {
  return (raw || "").trim();
}
