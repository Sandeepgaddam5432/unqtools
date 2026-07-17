/**
 * HTML to Text Ratio Checker — pure logic.
 *
 * Parse HTML, extract visible text, compute HTML-to-text ratio, provide stats
 * and SEO recommendations. Pure functions, no DOM, no network.
 *
 * Good HTML-to-text ratio is typically 15-50%. Below 10% suggests thin content
 * or excessive markup. Above 70% may indicate very plain text-heavy pages
 * (which is fine for content but may lack semantic structure).
 */

export interface HtmlStats {
  htmlSize: number;       // bytes
  textSize: number;       // bytes (visible text only)
  ratio: number;          // text size / html size * 100
  wordCount: number;
  charCount: number;      // characters in visible text
  tagCount: number;       // total HTML tags (opening + closing)
  scriptCount: number;
  styleCount: number;
  imgCount: number;
  linkCount: number;
  headingCount: number;
  paragraphCount: number;
  listCount: number;
}

export interface SeoRecommendation {
  level: "good" | "warning" | "bad";
  message: string;
}

export interface AnalysisResult {
  stats: HtmlStats;
  text: string;
  recommendations: SeoRecommendation[];
  score: number; // 0-100
}

/** Strip <script>...</script> blocks. */
export function stripScripts(html: string): string {
  if (!html) return "";
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

/** Strip <style>...</style> blocks. */
export function stripStyles(html: string): string {
  if (!html) return "";
  return html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
}

/** Strip HTML comments. */
export function stripComments(html: string): string {
  if (!html) return "";
  return html.replace(/<!--[\s\S]*?-->/g, "");
}

/** Strip all HTML tags, returning text only. */
export function stripTags(html: string): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, "");
}

/** Decode common HTML entities. */
export function decodeEntities(text: string): string {
  if (!text) return "";
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&copy;/g, "©")
    .replace(/&reg;/g, "®")
    .replace(/&trade;/g, "™")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/** Collapse whitespace and trim. */
export function normalizeWhitespace(text: string): string {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim();
}

/** Count HTML tags (opening + closing). */
export function countTags(html: string): number {
  if (!html) return 0;
  const matches = html.match(/<\/?[a-zA-Z][^>]*>/g);
  return matches ? matches.length : 0;
}

/** Count occurrences of a specific tag. */
export function countTag(html: string, tag: string): number {
  if (!html) return 0;
  const re = new RegExp(`<${tag}\\b[^>]*>`, "gi");
  const matches = html.match(re);
  return matches ? matches.length : 0;
}

/** Extract visible text from HTML — strips scripts, styles, comments, tags. */
export function extractText(html: string): string {
  if (!html) return "";
  let s = stripComments(html);
  s = stripScripts(s);
  s = stripStyles(s);
  // Replace block tags with line breaks to preserve some structure
  s = s.replace(/<(p|div|h[1-6]|li|br|tr)[^>]*>/gi, "\n");
  s = stripTags(s);
  s = decodeEntities(s);
  s = normalizeWhitespace(s);
  return s;
}

/** Count words in a text. */
export function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

/** Compute the HTML-to-text ratio percentage. */
export function computeRatio(htmlSize: number, textSize: number): number {
  if (htmlSize === 0) return 0;
  return (textSize / htmlSize) * 100;
}

/** Generate SEO recommendations based on stats. */
export function generateRecommendations(stats: HtmlStats): SeoRecommendation[] {
  const recs: SeoRecommendation[] = [];

  // Ratio checks
  if (stats.ratio < 10) {
    recs.push({
      level: "bad",
      message: `Very low text-to-HTML ratio (${stats.ratio.toFixed(1)}%). Page may appear thin or have excessive markup. Add more substantive content.`,
    });
  } else if (stats.ratio < 15) {
    recs.push({
      level: "warning",
      message: `Low text-to-HTML ratio (${stats.ratio.toFixed(1)}%). Aim for 15-50% for content pages.`,
    });
  } else if (stats.ratio >= 15 && stats.ratio <= 50) {
    recs.push({
      level: "good",
      message: `Healthy text-to-HTML ratio (${stats.ratio.toFixed(1)}%). Good balance of content and markup.`,
    });
  } else if (stats.ratio > 50 && stats.ratio <= 70) {
    recs.push({
      level: "good",
      message: `Text-heavy page (${stats.ratio.toFixed(1)}%). Fine for articles but consider more semantic structure (headings, lists).`,
    });
  } else {
    recs.push({
      level: "warning",
      message: `Very high text-to-HTML ratio (${stats.ratio.toFixed(1)}%). Page may lack semantic structure. Add headings, paragraphs, and lists.`,
    });
  }

  // Word count checks
  if (stats.wordCount < 300) {
    recs.push({
      level: stats.wordCount < 100 ? "bad" : "warning",
      message: `Only ${stats.wordCount} words. Most SEO guides recommend 300+ words for content pages, 1000+ for in-depth articles.`,
    });
  } else {
    recs.push({
      level: "good",
      message: `${stats.wordCount} words — solid content length.`,
    });
  }

  // Heading checks
  if (stats.headingCount === 0 && stats.wordCount > 100) {
    recs.push({
      level: "warning",
      message: "No heading tags found. Add H1 (one per page) and H2/H3 to structure content.",
    });
  } else if (stats.headingCount > 0) {
    recs.push({
      level: "good",
      message: `${stats.headingCount} heading tags found — good for content structure.`,
    });
  }

  // Image checks
  if (stats.imgCount > 0) {
    recs.push({
      level: "good",
      message: `${stats.imgCount} images — remember to add descriptive alt text for SEO and accessibility.`,
    });
  }

  // Script/style overhead
  if (stats.scriptCount > 5) {
    recs.push({
      level: "warning",
      message: `${stats.scriptCount} <script> tags. Consider deferring or moving scripts to external files to improve performance.`,
    });
  }

  return recs;
}

