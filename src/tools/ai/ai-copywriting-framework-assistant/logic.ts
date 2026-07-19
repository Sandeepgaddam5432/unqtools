/**
 * AI Copywriting Framework Assistant — pure logic.
 *
 * Generates labeled marketing copy for five proven frameworks:
 *   - AIDA  (Attention / Interest / Desire / Action)
 *   - PAS   (Problem / Agitate / Solve)
 *   - FAB   (Feature / Advantage / Benefit)
 *   - BAB   (Before / After / Bridge)
 *   - 4Ps   (Picture / Promise / Prove / Push)
 *
 * Templates are pure TypeScript and run on-device. Optional BYO-key
 * LLM polish lives in ui.tsx because it touches the network.
 *
 * Honesty: copy is a strong draft to edit for accuracy and claims
 * compliance. The honesty linter flags unverifiable superlatives.
 * Nothing is uploaded or logged by us.
 *
 * Pure functions only — no DOM, no network.
 */

// ---------- Types ----------

export type Framework = "aida" | "pas" | "fab" | "bab" | "4ps";

export type Tone = "professional" | "friendly" | "bold" | "playful" | "urgent";

export type Length = "concise" | "standard" | "expanded";

export type Channel = "ad" | "email" | "landing" | "product";

export interface CopyInputs {
  /** Product / brand name. */
  product: string;
  /** Target audience description (e.g., "B2B marketers at $5–50M ARR SaaS"). */
  audience: string;
  /** Core benefit or outcome the audience gets. */
  benefit: string;
  /** Pain point the audience has that the product solves. */
  pain: string;
  /** A specific feature or capability to anchor the copy on (optional). */
  feature?: string;
  /** A concrete proof point: metric, customer, or result (optional). */
  proof?: string;
  /** Call-to-action phrase (e.g., "Start free trial"). */
  cta: string;
}

export interface StageBlock {
  /** Stage label, e.g., 'Attention' or 'Problem'. */
  label: string;
  /** Lowercase stage slug, e.g., 'attention' or 'problem'. */
  slug: string;
  /** Copy text for this stage. */
  text: string;
}

export interface FrameworkVariant {
  id: string;
  framework: Framework;
  tone: Tone;
  length: Length;
  channel: Channel;
  variant: number; // 0..N
  stages: StageBlock[];
  fullText: string;
  wordCount: number;
}

export interface FrameworkExplainer {
  framework: Framework;
  name: string;
  stages: Array<{ label: string; slug: string; what: string; why: string }>;
  bestFor: string;
  watchOut: string;
}

export interface SwipeEntry {
  ts: number;
  framework: Framework;
  tone: Tone;
  product: string;
  excerpt: string;
}

export interface HistoryEntry {
  ts: number;
  product: string;
  framework: Framework;
  tone: Tone;
  variantCount: number;
}

export interface ShareState {
  inputs: Partial<CopyInputs>;
  framework: Framework;
  tone: Tone;
  length: Length;
  channel: Channel;
}

export interface LlmEnhancement {
  polishedStages: StageBlock[];
  polishedFullText: string;
  subjectLines: string[];
  suggestions: string[];
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-copywriting-framework-assistant:history";
export const HISTORY_MAX = 20;
export const SWIPE_KEY = "unqtools:ai-copywriting-framework-assistant:swipe";
export const SWIPE_MAX = 50;
export const LLM_KEY_STORAGE = "unqtools:ai-copywriting-framework-assistant:llm-key";

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  aida: "AIDA — Attention · Interest · Desire · Action",
  pas: "PAS — Problem · Agitate · Solve",
  fab: "FAB — Feature · Advantage · Benefit",
  bab: "BAB — Before · After · Bridge",
  "4ps": "4Ps — Picture · Promise · Prove · Push",
};

export const TONE_LABELS: Record<Tone, string> = {
  professional: "Professional",
  friendly: "Friendly",
  bold: "Bold",
  playful: "Playful",
  urgent: "Urgent",
};

export const LENGTH_LABELS: Record<Length, string> = {
  concise: "Concise",
  standard: "Standard",
  expanded: "Expanded",
};

export const CHANNEL_LABELS: Record<Channel, string> = {
  ad: "Ad",
  email: "Email",
  landing: "Landing page",
  product: "Product page",
};

