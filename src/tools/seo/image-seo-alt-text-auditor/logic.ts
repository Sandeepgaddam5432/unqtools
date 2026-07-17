/**
 * Image SEO & Alt Text Auditor — pure logic.
 *
 * Extract <img> tags from HTML, audit alt text quality, classify issues
 * (missing, empty, too long, too short, good), provide stats and reports.
 *
 * WCAG 2.1 SC 1.1.1: All non-decorative images must have equivalent alt text.
 * SEO best practice: descriptive alt text 5-125 characters.
 *
 * Pure functions only — no DOM, no network.
 */

export interface ImageInfo {
  src: string;
  alt: string | null;     // null = no alt attribute at all
  title: string | null;
  isDecorative: boolean;  // alt="" (decorative / spacer)
  width?: string;
  height?: string;
  raw: string;            // raw <img ...> tag
  index: number;
}

export type AltIssueType =
  | "missing-alt"
  | "empty-alt"
  | "too-long"
  | "too-short"
  | "good"
  | "non-descriptive";

export interface AltIssue {
  type: AltIssueType;
  message: string;
  image: ImageInfo;
}

export interface AuditStats {
  totalImages: number;
  missingAlt: number;
  emptyAlt: number;       // decorative (alt="")
  tooLong: number;        // > 125 chars
  tooShort: number;       // 1-3 chars
  nonDescriptive: number; // contains generic words like "image", "photo"
  good: number;
  altLengthMin: number;
  altLengthMax: number;
  altLengthAvg: number;
  withTitle: number;
  withWidth: number;
  withHeight: number;
}

export interface AuditResult {
  images: ImageInfo[];
  issues: AltIssue[];
  stats: AuditStats;
}

export const ALT_MIN_LENGTH = 4;
export const ALT_MAX_LENGTH = 125;

/** Generic / non-descriptive words that suggest low-quality alt text. */
export const GENERIC_WORDS = new Set<string>([
  "image", "img", "photo", "picture", "pic", "icon", "graphic",
  "placeholder", "untitled", "screenshot", "untitled",
]);

/** Extract all <img> tags from HTML. */
export function extractImages(html: string): ImageInfo[] {
  if (!html) return [];
  const images: ImageInfo[] = [];
  const imgRegex = /<img\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = imgRegex.exec(html)) !== null) {
    const raw = match[0];
    const src = getAttribute(raw, "src") || "";
    const alt = getAttribute(raw, "alt");
    const title = getAttribute(raw, "title");
    const width = getAttribute(raw, "width") || undefined;
    const height = getAttribute(raw, "height") || undefined;
    const isDecorative = alt !== null && alt === "";
    images.push({ src, alt, title, isDecorative, width, height, raw, index: index++ });
  }
  return images;
}

/** Get an attribute value from a tag. Returns null if attribute is not present. */
export function getAttribute(tag: string, attr: string): string | null {
  const re = new RegExp(`\\b${attr}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const m = tag.match(re);
  if (!m) return null;
  return m[2] ?? m[3] ?? m[4] ?? "";
}

/** Classify an image's alt text quality. */
export function classifyAlt(image: ImageInfo): AltIssueType {
  // No alt attribute at all
  if (image.alt === null) return "missing-alt";
  // Empty alt = decorative (intentional)
  if (image.alt === "") return "empty-alt";
  const alt = image.alt.trim();
  if (alt.length === 0) return "empty-alt";
  if (alt.length < ALT_MIN_LENGTH) return "too-short";
  if (alt.length > ALT_MAX_LENGTH) return "too-long";
  if (isNonDescriptive(alt)) return "non-descriptive";
  return "good";
}

/** Check if alt text contains only generic words. */
export function isNonDescriptive(alt: string): boolean {
  const words = alt.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  // If every word is generic, it's non-descriptive
  return words.every((w) => GENERIC_WORDS.has(w));
}

/** Build an issue message for a given image. */
export function buildIssue(image: ImageInfo): AltIssue {
  const type = classifyAlt(image);
  let message = "";
  switch (type) {
    case "missing-alt":
      message = `Missing alt attribute — screen readers can't describe this image. Add alt="description" or alt="" for decorative images.`;
      break;
    case "empty-alt":
      message = `Empty alt attribute (alt="") — fine for decorative images, but verify this image isn't content-bearing.`;
      break;
    case "too-long":
      message = `Alt text is too long (${image.alt!.length} chars > ${ALT_MAX_LENGTH}). Screen readers may truncate it. Aim for under ${ALT_MAX_LENGTH} characters.`;
      break;
    case "too-short":
      message = `Alt text is too short ("${image.alt}") — needs more descriptive context.`;
      break;
    case "non-descriptive":
      message = `Alt text "${image.alt}" is non-descriptive (generic words only). Describe what the image actually shows.`;
      break;
    case "good":
      message = `Good alt text: "${image.alt}"`;
      break;
  }
  return { type, message, image };
}

