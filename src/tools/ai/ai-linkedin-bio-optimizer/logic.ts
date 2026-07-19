/**
 * AI LinkedIn Bio Optimizer — pure logic.
 *
 * Generate keyword-rich LinkedIn headlines (≤ 220 chars) and About
 * sections (≤ 2,600 chars) from a pasted profile/resume, target role,
 * and industry. Score by keyword density, clarity, and impact. Multiple
 * tone presets and CTA options. Pure functions only — no DOM, no network.
 * The optional LLM call (BYO API key) lives in ui.tsx.
 *
 * Honesty: keep claims truthful — don't inflate titles or metrics.
 * Keyword optimization helps discovery, not guarantees.
 */

// ---------- Types ----------

export type Tone = "leadership" | "ic" | "creative" | "minimal" | "technical";
export type Cta = "open-to-work" | "lets-connect" | "hire-me" | "speaking" | "blog";

export interface ScoreBreakdown {
  /** 0-100 overall score. */
  overall: number;
  /** 0-40 keyword density score. */
  keywordDensity: number;
  /** 0-30 clarity score. */
  clarity: number;
  /** 0-30 impact score. */
  impact: number;
  /** What's good. */
  strengths: string[];
  /** What could be improved. */
  improvements: string[];
}

export interface HeadlineVariant {
  id: string;
  text: string;
  tone: Tone;
  cta: Cta;
  charCount: number;
  charLimit: number;
  exceedsLimit: boolean;
  trimmed: boolean;
  keywords: string[];
  score: ScoreBreakdown;
}

export interface AboutVariant {
  id: string;
  text: string;
  tone: Tone;
  cta: Cta;
  charCount: number;
  charLimit: number;
  exceedsLimit: boolean;
  trimmed: boolean;
  paragraphs: string[];
  keywords: string[];
  score: ScoreBreakdown;
}

export interface KeywordGap {
  keyword: string;
  /** True if present in the optimized output. */
  present: boolean;
  suggestion: string;
}

export interface ProfileScore {
  headlineScore: number;
  aboutScore: number;
  overall: number;
  breakdown: {
    headline: ScoreBreakdown;
    about: ScoreBreakdown;
  };
}

export interface DiffResult {
  before: string;
  after: string;
  added: string[];
  removed: string[];
  unchanged: string[];
}

// ---------- Constants ----------

export const HEADLINE_CHAR_LIMIT = 220;
export const ABOUT_CHAR_LIMIT = 2600;

export const HISTORY_KEY = "unqtools:ai-linkedin-bio-optimizer:history";
export const HISTORY_MAX = 20;
export const LLM_KEY_STORAGE = "unqtools:ai-linkedin-bio-optimizer:llm-key";

export const TONE_LABELS: Record<Tone, string> = {
  leadership: "Leadership",
  ic: "Individual Contributor",
  creative: "Creative",
  minimal: "Minimal",
  technical: "Technical",
};

export const CTA_LABELS: Record<Cta, string> = {
  "open-to-work": "Open to work",
  "lets-connect": "Let's connect",
  "hire-me": "Hire me",
  speaking: "Speaking inquiries",
  blog: "Read my blog",
};

export const CTA_TEXT: Record<Cta, string> = {
  "open-to-work": "Open to new opportunities",
  "lets-connect": "Let's connect — always happy to network",
  "hire-me": "Available for hire — DM me",
  speaking: "Available for speaking engagements",
  blog: "Read my writing →",
};

export const ROLE_PRESETS: string[] = [
  "Senior Product Manager", "Software Engineer", "Data Scientist",
  "Marketing Manager", "UX Designer", "Engineering Manager",
  "Sales Director", "Growth Lead", "DevOps Engineer",
  "Content Strategist", "Finance Analyst", "Founder & CEO",
];

export const INDUSTRY_PRESETS: string[] = [
  "SaaS", "Fintech", "Healthcare", "E-commerce", "AI/ML",
  "Cybersecurity", "EdTech", "Climate Tech", "Media", "B2B",
];