export const FRAMEWORKS: Framework[] = ["aida", "pas", "fab", "bab", "4ps"];

/**
 * Mapping from framework → ordered list of stage slugs + labels.
 * Drives the labeled stage output.
 */
export const FRAMEWORK_STAGES: Record<Framework, Array<{ label: string; slug: string }>> = {
  aida: [
    { label: "Attention", slug: "attention" },
    { label: "Interest", slug: "interest" },
    { label: "Desire", slug: "desire" },
    { label: "Action", slug: "action" },
  ],
  pas: [
    { label: "Problem", slug: "problem" },
    { label: "Agitate", slug: "agitate" },
    { label: "Solve", slug: "solve" },
  ],
  fab: [
    { label: "Feature", slug: "feature" },
    { label: "Advantage", slug: "advantage" },
    { label: "Benefit", slug: "benefit" },
  ],
  bab: [
    { label: "Before", slug: "before" },
    { label: "After", slug: "after" },
    { label: "Bridge", slug: "bridge" },
  ],
  "4ps": [
    { label: "Picture", slug: "picture" },
    { label: "Promise", slug: "promise" },
    { label: "Prove", slug: "prove" },
    { label: "Push", slug: "push" },
  ],
};

/**
 * Teaching notes per framework. Surfaced via the "Explain this framework"
 * toggle so users learn why the structure works.
 */
export const FRAMEWORK_EXPLAINERS: Record<Framework, FrameworkExplainer> = {
  aida: {
    framework: "aida",
    name: "AIDA",
    stages: [
      { label: "Attention", slug: "attention", what: "A hook that stops the scroll.", why: "Without attention, the rest of the copy is invisible." },
      { label: "Interest", slug: "interest", what: "A detail that makes the reader lean in.", why: "Relevance converts attention into interest." },
      { label: "Desire", slug: "desire", what: "The outcome the reader wants.", why: "Desire is what moves people from reading to wanting." },
      { label: "Action", slug: "action", what: "A single, specific next step.", why: "Friction at the CTA kills the conversion." },
    ],
    bestFor: "Landing pages, ads, product pages where you need a linear, top-down flow.",
    watchOut: "AIDA is generic — pair it with a sharp audience insight or it reads as filler.",
  },
  pas: {
    framework: "pas",
    name: "PAS",
    stages: [
      { label: "Problem", slug: "problem", what: "Name the reader's problem in their words.", why: "Naming a problem creates immediate recognition." },
      { label: "Agitate", slug: "agitate", what: "Twist the knife — what does the problem cost?", why: "Agitation amplifies motivation to act." },
      { label: "Solve", slug: "solve", what: "Present your product as the relief.", why: "The solve feels like a release after the agitate." },
    ],
    bestFor: "Email subject lines, cold email, sales pages where pain is the dominant emotion.",
    watchOut: "Over-agitation feels manipulative — keep it honest and specific.",
  },
  fab: {
    framework: "fab",
    name: "FAB",
    stages: [
      { label: "Feature", slug: "feature", what: "What the product is or does.", why: "Anchors the claim to something concrete." },
      { label: "Advantage", slug: "advantage", what: "What the feature enables.", why: "Translates engineering into capability." },
      { label: "Benefit", slug: "benefit", what: "The outcome the reader cares about.", why: "Benefits — not features — drive decisions." },
    ],
    bestFor: "Product pages, demos, sales decks where you have to map capability to outcome.",
    watchOut: "Most teams stop at the feature. Always push to the benefit.",
  },
  bab: {
    framework: "bab",
    name: "BAB",
    stages: [
      { label: "Before", slug: "before", what: "The reader's current reality.", why: "Anchors contrast — readers see themselves." },
      { label: "After", slug: "after", what: "The reality your product unlocks.", why: "Painted vividly, the after-state feels attainable." },
      { label: "Bridge", slug: "bridge", what: "How your product gets them there.", why: "The bridge is the CTA dressed as a path." },
    ],
    bestFor: "Brand campaigns, vision pages, transformation stories.",
    watchOut: "The 'after' must be specific and credible, not aspirational fluff.",
  },
  "4ps": {
    framework: "4ps",
    name: "4Ps",
    stages: [
      { label: "Picture", slug: "picture", what: "Paint a scene the reader recognizes.", why: "A picture pulls the reader into the story." },
      { label: "Promise", slug: "promise", what: "State the headline benefit.", why: "The promise is what the reader takes away." },
      { label: "Prove", slug: "prove", what: "Evidence: data, customers, results.", why: "Proof converts the promise from claim to fact." },
      { label: "Push", slug: "push", what: "The push to act now.", why: "A push creates urgency without hype." },
    ],
    bestFor: "Long-form sales pages, launch emails, video scripts.",
    watchOut: "The 'Picture' stage is easy to over-write. Keep it sensory and short.",
  },
};