/** Compute a 0-100 SEO score based on the analysis. */
export function computeScore(stats: HtmlStats): number {
  let score = 50;
  // Ratio score (max +30)
  if (stats.ratio >= 15 && stats.ratio <= 50) score += 30;
  else if (stats.ratio >= 10 && stats.ratio < 15) score += 15;
  else if (stats.ratio > 50 && stats.ratio <= 70) score += 20;
  else if (stats.ratio < 10) score += 0;
  else score += 10;

  // Word count (max +20)
  if (stats.wordCount >= 1000) score += 20;
  else if (stats.wordCount >= 300) score += 15;
  else if (stats.wordCount >= 100) score += 5;

  // Headings (max +5)
  if (stats.headingCount >= 2) score += 5;
  else if (stats.headingCount === 1) score += 3;

  // Scripts penalty (max -5)
  if (stats.scriptCount > 10) score -= 5;
  else if (stats.scriptCount > 5) score -= 2;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Run the full analysis on HTML. */
export function analyze(html: string): AnalysisResult {
  if (!html || !html.trim()) {
    return {
      stats: {
        htmlSize: 0, textSize: 0, ratio: 0, wordCount: 0, charCount: 0,
        tagCount: 0, scriptCount: 0, styleCount: 0, imgCount: 0,
        linkCount: 0, headingCount: 0, paragraphCount: 0, listCount: 0,
      },
      text: "",
      recommendations: [],
      score: 0,
    };
  }
  const text = extractText(html);
  const stats: HtmlStats = {
    htmlSize: html.length,
    textSize: text.length,
    ratio: computeRatio(html.length, text.length),
    wordCount: countWords(text),
    charCount: text.length,
    tagCount: countTags(html),
    scriptCount: countTag(html, "script"),
    styleCount: countTag(html, "style"),
    imgCount: countTag(html, "img"),
    linkCount: countTag(html, "a"),
    headingCount: countTag(html, "h1") + countTag(html, "h2") + countTag(html, "h3") +
      countTag(html, "h4") + countTag(html, "h5") + countTag(html, "h6"),
    paragraphCount: countTag(html, "p"),
    listCount: countTag(html, "ul") + countTag(html, "ol"),
  };
  const recommendations = generateRecommendations(stats);
  const score = computeScore(stats);
  return { stats, text, recommendations, score };
}

/** Render the analysis as a Markdown report. */
export function renderReport(result: AnalysisResult): string {
  const lines: string[] = [];
  lines.push("# HTML to Text Ratio Report");
  lines.push("");
  lines.push(`**HTML size:** ${result.stats.htmlSize} bytes`);
  lines.push(`**Text size:** ${result.stats.textSize} bytes`);
  lines.push(`**Ratio:** ${result.stats.ratio.toFixed(2)}%`);
  lines.push(`**Word count:** ${result.stats.wordCount}`);
  lines.push(`**SEO score:** ${result.score}/100`);
  lines.push("");
  lines.push("## Tag counts");
  lines.push("");
  lines.push(`- Total tags: ${result.stats.tagCount}`);
  lines.push(`- Scripts: ${result.stats.scriptCount}`);
  lines.push(`- Styles: ${result.stats.styleCount}`);
  lines.push(`- Images: ${result.stats.imgCount}`);
  lines.push(`- Links: ${result.stats.linkCount}`);
  lines.push(`- Headings: ${result.stats.headingCount}`);
  lines.push(`- Paragraphs: ${result.stats.paragraphCount}`);
  lines.push(`- Lists: ${result.stats.listCount}`);
  lines.push("");
  if (result.recommendations.length > 0) {
    lines.push("## Recommendations");
    lines.push("");
    for (const r of result.recommendations) {
      const icon = r.level === "good" ? "✓" : r.level === "warning" ? "⚠" : "✗";
      lines.push(`- ${icon} [${r.level.toUpperCase()}] ${r.message}`);
    }
    lines.push("");
  }
  lines.push("---");
  lines.push("_Generated with UnQTools HTML to Text Ratio Checker_");
  return lines.join("\n");
}

/** Build bar chart data for visualization. */
export function buildBarData(result: AnalysisResult): { label: string; value: number; color: string }[] {
  return [
    { label: "Text", value: result.stats.textSize, color: "#10b981" },
    {
      label: "Markup",
      value: Math.max(0, result.stats.htmlSize - result.stats.textSize),
      color: "#6b7280",
    },
  ];
}

// ---- History ----

const HISTORY_KEY = "unqtools:html-to-text-ratio-checker:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  htmlSize: number;
  ratio: number;
  wordCount: number;
  score: number;
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

export function buildShareUrl(html: string): string {
  const params = new URLSearchParams();
  params.set("html", html);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { html?: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const html = params.get("html");
  if (html === null) return {};
  return { html };
}