export const COMMON_KEYWORDS: Record<string, string[]> = {
  "Product Manager": ["product strategy", "roadmap", "stakeholder", "OKRs", "discovery", "ship", "metrics", "user research"],
  "Software Engineer": ["full-stack", "backend", "frontend", "API", "scalable", "TypeScript", "architecture", "CI/CD"],
  "Data Scientist": ["machine learning", "Python", "SQL", "modeling", "experimentation", "A/B testing", "statistics", "predictive"],
  "Marketing Manager": ["SEO", "campaigns", "funnel", "growth", "attribution", "content", "brand", "demand gen"],
  "UX Designer": ["user research", "wireframes", "prototyping", "Figma", "usability", "design system", "accessibility", "journey"],
  "Engineering Manager": ["team lead", "scaling", "delivery", "mentor", "architecture", "hiring", "engineering culture", "OKRs"],
  "Sales Director": ["pipeline", "quota", "enterprise", "negotiation", "CRM", "forecasting", "closing", "account management"],
  "Growth Lead": ["growth", "experiments", "CRO", "funnel", "activation", "retention", "viral", "LTV/CAC"],
  "DevOps Engineer": ["Kubernetes", "Terraform", "CI/CD", "AWS", "observability", "SRE", "automation", "incident response"],
  "Content Strategist": ["content strategy", "editorial", "SEO", "storytelling", "brand voice", "audience", "distribution", "metrics"],
  "Finance Analyst": ["financial modeling", "forecasting", "Excel", "valuation", "FP&A", "variance analysis", "reporting", "budgeting"],
  "Founder & CEO": ["founder", "0-to-1", "fundraising", "vision", "go-to-market", "team building", "board", "P&L"],
};

// ---------- Tone-aware phrasing pools ----------

const TONE_OPENERS: Record<Tone, string[]> = {
  leadership: ["Driving", "Leading", "Building", "Scaling", "Empowering"],
  ic: ["Shipping", "Crafting", "Building", "Designing", "Optimizing"],
  creative: ["Storytelling", "Crafting", "Dreaming up", "Shaping", "Imagining"],
  minimal: ["", "Focusing on", "Working on", "", "Building"],
  technical: ["Engineering", "Architecting", "Optimizing", "Implementing", "Scaling"],
};

const TONE_CONNECTORS: Record<Tone, string> = {
  leadership: "leading",
  ic: "building",
  creative: "crafting",
  minimal: "",
  technical: "engineering",
};

// ---------- Helpers ----------