/** Tone-flavored connective phrases that stage templates draw from. */
export const TONE_CONNECTORS: Record<Tone, { and: string; so: string; because: string }> = {
  professional: { and: "And", so: "So", because: "Because" },
  friendly: { and: "And hey", so: "So", because: "Because here's the thing" },
  bold: { and: "And", so: "So", because: "Because" },
  playful: { and: "Plus", so: "So", because: "Because" },
  urgent: { and: "And", so: "So", because: "Because" },
};

/**
 * Generic-superlative words the honesty linter flags. Sourced from
 * common copywriting-advice lists. Detection is word-boundary, case-
 * insensitive. Each match is a warning — copy may still ship.
 */
export const HYPE_WORDS: string[] = [
  "best", "world-class", "game-changing", "revolutionary",
  "cutting-edge", "next-generation", "industry-leading",
  "best-in-class", "unparalleled", "unmatched", "unrivaled",
  "ultimate", "amazing", "incredible", "astounding",
  "miracle", "magic", "magical", "seamless", "robust",
  "innovative", "disruptive", "synergy", "leverage",
];

/** Channel → CTA suffix presets. */
export const CHANNEL_CTA_PRESETS: Record<Channel, string[]> = {
  ad: ["Tap to learn more.", "Click to see how.", "Get started →"],
  email: ["Reply to get started.", "Book a 15-min demo.", "Get the details →"],
  landing: ["Start your free trial.", "See plans & pricing.", "Get started — it's free."],
  product: ["Add to cart.", "Choose your plan.", "Buy now."],
};

// ---------- Validation ----------

/** Validate inputs and return human-readable warnings. */
export function validateInputs(inputs: CopyInputs): string[] {
  const warnings: string[] = [];
  if (!inputs.product || !inputs.product.trim()) {
    warnings.push("Product name is required.");
  }
  if (!inputs.audience || inputs.audience.trim().length < 8) {
    warnings.push("Audience is thin — describe who you're writing for (role, segment, context).");
  }
  if (!inputs.benefit || inputs.benefit.trim().length < 8) {
    warnings.push("Benefit is thin — name the concrete outcome the audience gets.");
  }
  if (!inputs.pain || inputs.pain.trim().length < 8) {
    warnings.push("Pain point is thin — name the specific problem you solve.");
  }
  if (!inputs.cta || inputs.cta.trim().length < 3) {
    warnings.push("CTA is required — give the reader one clear next step.");
  }
  if (inputs.benefit && detectHype(inputs.benefit).length > 0) {
    warnings.push(`Benefit contains hype words (${detectHype(inputs.benefit).join(", ")}). Replace with a specific proof point.`);
  }
  return warnings;
}

/** Detect hype-superlative words in text. Word-boundary, case-insensitive. */
export function detectHype(text: string): string[] {
  if (!text) return [];
  const found: string[] = [];
  for (const w of HYPE_WORDS) {
    const re = new RegExp(`\\b${escapeRegex(w)}\\b`, "i");
    if (re.test(text)) found.push(w);
  }
  return found;
}

/** Escape a string for use in a RegExp. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------- Helpers ----------

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

/** Pick a tone-flavored CTA suffix for the channel. */
export function pickChannelCta(channel: Channel, variant: number): string {
  const list = CHANNEL_CTA_PRESETS[channel];
  return list[variant % list.length];
}

/** Repeat-clause multiplier — produces longer copy in 'expanded' mode. */
export function lengthMultiplier(length: Length): number {
  if (length === "concise") return 1;
  if (length === "standard") return 1;
  return 2;
}

// ---------- Per-stage builders ----------

/**
 * Each framework has a per-stage sentence-template builder. The builder
 * takes (inputs, tone, variant) and returns the stage text. Variants
 * rotate sentence templates within the stage so multiple variants feel
 * different without breaking the framework's logic.
 */

