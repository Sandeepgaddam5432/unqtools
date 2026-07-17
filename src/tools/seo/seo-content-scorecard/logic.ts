/**
 * SEO Content Scorecard — pure logic.
 *
 * Pure functions only — no DOM, no network.
 */

export type CheckStatus = "pass" | "warn" | "fail";

export interface Check {
  id: string;
  label: string;
  category: string;
  weight: number;
  status: CheckStatus;
  message: string;
  recommendation: string;
}

export interface ScorecardResult {
  checks: Check[];
  score: number; // 0-100
  passCount: number;
  warnCount: number;
  failCount: number;
  totalWeight: number;
  earnedWeight: number;
  recommendations: Check[]; // sorted by weight desc, only non-pass
}

export interface ScorecardThresholds {
  titleMin: number;
  titleMax: number;
  metaMin: number;
  metaMax: number;
  wordCountMin: number;
  densityMin: number;
  densityMax: number;
  readabilityMin: number;
}

export const DEFAULT_THRESHOLDS: ScorecardThresholds = {
  titleMin: 30,
  titleMax: 60,
  metaMin: 70,
  metaMax: 160,
  wordCountMin: 300,
  densityMin: 0.5,
  densityMax: 3,
  readabilityMin: 50,
};

/** Strip HTML tags from input. */
export function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract the title text from HTML <title> or treat first line as title. */
export function extractTitle(html: string): string {
  if (!html) return "";
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (m) return m[1].trim();
  // Fallback: H1
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return stripHtml(h1[1]);
  return "";
}

/** Extract the meta description content. */
export function extractMetaDescription(html: string): string {
  if (!html) return "";
  const m = html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i);
  if (m) return m[1].trim();
  return "";
}

/** Extract all headings by level. */
export function extractHeadings(html: string): Array<{ level: number; text: string }> {
  if (!html) return [];
  const out: Array<{ level: number; text: string }> = [];
  const re = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out.push({ level: parseInt(m[1], 10), text: stripHtml(m[2]) });
  }
  return out;
}

/** Extract all images and their alt text. */
export function extractImages(html: string): Array<{ src: string; alt: string }> {
  if (!html) return [];
  const out: Array<{ src: string; alt: string }> = [];
  const re = /<img\s+[^>]*?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const srcMatch = tag.match(/src=["']([^"']+)["']/i);
    const altMatch = tag.match(/alt=["']([^"']*)["']/i);
    out.push({
      src: srcMatch ? srcMatch[1] : "",
      alt: altMatch ? altMatch[1] : "",
    });
  }
  return out;
}

/** Detect internal links (a href). */
export function extractLinks(html: string): Array<{ href: string; text: string }> {
  if (!html) return [];
  const out: Array<{ href: string; text: string }> = [];
  const re = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out.push({ href: m[1], text: stripHtml(m[2]) });
  }
  return out;
}

