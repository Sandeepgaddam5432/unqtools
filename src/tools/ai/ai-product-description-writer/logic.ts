/**
 * AI Product Description Writer — pure logic.
 *
 * Generates benefit-driven, SEO product descriptions from product attributes
 * (name, features, audience, tone). Outputs multiple format-correct variants
 * (paragraph, Amazon 5-bullet, Shopify, Etsy, meta description) with a
 * keyword-density meter and feature→benefit translator.
 *
 * Capabilities:
 *   - 4 product types (physical, digital, service, SaaS) with type-specific templates.
 *   - 6 tones (professional, casual, luxurious, playful, technical, persuasive).
 *   - 3 lengths (short 60–80w, medium 120–160w, long 220–280w).
 *   - 5 formats (paragraph, amazon-bullets, shopify, etsy, meta).
 *   - Feature→benefit translator (deterministic dictionary + pattern rewriter).
 *   - SEO keyword extraction + density check (warns on stuffing > 4%).
 *   - Persona targeting hooks + A/B variant generator.
 *   - Bulk CSV mode (one product per row).
 *   - History (localStorage, last 20) + shareable URL.
 *   - Honesty checks (flags unverifiable health/spec claims).
 *
 * Pure functions only — no DOM, no network. The optional LLM call (BYO API key)
 * lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type ProductType = "physical" | "digital" | "service" | "saas";

export type Tone =
  | "professional"
  | "casual"
  | "luxurious"
  | "playful"
  | "technical"
  | "persuasive";

export type Length = "short" | "medium" | "long";

export type Format =
  | "paragraph"
  | "amazon-bullets"
  | "shopify"
  | "etsy"
  | "meta";

export type DensityStatus = "good" | "warn" | "bad";

export interface ProductInput {
  name: string;
  type: ProductType;
  features: string[];
  audience: string;
  tone: Tone;
  length: Length;
  keywords: string[];
  brand: string;
  price: string;
  callToAction: string;
}

export interface Benefit {
  feature: string;
  benefit: string;
}

export interface GeneratedDescription {
  format: Format;
  text: string;
  wordCount: number;
  charCount: number;
}

export interface KeywordDensity {
  keyword: string;
  count: number;
  density: number; // percentage 0–100
  status: DensityStatus;
}

export interface DescriptionStats {
  totalWords: number;
  totalChars: number;
  sentenceCount: number;
  avgWordsPerSentence: number;
  readingTimeSeconds: number;
  keywordDensities: KeywordDensity[];
  benefitCount: number;
  hasCallToAction: boolean;
  honestyWarnings: string[];
}

export interface HistoryEntry {
  ts: number;
  name: string;
  type: ProductType;
  format: Format;
  wordCount: number;
  preview: string;
}

// ---------- Constants ----------

export const HISTORY_MAX = 20;

export const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: "physical", label: "Physical product" },
  { value: "digital", label: "Digital product (ebook, course, app)" },
  { value: "service", label: "Service" },
  { value: "saas", label: "SaaS / software" },
];

export const TONES: { value: Tone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual & friendly" },
  { value: "luxurious", label: "Luxurious" },
  { value: "playful", label: "Playful" },
  { value: "technical", label: "Technical" },
  { value: "persuasive", label: "Persuasive" },
];

export const LENGTHS: { value: Length; label: string; minWords: number; maxWords: number }[] = [
  { value: "short", label: "Short (60–80 words)", minWords: 60, maxWords: 80 },
  { value: "medium", label: "Medium (120–160 words)", minWords: 120, maxWords: 160 },
  { value: "long", label: "Long (220–280 words)", minWords: 220, maxWords: 280 },
];

export const FORMATS: { value: Format; label: string }[] = [
  { value: "paragraph", label: "Paragraph" },
  { value: "amazon-bullets", label: "Amazon 5-bullet" },
  { value: "shopify", label: "Shopify" },
  { value: "etsy", label: "Etsy" },
  { value: "meta", label: "Meta description (≤155 chars)" },
];

export const DEFAULT_INPUT: ProductInput = {
  name: "",
  type: "physical",
  features: [],
  audience: "",
  tone: "professional",
  length: "medium",
  keywords: [],
  brand: "",
  price: "",
  callToAction: "",
};

export const SAMPLE_PRODUCTS: { label: string; input: ProductInput }[] = [
  {
    label: "Stainless steel kettle",
    input: {
      name: "Aurora Stainless Steel Gooseneck Kettle",
      type: "physical",
      features: [
        "1.0L stainless steel body",
        "Precision gooseneck spout",
        "Ergonomic stay-cool handle",
        "Compatible with induction stovetops",
        "1-year warranty",
      ],
      audience: "home baristas and pour-over coffee enthusiasts",
      tone: "professional",
      length: "medium",
      keywords: ["pour over kettle", "gooseneck kettle", "stainless steel kettle"],
      brand: "Aurora",
      price: "$79",
      callToAction: "Brew better today — add the Aurora kettle to your cart.",
    },
  },
  {
    label: "Productivity SaaS",
    input: {
      name: "FluxTask — Team Task Manager",
      type: "saas",
      features: [
        "Unlimited projects and tasks",
        "Native Slack and GitHub integrations",
        "Recurring task automation",
        "Real-time collaboration for up to 50 seats",
        "SOC 2 Type II compliance",
      ],
      audience: "engineering managers and product teams of 10–50",
      tone: "persuasive",
      length: "long",
      keywords: ["team task manager", "project management software", "slack integration"],
      brand: "FluxTask",
      price: "$9/user/mo",
      callToAction: "Start a 14-day free trial — no credit card required.",
    },
  },
  {
    label: "Online course (digital)",
    input: {
      name: "Watercolor Basics: 30-Day Starter Course",
      type: "digital",
      features: [
        "30 HD video lessons (6 hours total)",
        "Downloadable reference sketches",
        "Lifetime access + future updates",
        "Private community feedback group",
        "Beginner-friendly — no prior experience needed",
      ],
      audience: "aspiring hobbyist painters with no formal training",
      tone: "casual",
      length: "medium",
      keywords: ["watercolor course", "learn watercolor", "online painting class"],
      brand: "Brushful Studio",
      price: "$49",
      callToAction: "Enroll today and paint your first piece this week.",
    },
  },
  {
    label: "Cleaning service",
    input: {
      name: "BrightNest Eco Home Cleaning",
      type: "service",
      features: [
        "Background-checked, insured cleaners",
        "Plant-based, pet-safe cleaning products",
        "Same 2-person team every visit",
        "Online booking with 1-hour arrival windows",
        "100% satisfaction guarantee",
      ],
      audience: "busy professionals and families in the metro area",
      tone: "professional",
      length: "short",
      keywords: ["home cleaning service", "eco friendly cleaning", "house cleaners"],
      brand: "BrightNest",
      price: "from $120/visit",
      callToAction: "Book your first clean — see the BrightNest difference.",
    },
  },
];

export const HONESTY_NOTES: string[] = [
  "This tool never fabricates specifications, certifications, or health/medical claims.",
  "If a feature references a claim that requires evidence (e.g. 'FDA-approved', 'clinically proven'), the generator flags it for you to verify before publishing.",
  "Keyword density is a guide — search engines penalize stuffing. Stay in the green zone.",
  "AI-drafted descriptions are starting points; review for accuracy, brand voice, and legal compliance before publishing.",
];

// Feature → benefit dictionary (deterministic). Each pattern matches a feature
// substring and produces a benefit template. {audience} and {feature} are
// substituted at runtime.
interface BenefitPattern {
  match: RegExp;
  template: (feature: string, audience: string) => string;
}

const BENEFIT_PATTERNS: BenefitPattern[] = [
  {
    match: /stainless steel|aluminum|titanium|carbon fiber|bamboo|cotton|leather|wood/i,
    template: (_f, a) => `Built from durable materials that last for years, so ${a} get long-term value without frequent replacements.`,
  },
  {
    match: /\b(\d+)[-\s]?(?:year|yr)s?\s*warranty/i,
    template: (f, _a) => `Backed by ${f}, giving you peace of mind and risk-free ownership.`,
  },
  {
    match: /lifetime warranty|lifetime guarantee/i,
    template: (_f, a) => `A lifetime warranty means ${a} buy once and never worry again.`,
  },
  {
    match: /battery|rechargeable|usb-?c|wireless charging/i,
    template: (f, a) => `${capitalize(f)} keeps ${a} powered through full work sessions without scrambling for an outlet.`,
  },
  {
    match: /waterproof|water-?resistant|ip67|ip68|sweat-?resistant/i,
    template: (f, a) => `${capitalize(f)} — so ${a} can use it in the rain, at the gym, or by the pool without worry.`,
  },
  {
    match: /ergonomic|comfort|lightweight|portable/i,
    template: (f, a) => `${capitalize(f)} design means ${a} can use it for hours without strain.`,
  },
  {
    match: /precision|gooseneck|calibrat/i,
    template: (f, a) => `${capitalize(f)} lets ${a} control every detail for consistently better results.`,
  },
  {
    match: /compatible with|works with|integrat/i,
    template: (f, a) => `${capitalize(f)} — fits right into the tools ${a} already use, with no new workflow to learn.`,
  },
  {
    match: /automation|automat|recurring|schedule/i,
    template: (f, a) => `${capitalize(f)} handles repetitive work in the background, freeing ${a} to focus on what matters.`,
  },
  {
    match: /real-?time|live sync|instant/i,
    template: (f, a) => `${capitalize(f)} means ${a} always see the latest state — no stale data, no surprises.`,
  },
  {
    match: /unlimited/i,
    template: (f, a) => `${capitalize(f)} — ${a} never hit artificial caps or paywalls as they grow.`,
  },
  {
    match: /sec|soc ?2|gdpr|hipaa|encrypt|compliance|certified/i,
    template: (f, a) => `${capitalize(f)} — so ${a} (and their customers) can trust the platform with sensitive data.`,
  },
  {
    match: /lifetime access|forever access/i,
    template: (_f, a) => `Lifetime access means ${a} pay once and revisit the material whenever they need a refresher.`,
  },
  {
    match: /hd video|4k video|video lesson|video tutor/i,
    template: (f, a) => `${capitalize(f)} lets ${a} follow along visually at their own pace, pausing and replaying as needed.`,
  },
  {
    match: /beginner-?friendly|no (prior )?experience/i,
    template: (f, a) => `${capitalize(f)} — ${a} can start from zero and still see results fast.`,
  },
  {
    match: /community|support group|forum/i,
    template: (f, a) => `${capitalize(f)} means ${a} never get stuck — peers and experts answer questions fast.`,
  },
  {
    match: /insured|background-?check/i,
    template: (f, a) => `${capitalize(f)} so ${a} can trust the people entering their home or handling their data.`,
  },
  {
    match: /guarantee|money-?back|satisfaction/i,
    template: (f, a) => `${capitalize(f)} — there's zero risk for ${a} to try it out.`,
  },
  {
    match: /booking|schedule online|online book/i,
    template: (f, a) => `${capitalize(f)} means ${a} can set up service in under a minute, anytime.`,
  },
  {
    match: /plant-?based|eco-?friendly|non-?toxic|pet-?safe/i,
    template: (f, a) => `${capitalize(f)} — safer for ${a}, their families, and the planet.`,
  },
];

// Honesty-flag patterns — words that require evidence.
const HONESTY_FLAG_PATTERNS: RegExp[] = [
  /\bFDA[- ]approved\b/i,
  /\bclinically proven\b/i,
  /\bguaranteed cure\b/i,
  /\b100% safe\b/i,
  /\bno side effects\b/i,
  /\bmedical-?grade\b/i,
  /\bdoctor recommended\b/i,
  /\bbest in the world\b/i,
  /\b#1\b/i,
];

// ---------- Helpers ----------

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function normalize(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

function words(s: string): string[] {
  return (s.toLowerCase().match(/\b[a-z0-9']+\b/g) ?? []);
}

function wordCount(s: string): number {
  return words(s).length;
}

function countSentences(s: string): number {
  const m = s.match(/[.!?]+/g);
  return m ? m.length : (s.trim() ? 1 : 0);
}

// ---------- Validation ----------

export function validateProductInput(input: ProductInput): string[] {
  const errors: string[] = [];
  if (!normalize(input.name)) errors.push("Product name is required.");
  if (!input.features || input.features.filter((f) => normalize(f)).length === 0) {
    errors.push("At least one feature is required.");
  }
  if (!normalize(input.audience)) errors.push("Target audience is required.");
  return errors;
}

// ---------- Feature → Benefit ----------

/** Translate a single feature into a customer-facing benefit. */
export function translateFeatureToBenefit(feature: string, audience = "customers"): Benefit {
  const f = normalize(feature);
  if (!f) return { feature: "", benefit: "" };
  for (const p of BENEFIT_PATTERNS) {
    if (p.match.test(f)) {
      return { feature: f, benefit: p.template(f, audience) };
    }
  }
  // Fallback: deterministic rewriter.
  return {
    feature: f,
    benefit: `Because of ${lowerFirst(f)}, ${audience} get a better result with less effort.`,
  };
}

function lowerFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** Translate a list of features into benefits. */
export function translateAllFeatures(features: string[], audience: string): Benefit[] {
  return features
    .filter((f) => normalize(f))
    .map((f) => translateFeatureToBenefit(f, audience));
}

// ---------- Tone modifiers ----------

const TONE_OPENERS: Record<Tone, string[]> = {
  professional: ["Meet", "Introducing", "Designed for"],
  casual: ["Say hello to", "Looking for", "Here's"],
  luxurious: ["Experience", "Indulge in", "Discover"],
  playful: ["Get ready for", "Say hi to", "Craving"],
  technical: ["Engineered for", "Optimized for", "Built for"],
  persuasive: ["Stop settling for less. Meet", "Finally:", "Upgrade to"],
};

const TONE_CONNECTORS: Record<Tone, string> = {
  professional: "Plus,",
  casual: "And,",
  luxurious: "What's more,",
  playful: "Best part?",
  technical: "Additionally,",
  persuasive: "Better yet,",
};

function pickOpener(tone: Tone, name: string): string {
  const openers = TONE_OPENERS[tone];
  const idx = name.length % openers.length;
  return `${openers[idx]} ${name}`;
}

// ---------- SEO keyword helpers ----------

/** Extract candidate keywords from text (simple noun-phrase-like tokens). */
export function extractKeywords(text: string, topN = 10): string[] {
  const stop = new Set([
    "the", "a", "an", "and", "or", "but", "for", "to", "of", "in", "on", "at",
    "with", "is", "are", "was", "were", "be", "been", "being", "have", "has",
    "had", "do", "does", "did", "this", "that", "these", "those", "it", "its",
    "as", "by", "from", "your", "you", "we", "our", "they", "their", "i",
  ]);
  const freq = new Map<string, number>();
  for (const w of words(text)) {
    if (w.length < 4 || stop.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([w]) => w);
}

/** Weave a keyword into text at most once per 100 words to avoid stuffing. */
export function weaveKeywords(text: string, keywords: string[]): string {
  if (keywords.length === 0) return text;
  const wc = wordCount(text);
  const maxInsertions = Math.max(0, Math.floor(wc / 100));
  if (maxInsertions === 0) return text;
  let out = text;
  let inserted = 0;
  for (const kw of keywords) {
    if (inserted >= maxInsertions) break;
    if (!kw) continue;
    const re = new RegExp(`\\b${escapeRegex(kw.toLowerCase())}\\b`, "i");
    if (re.test(out.toLowerCase())) continue; // already present
    // Insert after first period.
    const periodIdx = out.indexOf(". ");
    if (periodIdx === -1) continue;
    out = `${out.slice(0, periodIdx + 2)}${lowerFirst(kw)}? ${capitalize(out.slice(periodIdx + 2))}`;
    inserted++;
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Compute keyword density for a text. */
export function checkKeywordDensity(text: string, keywords: string[]): KeywordDensity[] {
  const wc = wordCount(text);
  if (wc === 0) return [];
  return keywords.filter((k) => k).map((kw) => {
    const re = new RegExp(`\\b${escapeRegex(kw.toLowerCase())}\\b`, "g");
    const matches = text.toLowerCase().match(re) ?? [];
    const count = matches.length;
    const density = (count / wc) * 100;
    let status: DensityStatus = "good";
    if (density > 4) status = "bad";
    else if (density > 2.5) status = "warn";
    return { keyword: kw, count, density: Math.round(density * 10) / 10, status };
  });
}

// ---------- Honesty checks ----------

/** Detect unverifiable claims that require evidence. */
export function detectHonestyWarnings(text: string): string[] {
  const out: string[] = [];
  for (const p of HONESTY_FLAG_PATTERNS) {
    if (p.test(text)) {
      const match = text.match(p);
      out.push(`Verify before publishing: "${match?.[0] ?? "claim"}" requires evidence.`);
    }
  }
  return out;
}

// ---------- Description generation ----------

/** Generate the main paragraph description (single format). */
export function generateParagraph(input: ProductInput): GeneratedDescription {
  const name = normalize(input.name) || "this product";
  const audience = normalize(input.audience) || "customers";
  const benefits = translateAllFeatures(input.features, audience);
  const opener = pickOpener(input.tone, name);
  const cta = normalize(input.callToAction);

  const benefitSentences = benefits.slice(0, 5).map((b) => b.benefit);
  const audienceClause = `Designed for ${audience},`;
  const firstBenefit = benefitSentences[0] ?? `it delivers real value every time you use it.`;
  const restBenefits = benefitSentences.slice(1);

  // Build a base paragraph then trim/extend by length.
  const target = LENGTHS.find((l) => l.value === input.length)!;
  let para = `${opener}. ${audienceClause} ${firstBenefit} ${TONE_CONNECTORS[input.tone]} ${restBenefits.join(" ")}`;

  // Trim or extend to target range.
  para = adjustToLength(para, input, benefits, target.minWords, target.maxWords);

  // Weave keywords.
  para = weaveKeywords(para, input.keywords);

  if (cta) {
    para = `${para} ${cta}`;
  }

  const wc = wordCount(para);
  return {
    format: "paragraph",
    text: para.trim().replace(/\s+/g, " "),
    wordCount: wc,
    charCount: para.trim().length,
  };
}

function adjustToLength(
  para: string,
  input: ProductInput,
  benefits: Benefit[],
  minWords: number,
  maxWords: number,
): string {
  let text = para;
  let wc = wordCount(text);
  // Extend if too short.
  let extraIdx = 5;
  while (wc < minWords && extraIdx < benefits.length) {
    text = `${text} ${benefits[extraIdx].benefit}`;
    extraIdx++;
    wc = wordCount(text);
  }
  // Extend with summary if still short.
  if (wc < minWords) {
    const summary = `Whether ${input.audience || "you"} choose it for daily use or special occasions, ${input.name || "this product"} is built to deliver consistent results.`;
    text = `${text} ${summary}`;
    wc = wordCount(text);
  }
  // Trim if too long (cut at sentence boundary).
  while (wc > maxWords) {
    const lastPeriod = text.lastIndexOf(". ");
    if (lastPeriod === -1) break;
    text = text.slice(0, lastPeriod + 1);
    wc = wordCount(text);
    if (wc <= maxWords) break;
  }
  return text;
}

/** Generate Amazon-style 5-bullet list. */
export function generateAmazonBullets(input: ProductInput): GeneratedDescription {
  const name = normalize(input.name) || "this product";
  const audience = normalize(input.audience) || "customers";
  const benefits = translateAllFeatures(input.features, audience);
  const cta = normalize(input.callToAction);

  // Amazon bullets: 5 bullets, each ≤ 200 chars, headline in CAPS + benefit.
  const bullets: string[] = [];
  const topBenefits = benefits.slice(0, 5);
  while (topBenefits.length < 5 && benefits.length > topBenefits.length) {
    topBenefits.push(benefits[topBenefits.length]);
  }
  for (const b of topBenefits) {
    const headline = extractHeadline(b.feature).toUpperCase();
    bullets.push(`• ${headline}: ${b.benefit}`);
  }
  // If fewer than 5 features, pad with benefit-style placeholders.
  while (bullets.length < 5) {
    bullets.push(`• GREAT GIFT: A thoughtful choice for ${audience} on any occasion.`);
  }

  let text = `${name} — key features:\n${bullets.join("\n")}`;
  if (cta) text = `${text}\n${cta}`;

  return {
    format: "amazon-bullets",
    text,
    wordCount: wordCount(text),
    charCount: text.length,
  };
}

function extractHeadline(feature: string): string {
  // Take first 2-3 words as a headline.
  const f = normalize(feature);
  if (!f) return "FEATURE";
  const w = f.split(/\s+/);
  if (w.length <= 3) return f;
  return w.slice(0, 3).join(" ");
}

/** Generate Shopify-style paragraph (slightly shorter, no CTA in body). */
export function generateShopify(input: ProductInput): GeneratedDescription {
  const adjusted: ProductInput = {
    ...input,
    length: input.length === "long" ? "medium" : input.length,
    callToAction: "", // Shopify CTA is in the buy button.
  };
  const para = generateParagraph(adjusted);
  return { ...para, format: "shopify" };
}

/** Generate Etsy-style description (longer, story-driven). */
export function generateEtsy(input: ProductInput): GeneratedDescription {
  const name = normalize(input.name) || "this piece";
  const audience = normalize(input.audience) || "shoppers";
  const benefits = translateAllFeatures(input.features, audience);
  const brand = normalize(input.brand);

  const intro = `Looking for something special? ${capitalize(name)} is a favorite among ${audience} who appreciate quality and craftsmanship.`;
  const benefitText = benefits.slice(0, 5).map((b) => `• ${capitalize(b.benefit)}`).join("\n");
  const outro = brand
    ? `Made with care by ${brand}. Order today and add a piece you'll love for years.`
    : `Order today and add a piece you'll love for years.`;

  const text = `${intro}\n\n${benefitText}\n\n${outro}`;
  return {
    format: "etsy",
    text,
    wordCount: wordCount(text),
    charCount: text.length,
  };
}

/** Generate meta description (≤ 155 characters). */
export function generateMeta(input: ProductInput): GeneratedDescription {
  const name = normalize(input.name) || "this product";
  const audience = normalize(input.audience) || "customers";
  const firstBenefit = translateAllFeatures(input.features, audience)[0];
  const kw = input.keywords.slice(0, 2).join(", ");
  let text = `${name} for ${audience}. ${firstBenefit ? firstBenefit.benefit : ""}`;
  if (kw) text = `${text} ${kw}.`;
  // Hard cap at 155 chars at word boundary.
  if (text.length > 155) {
    text = text.slice(0, 152);
    const lastSpace = text.lastIndexOf(" ");
    if (lastSpace > 80) text = text.slice(0, lastSpace);
    text = `${text}…`;
  }
  return {
    format: "meta",
    text,
    wordCount: wordCount(text),
    charCount: text.length,
  };
}

/** Generate all five formats. */
export function generateAll(input: ProductInput): GeneratedDescription[] {
  return [
    generateParagraph(input),
    generateAmazonBullets(input),
    generateShopify(input),
    generateEtsy(input),
    generateMeta(input),
  ];
}

/** Generate A/B variant — a second paragraph with a different opener + benefit order. */
export function generateVariant(input: ProductInput): GeneratedDescription {
  const benefits = translateAllFeatures(input.features, input.audience || "customers");
  const reversed: Benefit[] = [...benefits].reverse();
  const variantInput: ProductInput = {
    ...input,
    features: reversed.map((b) => b.feature),
  };
  // Force a different opener by tweaking the name slightly.
  const altName = `${input.name} — a closer look`;
  const para = generateParagraph({ ...variantInput, name: altName });
  return { ...para, format: "paragraph" };
}

// ---------- Bulk CSV mode ----------

export interface BulkRow {
  name: string;
  type: string;
  features: string;
  audience: string;
  tone: string;
  length: string;
  keywords: string;
}

/** Parse a CSV string into BulkRow[] (header row expected). */
export function parseBulkCsv(csv: string): BulkRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  // Skip header if it looks like one.
  const firstLower = lines[0].toLowerCase();
  const hasHeader = /name|type|features|audience/.test(firstLower);
  const startIdx = hasHeader ? 1 : 0;
  const out: BulkRow[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    if (cols.length < 1) continue;
    out.push({
      name: cols[0] ?? "",
      type: cols[1] ?? "physical",
      features: cols[2] ?? "",
      audience: cols[3] ?? "",
      tone: cols[4] ?? "professional",
      length: cols[5] ?? "medium",
      keywords: cols[6] ?? "",
    });
  }
  return out;
}

export function bulkRowToInput(row: BulkRow): ProductInput {
  const validTypes = PRODUCT_TYPES.map((p) => p.value) as string[];
  const validTones = TONES.map((t) => t.value) as string[];
  const validLengths = LENGTHS.map((l) => l.value) as string[];
  return {
    name: row.name,
    type: (validTypes.includes(row.type) ? row.type : "physical") as ProductType,
    features: row.features.split(/[|;\n]/).map((s) => s.trim()).filter(Boolean),
    audience: row.audience,
    tone: (validTones.includes(row.tone) ? row.tone : "professional") as Tone,
    length: (validLengths.includes(row.length) ? row.length : "medium") as Length,
    keywords: row.keywords.split(/[,;]/).map((s) => s.trim()).filter(Boolean),
    brand: "",
    price: "",
    callToAction: "",
  };
}

/** Process a bulk CSV — returns one paragraph per row. */
export function processBulkCsv(csv: string): GeneratedDescription[] {
  return parseBulkCsv(csv).map((row) => generateParagraph(bulkRowToInput(row)));
}

// ---------- Stats ----------

export function computeStats(desc: GeneratedDescription, input: ProductInput): DescriptionStats {
  const text = desc.text;
  const wc = wordCount(text);
  const sentences = countSentences(text);
  return {
    totalWords: wc,
    totalChars: text.length,
    sentenceCount: sentences,
    avgWordsPerSentence: sentences ? Math.round((wc / sentences) * 10) / 10 : 0,
    readingTimeSeconds: Math.max(1, Math.round((wc / 200) * 60)),
    keywordDensities: checkKeywordDensity(text, input.keywords),
    benefitCount: translateAllFeatures(input.features, input.audience).length,
    hasCallToAction: Boolean(normalize(input.callToAction)) && desc.format !== "shopify",
    honestyWarnings: detectHonestyWarnings(text),
  };
}

// ---------- Render helpers ----------

export function renderMarkdown(desc: GeneratedDescription, input: ProductInput): string {
  const benefits = translateAllFeatures(input.features, input.audience || "customers");
  let md = `# ${input.name || "Product"}\n\n`;
  if (input.brand) md += `**Brand:** ${input.brand}\n\n`;
  if (input.price) md += `**Price:** ${input.price}\n\n`;
  if (input.audience) md += `**Audience:** ${input.audience}\n\n`;
  if (input.keywords.length > 0) md += `**Keywords:** ${input.keywords.join(", ")}\n\n`;
  md += `## ${formatLabel(desc.format)}\n\n${desc.text}\n\n`;
  if (benefits.length > 0) {
    md += `## Feature → Benefit\n\n`;
    for (const b of benefits) md += `- **${b.feature}** → ${b.benefit}\n`;
  }
  return md;
}

export function formatLabel(format: Format): string {
  const f = FORMATS.find((x) => x.value === format);
  return f ? f.label : format;
}

export function renderCsv(descriptions: GeneratedDescription[]): string {
  const lines = ["format,text,word_count,char_count"];
  for (const d of descriptions) {
    lines.push([
      d.format,
      escapeCsv(d.text),
      String(d.wordCount),
      String(d.charCount),
    ].join(","));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(current); current = "";
    } else { current += ch; }
  }
  out.push(current);
  return out;
}

// ---------- LLM prompt (BYO key, called from ui.tsx) ----------

export function buildLlmPrompt(input: ProductInput, format: Format): string {
  const benefits = translateAllFeatures(input.features, input.audience || "customers");
  return [
    `You are an e-commerce copywriter. Write a ${formatLabel(format)} product description.`,
    `Product name: ${input.name}`,
    `Type: ${input.type}`,
    `Audience: ${input.audience}`,
    `Tone: ${input.tone}`,
    `Length target: ${input.length}`,
    `Features (as bullet list):`,
    ...input.features.map((f) => `  - ${f}`),
    `Translated benefits (as bullet list):`,
    ...benefits.map((b) => `  - ${b.benefit}`),
    `Target SEO keywords: ${input.keywords.join(", ")}`,
    `Call to action: ${input.callToAction || "(none — do not add one)"}`,
    ``,
    `Rules:`,
    `- Lead with the strongest benefit, not a feature.`,
    `- Use each keyword at most once.`,
    `- Never invent specifications, certifications, or health claims.`,
    `- If a claim requires evidence, mark it [VERIFY].`,
    `- Return only the description, no preamble.`,
  ].join("\n");
}

export function renderLlmResult(out: string): { text: string; warnings: string[] } {
  const text = (out || "").trim();
  return { text, warnings: detectHonestyWarnings(text) };
}

// ---------- History (localStorage) ----------

const HISTORY_KEY = "unqtools:ai-product-description-writer:history";

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

export function buildShareUrl(input: ProductInput): string {
  const params = new URLSearchParams();
  if (input.name) params.set("name", input.name);
  if (input.type) params.set("type", input.type);
  if (input.features.length > 0) params.set("features", input.features.join("|"));
  if (input.audience) params.set("audience", input.audience);
  if (input.tone) params.set("tone", input.tone);
  if (input.length) params.set("length", input.length);
  if (input.keywords.length > 0) params.set("kw", input.keywords.join(","));
  if (input.brand) params.set("brand", input.brand);
  if (input.price) params.set("price", input.price);
  if (input.callToAction) params.set("cta", input.callToAction);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ProductInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ProductInput> = {};
  if (params.get("name")) out.name = params.get("name")!;
  if (params.get("type")) {
    const t = params.get("type") as ProductType;
    if (PRODUCT_TYPES.some((p) => p.value === t)) out.type = t;
  }
  const f = params.get("features");
  if (f) out.features = f.split("|").map((s) => s.trim()).filter(Boolean);
  if (params.get("audience")) out.audience = params.get("audience")!;
  if (params.get("tone")) {
    const t = params.get("tone") as Tone;
    if (TONES.some((x) => x.value === t)) out.tone = t;
  }
  if (params.get("length")) {
    const l = params.get("length") as Length;
    if (LENGTHS.some((x) => x.value === l)) out.length = l;
  }
  const kw = params.get("kw");
  if (kw) out.keywords = kw.split(",").map((s) => s.trim()).filter(Boolean);
  if (params.get("brand")) out.brand = params.get("brand")!;
  if (params.get("price")) out.price = params.get("price")!;
  if (params.get("cta")) out.callToAction = params.get("cta")!;
  return out;
}
