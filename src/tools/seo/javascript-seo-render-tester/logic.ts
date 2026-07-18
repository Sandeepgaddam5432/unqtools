/**
 * JavaScript SEO Render Tester — pure logic.
 *
 * Analyze HTML snippets + JS file lists for JS-rendering SEO issues.
 * Pure functions only — no DOM, no network.
 */

export interface ScriptTag {
  /** Full raw tag text as found in the input. */
  raw: string;
  /** src attribute (URL). Undefined for inline scripts. */
  src?: string;
  /** async attribute present. */
  async: boolean;
  /** defer attribute present. */
  defer: boolean;
  /** type attribute (e.g. "module", "application/json"). */
  type?: string;
  /** True if the script has inline body content (no src). */
  isInline: boolean;
  /** True if the script was found inside <head>. */
  inHead: boolean;
  /** Inline script body (for inline scripts). */
  body?: string;
}

export interface DomSummary {
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  h1s: string[];
  linkCount: number;
  links: { href: string; text: string }[];
}

export type Severity = "critical" | "warning" | "info";

export interface Recommendation {
  code: string;
  message: string;
  severity: Severity;
}

export interface SummaryStats {
  totalScripts: number;
  externalCount: number;
  inlineCount: number;
  blockingCount: number;
  renderScore: number;
  missingCriticalTags: number;
}

export interface RenderAnalysis {
  scripts: ScriptTag[];
  domSummary: DomSummary;
  recommendations: Recommendation[];
  renderScore: number;
  externalCount: number;
  inlineCount: number;
  blockingCount: number;
  missingTitle: boolean;
  missingMetaDescription: boolean;
  missingH1: boolean;
  summary: SummaryStats;
}

export const HISTORY_KEY = "unqtools:javascript-seo-render-tester:history";
export const HISTORY_MAX = 20;

const SCRIPT_TAG_RE = /<script\b([^>]*?)>([\s\S]*?)<\/script>/gi;
const SCRIPT_SELF_RE = /<script\b([^>]*?)\s*\/>/gi;

/** Extract the <head>...</head> section content. Returns empty string if not found. */
export function parseHeadHtml(html: string): string {
  if (!html) return "";
  const m = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  return m ? m[1] : "";
}

/** Find the head section's start/end character indices. */
function findHeadBounds(html: string): { start: number; end: number } | null {
  if (!html) return null;
  const open = html.match(/<head\b[^>]*>/i);
  if (!open || open.index === undefined) return null;
  const openEnd = open.index + open[0].length;
  const close = html.slice(openEnd).match(/<\/head>/i);
  if (!close || close.index === undefined) return null;
  return { start: openEnd, end: openEnd + close.index };
}

/** Parse an attribute value from a tag string (e.g. src="..." or src='...' or src=bar). */
export function parseAttribute(tag: string, name: string): string | undefined {
  if (!tag || !name) return undefined;
  const re = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i");
  const m = tag.match(re);
  if (!m) return undefined;
  return m[2] ?? m[3] ?? m[4] ?? "";
}

/** Check if an attribute name is present (boolean attribute, e.g. async, defer). */
export function hasAttribute(tag: string, name: string): boolean {
  if (!tag || !name) return false;
  const re = new RegExp(`\\b${name}\\b`, "i");
  return re.test(tag);
}

/** Parse all <script> tags from an HTML string. Preserves head/body context. */
export function parseScriptTags(html: string): ScriptTag[] {
  if (!html) return [];
  const out: ScriptTag[] = [];
  const headBounds = findHeadBounds(html);
  const seen = new Set<number>();

  const collect = (re: RegExp, selfClosing: boolean) => {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(html)) !== null) {
      if (m.index === undefined) continue;
      if (seen.has(m.index)) continue;
      seen.add(m.index);
      const attrs = m[1] || "";
      const body = selfClosing ? "" : (m[2] || "");
      const src = parseAttribute(attrs, "src");
      const isInline = src === undefined;
      const inHead = headBounds
        ? m.index >= headBounds.start && m.index < headBounds.end
        : false;
      out.push({
        raw: m[0],
        src,
        async: hasAttribute(attrs, "async"),
        defer: hasAttribute(attrs, "defer"),
        type: parseAttribute(attrs, "type"),
        isInline,
        inHead,
        body: isInline ? body.trim() : undefined,
      });
    }
  };

  collect(SCRIPT_TAG_RE, false);
  collect(SCRIPT_SELF_RE, true);

  // Sort by document position
  out.sort((a, b) => {
    const ai = html.indexOf(a.raw);
    const bi = html.indexOf(b.raw);
    return ai - bi;
  });

  return out;
}

