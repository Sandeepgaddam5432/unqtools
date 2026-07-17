/**
 * Content Outline Generator — pure logic.
 *
 * Generate SEO-optimized content outlines with H1 + H2s + H3s.
 * Export as markdown / HTML / JSON. Pure functions only.
 */

export interface OutlineSection {
  heading: string;
  level: 2 | 3;
  wordTarget?: number;
  keyPoints?: string[];
}

export interface OutlineInput {
  topic: string;
  keyword: string;
  secondaryKeywords?: string[];
  h1?: string;
  intro?: string;
  sections: OutlineSection[];
  conclusion?: string;
  wordTargetTotal?: number;
  template?: OutlineTemplate;
}

export type OutlineTemplate =
  | "blog-post"
  | "listicle"
  | "how-to"
  | "comparison"
  | "case-study"
  | "custom";

export const TEMPLATES: Record<OutlineTemplate, { label: string; description: string }> = {
  "blog-post": {
    label: "Blog Post",
    description: "Standard blog: intro, body sections, conclusion.",
  },
  listicle: {
    label: "Listicle",
    description: "Numbered list (10 items), intro, conclusion.",
  },
  "how-to": {
    label: "How-To",
    description: "Step-by-step instructions with intro and tips.",
  },
  comparison: {
    label: "Comparison",
    description: "Compare X vs Y with criteria table and verdict.",
  },
  "case-study": {
    label: "Case Study",
    description: "Challenge → Solution → Results format.",
  },
  custom: {
    label: "Custom",
    description: "Start from scratch with your own structure.",
  },
};

export const DEFAULT_TEMPLATES: Record<Exclude<OutlineTemplate, "custom">, OutlineSection[]> = {
  "blog-post": [
    { heading: "Introduction", level: 2, wordTarget: 100, keyPoints: ["Hook the reader", "State the problem"] },
    { heading: "What is {topic}?", level: 2, wordTarget: 200, keyPoints: ["Define the topic", "Why it matters"] },
    { heading: "Key benefits of {topic}", level: 2, wordTarget: 300, keyPoints: ["List 3-5 benefits"] },
    { heading: "How to get started with {topic}", level: 2, wordTarget: 300, keyPoints: ["Step-by-step guidance"] },
    { heading: "Common mistakes to avoid", level: 2, wordTarget: 200, keyPoints: ["List 3 mistakes"] },
    { heading: "Conclusion", level: 2, wordTarget: 100, keyPoints: ["Summary", "Call to action"] },
  ],
  listicle: [
    { heading: "Introduction", level: 2, wordTarget: 100, keyPoints: ["Why this list matters"] },
    { heading: "1. First item", level: 2, wordTarget: 100 },
    { heading: "2. Second item", level: 2, wordTarget: 100 },
    { heading: "3. Third item", level: 2, wordTarget: 100 },
    { heading: "4. Fourth item", level: 2, wordTarget: 100 },
    { heading: "5. Fifth item", level: 2, wordTarget: 100 },
    { heading: "6. Sixth item", level: 2, wordTarget: 100 },
    { heading: "7. Seventh item", level: 2, wordTarget: 100 },
    { heading: "8. Eighth item", level: 2, wordTarget: 100 },
    { heading: "9. Ninth item", level: 2, wordTarget: 100 },
    { heading: "10. Tenth item", level: 2, wordTarget: 100 },
    { heading: "Conclusion", level: 2, wordTarget: 100, keyPoints: ["Recap the top 3", "Call to action"] },
  ],
  "how-to": [
    { heading: "Introduction", level: 2, wordTarget: 100, keyPoints: ["The problem you'll solve"] },
    { heading: "What you'll need", level: 2, wordTarget: 100, keyPoints: ["Tools / supplies list"] },
    { heading: "Step 1: Preparation", level: 2, wordTarget: 150 },
    { heading: "Step 2: First action", level: 2, wordTarget: 150 },
    { heading: "Step 3: Next action", level: 2, wordTarget: 150 },
    { heading: "Step 4: Refinement", level: 2, wordTarget: 150 },
    { heading: "Common pitfalls", level: 2, wordTarget: 100, keyPoints: ["Top 3 mistakes"] },
    { heading: "Conclusion", level: 2, wordTarget: 100, keyPoints: ["Recap", "Next steps"] },
  ],
  comparison: [
    { heading: "Introduction", level: 2, wordTarget: 100, keyPoints: ["Why compare these"] },
    { heading: "Overview of {topic} option A", level: 2, wordTarget: 200 },
    { heading: "Overview of {topic} option B", level: 2, wordTarget: 200 },
    { heading: "Feature comparison", level: 2, wordTarget: 200, keyPoints: ["Side-by-side table"] },
    { heading: "Pricing comparison", level: 2, wordTarget: 150 },
    { heading: "Pros and cons", level: 2, wordTarget: 200 },
    { heading: "Verdict: which to choose", level: 2, wordTarget: 150, keyPoints: ["Recommendation by use case"] },
  ],
  "case-study": [
    { heading: "Background", level: 2, wordTarget: 150, keyPoints: ["Client context"] },
    { heading: "The challenge", level: 2, wordTarget: 200 },
    { heading: "The solution", level: 2, wordTarget: 300, keyPoints: ["Approach", "Implementation"] },
    { heading: "Results", level: 2, wordTarget: 200, keyPoints: ["Metrics", "Before/after"] },
    { heading: "Lessons learned", level: 2, wordTarget: 150 },
    { heading: "Conclusion", level: 2, wordTarget: 100, keyPoints: ["Key takeaway"] },
  ],
};