function aidaAttention(inputs: CopyInputs, tone: Tone, variant: number): string {
  const product = inputs.product || "[product]";
  const audience = inputs.audience || "[audience]";
  const templates: string[] = [
    `Hey ${audience} — stop wrestling spreadsheets and meet ${product}.`,
    `${capFirst(audience)}, your workflow is broken. ${product} fixes it.`,
    `If you're a ${audience}, you already know this pain. ${product} ends it.`,
  ];
  return templates[variant % templates.length];
}

function aidaInterest(inputs: CopyInputs, _tone: Tone, variant: number): string {
  const benefit = inputs.benefit || "[benefit]";
  const templates: string[] = [
    `Here's what changes: ${lcFirst(benefit)}.`,
    `In practice, that means ${lcFirst(benefit)}.`,
    `The shift is concrete — ${lcFirst(benefit)}.`,
  ];
  return templates[variant % templates.length];
}

function aidaDesire(inputs: CopyInputs, _tone: Tone, variant: number): string {
  const proof = inputs.proof || `a real result ${inputs.product || "it"} has delivered`;
  const benefit = inputs.benefit || "[benefit]";
  const templates: string[] = [
    `Picture this: ${lcFirst(proof)}. That's not a hypothetical — it's ${lcFirst(benefit)}.`,
    `Teams like yours report ${lcFirst(proof)}. You get ${lcFirst(benefit)}.`,
    `Real customers see ${lcFirst(proof)}. You could see ${lcFirst(benefit)}.`,
  ];
  return templates[variant % templates.length];
}

function aidaAction(inputs: CopyInputs, _tone: Tone, variant: number, channel: Channel): string {
  const cta = inputs.cta || "Get started";
  const suffix = pickChannelCta(channel, variant);
  return `${cta}. ${suffix}`;
}

function pasProblem(inputs: CopyInputs, _tone: Tone, variant: number): string {
  const pain = inputs.pain || "[pain]";
  const templates: string[] = [
    `You know the pain: ${lcFirst(pain)}.`,
    `Here's the problem: ${lcFirst(pain)}.`,
    `The cost is real — ${lcFirst(pain)}.`,
  ];
  return templates[variant % templates.length];
}

function pasAgitate(inputs: CopyInputs, _tone: Tone, variant: number): string {
  const pain = inputs.pain || "[pain]";
  const templates: string[] = [
    `And it compounds. Every hour you spend on ${lcFirst(pain)} is an hour you don't spend shipping.`,
    `Left unchecked, ${lcFirst(pain)} drags down morale, velocity, and revenue.`,
    `The longer it sits, the worse it gets — ${lcFirst(pain)} is not a one-time cost.`,
  ];
  return templates[variant % templates.length];
}

function pasSolve(inputs: CopyInputs, _tone: Tone, variant: number, channel: Channel): string {
  const product = inputs.product || "[product]";
  const benefit = inputs.benefit || "[benefit]";
  const cta = inputs.cta || "Get started";
  const suffix = pickChannelCta(channel, variant);
  const templates: string[] = [
    `${product} fixes this — ${lcFirst(benefit)}. ${cta}. ${suffix}`,
    `Enter ${product}: ${lcFirst(benefit)}. ${cta}. ${suffix}`,
    `That's where ${product} comes in. ${capFirst(benefit)}. ${cta}. ${suffix}`,
  ];
  return templates[variant % templates.length];
}

function fabFeature(inputs: CopyInputs, _tone: Tone, variant: number): string {
  const product = inputs.product || "[product]";
  const feature = inputs.feature || "the core capability";
  const templates: string[] = [
    `${product} ships ${feature}.`,
    `The feature: ${feature}, built into ${product}.`,
    `What it is: ${feature}, in ${product}.`,
  ];
  return templates[variant % templates.length];
}

function fabAdvantage(inputs: CopyInputs, _tone: Tone, variant: number): string {
  const feature = inputs.feature || "the core capability";
  const templates: string[] = [
    `What that means: ${lcFirst(feature)} works without setup, plugins, or scripts.`,
    `The advantage: ${lcFirst(feature)} runs in the background, so you skip the manual work.`,
    `Practically: ${lcFirst(feature)} replaces three tools and a spreadsheet.`,
  ];
  return templates[variant % templates.length];
}