/** Run the full audit on HTML. */
export function auditImages(html: string): AuditResult {
  const images = extractImages(html);
  const issues = images.map(buildIssue);

  const withAlts = images
    .filter((i) => i.alt !== null && i.alt !== "")
    .map((i) => i.alt!.trim().length);
  const altLengthMin = withAlts.length > 0 ? Math.min(...withAlts) : 0;
  const altLengthMax = withAlts.length > 0 ? Math.max(...withAlts) : 0;
  const altLengthAvg = withAlts.length > 0
    ? Math.round(withAlts.reduce((a, b) => a + b, 0) / withAlts.length)
    : 0;

  const stats: AuditStats = {
    totalImages: images.length,
    missingAlt: issues.filter((i) => i.type === "missing-alt").length,
    emptyAlt: issues.filter((i) => i.type === "empty-alt").length,
    tooLong: issues.filter((i) => i.type === "too-long").length,
    tooShort: issues.filter((i) => i.type === "too-short").length,
    nonDescriptive: issues.filter((i) => i.type === "non-descriptive").length,
    good: issues.filter((i) => i.type === "good").length,
    altLengthMin,
    altLengthMax,
    altLengthAvg,
    withTitle: images.filter((i) => i.title !== null && i.title !== "").length,
    withWidth: images.filter((i) => i.width !== undefined).length,
    withHeight: images.filter((i) => i.height !== undefined).length,
  };

  return { images, issues, stats };
}

/** Render audit as a CSV report. */
export function renderCsv(result: AuditResult): string {
  const lines: string[] = [
    "index,src,alt,status,length,title,width,height",
  ];
  for (const img of result.images) {
    const issue = result.issues.find((i) => i.image.index === img.index);
    lines.push(
      [
        img.index,
        escapeCsv(img.src),
        escapeCsv(img.alt ?? ""),
        escapeCsv(issue?.type ?? ""),
        img.alt?.length ?? 0,
        escapeCsv(img.title ?? ""),
        img.width ?? "",
        img.height ?? "",
      ].join(","),
    );
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Render a Markdown report. */
export function renderReport(result: AuditResult): string {
  const lines: string[] = [];
  lines.push("# Image SEO & Alt Text Audit Report");
  lines.push("");
  lines.push(`**Total images:** ${result.stats.totalImages}`);
  lines.push(`**Good alt text:** ${result.stats.good}`);
  lines.push(`**Missing alt:** ${result.stats.missingAlt}`);
  lines.push(`**Empty alt (decorative):** ${result.stats.emptyAlt}`);
  lines.push(`**Too long (> ${ALT_MAX_LENGTH} chars):** ${result.stats.tooLong}`);
  lines.push(`**Too short (< ${ALT_MIN_LENGTH} chars):** ${result.stats.tooShort}`);
  lines.push(`**Non-descriptive:** ${result.stats.nonDescriptive}`);
  lines.push(`**Alt length min/avg/max:** ${result.stats.altLengthMin} / ${result.stats.altLengthAvg} / ${result.stats.altLengthMax}`);
  lines.push("");
  lines.push("## Issues");
  lines.push("");
  if (result.issues.length === 0) {
    lines.push("_No images found._");
  } else {
    for (const issue of result.issues) {
      const icon = issue.type === "good" ? "✓" : "⚠";
      lines.push(`- ${icon} **[${issue.type}]** ${issue.message}`);
      lines.push(`  - Source: \`${issue.image.src || "(no src)"}\``);
    }
  }
  lines.push("");
  lines.push("## SEO recommendations");
  lines.push("");
  lines.push("- Add descriptive alt text to all content-bearing images.");
  lines.push(`- Keep alt text between ${ALT_MIN_LENGTH} and ${ALT_MAX_LENGTH} characters.`);
  lines.push("- Avoid generic words like \"image\", \"photo\", \"icon\".");
  lines.push("- Use empty alt=\"\" only for purely decorative images.");
  lines.push("- Include width and height attributes to prevent layout shift (CLS).");
  lines.push("");
  lines.push("---");
  lines.push("_Generated with UnQTools Image SEO & Alt Text Auditor_");
  return lines.join("\n");
}

/** Generate WCAG accessibility issue list. */
export function generateAccessibilityIssues(result: AuditResult): string[] {
  const issues: string[] = [];
  if (result.stats.missingAlt > 0) {
    issues.push(
      `WCAG 2.1 SC 1.1.1 (Non-text Content): ${result.stats.missingAlt} image(s) missing alt attribute. Screen readers cannot describe them.`,
    );
  }
  if (result.stats.tooLong > 0) {
    issues.push(
      `WCAG 2.1 SC 1.1.1: ${result.stats.tooLong} image(s) with alt text over ${ALT_MAX_LENGTH} characters — may be truncated by screen readers.`,
    );
  }
  if (result.stats.nonDescriptive > 0) {
    issues.push(
      `WCAG 2.1 SC 1.1.1: ${result.stats.nonDescriptive} image(s) with non-descriptive alt text. Doesn't convey the meaning of the image.`,
    );
  }
  return issues;
}

/** Generate SEO-specific issues. */
export function generateSeoIssues(result: AuditResult): string[] {
  const issues: string[] = [];
  if (result.stats.missingAlt > 0) {
    issues.push(
      `${result.stats.missingAlt} image(s) missing alt text — missed opportunity for image search rankings.`,
    );
  }
  if (result.stats.tooShort > 0) {
    issues.push(
      `${result.stats.tooShort} image(s) with too-short alt text — doesn't help image SEO.`,
    );
  }
  if (result.stats.nonDescriptive > 0) {
    issues.push(
      `${result.stats.nonDescriptive} image(s) with non-descriptive alt text — won't rank for relevant image searches.`,
    );
  }
  const missingDimensions = result.images.filter(
    (i) => i.width === undefined || i.height === undefined,
  ).length;
  if (missingDimensions > 0) {
    issues.push(
      `${missingDimensions} image(s) missing width/height attributes — may cause layout shift (CLS) which hurts Core Web Vitals.`,
    );
  }
  return issues;
}

// ---- History ----

const HISTORY_KEY = "unqtools:image-seo-alt-text-auditor:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  imageCount: number;
  issueCount: number;
  goodCount: number;
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