/** Clean a free-text string. */
export function clean(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Count characters (treats each code point as 1). */
export function countChars(s: string): number {
  return Array.from(s || "").length;
}

/** Lowercase and split into keywords (2-4 word ngrams). */
export function tokenize(s: string): string[] {
  const text = (s || "").toLowerCase();
  const words = text.split(/[^a-z0-9+#./]+/i).filter(Boolean);
  return words;
}

/** Extract candidate keywords (ngrams 1-3) from resume text. */
export function extractKeywords(text: string, max = 20): string[] {
  const tokens = tokenize(text);
  if (tokens.length === 0) return [];
  const stop = new Set([
    "the", "and", "for", "with", "you", "are", "was", "were", "have", "has",
    "this", "that", "from", "your", "their", "they", "them", "our", "his", "her",
    "but", "not", "all", "any", "can", "will", "would", "should", "could",
    "into", "than", "then", "such", "also", "more", "most", "very", "just",
  ]);
  const counts = new Map<string, number>();
  // Unigrams
  for (const w of tokens) {
    if (w.length < 3 || stop.has(w)) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  // Bigrams
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i]!;
    const b = tokens[i + 1]!;
    if (a.length < 3 || b.length < 3 || stop.has(a) || stop.has(b)) continue;
    const ng = `${a} ${b}`;
    counts.set(ng, (counts.get(ng) ?? 0) + 2);
  }
  // Trigrams
  for (let i = 0; i < tokens.length - 2; i++) {
    const a = tokens[i]!;
    const b = tokens[i + 1]!;
    const c = tokens[i + 2]!;
    if (a.length < 3 || c.length < 3 || stop.has(a) || stop.has(c)) continue;
    const ng = `${a} ${b} ${c}`;
    counts.set(ng, (counts.get(ng) ?? 0) + 3);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, max).map((e) => e[0]);
}

/** Suggest keywords for a target role + industry. */
export function suggestKeywords(role: string, industry: string, max = 12): string[] {
  const out: string[] = [];
  const r = clean(role);
  if (r && COMMON_KEYWORDS[r]) out.push(...COMMON_KEYWORDS[r]);
  // Fallback: use the role name itself as a keyword
  if (r && out.length === 0) out.push(r.toLowerCase());
  // Industry keywords
  const ind = clean(industry);
  if (ind) {
    out.push(ind.toLowerCase());
    out.push(`${ind.toLowerCase()} ${r.toLowerCase()}`.trim());
  }
  // Dedupe
  const seen = new Set<string>();
  return out.filter((k) => {
    const key = k.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, max);
}

/** Compute keyword gap: which suggested keywords are missing from the text? */
export function keywordGap(text: string, suggested: string[]): KeywordGap[] {
  const lower = (text || "").toLowerCase();
  return suggested.map((k) => {
    const present = lower.includes(k.toLowerCase());
    return {
      keyword: k,
      present,
      suggestion: present
        ? "Already present — good."
        : `Consider adding "${k}" to improve recruiter search visibility.`,
    };
  });
}

// ---------- Scoring ----------

/** Score a headline: keyword density (40) + clarity (30) + impact (30). */
export function scoreHeadline(
  text: string,
  targetKeywords: string[],
  targetRole: string,
): ScoreBreakdown {
  const lower = (text || "").toLowerCase();
  const chars = countChars(text);
  const strengths: string[] = [];
  const improvements: string[] = [];

  // Keyword density (40)
  let present = 0;
  for (const k of targetKeywords) {
    if (lower.includes(k.toLowerCase())) present++;
  }
  const density = targetKeywords.length > 0 ? present / targetKeywords.length : 0;
  let kwScore = Math.round(density * 40);
  if (present > 0) strengths.push(`Includes ${present}/${targetKeywords.length} target keywords.`);
  else improvements.push("No target keywords present — recruiters won't find you in search.");

  // Clarity (30)
  let clarity = 15;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length >= 4 && words.length <= 18) {
    clarity += 8;
    strengths.push("Headline length is in the sweet spot (4-18 words).");
  } else {
    improvements.push("Aim for 4-18 words for scannability.");
  }
  // Avoid jargon pile-up: more than 3 '/' separators is noisy
  const slashCount = (text.match(/\//g) ?? []).length;
  if (slashCount <= 2) clarity += 7;
  else {
    clarity -= Math.min(7, slashCount - 2);
    improvements.push("Too many '/' separators — feels like a keyword list, not a person.");
  }
  clarity = Math.max(0, Math.min(30, clarity));

  // Impact (30)
  let impact = 10;
  const actionVerbs = /\b(driving|leading|building|scaling|shipping|launching|growing|optimizing|designing|founding|creating|delivering|empowering|transforming|architecting)\b/i;
  if (actionVerbs.test(text)) {
    impact += 10;
    strengths.push("Uses a strong action verb.");
  } else {
    improvements.push("Add an action verb (driving, building, scaling, …).");
  }
  // Quantified achievement
  if (/\$\s?\d|\d+\s?%|\d+x|\d+,?\d{3}/.test(text)) {
    impact += 10;
    strengths.push("Includes a quantified metric.");
  } else {
    improvements.push("Add a number (revenue, %, team size) to back up claims.");
  }
  // Role present
  if (targetRole && lower.includes(targetRole.toLowerCase())) {
    impact = Math.min(30, impact + 5);
    strengths.push(`Includes target role "${targetRole}".`);
  }
  impact = Math.max(0, Math.min(30, impact));

  const overall = kwScore + clarity + impact;
  return { overall, keywordDensity: kwScore, clarity, impact, strengths, improvements };
}

/** Score an About section: same rubric as headline. */
export function scoreAbout(
  text: string,
  targetKeywords: string[],
): ScoreBreakdown {
  const lower = (text || "").toLowerCase();
  const strengths: string[] = [];
  const improvements: string[] = [];

  // Keyword density (40)
  let present = 0;
  for (const k of targetKeywords) {
    if (lower.includes(k.toLowerCase())) present++;
  }
  const density = targetKeywords.length > 0 ? present / targetKeywords.length : 0;
  let kwScore = Math.round(density * 40);
  if (present > 0) strengths.push(`Includes ${present}/${targetKeywords.length} target keywords.`);
  else improvements.push("No target keywords — recruiters won't find you in search.");

  // Clarity (30)
  let clarity = 12;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgLen = sentences.length > 0
    ? sentences.reduce((s, x) => s + x.trim().split(/\s+/).length, 0) / sentences.length
    : 0;
  if (avgLen > 0 && avgLen <= 22) {
    clarity += 10;
    strengths.push("Average sentence length is readable (≤ 22 words).");
  } else if (avgLen > 22) {
    improvements.push("Sentences are long — split for readability.");
  }
  // Multiple paragraphs = good structure
  const paras = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  if (paras.length >= 2) {
    clarity += 8;
    strengths.push(`Structured into ${paras.length} paragraphs.`);
  } else {
    improvements.push("Break into 2-3 paragraphs for scannability.");
  }
  clarity = Math.max(0, Math.min(30, clarity));

  // Impact (30)
  let impact = 10;
  const actionVerbs = /\b(drive|led|built|scaled|shipped|launched|grew|optimized|designed|founded|created|delivered|empowered|transformed|architected|spearheaded)\b/i;
  if (actionVerbs.test(text)) {
    impact += 10;
    strengths.push("Uses action verbs (led, built, scaled).");
  } else {
    improvements.push("Use action verbs to describe achievements.");
  }
  if (/\$\s?\d|\d+\s?%|\d+x|\d+,?\d{3}|\d+\+/.test(text)) {
    impact += 10;
    strengths.push("Includes quantified metrics.");
  } else {
    improvements.push("Quantify achievements (revenue, %, team size, users).");
  }
  impact = Math.max(0, Math.min(30, impact));

  const overall = kwScore + clarity + impact;
  return { overall, keywordDensity: kwScore, clarity, impact, strengths, improvements };
}

// ---------- Headline generation ----------

const HEADLINE_TEMPLATES: Array<{
  tones: Tone[];
  build: (ctx: { role: string; industry: string; tone: Tone; opener: string; connector: string; metric?: string; ctaText: string }) => string;
}> = [
  // 1. Keyword + role + value prop
  {
    tones: ["leadership", "ic", "technical"],
    build: (c) => `${c.role} @ ${c.industry} | ${c.opener} ${c.connector} ${c.industry.toLowerCase()} products${c.metric ? ` (${c.metric})` : ""} | ${c.ctaText}`,
  },
  // 2. Role stack
  {
    tones: ["ic", "minimal", "technical"],
    build: (c) => `${c.role} — ${c.industry} | ${c.connector.charAt(0).toUpperCase() + c.connector.slice(1)} ${c.industry.toLowerCase()} ${c.metric ? `| ${c.metric} ` : ""}| ${c.ctaText}`,
  },
  // 3. Outcome-first
  {
    tones: ["leadership", "ic"],
    build: (c) => `${c.opener} ${c.industry.toLowerCase()} ${c.metric ? `(${c.metric}) ` : ""}| ${c.role} | ${c.ctaText}`,
  },
  // 4. Authority / social proof
  {
    tones: ["leadership", "creative"],
    build: (c) => `${c.role} → ${c.opener} ${c.industry.toLowerCase()} ${c.metric ? `(${c.metric})` : ""} | Speaker · Writer | ${c.ctaText}`,
  },
  // 5. Niche + role
  {
    tones: ["ic", "minimal", "technical"],
    build: (c) => `${c.industry} ${c.role} | ${c.opener} ${c.connector} ${c.metric ? `${c.metric} ` : ""}| ${c.ctaText}`,
  },
  // 6. Founder / leader style
  {
    tones: ["leadership", "creative"],
    build: (c) => `${c.opener} ${c.industry.toLowerCase()} at scale | ${c.role} ${c.metric ? `| ${c.metric} ` : ""}| ${c.ctaText}`,
  },
  // 7. Quote / philosophy
  {
    tones: ["creative", "minimal"],
    build: (c) => `"${c.opener} ${c.industry.toLowerCase()} that ${c.metric ?? "people love"}" | ${c.role} | ${c.ctaText}`,
  },
  // 8. Triple-stack
  {
    tones: ["ic", "technical", "leadership"],
    build: (c) => `${c.role} | ${c.industry} | ${c.opener} ${c.connector} ${c.metric ? `· ${c.metric}` : ""} | ${c.ctaText}`,
  },
  // 9. Action-led
  {
    tones: ["leadership", "ic"],
    build: (c) => `${c.opener} ${c.metric ? `${c.metric} ` : ""}${c.industry.toLowerCase()} ${c.connector} | ${c.role} | ${c.ctaText}`,
  },
  // 10. Minimal one-liner
  {
    tones: ["minimal"],
    build: (c) => `${c.role}. ${c.industry}. ${c.metric ? `${c.metric}. ` : ""}${c.ctaText}`,
  },
  // 11. Mission-led
  {
    tones: ["leadership", "creative"],
    build: (c) => `Mission: ${c.opener.toLowerCase()} ${c.industry.toLowerCase()} that ${c.metric ?? "scale"} | ${c.role} | ${c.ctaText}`,
  },
  // 12. Multi-role
  {
    tones: ["ic", "creative"],
    build: (c) => `${c.role} · ${c.opener} · ${c.industry} ${c.metric ? `· ${c.metric} ` : ""}| ${c.ctaText}`,
  },
];

const FALLBACK_METRICS = ["$10M+", "30% faster", "100k+ users", "5M+", "2x growth", "99.9% uptime", "10+ yrs"];

/** Build a single headline variant. */
export function buildHeadline(
  role: string,
  industry: string,
  tone: Tone,
  cta: Cta,
  templateIdx = 0,
  variantIdx = 0,
): HeadlineVariant {
  const r = clean(role) || "Professional";
  const ind = clean(industry) || "Tech";
  const openers = TONE_OPENERS[tone];
  const opener = openers[variantIdx % openers.length] ?? "";
  const connector = TONE_CONNECTORS[tone];
  const metric = FALLBACK_METRICS[variantIdx % FALLBACK_METRICS.length];
  const ctaText = CTA_TEXT[cta];
  const matching = HEADLINE_TEMPLATES.filter((t) => t.tones.includes(tone));
  const pool = matching.length > 0 ? matching : HEADLINE_TEMPLATES;
  const template = pool[templateIdx % pool.length] ?? HEADLINE_TEMPLATES[0]!;
  let text = template.build({ role: r, industry: ind, tone, opener, connector, metric, ctaText });
  // Collapse double spaces
  text = text.replace(/\s{2,}/g, " ").replace(/\s+\|/g, " |").replace(/\|\s+/g, "| ").replace(/\s+,/g, ",").trim();
  // Re-add space after pipe
  text = text.replace(/\|/g, " | ").replace(/\s{2,}/g, " ").trim();
  const charCount = countChars(text);
  const exceedsLimit = charCount > HEADLINE_CHAR_LIMIT;
  const keywords = suggestKeywords(r, ind, 6);
  const score = scoreHeadline(text, keywords, r);
  return {
    id: `hl-${variantIdx}`,
    text,
    tone,
    cta,
    charCount,
    charLimit: HEADLINE_CHAR_LIMIT,
    exceedsLimit,
    trimmed: false,
    keywords,
    score,
  };
}

/** Auto-trim a headline to 220 chars on word boundaries. */
export function trimHeadline(h: HeadlineVariant): HeadlineVariant {
  if (!h.exceedsLimit) return { ...h, trimmed: false };
  let text = h.text;
  // Drop trailing CTA fragment first if it would push us over
  while (countChars(text) > HEADLINE_CHAR_LIMIT && text.includes(" | ")) {
    const idx = text.lastIndexOf(" | ");
    if (idx <= 0) break;
    text = text.slice(0, idx).trim();
  }
  // Word-trim
  while (countChars(text) > HEADLINE_CHAR_LIMIT) {
    const words = text.split(/\s+/);
    if (words.length <= 1) break;
    words.pop();
    text = words.join(" ").replace(/[·,\s|]+$/, "").trim();
  }
  const charCount = countChars(text);
  const exceedsLimit = charCount > HEADLINE_CHAR_LIMIT;
  return {
    ...h,
    text,
    charCount,
    exceedsLimit,
    trimmed: true,
    score: scoreHeadline(text, h.keywords, h.keywords[0] ?? ""),
  };
}

/** Generate 10+ headline variants across tones. */
export function generateHeadlines(
  role: string,
  industry: string,
  cta: Cta,
  count = 12,
): HeadlineVariant[] {
  const tones: Tone[] = ["leadership", "ic", "creative", "minimal", "technical"];
  const n = Math.max(10, count);
  const out: HeadlineVariant[] = [];
  for (let i = 0; i < n; i++) {
    const tone = tones[i % tones.length]!;
    const v = buildHeadline(role, industry, tone, cta, i, i);
    out.push(v.exceedsLimit ? trimHeadline(v) : v);
  }
  // Sort by score descending for best-first
  out.sort((a, b) => b.score.overall - a.score.overall);
  return out;
}

// ---------- About generation ----------

const ABOUT_OPENERS_BY_TONE: Record<Tone, string[]> = {
  leadership: [
    "I lead {role} teams in {industry} that ship outcomes, not features.",
    "As a {role} in {industry}, I've spent the last decade turning ambiguity into shipped product.",
    "Building and scaling {industry} teams is what I do.",
  ],
  ic: [
    "I'm a {role} who likes shipping. {industry} is my home turf.",
    "Day to day I'm a {role} in {industry} — building, shipping, and iterating.",
    "I write code and ship product. {role} in {industry}.",
  ],
  creative: [
    "I tell stories with {industry} — sometimes in code, sometimes in copy.",
    "{role} by training, storyteller by trade. {industry} is the canvas.",
    "I turn fuzzy {industry} problems into clean, human-centered solutions.",
  ],
  minimal: [
    "{role}. {industry}. I ship things.",
    "I'm a {role} in {industry}. I keep it simple.",
    "{role} working in {industry}.",
  ],
  technical: [
    "I'm a {role} who architects {industry} systems for scale.",
    "Engineering {industry} systems that handle real load — that's my craft.",
    "I design and build {industry} infrastructure that doesn't wake people up at night.",
  ],
};

const ABOUT_BODY_BY_TONE: Record<Tone, string[]> = {
  leadership: [
    "Most recently I led a team of engineers that {metric}. The playbook: small teams, clear ownership, and shipping every week.",
    "My job is to make other people's jobs easier — by removing blockers, setting direction, and shipping the unglamorous infrastructure that scales.",
    "What I'm proudest of: {metric}, on a team of {team}.",
  ],
  ic: [
    "Lately I've been {metric} — mostly {tech}, with the occasional detour into {tech2}.",
    "I care about clean abstractions, fast feedback loops, and code that the next engineer can read.",
    "Highlights: {metric}; shipping {tech}; cutting latency by 40%.",
  ],
  creative: [
    "I've written for {industry} brands, designed for {industry} products, and shipped campaigns that {metric}.",
    "My work lives at the intersection of story, design, and conversion. I obsess over the audience.",
    "Proudest moment: {metric}, a campaign that turned into a case study.",
  ],
  minimal: [
    "I {metric}. I work in {industry}. I write code that ships.",
    "Less talk, more ship. Recent work: {metric}.",
    "I focus on the smallest change that moves the biggest metric.",
  ],
  technical: [
    "Most of my work is on {industry} infrastructure: {tech}, {tech2}, observability, and SLOs.",
    "Recently I {metric} by re-architecting the critical path.",
    "I write code that other engineers want to read — and that survives on-call rotations.",
  ],
};

const ABOUT_CLOSERS_BY_TONE: Record<Tone, string[]> = {
  leadership: [
    "Outside of work, I mentor early-stage founders and write about leadership.",
    "Always happy to talk shop — reach out if you're scaling a team.",
    "Currently exploring what's next in {industry}.",
  ],
  ic: [
    "When I'm not coding, I write about {industry} and contribute to open source.",
    "DM me about {industry}, {tech}, or anything that ships.",
    "Always learning, always shipping.",
  ],
  creative: [
    "Find me writing about {industry} or speaking at conferences.",
    "Currently open to speaking and writing opportunities.",
    "Let's make something people remember.",
  ],
  minimal: [
    "Reach out if you want to ship something in {industry}.",
    "Open to {industry} opportunities.",
    "More on my blog.",
  ],
  technical: [
    "Open source contributor. Speak at {industry} meetups when I can.",
    "Always up for a conversation about {industry} infrastructure.",
    "Reach out if your {industry} stack needs an upgrade.",
  ],
};

const TECH_POOL = ["TypeScript", "Go", "Python", "Kubernetes", "Postgres", "Rust", "React", "Terraform", "Kafka", "AWS"];

/** Build a single About variant. */
export function buildAbout(
  role: string,
  industry: string,
  tone: Tone,
  cta: Cta,
  variantIdx = 0,
): AboutVariant {
  const r = clean(role) || "Professional";
  const ind = clean(industry) || "Tech";
  const fill = (s: string): string => s
    .replace(/\{role\}/g, r)
    .replace(/\{industry\}/g, ind)
    .replace(/\{metric\}/g, FALLBACK_METRICS[variantIdx % FALLBACK_METRICS.length]!)
    .replace(/\{team\}/g, String(5 + (variantIdx % 15)))
    .replace(/\{tech\}/g, TECH_POOL[variantIdx % TECH_POOL.length]!)
    .replace(/\{tech2\}/g, TECH_POOL[(variantIdx + 3) % TECH_POOL.length]!);
  const openers = ABOUT_OPENERS_BY_TONE[tone];
  const bodies = ABOUT_BODY_BY_TONE[tone];
  const closers = ABOUT_CLOSERS_BY_TONE[tone];
  const opener = fill(openers[variantIdx % openers.length]!);
  const body = fill(bodies[variantIdx % bodies.length]!);
  const closer = fill(closers[variantIdx % closers.length]!);
  const ctaText = CTA_TEXT[cta];
  const paragraphs = [opener, body, `${closer} ${ctaText}`];
  const text = paragraphs.join("\n\n");
  const charCount = countChars(text);
  const exceedsLimit = charCount > ABOUT_CHAR_LIMIT;
  const keywords = suggestKeywords(r, ind, 8);
  const score = scoreAbout(text, keywords);
  return {
    id: `about-${variantIdx}`,
    text,
    tone,
    cta,
    charCount,
    charLimit: ABOUT_CHAR_LIMIT,
    exceedsLimit,
    trimmed: false,
    paragraphs,
    keywords,
    score,
  };
}

/** Auto-trim an About to 2,600 chars on paragraph boundaries. */
export function trimAbout(a: AboutVariant): AboutVariant {
  if (!a.exceedsLimit) return { ...a, trimmed: false };
  let paragraphs = [...a.paragraphs];
  // Trim trailing paragraph
  while (countChars(paragraphs.join("\n\n")) > ABOUT_CHAR_LIMIT && paragraphs.length > 1) {
    paragraphs = paragraphs.slice(0, -1);
  }
  // Word-trim last paragraph
  while (countChars(paragraphs.join("\n\n")) > ABOUT_CHAR_LIMIT && paragraphs.length > 0) {
    const last = paragraphs[paragraphs.length - 1]!;
    const words = last.split(/\s+/);
    if (words.length <= 1) {
      paragraphs = paragraphs.slice(0, -1);
      continue;
    }
    words.pop();
    paragraphs[paragraphs.length - 1] = words.join(" ").replace(/[·,\s]+$/, "").trim();
  }
  const text = paragraphs.join("\n\n");
  const charCount = countChars(text);
  const exceedsLimit = charCount > ABOUT_CHAR_LIMIT;
  return {
    ...a,
    text,
    paragraphs,
    charCount,
    exceedsLimit,
    trimmed: true,
    score: scoreAbout(text, a.keywords),
  };
}

/** Generate multiple About variants. */
export function generateAbouts(
  role: string,
  industry: string,
  cta: Cta,
  count = 4,
): AboutVariant[] {
  const tones: Tone[] = ["leadership", "ic", "creative", "minimal", "technical"];
  const n = Math.max(3, count);
  const out: AboutVariant[] = [];
  for (let i = 0; i < n; i++) {
    const tone = tones[i % tones.length]!;
    const v = buildAbout(role, industry, tone, cta, i);
    out.push(v.exceedsLimit ? trimAbout(v) : v);
  }
  out.sort((a, b) => b.score.overall - a.score.overall);
  return out;
}

// ---------- Profile scoring ----------

/** Compute an overall profile score from headline + About. */
export function scoreProfile(headline: HeadlineVariant, about: AboutVariant): ProfileScore {
  return {
    headlineScore: headline.score.overall,
    aboutScore: about.score.overall,
    overall: Math.round((headline.score.overall + about.score.overall) / 2),
    breakdown: { headline: headline.score, about: about.score },
  };
}

// ---------- Before/after diff ----------

/** Compute a simple line-based diff. */
export function beforeAfterDiff(before: string, after: string): DiffResult {
  const a = (before || "").split(/(?<=[.!?])\s+/).filter(Boolean);
  const b = (after || "").split(/(?<=[.!?])\s+/).filter(Boolean);
  const setA = new Set(a.map((s) => s.trim()));
  const setB = new Set(b.map((s) => s.trim()));
  const added = b.filter((s) => !setA.has(s.trim()));
  const removed = a.filter((s) => !setB.has(s.trim()));
  const unchanged = a.filter((s) => setB.has(s.trim()));
  return { before, after, added, removed, unchanged };
}

// ---------- Rendering ----------

export function renderHeadlinesText(headlines: HeadlineVariant[]): string {
  return headlines.map((h) => {
    const lines = [
      `[${TONE_LABELS[h.tone]} · ${CTA_LABELS[h.cta]}] score ${h.score.overall}/100`,
      h.text,
      `Chars: ${h.charCount}/${h.charLimit}${h.exceedsLimit ? " (over limit!)" : h.trimmed ? " (trimmed)" : ""}`,
    ];
    if (h.score.strengths.length > 0) lines.push(`Strengths: ${h.score.strengths.join("; ")}`);
    if (h.score.improvements.length > 0) lines.push(`Improve: ${h.score.improvements.join("; ")}`);
    return lines.join("\n");
  }).join("\n---\n");
}

export function renderAboutsText(abouts: AboutVariant[]): string {
  return abouts.map((a) => {
    const lines = [
      `[${TONE_LABELS[a.tone]} · ${CTA_LABELS[a.cta]}] score ${a.score.overall}/100`,
      a.text,
      `Chars: ${a.charCount}/${a.charLimit}${a.exceedsLimit ? " (over limit!)" : a.trimmed ? " (trimmed)" : ""}`,
    ];
    if (a.score.strengths.length > 0) lines.push(`Strengths: ${a.score.strengths.join("; ")}`);
    if (a.score.improvements.length > 0) lines.push(`Improve: ${a.score.improvements.join("; ")}`);
    return lines.join("\n");
  }).join("\n---\n");
}

export function renderMarkdown(headlines: HeadlineVariant[], abouts: AboutVariant[]): string {
  const out: string[] = ["# LinkedIn Optimization", ""];
  out.push("## Headlines", "");
  headlines.forEach((h, i) => {
    out.push(`### ${i + 1}. ${TONE_LABELS[h.tone]} / ${CTA_LABELS[h.cta]} (score ${h.score.overall}/100)`);
    out.push("");
    out.push(`> ${h.text}`);
    out.push("");
    out.push(`*Characters: ${h.charCount}/${h.charLimit}${h.exceedsLimit ? " — over limit" : ""}*`);
    if (h.score.strengths.length > 0) out.push(`- **Strengths:** ${h.score.strengths.join("; ")}`);
    if (h.score.improvements.length > 0) out.push(`- **Improve:** ${h.score.improvements.join("; ")}`);
    out.push("");
  });
  out.push("## About sections", "");
  abouts.forEach((a, i) => {
    out.push(`### ${i + 1}. ${TONE_LABELS[a.tone]} / ${CTA_LABELS[a.cta]} (score ${a.score.overall}/100)`);
    out.push("");
    out.push(a.text);
    out.push("");
    out.push(`*Characters: ${a.charCount}/${a.charLimit}${a.exceedsLimit ? " — over limit" : ""}*`);
    out.push("");
  });
  return out.join("\n");
}

export function renderCsv(headlines: HeadlineVariant[], abouts: AboutVariant[]): string {
  const lines = ["section,id,tone,cta,char_count,char_limit,score,exceeds_limit,trimmed,text"];
  for (const h of headlines) {
    lines.push([
      "headline", h.id, h.tone, h.cta, h.charCount, h.charLimit, h.score.overall,
      h.exceedsLimit ? "yes" : "no", h.trimmed ? "yes" : "no", escapeCsv(h.text),
    ].join(","));
  }
  for (const a of abouts) {
    lines.push([
      "about", a.id, a.tone, a.cta, a.charCount, a.charLimit, a.score.overall,
      a.exceedsLimit ? "yes" : "no", a.trimmed ? "yes" : "no", escapeCsv(a.text),
    ].join(","));
  }
  return lines.join("\n");
}

export function renderJson(headlines: HeadlineVariant[], abouts: AboutVariant[]): string {
  return JSON.stringify({
    headlines: headlines.map((h) => ({
      id: h.id, tone: h.tone, cta: h.cta, text: h.text,
      charCount: h.charCount, charLimit: h.charLimit, score: h.score,
      keywords: h.keywords,
    })),
    abouts: abouts.map((a) => ({
      id: a.id, tone: a.tone, cta: a.cta, text: a.text,
      charCount: a.charCount, charLimit: a.charLimit, score: a.score,
      keywords: a.keywords,
    })),
  }, null, 2);
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------- History (localStorage) ----------

export interface HistoryEntry {
  ts: number;
  role: string;
  industry: string;
  tone: Tone;
  cta: Cta;
  headlineCount: number;
  aboutCount: number;
  topHeadlineScore: number;
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

export interface ShareState {
  role: string;
  industry: string;
  tone: Tone;
  cta: Cta;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.role) params.set("role", state.role);
  if (state.industry) params.set("ind", state.industry);
  if (state.tone) params.set("t", state.tone);
  if (state.cta) params.set("c", state.cta);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareState> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareState> = {};
  const role = params.get("role");
  if (role) out.role = role;
  const ind = params.get("ind");
  if (ind) out.industry = ind;
  const t = params.get("t") as Tone | null;
  if (t && t in TONE_LABELS) out.tone = t;
  const c = params.get("c") as Cta | null;
  if (c && c in CTA_LABELS) out.cta = c;
  return out;
}

// ---------- LLM prompt builder (optional BYO-key enhancement) ----------

export function buildLlmPrompt(
  currentProfile: string,
  role: string,
  industry: string,
  tone: Tone,
  cta: Cta,
): string {
  return [
    "You are an expert LinkedIn profile copywriter who writes keyword-rich, recruiter-friendly profiles.",
    `Target role: ${role}.`,
    `Industry: ${industry}.`,
    `Tone: ${TONE_LABELS[tone]}.`,
    `Call-to-action: ${CTA_LABELS[cta]}.`,
    "",
    "Current profile / resume:",
    "```",
    currentProfile.slice(0, 4000),
    "```",
    "",
    "Hard constraints:",
    `- Headline MUST fit LinkedIn's ${HEADLINE_CHAR_LIMIT}-character limit.`,
    `- About section MUST fit LinkedIn's ${ABOUT_CHAR_LIMIT}-character limit.`,
    "- Include role + industry keywords recruiters search for.",
    "- Use action verbs and quantify achievements where possible.",
    "- Do NOT inflate titles or invent metrics not in the input.",
    "",
    "Output a JSON object with:",
    '- "headline": a single optimized headline string (≤ 220 chars)',
    '- "about": a single optimized About section string (≤ 2600 chars, with \\n\\n paragraph breaks)',
    '- "keywords": an array of 5-8 keyword strings present in the output',
    '- "rationale": one sentence explaining the optimization',
    "",
    "Output ONLY the JSON object — no markdown fences, no commentary.",
  ].join("\n");
}

export interface LlmOptimization {
  headline: string;
  about: string;
  keywords: string[];
  rationale: string;
}

export function renderLlmResult(rawText: string):
  | { ok: true; optimization: LlmOptimization }
  | { ok: false; error: string } {
  let s = (rawText || "").trim();
  if (!s) return { ok: false, error: "Empty LLM response." };
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  let obj: unknown;
  try {
    obj = JSON.parse(s);
  } catch {
    return { ok: false, error: "Could not parse LLM output as JSON." };
  }
  if (typeof obj !== "object" || obj === null) {
    return { ok: false, error: "LLM output was not a JSON object." };
  }
  const o = obj as Record<string, unknown>;
  const headline = typeof o.headline === "string" ? o.headline : "";
  const about = typeof o.about === "string" ? o.about : "";
  const keywords = Array.isArray(o.keywords)
    ? (o.keywords as unknown[]).filter((k): k is string => typeof k === "string").slice(0, 8)
    : [];
  const rationale = typeof o.rationale === "string" ? o.rationale : "";
  if (!headline && !about) {
    return { ok: false, error: "LLM output had no headline or about." };
  }
  return { ok: true, optimization: { headline, about, keywords, rationale } };
}