function fabBenefit(inputs: CopyInputs, _tone: Tone, variant: number, channel: Channel): string {
  const benefit = inputs.benefit || "[benefit]";
  const cta = inputs.cta || "Get started";
  const suffix = pickChannelCta(channel, variant);
  const templates: string[] = [
    `The payoff: ${lcFirst(benefit)}. ${cta}. ${suffix}`,
    `You walk away with ${lcFirst(benefit)}. ${cta}. ${suffix}`,
    `So you get ${lcFirst(benefit)} — not eventually, now. ${cta}. ${suffix}`,
  ];
  return templates[variant % templates.length];
}

function babBefore(inputs: CopyInputs, _tone: Tone, variant: number): string {
  const audience = inputs.audience || "[audience]";
  const pain = inputs.pain || "[pain]";
  const templates: string[] = [
    `Today, being a ${audience} means ${lcFirst(pain)}.`,
    `Right now, ${audience} accept ${lcFirst(pain)} as the cost of doing business.`,
    `Most ${audience} spend Mondays on ${lcFirst(pain)}.`,
  ];
  return templates[variant % templates.length];
}

function babAfter(inputs: CopyInputs, _tone: Tone, variant: number): string {
  const benefit = inputs.benefit || "[benefit]";
  const templates: string[] = [
    `Imagine instead: ${lcFirst(benefit)}.`,
    `Now picture this: ${lcFirst(benefit)}.`,
    `The future state: ${lcFirst(benefit)}.`,
  ];
  return templates[variant % templates.length];
}

function babBridge(inputs: CopyInputs, _tone: Tone, variant: number, channel: Channel): string {
  const product = inputs.product || "[product]";
  const cta = inputs.cta || "Get started";
  const suffix = pickChannelCta(channel, variant);
  const templates: string[] = [
    `The bridge is ${product}. ${cta}. ${suffix}`,
    `${product} is how you get there. ${cta}. ${suffix}`,
    `That's the path ${product} opens. ${cta}. ${suffix}`,
  ];
  return templates[variant % templates.length];
}

function fourPsPicture(inputs: CopyInputs, _tone: Tone, variant: number): string {
  const audience = inputs.audience || "[audience]";
  const pain = inputs.pain || "[pain]";
  const templates: string[] = [
    `It's Monday morning. You're a ${audience}, and the first thing you face is ${lcFirst(pain)}.`,
    `Close your eyes: it's end of quarter. You're a ${audience}, and ${lcFirst(pain)} is blocking the number.`,
    `Picture the scene — a ${audience} at 5pm, still stuck on ${lcFirst(pain)}.`,
  ];
  return templates[variant % templates.length];
}

function fourPsPromise(inputs: CopyInputs, _tone: Tone, variant: number): string {
  const product = inputs.product || "[product]";
  const benefit = inputs.benefit || "[benefit]";
  const templates: string[] = [
    `Here's the promise of ${product}: ${lcFirst(benefit)}.`,
    `${product} exists for one reason: ${lcFirst(benefit)}.`,
    `The commitment behind ${product} is ${lcFirst(benefit)}.`,
  ];
  return templates[variant % templates.length];
}

function fourPsProve(inputs: CopyInputs, _tone: Tone, variant: number): string {
  const proof = inputs.proof || `real results from teams using ${inputs.product || "the product"}`;
  const templates: string[] = [
    `Proof: ${lcFirst(proof)}.`,
    `Don't take our word for it — ${lcFirst(proof)}.`,
    `The evidence is concrete: ${lcFirst(proof)}.`,
  ];
  return templates[variant % templates.length];
}

function fourPsPush(inputs: CopyInputs, _tone: Tone, variant: number, channel: Channel): string {
  const cta = inputs.cta || "Get started";
  const suffix = pickChannelCta(channel, variant);
  const templates: string[] = [
    `Don't wait. ${cta}. ${suffix}`,
    `The next move is yours. ${cta}. ${suffix}`,
    `Make today the day. ${cta}. ${suffix}`,
  ];
  return templates[variant % templates.length];
}

// ---------- Stage builder dispatch ----------

/**
 * Build a single stage's text for a framework + tone + variant.
 * Tone and length modifiers are applied at the variant level, not per
 * stage, so the framework structure stays visible.
 */