/** Replace {topic} and {keyword} placeholders in a heading. */
export function fillPlaceholders(text: string, topic: string, keyword: string): string {
  if (!text) return "";
  return text
    .replace(/\{topic\}/gi, topic || "")
    .replace(/\{keyword\}/gi, keyword || "");
}

/** Generate suggested H2 topics for a given main topic. */
export function suggestH2Topics(topic: string): string[] {
  if (!topic) return [];
  return [
    `What is ${topic}?`,
    `Why ${topic} matters`,
    `Key benefits of ${topic}`,
    `How to get started with ${topic}`,
    `Best practices for ${topic}`,
    `Common ${topic} mistakes to avoid`,
    `${topic} tools and resources`,
    `Advanced ${topic} tips`,
  ];
}

/** Generate suggested H3 subtopics for a given H2. */
export function suggestH3Topics(h2: string): string[] {
  if (!h2) return [];
  return [
    `${h2}: Overview`,
    `${h2}: Step-by-step`,
    `${h2}: Examples`,
    `${h2}: Tips`,
    `${h2}: Common questions`,
  ];
}

/** Validate the outline input. */
export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateInput(input: OutlineInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!input.topic || !input.topic.trim()) {
    errors.push("Topic is required");
  }
  if (!input.keyword || !input.keyword.trim()) {
    warnings.push("Target keyword is recommended for SEO");
  }
  if (!Array.isArray(input.sections) || input.sections.length === 0) {
    warnings.push("No sections yet — add H2/H3 topics to build the outline");
  } else {
    for (let i = 0; i < input.sections.length; i++) {
      const s = input.sections[i];
      if (!s.heading || !s.heading.trim()) {
        errors.push(`Section #${i + 1}: heading is empty`);
      }
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

/** Build the default H1 from topic + keyword. */
export function buildH1(topic: string, keyword: string): string {
  if (!topic) return "";
  if (keyword) {
    return `${capitalize(topic)}: The Complete Guide (${capitalize(keyword)})`;
  }
  return `${capitalize(topic)}: The Complete Guide`;
}

function capitalize(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Calculate total word target. */
export function totalWordTarget(sections: OutlineSection[]): number {
  return sections.reduce((sum, s) => sum + (s.wordTarget || 0), 0);
}

/** Render the outline as Markdown. */
export function renderMarkdown(input: OutlineInput): string {
  const v = validateInput(input);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const lines: string[] = [];
  const h1 = input.h1 || buildH1(input.topic, input.keyword);
  lines.push(`# ${h1}`);
  lines.push("");
  if (input.keyword) {
    lines.push(`> **Target keyword:** ${input.keyword}`);
    if (input.secondaryKeywords && input.secondaryKeywords.length > 0) {
      lines.push(`> **Secondary keywords:** ${input.secondaryKeywords.join(", ")}`);
    }
    lines.push("");
  }
  if (input.intro) {
    lines.push(`## Introduction`);
    lines.push("");
    lines.push(input.intro);
    lines.push("");
  }
  for (const s of input.sections) {
    const heading = fillPlaceholders(s.heading, input.topic, input.keyword);
    lines.push(`## ${heading}`);
    if (s.wordTarget) {
      lines.push("");
      lines.push(`*(Target: ~${s.wordTarget} words)*`);
    }
    if (s.keyPoints && s.keyPoints.length > 0) {
      lines.push("");
      for (const p of s.keyPoints) {
        lines.push(`- ${p}`);
      }
    }
    lines.push("");
  }
  if (input.conclusion) {
    lines.push(`## Conclusion`);
    lines.push("");
    lines.push(input.conclusion);
    lines.push("");
  }
  return lines.join("\n");
}

/** Render the outline as HTML. */
export function renderHtml(input: OutlineInput): string {
  const v = validateInput(input);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const esc = (s: string): string =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines: string[] = [];
  const h1 = input.h1 || buildH1(input.topic, input.keyword);
  lines.push(`<article>`);
  lines.push(`  <h1>${esc(h1)}</h1>`);
  if (input.keyword) {
    lines.push(`  <p><strong>Target keyword:</strong> ${esc(input.keyword)}</p>`);
  }
  if (input.intro) {
    lines.push(`  <h2>Introduction</h2>`);
    lines.push(`  <p>${esc(input.intro)}</p>`);
  }
  for (const s of input.sections) {
    const heading = fillPlaceholders(s.heading, input.topic, input.keyword);
    const tag = s.level === 3 ? "h3" : "h2";
    lines.push(`  <${tag}>${esc(heading)}</${tag}>`);
    if (s.wordTarget) {
      lines.push(`  <p><em>Target: ~${s.wordTarget} words</em></p>`);
    }
    if (s.keyPoints && s.keyPoints.length > 0) {
      lines.push(`  <ul>`);
      for (const p of s.keyPoints) {
        lines.push(`    <li>${esc(p)}</li>`);
      }
      lines.push(`  </ul>`);
    }
  }
  if (input.conclusion) {
    lines.push(`  <h2>Conclusion</h2>`);
    lines.push(`  <p>${esc(input.conclusion)}</p>`);
  }
  lines.push(`</article>`);
  return lines.join("\n");
}

/** Render the outline as JSON. */
export function renderJson(input: OutlineInput): string {
  const v = validateInput(input);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const obj = {
    h1: input.h1 || buildH1(input.topic, input.keyword),
    topic: input.topic,
    keyword: input.keyword,
    secondaryKeywords: input.secondaryKeywords || [],
    intro: input.intro || "",
    sections: input.sections.map((s) => ({
      ...s,
      heading: fillPlaceholders(s.heading, input.topic, input.keyword),
    })),
    conclusion: input.conclusion || "",
    totalWordTarget: totalWordTarget(input.sections),
  };
  return JSON.stringify(obj, null, 2);
}

/** Apply a template to an input (returns sections array). */
export function applyTemplate(template: OutlineTemplate, topic: string, keyword: string): OutlineSection[] {
  if (template === "custom") return [];
  const tmpl = DEFAULT_TEMPLATES[template];
  return tmpl.map((s) => ({
    ...s,
    heading: fillPlaceholders(s.heading, topic, keyword),
  }));
}

// ---- History ----

const HISTORY_KEY = "unqtools:content-outline-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  topic: string;
  sectionCount: number;
  snippet: string;
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

// ---- Shareable URL ----

export function buildShareUrl(input: OutlineInput): string {
  const params = new URLSearchParams();
  params.set("data", JSON.stringify(input));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<OutlineInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const data = params.get("data");
  if (!data) return {};
  try {
    return JSON.parse(data) as OutlineInput;
  } catch {
    return {};
  }
}