/** Parse a user-provided JS file list (one per line). Accepts URLs or <script src=...> tags. */
export function parseJsFileList(input: string): ScriptTag[] {
  if (!input) return [];
  const out: ScriptTag[] = [];
  for (const line of input.split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    // If line is a <script> tag, parse it directly
    if (/^<script\b/i.test(s)) {
      const parsed = parseScriptTags(s);
      for (const p of parsed) {
        // Treat all parsed file-list scripts as "in head = unknown" — set false unless explicitly inside
        out.push({ ...p, inHead: false });
      }
      continue;
    }
    // Otherwise, treat as a URL — extract optional trailing attributes
    // e.g. "/app.js defer" or "/app.js (defer)" — split on whitespace
    const parts = s.split(/\s+/);
    const src = parts[0];
    const rest = parts.slice(1).join(" ");
    out.push({
      raw: `<script src="${src}"></script>`,
      src,
      async: hasAttribute(rest, "async") || /async\b/i.test(rest),
      defer: hasAttribute(rest, "defer") || /defer\b/i.test(rest),
      type: parseAttribute(rest, "type"),
      isInline: false,
      inHead: false,
      body: undefined,
    });
  }
  return out;
}

/** Extract <title> text from HTML. */
export function extractTitle(html: string): string | null {
  if (!html) return null;
  const m = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : null;
}

/** Extract <meta name="description" content="..."> content. */
export function extractMetaDescription(html: string): string | null {
  if (!html) return null;
  // Look for <meta name="description" content="..."> (in either attr order)
  const re = /<meta\b([^>]*?)\s*\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || "";
    const name = parseAttribute(attrs, "name");
    if (name && name.toLowerCase() === "description") {
      return parseAttribute(attrs, "content") ?? "";
    }
  }
  return null;
}

/** Extract all <h1> texts from HTML. */
export function extractH1s(html: string): string[] {
  if (!html) return [];
  const out: string[] = [];
  const re = /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    // strip nested tags
    const text = (m[1] || "").replace(/<[^>]*>/g, "").trim();
    out.push(text);
  }
  return out;
}

/** Extract <a href="...">text</a> pairs. */
export function extractLinks(html: string): { href: string; text: string }[] {
  if (!html) return [];
  const out: { href: string; text: string }[] = [];
  const re = /<a\b([^>]*?)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || "";
    const href = parseAttribute(attrs, "href");
    if (!href) continue;
    const text = (m[2] || "").replace(/<[^>]*>/g, "").trim();
    out.push({ href, text });
  }
  return out;
}

/** Simulate the post-JS DOM by extracting critical tags from the HTML. */
export function simulateDom(html: string): DomSummary {
  const h1s = extractH1s(html);
  const links = extractLinks(html);
  return {
    title: extractTitle(html),
    metaDescription: extractMetaDescription(html),
    h1Count: h1s.length,
    h1s,
    linkCount: links.length,
    links,
  };
}

/** Detect render-blocking scripts: external scripts in <head> without async or defer. */
export function detectBlockingScripts(scripts: ScriptTag[]): ScriptTag[] {
  return scripts.filter((s) => s.inHead && !s.isInline && !s.async && !s.defer);
}

/** Count external (with src) vs inline (without src) scripts. */
export function countExternalInline(scripts: ScriptTag[]): { external: number; inline: number } {
  let external = 0;
  let inline = 0;
  for (const s of scripts) {
    if (s.isInline) inline += 1;
    else external += 1;
  }
  return { external, inline };
}