export function buildStageText(
  framework: Framework,
  slug: string,
  inputs: CopyInputs,
  tone: Tone,
  variant: number,
  channel: Channel,
): string {
  switch (framework) {
    case "aida":
      if (slug === "attention") return aidaAttention(inputs, tone, variant);
      if (slug === "interest") return aidaInterest(inputs, tone, variant);
      if (slug === "desire") return aidaDesire(inputs, tone, variant);
      if (slug === "action") return aidaAction(inputs, tone, variant, channel);
      break;
    case "pas":
      if (slug === "problem") return pasProblem(inputs, tone, variant);
      if (slug === "agitate") return pasAgitate(inputs, tone, variant);
      if (slug === "solve") return pasSolve(inputs, tone, variant, channel);
      break;
    case "fab":
      if (slug === "feature") return fabFeature(inputs, tone, variant);
      if (slug === "advantage") return fabAdvantage(inputs, tone, variant);
      if (slug === "benefit") return fabBenefit(inputs, tone, variant, channel);
      break;
    case "bab":
      if (slug === "before") return babBefore(inputs, tone, variant);
      if (slug === "after") return babAfter(inputs, tone, variant);
      if (slug === "bridge") return babBridge(inputs, tone, variant, channel);
      break;
    case "4ps":
      if (slug === "picture") return fourPsPicture(inputs, tone, variant);
      if (slug === "promise") return fourPsPromise(inputs, tone, variant);
      if (slug === "prove") return fourPsProve(inputs, tone, variant);
      if (slug === "push") return fourPsPush(inputs, tone, variant, channel);
      break;
  }
  return "";
}

// ---------- Variant generation ----------

/** Number of variants generated per framework. >= 3 per blueprint. */
export const VARIANT_COUNT = 3;

/**
 * Generate N variants for one framework. Each variant rotates the per-
 * stage sentence template by the variant index, so variants read
 * differently while keeping the framework's structure intact.
 *
 * In 'expanded' mode, each stage gets a second reinforcing sentence
 * drawn from the next variant of the same stage (so expanded variants
 * are ~2x longer).
 */
export function generateVariants(
  inputs: CopyInputs,
  framework: Framework,
  tone: Tone,
  length: Length,
  channel: Channel,
): FrameworkVariant[] {
  const stageDefs = FRAMEWORK_STAGES[framework];
  const out: FrameworkVariant[] = [];
  const expand = length === "expanded";
  for (let v = 0; v < VARIANT_COUNT; v++) {
    const stages: StageBlock[] = stageDefs.map((sd) => {
      let text = buildStageText(framework, sd.slug, inputs, tone, v, channel);
      if (expand) {
        const second = buildStageText(framework, sd.slug, inputs, tone, v + 1, channel);
        if (second && second !== text) text = `${text} ${second}`;
      }
      return { label: sd.label, slug: sd.slug, text };
    });
    const fullText = stages.map((s) => `${s.label}: ${s.text}`).join("\n\n");
    out.push({
      id: `${framework}-v${v + 1}`,
      framework,
      tone,
      length,
      channel,
      variant: v,
      stages,
      fullText,
      wordCount: countWords(stages.map((s) => s.text).join(" ")),
    });
  }
  return out;
}

/**
 * Generate variants for ALL frameworks at once.
 * Useful for the "compare frameworks" view.
 */
export function generateAllFrameworks(
  inputs: CopyInputs,
  tone: Tone,
  length: Length,
  channel: Channel,
): Record<Framework, FrameworkVariant[]> {
  const out = {} as Record<Framework, FrameworkVariant[]>;
  for (const f of FRAMEWORKS) {
    out[f] = generateVariants(inputs, f, tone, length, channel);
  }
  return out;
}

// ---------- Plain copy ----------

/** Render a single variant as plain copy without stage labels. */
export function renderPlain(variant: FrameworkVariant): string {
  return variant.stages.map((s) => s.text).join("\n\n");
}

/** Render a single variant as labeled copy. */
export function renderLabeled(variant: FrameworkVariant): string {
  return variant.fullText;
}

// ---------- Markdown / JSON / CSV ----------