/** Detect schema markup (JSON-LD, microdata, rdfa). */
export function detectSchema(html: string): string[] {
  if (!html) return [];
  const out: string[] = [];
  const jsonLd = html.match(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLd) out.push("JSON-LD");
  if (/itemscope/i.test(html)) out.push("Microdata");
  if (/vocab=["']https?:\/\/schema\.org/i.test(html) || /typeof=["']/i.test(html)) out.push("RDFa");
  return out;
}

/** Detect mobile viewport tag. */
export function hasViewport(html: string): boolean {
  if (!html) return false;
  return /<meta\s+name=["']viewport["']/i.test(html);
}

/** Count words in plain text. */
export function countWords(text: string): number {
  if (!text) return 0;
  const matches = text.match(/\b[a-zA-Z0-9']+\b/g);
  return matches ? matches.length : 0;
}

/** Count occurrences of a keyword (case-insensitive). */
export function countKeyword(text: string, keyword: string): number {
  if (!text || !keyword) return 0;
  const lower = text.toLowerCase();
  const k = keyword.toLowerCase().trim();
  let count = 0;
  let idx = 0;
  while ((idx = lower.indexOf(k, idx)) !== -1) {
    count++;
    idx += k.length;
  }
  return count;
}

/** Compute keyword density percentage. */
export function computeDensity(text: string, keyword: string): number {
  const words = countWords(text);
  if (words === 0 || !keyword) return 0;
  const count = countKeyword(text, keyword);
  // For multi-word keywords, density is per keyword phrase
  const kwWords = keyword.trim().split(/\s+/).length;
  return (count / Math.max(1, words - kwWords + 1)) * 100;
}

/** Compute Flesch Reading Ease score. */
export function fleschReadingEase(text: string): number {
  if (!text) return 0;
  const words = text.match(/\b[a-zA-Z0-9']+\b/g) || [];
  if (words.length === 0) return 0;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length === 0) return 0;
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const score = 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function countSyllables(word: string): number {
  const w = word.toLowerCase();
  if (w.length <= 3) return 1;
  const stripped = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const matches = stripped.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

/** Run all checks. */
export function audit(input: string, keyword: string, thresholds: ScorecardThresholds = DEFAULT_THRESHOLDS): ScorecardResult {
  const isHtml = /<[^>]+>/.test(input || "");
  const html = input || "";
  const plain = isHtml ? stripHtml(html) : html;
  const title = isHtml ? extractTitle(html) : (plain.split("\n")[0] || "");
  const meta = isHtml ? extractMetaDescription(html) : "";
  const headings = isHtml ? extractHeadings(html) : [];
  const images = isHtml ? extractImages(html) : [];
  const links = isHtml ? extractLinks(html) : [];
  const schemas = isHtml ? detectSchema(html) : [];
  const viewport = isHtml ? hasViewport(html) : true; // assume OK for plain text

  const wordCount = countWords(plain);
  const density = keyword ? computeDensity(plain, keyword) : 0;
  const readability = fleschReadingEase(plain);
  const h1Count = headings.filter((h) => h.level === 1).length;

  const checks: Check[] = [];

  // 1. Title length
  if (title.length === 0) {
    checks.push({
      id: "title",
      label: "Title length",
      category: "Title",
      weight: 15,
      status: "fail",
      message: "No title found",
      recommendation: "Add a <title> tag with 30-60 characters.",
    });
  } else if (title.length < thresholds.titleMin) {
    checks.push({
      id: "title", label: "Title length", category: "Title", weight: 15, status: "warn",
      message: `Title is ${title.length} chars (min ${thresholds.titleMin})`,
      recommendation: "Expand the title to 30-60 characters for optimal SERP display.",
    });
  } else if (title.length > thresholds.titleMax) {
    checks.push({
      id: "title", label: "Title length", category: "Title", weight: 15, status: "warn",
      message: `Title is ${title.length} chars (max ${thresholds.titleMax})`,
      recommendation: "Trim the title to 60 chars or fewer to avoid SERP truncation.",
    });
  } else {
    checks.push({
      id: "title", label: "Title length", category: "Title", weight: 15, status: "pass",
      message: `Title is ${title.length} chars`,
      recommendation: "",
    });
  }

  // 2. Meta description
  if (meta.length === 0) {
    checks.push({
      id: "meta", label: "Meta description", category: "Meta", weight: 10, status: "fail",
      message: "No meta description",
      recommendation: "Add a meta description of 70-160 chars.",
    });
  } else if (meta.length < thresholds.metaMin) {
    checks.push({
      id: "meta", label: "Meta description", category: "Meta", weight: 10, status: "warn",
      message: `Meta is ${meta.length} chars (min ${thresholds.metaMin})`,
      recommendation: "Expand the meta description to 70-160 chars.",
    });
  } else if (meta.length > thresholds.metaMax) {
    checks.push({
      id: "meta", label: "Meta description", category: "Meta", weight: 10, status: "warn",
      message: `Meta is ${meta.length} chars (max ${thresholds.metaMax})`,
      recommendation: "Trim the meta description to 160 chars or fewer.",
    });
  } else {
    checks.push({
      id: "meta", label: "Meta description", category: "Meta", weight: 10, status: "pass",
      message: `Meta is ${meta.length} chars`,
      recommendation: "",
    });
  }

  // 3. H1 presence
  if (h1Count === 0) {
    checks.push({
      id: "h1", label: "H1 heading", category: "Headings", weight: 10, status: "fail",
      message: "No H1 found",
      recommendation: "Add exactly one H1 heading with the target keyword near the front.",
    });
  } else if (h1Count > 1) {
    checks.push({
      id: "h1", label: "H1 heading", category: "Headings", weight: 10, status: "warn",
      message: `${h1Count} H1s found`,
      recommendation: "Use only one H1 per page.",
    });
  } else {
    checks.push({
      id: "h1", label: "H1 heading", category: "Headings", weight: 10, status: "pass",
      message: "Exactly one H1",
      recommendation: "",
    });
  }

  // 4. Heading hierarchy
  const headingLevels = headings.map((h) => h.level);
  let hierarchyOk = true;
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] - headingLevels[i - 1] > 1) {
      hierarchyOk = false;
      break;
    }
  }
  if (!isHtml) {
    checks.push({
      id: "headings", label: "Heading hierarchy", category: "Headings", weight: 10, status: "warn",
      message: "No HTML headings detected (plain text input)",
      recommendation: "Provide HTML input to evaluate H1-H6 hierarchy.",
    });
  } else if (headings.length === 0) {
    checks.push({
      id: "headings", label: "Heading hierarchy", category: "Headings", weight: 10, status: "fail",
      message: "No headings found",
      recommendation: "Add H2-H6 subheadings to structure content.",
    });
  } else if (!hierarchyOk) {
    checks.push({
      id: "headings", label: "Heading hierarchy", category: "Headings", weight: 10, status: "warn",
      message: "Heading levels skip (e.g. H2 → H4)",
      recommendation: "Don't skip heading levels. Use H2 then H3, not H2 then H4.",
    });
  } else {
    checks.push({
      id: "headings", label: "Heading hierarchy", category: "Headings", weight: 10, status: "pass",
      message: `${headings.length} headings, hierarchy valid`,
      recommendation: "",
    });
  }

  // 5. Keyword density
  if (!keyword) {
    checks.push({
      id: "density", label: "Keyword density", category: "Content", weight: 10, status: "warn",
      message: "No keyword provided",
      recommendation: "Enter a target keyword to evaluate density.",
    });
  } else if (density < thresholds.densityMin) {
    checks.push({
      id: "density", label: "Keyword density", category: "Content", weight: 10, status: "warn",
      message: `Density ${density.toFixed(2)}% (min ${thresholds.densityMin}%)`,
      recommendation: `Use the keyword "${keyword}" more often in the content.`,
    });
  } else if (density > thresholds.densityMax) {
    checks.push({
      id: "density", label: "Keyword density", category: "Content", weight: 10, status: "warn",
      message: `Density ${density.toFixed(2)}% (max ${thresholds.densityMax}%)`,
      recommendation: "Reduce keyword usage — risk of keyword stuffing.",
    });
  } else {
    checks.push({
      id: "density", label: "Keyword density", category: "Content", weight: 10, status: "pass",
      message: `Density ${density.toFixed(2)}%`,
      recommendation: "",
    });
  }

  // 6. Word count
  if (wordCount < thresholds.wordCountMin) {
    checks.push({
      id: "wordcount", label: "Word count", category: "Content", weight: 10, status: "warn",
      message: `${wordCount} words (min ${thresholds.wordCountMin})`,
      recommendation: `Add more content — aim for at least ${thresholds.wordCountMin} words.`,
    });
  } else {
    checks.push({
      id: "wordcount", label: "Word count", category: "Content", weight: 10, status: "pass",
      message: `${wordCount} words`,
      recommendation: "",
    });
  }

  // 7. Readability
  if (readability < thresholds.readabilityMin) {
    checks.push({
      id: "readability", label: "Readability (Flesch)", category: "Content", weight: 10, status: "warn",
      message: `Flesch score ${readability} (min ${thresholds.readabilityMin})`,
      recommendation: "Use shorter sentences and simpler words to improve readability.",
    });
  } else {
    checks.push({
      id: "readability", label: "Readability (Flesch)", category: "Content", weight: 10, status: "pass",
      message: `Flesch score ${readability}`,
      recommendation: "",
    });
  }

  // 8. Internal links
  const internalLinks = links.filter((l) => !/^https?:\/\//i.test(l.href) || /<a[^>]+href=["']\/[^/]/.test(l.href));
  if (!isHtml) {
    checks.push({
      id: "links", label: "Internal links", category: "Links", weight: 5, status: "warn",
      message: "No HTML links detected",
      recommendation: "Provide HTML input to evaluate internal links.",
    });
  } else if (internalLinks.length === 0) {
    checks.push({
      id: "links", label: "Internal links", category: "Links", weight: 5, status: "fail",
      message: "No internal links found",
      recommendation: "Add internal links to related content (aim for 3-10 per page).",
    });
  } else if (internalLinks.length < 3) {
    checks.push({
      id: "links", label: "Internal links", category: "Links", weight: 5, status: "warn",
      message: `${internalLinks.length} internal links`,
      recommendation: "Add more internal links — aim for 3-10 per page.",
    });
  } else {
    checks.push({
      id: "links", label: "Internal links", category: "Links", weight: 5, status: "pass",
      message: `${internalLinks.length} internal links`,
      recommendation: "",
    });
  }

  // 9. Image alt text
  if (!isHtml) {
    checks.push({
      id: "alt", label: "Image alt text", category: "Images", weight: 10, status: "warn",
      message: "No HTML images detected",
      recommendation: "Provide HTML input to evaluate image alt text.",
    });
  } else if (images.length === 0) {
    checks.push({
      id: "alt", label: "Image alt text", category: "Images", weight: 10, status: "warn",
      message: "No images found",
      recommendation: "Add relevant images with descriptive alt text containing the keyword.",
    });
  } else {
    const missingAlt = images.filter((img) => !img.alt.trim());
    if (missingAlt.length === 0) {
      checks.push({
        id: "alt", label: "Image alt text", category: "Images", weight: 10, status: "pass",
        message: `All ${images.length} images have alt text`,
        recommendation: "",
      });
    } else if (missingAlt.length === images.length) {
      checks.push({
        id: "alt", label: "Image alt text", category: "Images", weight: 10, status: "fail",
        message: `All ${images.length} images missing alt text`,
        recommendation: "Add descriptive alt text to every image.",
      });
    } else {
      checks.push({
        id: "alt", label: "Image alt text", category: "Images", weight: 10, status: "warn",
        message: `${missingAlt.length} of ${images.length} images missing alt`,
        recommendation: "Add alt text to remaining images.",
      });
    }
  }

  // 10. Schema markup
  if (!isHtml) {
    checks.push({
      id: "schema", label: "Schema markup", category: "Technical", weight: 5, status: "warn",
      message: "No HTML input to detect schema",
      recommendation: "Provide HTML input to evaluate schema markup.",
    });
  } else if (schemas.length === 0) {
    checks.push({
      id: "schema", label: "Schema markup", category: "Technical", weight: 5, status: "fail",
      message: "No schema markup found",
      recommendation: "Add JSON-LD schema (Article, FAQPage, BreadcrumbList) for rich results.",
    });
  } else {
    checks.push({
      id: "schema", label: "Schema markup", category: "Technical", weight: 5, status: "pass",
      message: `Found: ${schemas.join(", ")}`,
      recommendation: "",
    });
  }

  // 11. Mobile viewport
  if (!viewport) {
    checks.push({
      id: "viewport", label: "Mobile viewport", category: "Technical", weight: 5, status: "fail",
      message: "No viewport meta tag",
      recommendation: "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">.",
    });
  } else {
    checks.push({
      id: "viewport", label: "Mobile viewport", category: "Technical", weight: 5, status: "pass",
      message: "Viewport tag present",
      recommendation: "",
    });
  }

  // 12. Duplicate H1 (extra check)
  if (h1Count > 1) {
    checks.push({
      id: "dup-h1", label: "Duplicate H1", category: "Headings", weight: 5, status: "warn",
      message: `${h1Count} H1 tags`,
      recommendation: "Use only one H1 — additional ones should be H2.",
    });
  } else if (h1Count === 1) {
    checks.push({
      id: "dup-h1", label: "Duplicate H1", category: "Headings", weight: 5, status: "pass",
      message: "Single H1",
      recommendation: "",
    });
  } else {
    checks.push({
      id: "dup-h1", label: "Duplicate H1", category: "Headings", weight: 5, status: "fail",
      message: "No H1",
      recommendation: "Add an H1 with the primary keyword.",
    });
  }

  // Compute score
  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const earnedWeight = checks.reduce(
    (sum, c) => sum + (c.status === "pass" ? c.weight : c.status === "warn" ? c.weight / 2 : 0),
    0,
  );
  const score = Math.round((earnedWeight / Math.max(1, totalWeight)) * 100);
  const passCount = checks.filter((c) => c.status === "pass").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const failCount = checks.filter((c) => c.status === "fail").length;
  // Recommendations sorted by impact (weight desc, fails first)
  const recommendations = checks
    .filter((c) => c.status !== "pass" && c.recommendation)
    .sort((a, b) => {
      const order = { fail: 0, warn: 1, pass: 2 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return b.weight - a.weight;
    });

  return {
    checks,
    score,
    passCount,
    warnCount,
    failCount,
    totalWeight,
    earnedWeight,
    recommendations,
  };
}

/** Render report as Markdown. */
export function renderMarkdown(result: ScorecardResult): string {
  const lines: string[] = [
    "# SEO Content Scorecard",
    "",
    `**Overall score:** ${result.score}/100`,
    `**Pass:** ${result.passCount} · **Warn:** ${result.warnCount} · **Fail:** ${result.failCount}`,
    "",
    "## Checks",
    "",
    "| Check | Status | Message |",
    "| --- | --- | --- |",
  ];
  for (const c of result.checks) {
    lines.push(`| ${c.label} | ${c.status.toUpperCase()} | ${c.message} |`);
  }
  lines.push("");
  if (result.recommendations.length > 0) {
    lines.push("## Prioritized recommendations");
    lines.push("");
    for (const c of result.recommendations) {
      lines.push(`- [${c.status.toUpperCase()}] **${c.label}** — ${c.recommendation}`);
    }
  } else {
    lines.push("_All checks passed — no recommendations._");
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:seo-content-scorecard:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  score: number;
  passCount: number;
  warnCount: number;
  failCount: number;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, HISTORY_MAX);
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

export function buildShareUrl(input: {
  content: string;
  keyword: string;
}): string {
  const params = new URLSearchParams();
  if (input.content) params.set("content", input.content);
  if (input.keyword) params.set("keyword", input.keyword);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { content: string; keyword: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { content: "", keyword: "" };
  const params = new URLSearchParams(clean);
  return {
    content: params.get("content") ?? "",
    keyword: params.get("keyword") ?? "",
  };
}