/** Generate SEO recommendations based on the analysis. */
export function generateRecommendations(analysis: {
  scripts: ScriptTag[];
  domSummary: DomSummary;
  blockingCount: number;
  externalCount: number;
  inlineCount: number;
  missingTitle: boolean;
  missingMetaDescription: boolean;
  missingH1: boolean;
}): Recommendation[] {
  const recs: Recommendation[] = [];

  if (analysis.blockingCount > 0) {
    recs.push({
      code: "RENDER_BLOCKING_HEAD",
      message: `${analysis.blockingCount} render-blocking script(s) in <head> — add 'defer' or move to end of <body>`,
      severity: "critical",
    });
  }

  if (analysis.missingTitle) {
    recs.push({
      code: "MISSING_TITLE",
      message: "No <title> found — ensure JS injects <title> for crawlers before paint",
      severity: "critical",
    });
  }

  if (analysis.missingMetaDescription) {
    recs.push({
      code: "MISSING_META_DESCRIPTION",
      message: "No meta description found — JS should inject meta description for SERP snippets",
      severity: "critical",
    });
  }

  if (analysis.missingH1) {
    recs.push({
      code: "MISSING_H1",
      message: "No <h1> found — ensure JS injects <h1> for content hierarchy",
      severity: "warning",
    });
  }

  if (analysis.externalCount > 5) {
    recs.push({
      code: "TOO_MANY_EXTERNAL",
      message: `${analysis.externalCount} external scripts — bundle scripts to reduce HTTP requests`,
      severity: "warning",
    });
  }

  const externalNoAsyncDefer = analysis.scripts.filter(
    (s) => !s.isInline && !s.async && !s.defer,
  ).length;
  if (externalNoAsyncDefer > 0 && analysis.blockingCount === 0) {
    recs.push({
      code: "EXTERNAL_NO_ASYNC_DEFER",
      message: `${externalNoAsyncDefer} external script(s) without async/defer — add async or defer for non-critical scripts`,
      severity: "warning",
    });
  }

  if (analysis.inlineCount > 0 && analysis.externalCount === 0) {
    recs.push({
      code: "INLINE_ONLY",
      message: `${analysis.inlineCount} inline script(s) only — consider extracting to external cached files`,
      severity: "info",
    });
  }

  if (recs.length === 0) {
    recs.push({
      code: "ALL_GOOD",
      message: "No JS rendering SEO issues detected — keep up the good work",
      severity: "info",
    });
  }

  return recs;
}

/** Compute render score (0-100). Higher = better for SEO. */
export function computeRenderScore(analysis: {
  blockingCount: number;
  missingTitle: boolean;
  missingMetaDescription: boolean;
  missingH1: boolean;
  externalCount: number;
  scripts: ScriptTag[];
}): number {
  let score = 100;
  // -15 per blocking script, max -45
  score -= Math.min(analysis.blockingCount * 15, 45);
  if (analysis.missingTitle) score -= 15;
  if (analysis.missingMetaDescription) score -= 15;
  if (analysis.missingH1) score -= 10;
  if (analysis.externalCount > 5) score -= 5;
  // External scripts without async/defer (and not already counted as blocking in head)
  const externalNoAsyncDefer = analysis.scripts.filter(
    (s) => !s.isInline && !s.async && !s.defer && !s.inHead,
  ).length;
  if (externalNoAsyncDefer > 0) score -= 5;
  return Math.max(0, Math.min(100, score));
}

/** Filter scripts to show blocking-only or all. */
export function filterBlocking(scripts: ScriptTag[], onlyBlocking: boolean): ScriptTag[] {
  if (!onlyBlocking) return scripts;
  return scripts.filter((s) => !s.isInline && !s.async && !s.defer && s.inHead);
}

/** Compute summary stats. */
export function summarizeStats(analysis: RenderAnalysis): SummaryStats {
  const missingCriticalTags =
    (analysis.missingTitle ? 1 : 0) +
    (analysis.missingMetaDescription ? 1 : 0) +
    (analysis.missingH1 ? 1 : 0);
  return {
    totalScripts: analysis.scripts.length,
    externalCount: analysis.externalCount,
    inlineCount: analysis.inlineCount,
    blockingCount: analysis.blockingCount,
    renderScore: analysis.renderScore,
    missingCriticalTags,
  };
}