/** Render a list of variants as a Markdown document. */
export function renderMarkdown(
  variants: FrameworkVariant[],
  inputs: CopyInputs,
  framework: Framework,
  tone: Tone,
  length: Length,
  channel: Channel,
): string {
  const lines: string[] = [];
  lines.push(`# ${FRAMEWORK_LABELS[framework]} — ${TONE_LABELS[tone]} · ${LENGTH_LABELS[length]} · ${CHANNEL_LABELS[channel]}`);
  lines.push("");
  lines.push("_Generated by UnQTools AI Copywriting Framework Assistant. Copy is a strong draft to edit for accuracy and claims compliance — do not ship unverified claims._");
  lines.push("");
  lines.push("## Inputs");
  lines.push("");
  lines.push(`- **Product:** ${inputs.product || "—"}`);
  lines.push(`- **Audience:** ${inputs.audience || "—"}`);
  lines.push(`- **Benefit:** ${inputs.benefit || "—"}`);
  lines.push(`- **Pain:** ${inputs.pain || "—"}`);
  if (inputs.feature) lines.push(`- **Feature:** ${inputs.feature}`);
  if (inputs.proof) lines.push(`- **Proof:** ${inputs.proof}`);
  lines.push(`- **CTA:** ${inputs.cta || "—"}`);
  lines.push("");
  lines.push("## Variants");
  lines.push("");
  for (const v of variants) {
    lines.push(`### ${v.id} — variant ${v.variant + 1} (${v.wordCount} words)`);
    lines.push("");
    for (const s of v.stages) {
      lines.push(`**${s.label}**`);
      lines.push("");
      lines.push(s.text);
      lines.push("");
    }
    lines.push("---");
    lines.push("");
  }
  return lines.join("\n");
}

/** Render a list of variants as JSON. */
export function renderJson(
  variants: FrameworkVariant[],
  inputs: CopyInputs,
  framework: Framework,
  tone: Tone,
  length: Length,
  channel: Channel,
): string {
  return JSON.stringify({
    inputs,
    framework,
    tone,
    length,
    channel,
    variants,
    generatedAt: new Date().toISOString(),
  }, null, 2);
}

