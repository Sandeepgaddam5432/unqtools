/**
 * Content Brief Generator — pure logic.
 *
 * Generate SEO content briefs for writers: target keyword, title, search intent,
 * word count target, outline, key points, LSI keywords, internal/external links.
 * Export as Markdown / HTML.
 *
 * Pure functions only — no DOM, no network.
 */

export type SearchIntent =
  | "informational"
  | "transactional"
  | "navigational"
  | "commercial";

export const INTENT_LABELS: Record<SearchIntent, string> = {
  informational: "Informational — user wants to learn",
  transactional: "Transactional — user wants to buy",
  navigational: "Navigational — user wants a specific site",
  commercial: "Commercial — user is researching before buying",
};

export interface BriefLink {
  url: string;
  anchor: string;
}

export interface OutlineItem {
  heading: string;
  notes?: string;
}

export interface ContentBriefInput {
  targetKeyword: string;
  title: string;
  searchIntent: SearchIntent;
  wordCountTarget: number;
  audience?: string;
  tone?: string;
  outline: OutlineItem[];
  keyPoints: string[];
  lsiKeywords: string[];
  internalLinks: BriefLink[];
  externalLinks: BriefLink[];
  competitorUrls: string[];
  notes?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function isValidUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateInput(input: ContentBriefInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!input.targetKeyword || !input.targetKeyword.trim()) {
    errors.push("Target keyword is required");
  }
  if (!input.title || !input.title.trim()) {
    errors.push("Title is required");
  } else if (input.title.length > 70) {
    warnings.push(`Title is long (${input.title.length} chars > 70) — may be truncated in SERPs`);
  }
  if (!input.wordCountTarget || input.wordCountTarget < 100) {
    warnings.push("Word count target below 100 — usually too short for SEO");
  }
  if (input.wordCountTarget > 5000) {
    warnings.push("Word count target above 5000 — very long-form, ensure depth");
  }
  if (input.outline.length === 0) {
    warnings.push("No outline items — writers usually need section headings");
  }
  if (input.keyPoints.length === 0) {
    warnings.push("No key points — list the must-cover points");
  }
  if (input.lsiKeywords.length === 0) {
    warnings.push("No LSI keywords — adding 5-10 related terms helps topical depth");
  }
  for (let i = 0; i < input.internalLinks.length; i++) {
    if (!isValidUrl(input.internalLinks[i].url)) {
      warnings.push(`Internal link #${i + 1}: URL is invalid`);
    }
  }
  for (let i = 0; i < input.externalLinks.length; i++) {
    if (!isValidUrl(input.externalLinks[i].url)) {
      warnings.push(`External link #${i + 1}: URL is invalid`);
    }
  }
  for (let i = 0; i < input.competitorUrls.length; i++) {
    if (!isValidUrl(input.competitorUrls[i])) {
      warnings.push(`Competitor URL #${i + 1}: invalid`);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

/** Suggest LSI / related keywords based on a primary keyword. */
export function suggestLsiKeywords(keyword: string): string[] {
  if (!keyword) return [];
  const k = keyword.trim().toLowerCase();
  return [
    `what is ${k}`,
    `${k} meaning`,
    `${k} examples`,
    `${k} benefits`,
    `${k} best practices`,
    `${k} tools`,
    `${k} vs alternatives`,
    `${k} for beginners`,
    `${k} cost`,
    `${k} tutorial`,
  ];
}

/** Build a default outline suggestion for a keyword. */
export function suggestOutline(keyword: string): OutlineItem[] {
  if (!keyword) return [];
  const k = keyword.trim();
  return [
    { heading: "Introduction", notes: `Hook the reader. Why ${k} matters.` },
    { heading: `What is ${k}?`, notes: `Define ${k}. Cover the basics.` },
    { heading: `Key benefits of ${k}`, notes: `List 3-5 benefits with examples.` },
    { heading: `How to use ${k}`, notes: `Step-by-step guidance.` },
    { heading: `Common ${k} mistakes to avoid`, notes: `List 3 mistakes.` },
    { heading: `${k} best practices`, notes: `Tips from experts.` },
    { heading: "Conclusion", notes: `Recap. CTA.` },
  ];
}

/** Render the brief as Markdown. */
export function renderMarkdown(input: ContentBriefInput): string {
  const v = validateInput(input);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const lines: string[] = [];
  lines.push(`# Content Brief: ${input.title}`);
  lines.push("");
  lines.push(`**Target keyword:** ${input.targetKeyword}`);
  lines.push(`**Search intent:** ${INTENT_LABELS[input.searchIntent]}`);
  lines.push(`**Word count target:** ${input.wordCountTarget} words`);
  if (input.audience) lines.push(`**Audience:** ${input.audience}`);
  if (input.tone) lines.push(`**Tone:** ${input.tone}`);
  lines.push("");
  lines.push("## Outline");
  lines.push("");
  for (const item of input.outline) {
    lines.push(`### ${item.heading}`);
    if (item.notes) lines.push(`> ${item.notes}`);
    lines.push("");
  }
  if (input.keyPoints.length > 0) {
    lines.push("## Key points (must cover)");
    lines.push("");
    for (const p of input.keyPoints) {
      lines.push(`- ${p}`);
    }
    lines.push("");
  }
  if (input.lsiKeywords.length > 0) {
    lines.push("## LSI / related keywords");
    lines.push("");
    lines.push(input.lsiKeywords.map((k) => `\`${k}\``).join(", "));
    lines.push("");
  }
  if (input.internalLinks.length > 0) {
    lines.push("## Internal links");
    lines.push("");
    for (const l of input.internalLinks) {
      lines.push(`- [${l.anchor || l.url}](${l.url})`);
    }
    lines.push("");
  }
  if (input.externalLinks.length > 0) {
    lines.push("## External links (authority sources)");
    lines.push("");
    for (const l of input.externalLinks) {
      lines.push(`- [${l.anchor || l.url}](${l.url})`);
    }
    lines.push("");
  }
  if (input.competitorUrls.length > 0) {
    lines.push("## Competitor URLs to review");
    lines.push("");
    for (const u of input.competitorUrls) {
      lines.push(`- ${u}`);
    }
    lines.push("");
  }
  if (input.notes) {
    lines.push("## Additional notes");
    lines.push("");
    lines.push(input.notes);
    lines.push("");
  }
  lines.push("---");
  lines.push("_Generated with UnQTools Content Brief Generator_");
  return lines.join("\n");
}

/** Render the brief as HTML. */
export function renderHtml(input: ContentBriefInput): string {
  const v = validateInput(input);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const esc = (s: string): string =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines: string[] = [];
  lines.push(`<article class="content-brief">`);
  lines.push(`  <h1>${esc(input.title)}</h1>`);
  lines.push(`  <dl>`);
  lines.push(`    <dt>Target keyword</dt><dd>${esc(input.targetKeyword)}</dd>`);
  lines.push(`    <dt>Search intent</dt><dd>${esc(INTENT_LABELS[input.searchIntent])}</dd>`);
  lines.push(`    <dt>Word count target</dt><dd>${input.wordCountTarget} words</dd>`);
  if (input.audience) lines.push(`    <dt>Audience</dt><dd>${esc(input.audience)}</dd>`);
  if (input.tone) lines.push(`    <dt>Tone</dt><dd>${esc(input.tone)}</dd>`);
  lines.push(`  </dl>`);
  if (input.outline.length > 0) {
    lines.push(`  <h2>Outline</h2>`);
    for (const item of input.outline) {
      lines.push(`  <h3>${esc(item.heading)}</h3>`);
      if (item.notes) lines.push(`  <blockquote>${esc(item.notes)}</blockquote>`);
    }
  }
  if (input.keyPoints.length > 0) {
    lines.push(`  <h2>Key points</h2>`);
    lines.push(`  <ul>`);
    for (const p of input.keyPoints) lines.push(`    <li>${esc(p)}</li>`);
    lines.push(`  </ul>`);
  }
  if (input.lsiKeywords.length > 0) {
    lines.push(`  <h2>LSI keywords</h2>`);
    lines.push(`  <p>${input.lsiKeywords.map((k) => `<code>${esc(k)}</code>`).join(", ")}</p>`);
  }
  if (input.internalLinks.length > 0) {
    lines.push(`  <h2>Internal links</h2>`);
    lines.push(`  <ul>`);
    for (const l of input.internalLinks) {
      lines.push(`    <li><a href="${esc(l.url)}">${esc(l.anchor || l.url)}</a></li>`);
    }
    lines.push(`  </ul>`);
  }
  if (input.externalLinks.length > 0) {
    lines.push(`  <h2>External links</h2>`);
    lines.push(`  <ul>`);
    for (const l of input.externalLinks) {
      lines.push(`    <li><a href="${esc(l.url)}">${esc(l.anchor || l.url)}</a></li>`);
    }
    lines.push(`  </ul>`);
  }
  if (input.competitorUrls.length > 0) {
    lines.push(`  <h2>Competitor URLs</h2>`);
    lines.push(`  <ul>`);
    for (const u of input.competitorUrls) lines.push(`    <li>${esc(u)}</li>`);
    lines.push(`  </ul>`);
  }
  if (input.notes) {
    lines.push(`  <h2>Notes</h2>`);
    lines.push(`  <p>${esc(input.notes)}</p>`);
  }
  lines.push(`</article>`);
  return lines.join("\n");
}

/** Parse a comma- or newline-separated list. */
export function parseList(text: string): string[] {
  if (!text || !text.trim()) return [];
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse links from text: one per line, "anchor | URL" or "URL" or "URL anchor". */
export function parseLinks(text: string): BriefLink[] {
  if (!text || !text.trim()) return [];
  const links: BriefLink[] = [];
  for (const line of text.split(/\n+/).map((l) => l.trim()).filter(Boolean)) {
    if (line.includes("|")) {
      const [anchor, url] = line.split("|").map((s) => s.trim());
      if (url) links.push({ anchor: anchor || url, url });
      continue;
    }
    // Try URL first, then anchor
    const m = line.match(/^(https?:\/\/\S+)\s*(.*)$/);
    if (m) {
      links.push({ url: m[1], anchor: m[2] || m[1] });
      continue;
    }
    // Assume URL only
    if (isValidUrl(line)) links.push({ url: line, anchor: line });
  }
  return links;
}

// ---- History ----

const HISTORY_KEY = "unqtools:content-brief-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  title: string;
  keyword: string;
  wordCount: number;
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

export function buildShareUrl(input: ContentBriefInput): string {
  const params = new URLSearchParams();
  params.set("data", JSON.stringify(input));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ContentBriefInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const data = params.get("data");
  if (!data) return {};
  try {
    return JSON.parse(data) as ContentBriefInput;
  } catch {
    return {};
  }
}