/** Full analysis pipeline combining HTML + JS file list. */
export function analyzeInputs(html: string, jsList: string): RenderAnalysis {
  const htmlScripts = parseScriptTags(html);
  const fileScripts = parseJsFileList(jsList);
  const scripts = [...htmlScripts, ...fileScripts];
  const domSummary = simulateDom(html);
  const { external, inline } = countExternalInline(scripts);
  const blocking = detectBlockingScripts(scripts);
  const missingTitle = domSummary.title === null;
  const missingMetaDescription = domSummary.metaDescription === null;
  const missingH1 = domSummary.h1Count === 0;

  const partial: RenderAnalysis = {
    scripts,
    domSummary,
    recommendations: [],
    renderScore: 0,
    externalCount: external,
    inlineCount: inline,
    blockingCount: blocking.length,
    missingTitle,
    missingMetaDescription,
    missingH1,
    summary: {
      totalScripts: 0,
      externalCount: 0,
      inlineCount: 0,
      blockingCount: 0,
      renderScore: 0,
      missingCriticalTags: 0,
    },
  };

  partial.recommendations = generateRecommendations(partial);
  partial.renderScore = computeRenderScore(partial);
  partial.summary = summarizeStats(partial);
  return partial;
}

/** Render analysis as a plain-text report. */
export function renderTextReport(analysis: RenderAnalysis): string {
  const lines: string[] = [];
  lines.push("=== JavaScript SEO Render Test ===");
  lines.push("");
  lines.push(`Render score:       ${analysis.renderScore}/100`);
  lines.push(`Total scripts:      ${analysis.summary.totalScripts}`);
  lines.push(`External scripts:   ${analysis.externalCount}`);
  lines.push(`Inline scripts:     ${analysis.inlineCount}`);
  lines.push(`Render-blocking:    ${analysis.blockingCount}`);
  lines.push("");
  lines.push("--- DOM after render simulation ---");
  lines.push(`  <title>:          ${analysis.domSummary.title ?? "(missing)"}`);
  lines.push(`  meta description: ${analysis.domSummary.metaDescription ?? "(missing)"}`);
  lines.push(`  <h1> count:       ${analysis.domSummary.h1Count}`);
  if (analysis.domSummary.h1s.length > 0) {
    for (const h of analysis.domSummary.h1s.slice(0, 3)) {
      lines.push(`    - "${h.slice(0, 80)}"`);
    }
  }
  lines.push(`  <a> link count:   ${analysis.domSummary.linkCount}`);
  lines.push("");
  lines.push("--- Recommendations ---");
  for (const r of analysis.recommendations) {
    lines.push(`  [${r.severity.toUpperCase()}] ${r.code}`);
    lines.push(`    ${r.message}`);
  }
  lines.push("");
  lines.push("--- Script inventory ---");
  if (analysis.scripts.length === 0) {
    lines.push("(no scripts detected)");
  } else {
    for (const s of analysis.scripts) {
      const label = s.isInline
        ? "inline"
        : (s.src ?? "(no src)");
      const flags: string[] = [];
      if (s.inHead) flags.push("head");
      if (s.async) flags.push("async");
      if (s.defer) flags.push("defer");
      if (s.type) flags.push(`type=${s.type}`);
      const blocking = s.inHead && !s.async && !s.defer && !s.isInline ? " [BLOCKING]" : "";
      lines.push(`  ${label} ${flags.length ? `(${flags.join(", ")})` : ""}${blocking}`);
    }
  }
  return lines.join("\n");
}

/** Render scripts as CSV (url, type, blocking, recommendation hint). */
export function renderCsv(scripts: ScriptTag[]): string {
  const lines = ["src,type,location,async,defer,blocking"];
  for (const s of scripts) {
    const blocking = s.inHead && !s.async && !s.defer && !s.isInline ? "yes" : "no";
    const location = s.inHead ? "head" : "body";
    lines.push([
      escapeCsv(s.isInline ? "(inline)" : (s.src ?? "")),
      escapeCsv(s.type ?? ""),
      location,
      s.async ? "yes" : "no",
      s.defer ? "yes" : "no",
      blocking,
    ].join(","));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

export interface HistoryEntry {
  ts: number;
  scriptCount: number;
  blockingCount: number;
  renderScore: number;
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

export function buildShareUrl(html: string, jsList: string): string {
  const params = new URLSearchParams();
  if (html) params.set("html", html);
  if (jsList) params.set("js", jsList);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { html: string; jsList: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { html: "", jsList: "" };
  const params = new URLSearchParams(clean);
  return {
    html: params.get("html") ?? "",
    jsList: params.get("js") ?? "",
  };
}