/** Render a list of variants as CSV (one row per variant). */
export function renderCsv(variants: FrameworkVariant[]): string {
  const lines = ["id,framework,tone,length,channel,variant,word_count,full_text"];
  for (const v of variants) {
    lines.push([
      v.id,
      v.framework,
      v.tone,
      v.length,
      v.channel,
      String(v.variant),
      String(v.wordCount),
      escapeCsv(v.fullText),
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

// ---------- Swipe file (localStorage) ----------

export function loadSwipe(): SwipeEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(SWIPE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as SwipeEntry[];
    return Array.isArray(arr) ? arr.slice(0, SWIPE_MAX) : [];
  } catch {
    return [];
  }
}

export function saveSwipe(entry: SwipeEntry): SwipeEntry[] {
  const next = [entry, ...loadSwipe()].slice(0, SWIPE_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(SWIPE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function removeSwipe(ts: number): SwipeEntry[] {
  const next = loadSwipe().filter((e) => e.ts !== ts);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(SWIPE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearSwipe(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(SWIPE_KEY);
  } catch {
    // ignore
  }
}

// ---------- Shareable URL ----------

export function buildShareUrl(
  inputs: CopyInputs,
  framework: Framework,
  tone: Tone,
  length: Length,
  channel: Channel,
): string {
  const params = new URLSearchParams();
  if (inputs.product) params.set("p", inputs.product);
  if (inputs.audience) params.set("a", inputs.audience);
  if (inputs.benefit) params.set("b", inputs.benefit);
  if (inputs.pain) params.set("pa", inputs.pain);
  if (inputs.feature) params.set("f", inputs.feature);
  if (inputs.proof) params.set("pr", inputs.proof);
  if (inputs.cta) params.set("c", inputs.cta);
  params.set("fw", framework);
  if (tone !== "professional") params.set("t", tone);
  if (length !== "standard") params.set("l", length);
  if (channel !== "ad") params.set("ch", channel);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  let clean = hash;
  if (clean.startsWith("#") || clean.startsWith("?")) clean = clean.slice(1);
  if (!clean) {
    return {
      inputs: {},
      framework: "aida",
      tone: "professional",
      length: "standard",
      channel: "ad",
    };
  }
  const params = new URLSearchParams(clean);
  const inputs: Partial<CopyInputs> = {};
  if (params.get("p")) inputs.product = params.get("p")!;
  if (params.get("a")) inputs.audience = params.get("a")!;
  if (params.get("b")) inputs.benefit = params.get("b")!;
  if (params.get("pa")) inputs.pain = params.get("pa")!;
  if (params.get("f")) inputs.feature = params.get("f")!;
  if (params.get("pr")) inputs.proof = params.get("pr")!;
  if (params.get("c")) inputs.cta = params.get("c")!;
  const fwRaw = params.get("fw");
  const framework: Framework = (FRAMEWORKS as string[]).includes(fwRaw ?? "")
    ? (fwRaw as Framework)
    : "aida";
  const tRaw = params.get("t");
  const tone: Tone = ["professional", "friendly", "bold", "playful", "urgent"].includes(tRaw ?? "")
    ? (tRaw as Tone)
    : "professional";
  const lRaw = params.get("l");
  const length: Length = ["concise", "standard", "expanded"].includes(lRaw ?? "")
    ? (lRaw as Length)
    : "standard";
  const chRaw = params.get("ch");
  const channel: Channel = ["ad", "email", "landing", "product"].includes(chRaw ?? "")
    ? (chRaw as Channel)
    : "ad";
  return { inputs, framework, tone, length, channel };
}

// ---------- Optional LLM enhancement ----------

export function buildLlmPrompt(
  inputs: CopyInputs,
  framework: Framework,
  tone: Tone,
  length: Length,
  channel: Channel,
): string {
  const stageList = FRAMEWORK_STAGES[framework]
    .map((s) => `  - ${s.label} (${s.slug})`)
    .join("\n");
  return [
    "You are an expert marketing copywriter. Polish the inputs below into a single piece of copy structured by the named framework, in the named tone and length, tuned for the named channel.",
    "",
    "Framework: " + framework.toUpperCase(),
    "Stages (in order, each labeled):",
    stageList,
    "",
    "Tone: " + TONE_LABELS[tone],
    "Length: " + LENGTH_LABELS[length],
    "Channel: " + CHANNEL_LABELS[channel],
    "",
    "Inputs:",
    `- Product: ${inputs.product || "(empty)"}`,
    `- Audience: ${inputs.audience || "(empty)"}`,
    `- Benefit: ${inputs.benefit || "(empty)"}`,
    `- Pain: ${inputs.pain || "(empty)"}`,
    `- Feature: ${inputs.feature || "(empty)"}`,
    `- Proof: ${inputs.proof || "(empty)"}`,
    `- CTA: ${inputs.cta || "(empty)"}`,
    "",
    "Constraints: do not invent metrics or customer names; if proof is empty, do not fabricate any. Stay structurally faithful to the framework — every labeled stage must appear. Avoid hype superlatives (best, world-class, revolutionary, etc.).",
    "",
    'Output a JSON object with:',
    '- "polishedStages": array of { label, slug, text } — one per framework stage, in order',
    '- "polishedFullText": string — the stages joined with their labels, e.g. "Attention: ...\\n\\nInterest: ..."',
    '- "subjectLines": array of 3 strings — alternate headlines',
    '- "suggestions": array of strings — specific improvements the user could make to the inputs',
    "",
    "Be honest. If the inputs are thin, say so in suggestions. Do not fabricate proof points.",
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
  const stagesRaw = Array.isArray(o.polishedStages) ? (o.polishedStages as unknown[]) : [];
  const validSlugs = new Set(FRAMEWORKS.flatMap((f) => FRAMEWORK_STAGES[f].map((s) => s.slug)));
  const polishedStages: StageBlock[] = stagesRaw
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .map((x) => ({
      label: typeof x.label === "string" ? x.label : "",
      slug: typeof x.slug === "string" && validSlugs.has(x.slug) ? x.slug : "",
      text: typeof x.text === "string" ? x.text : "",
    }))
    .filter((s) => s.label || s.text);
  const polishedFullText = typeof o.polishedFullText === "string" ? o.polishedFullText : "";
  const subjectLines = Array.isArray(o.subjectLines)
    ? (o.subjectLines as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  const suggestions = Array.isArray(o.suggestions)
    ? (o.suggestions as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  return {
    ok: true,
    result: { polishedStages, polishedFullText, subjectLines, suggestions },
  };
}
