/**
 * SEO Report Generator — pure logic.
 *
 * Generate white-label SEO audit reports in markdown, HTML, or text.
 * Pure functions only — no DOM, no network.
 */

export type ReportFormat = "markdown" | "html" | "text";

export const REPORT_FORMATS: ReportFormat[] = ["markdown", "html", "text"];

export const REPORT_FORMAT_LABELS: Record<ReportFormat, string> = {
  markdown: "Markdown (.md)",
  html: "HTML (.html)",
  text: "Text (.txt)",
};

export type SectionId =
  | "executive-summary"
  | "technical-seo"
  | "on-page-seo"
  | "content-analysis"
  | "backlink-profile"
  | "keyword-rankings"
  | "competitor-analysis"
  | "recommendations";

export const ALL_SECTIONS: SectionId[] = [
  "executive-summary",
  "technical-seo",
  "on-page-seo",
  "content-analysis",
  "backlink-profile",
  "keyword-rankings",
  "competitor-analysis",
  "recommendations",
];

export const SECTION_LABELS: Record<SectionId, string> = {
  "executive-summary": "Executive Summary",
  "technical-seo": "Technical SEO",
  "on-page-seo": "On-Page SEO",
  "content-analysis": "Content Analysis",
  "backlink-profile": "Backlink Profile",
  "keyword-rankings": "Keyword Rankings",
  "competitor-analysis": "Competitor Analysis",
  "recommendations": "Recommendations",
};

export interface ReportInput {
  clientName: string;
  websiteUrl: string;
  auditDate: string; // YYYY-MM-DD
  auditorName: string;
  reportFormat: ReportFormat;
  sectionsToInclude: SectionId[];
  executiveSummary: string;
  technicalSeoScore: string; // 0-100
  onPageSeoScore: string;
  contentScore: string;
  backlinkScore: string;
  keywordRankings: string; // CSV: keyword,position,url
  topRecommendations: string; // one per line
  competitorUrls: string; // one per line
}

export function defaultInput(): ReportInput {
  return {
    clientName: "",
    websiteUrl: "",
    auditDate: "",
    auditorName: "",
    reportFormat: "markdown",
    sectionsToInclude: [...ALL_SECTIONS],
    executiveSummary: "",
    technicalSeoScore: "",
    onPageSeoScore: "",
    contentScore: "",
    backlinkScore: "",
    keywordRankings: "",
    topRecommendations: "",
    competitorUrls: "",
  };
}

export interface ScoreInfo {
  value: number | null;
  label: string;
  color: "excellent" | "good" | "needs-improvement" | "poor" | "none";
}

/** Compute the label/color for a 0-100 score. */
export function scoreInfo(s: string): ScoreInfo {
  if (s === "" || s === undefined || s === null) {
    return { value: null, label: "Not provided", color: "none" };
  }
  const n = Number(s);
  if (isNaN(n) || !isFinite(n)) {
    return { value: null, label: "Not provided", color: "none" };
  }
  if (n >= 90) return { value: n, label: "Excellent", color: "excellent" };
  if (n >= 75) return { value: n, label: "Good", color: "good" };
  if (n >= 60) return { value: n, label: "Needs Improvement", color: "needs-improvement" };
  return { value: n, label: "Poor", color: "poor" };
}

export const SCORE_COLOR_HEX: Record<ScoreInfo["color"], string> = {
  excellent: "#16a34a",
  good: "#2563eb",
  "needs-improvement": "#d97706",
  poor: "#dc2626",
  none: "#6b7280",
};

export const SCORE_COLOR_NAME: Record<ScoreInfo["color"], string> = {
  excellent: "green",
  good: "blue",
  "needs-improvement": "amber",
  poor: "red",
  none: "gray",
};

/** Weighted overall score: technical 25, on-page 25, content 20, backlinks 30. */
export function computeOverallScore(input: ReportInput): number | null {
  const weights: { field: keyof ReportInput; weight: number }[] = [
    { field: "technicalSeoScore", weight: 0.25 },
    { field: "onPageSeoScore", weight: 0.25 },
    { field: "contentScore", weight: 0.20 },
    { field: "backlinkScore", weight: 0.30 },
  ];
  let totalWeight = 0;
  let weightedSum = 0;
  for (const { field, weight } of weights) {
    const v = input[field];
    if (v === "" || v === undefined) continue;
    const n = Number(v);
    if (!isNaN(n) && isFinite(n)) {
      weightedSum += n * weight;
      totalWeight += weight;
    }
  }
  if (totalWeight === 0) return null;
  // Normalize: divide by totalWeight in case not all scores provided
  const score = weightedSum / totalWeight;
  return Math.round(score * 10) / 10;
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

export function isValidDate(d: string): boolean {
  if (!d) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const dt = new Date(d + "T00:00:00Z");
  return !isNaN(dt.getTime());
}

export function isValidScore(s: string): boolean {
  if (s === "") return true; // empty is allowed (not provided)
  const n = Number(s);
  return !isNaN(n) && isFinite(n) && n >= 0 && n <= 100;
}

export interface ValidationIssue {
  field: string;
  message: string;
  level: "error" | "warning";
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  issues: ValidationIssue[];
}

export function validate(input: ReportInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const issues: ValidationIssue[] = [];

  if (!input.clientName.trim()) {
    const m = "Client name is required";
    errors.push(m); issues.push({ field: "clientName", message: m, level: "error" });
  }
  if (!input.websiteUrl.trim()) {
    const m = "Website URL is required";
    errors.push(m); issues.push({ field: "websiteUrl", message: m, level: "error" });
  } else if (!isValidUrl(input.websiteUrl)) {
    const m = "Website URL must be a valid http(s) URL";
    errors.push(m); issues.push({ field: "websiteUrl", message: m, level: "error" });
  }
  if (!input.auditDate.trim()) {
    const m = "Audit date is required";
    errors.push(m); issues.push({ field: "auditDate", message: m, level: "error" });
  } else if (!isValidDate(input.auditDate)) {
    const m = "Audit date must be YYYY-MM-DD";
    errors.push(m); issues.push({ field: "auditDate", message: m, level: "error" });
  }
  if (!input.auditorName.trim()) {
    const m = "Auditor name is required";
    errors.push(m); issues.push({ field: "auditorName", message: m, level: "error" });
  }
  if (input.sectionsToInclude.length === 0) {
    const m = "Select at least one section";
    errors.push(m); issues.push({ field: "sectionsToInclude", message: m, level: "error" });
  }

  // Score validations (must be 0-100 if provided)
  for (const field of ["technicalSeoScore", "onPageSeoScore", "contentScore", "backlinkScore"] as const) {
    if (!isValidScore(input[field])) {
      const m = `${field} must be 0-100`;
      errors.push(m); issues.push({ field, message: m, level: "error" });
    }
  }

  // Warnings
  if (!input.executiveSummary.trim()) {
    const m = "Executive summary is empty — consider adding a brief overview";
    warnings.push(m); issues.push({ field: "executiveSummary", message: m, level: "warning" });
  }
  if (!input.topRecommendations.trim()) {
    const m = "No recommendations provided — adding actionable items improves report value";
    warnings.push(m); issues.push({ field: "topRecommendations", message: m, level: "warning" });
  }
  if (!input.keywordRankings.trim() && input.sectionsToInclude.includes("keyword-rankings")) {
    const m = "Keyword rankings section included but no CSV provided";
    warnings.push(m); issues.push({ field: "keywordRankings", message: m, level: "warning" });
  }
  if (!input.competitorUrls.trim() && input.sectionsToInclude.includes("competitor-analysis")) {
    const m = "Competitor analysis section included but no competitor URLs provided";
    warnings.push(m); issues.push({ field: "competitorUrls", message: m, level: "warning" });
  }

  return { ok: errors.length === 0, errors, warnings, issues };
}

// ---- Parsing helpers ----

export interface KeywordRow {
  keyword: string;
  position: string;
  url: string;
}

/** Parse `keyword,position,url` lines into rows. */
export function parseKeywordRankings(csv: string): KeywordRow[] {
  if (!csv || !csv.trim()) return [];
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: KeywordRow[] = [];
  for (const line of lines) {
    // Skip header
    if (/^keyword/i.test(line) && /position/i.test(line)) continue;
    const parts = splitCsvRow(line);
    if (parts.length === 0) continue;
    rows.push({
      keyword: parts[0] ?? "",
      position: parts[1] ?? "",
      url: parts[2] ?? "",
    });
  }
  return rows;
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

/** Parse one-per-line text into trimmed items. */
export function parseLines(input: string): string[] {
  if (!input) return [];
  return input.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

// ---- Cover page ----

export function buildCoverPage(input: ReportInput, format: ReportFormat): string {
  const dateStr = input.auditDate || "—";
  const lines = [
    `Client: ${input.clientName}`,
    `Website: ${input.websiteUrl}`,
    `Audit Date: ${dateStr}`,
    `Auditor: ${input.auditorName}`,
  ];
  if (format === "markdown") {
    return [
      `# SEO Audit Report`,
      "",
      `**${input.clientName}**`,
      "",
      ...lines.map((l) => `- ${l}`),
    ].join("\n");
  }
  if (format === "html") {
    return [
      `<h1 style="margin:0 0 8px 0;">SEO Audit Report</h1>`,
      `<p style="margin:0 0 12px 0;font-size:18px;color:#111827;"><strong>${escapeHtml(input.clientName)}</strong></p>`,
      `<table style="border-collapse:collapse;font-size:14px;">`,
      ...lines.map((l) => {
        const [k, ...rest] = l.split(": ");
        return `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-weight:600;">${escapeHtml(k)}</td><td style="padding:4px 0;">${escapeHtml(rest.join(": "))}</td></tr>`;
      }),
      `</table>`,
    ].join("\n");
  }
  // text
  const bar = "=".repeat(50);
  return [
    bar,
    "SEO AUDIT REPORT".padEnd(50),
    bar,
    "",
    ...lines,
    "",
    bar,
  ].join("\n");
}

// ---- Table of contents ----

export function buildToc(input: ReportInput, format: ReportFormat): string {
  const sections = input.sectionsToInclude;
  if (sections.length === 0) return "";
  if (format === "markdown") {
    const lines = ["## Table of Contents", ""];
    sections.forEach((s, i) => {
      const anchor = s;
      lines.push(`${i + 1}. [${SECTION_LABELS[s]}](#${anchor})`);
    });
    return lines.join("\n");
  }
  if (format === "html") {
    const items = sections
      .map((s, i) => `<li style="margin:4px 0;"><a href="#${s}" style="color:#2563eb;text-decoration:none;">${i + 1}. ${escapeHtml(SECTION_LABELS[s])}</a></li>`)
      .join("\n");
    return `<h2 style="margin:24px 0 8px 0;">Table of Contents</h2>\n<ul style="padding-left:20px;">\n${items}\n</ul>`;
  }
  const lines = ["Table of Contents", "-----------------"];
  sections.forEach((s, i) => {
    lines.push(`${i + 1}. ${SECTION_LABELS[s]}`);
  });
  return lines.join("\n");
}

// ---- Section renderers ----

export function renderExecutiveSummary(input: ReportInput, format: ReportFormat): string {
  const overall = computeOverallScore(input);
  const overallLabel = overall !== null ? scoreInfo(String(overall)).label : "Not available";
  const summary = input.executiveSummary.trim() ||
    `This SEO audit report evaluates the online presence of ${input.clientName} (${input.websiteUrl}). The overall score is ${overall ?? "—"} (${overallLabel}), based on technical SEO, on-page SEO, content, and backlink analysis. Key findings and prioritized recommendations are detailed in the sections below.`;
  return renderSection("executive-summary", "Executive Summary", [
    summary,
    "",
    `**Overall Score:** ${overall ?? "—"} / 100 — ${overallLabel}`,
  ], format);
}

export function renderTechnicalSeo(input: ReportInput, format: ReportFormat): string {
  const score = scoreInfo(input.technicalSeoScore);
  const v = score.value ?? "—";
  const bullets = [
    `Technical SEO Score: ${v} / 100 — ${score.label}`,
    `Site speed, mobile-friendliness, indexability, and HTTPS implementation should be reviewed.`,
    `Run PageSpeed Insights and the Lighthouse audit for detailed Core Web Vitals metrics.`,
    `Ensure XML sitemap and robots.txt are accessible and properly configured.`,
    `Verify canonical tags and structured data are correctly implemented.`,
  ];
  return renderScoreSection("technical-seo", "Technical SEO", bullets, format);
}

export function renderOnPageSeo(input: ReportInput, format: ReportFormat): string {
  const score = scoreInfo(input.onPageSeoScore);
  const v = score.value ?? "—";
  const bullets = [
    `On-Page SEO Score: ${v} / 100 — ${score.label}`,
    `Title tags should be 50-60 characters and include the primary keyword.`,
    `Meta descriptions should be 150-160 characters with a compelling CTA.`,
    `Headings (H1, H2, H3) should follow a logical hierarchy.`,
    `URLs should be short, descriptive, and keyword-rich.`,
  ];
  return renderScoreSection("on-page-seo", "On-Page SEO", bullets, format);
}

export function renderContentAnalysis(input: ReportInput, format: ReportFormat): string {
  const score = scoreInfo(input.contentScore);
  const v = score.value ?? "—";
  const bullets = [
    `Content Score: ${v} / 100 — ${score.label}`,
    `Evaluate content depth, relevance, and uniqueness across the site.`,
    `Identify thin content pages (< 300 words) for expansion or consolidation.`,
    `Check keyword optimization and semantic relevance using TF-IDF analysis.`,
    `Assess readability (Flesch Reading Ease) and content structure.`,
  ];
  return renderScoreSection("content-analysis", "Content Analysis", bullets, format);
}

export function renderBacklinkProfile(input: ReportInput, format: ReportFormat): string {
  const score = scoreInfo(input.backlinkScore);
  const v = score.value ?? "—";
  const bullets = [
    `Backlink Score: ${v} / 100 — ${score.label}`,
    `Analyze referring domains, anchor text distribution, and link quality.`,
    `Identify toxic links for disavow consideration via Google Search Console.`,
    `Compare backlink growth against industry benchmarks.`,
    `Prioritize high-authority link-building opportunities.`,
  ];
  return renderScoreSection("backlink-profile", "Backlink Profile", bullets, format);
}

export function renderKeywordRankings(input: ReportInput, format: ReportFormat): string {
  const rows = parseKeywordRankings(input.keywordRankings);
  if (format === "markdown") {
    const lines = [
      `## Keyword Rankings`,
      "",
    ];
    if (rows.length === 0) {
      lines.push("_No keyword rankings provided._");
    } else {
      lines.push("| # | Keyword | Position | URL |", "| --- | --- | --- | --- |");
      rows.forEach((r, i) => {
        lines.push(`| ${i + 1} | ${escapeMd(r.keyword)} | ${escapeMd(r.position)} | ${escapeMd(r.url)} |`);
      });
    }
    return lines.join("\n");
  }
  if (format === "html") {
    if (rows.length === 0) {
      return `<h2 id="keyword-rankings">Keyword Rankings</h2>\n<p style="color:#6b7280;font-style:italic;">No keyword rankings provided.</p>`;
    }
    const head = `<tr><th style="padding:6px 12px;border:1px solid #e5e7eb;text-align:left;background:#f9fafb;">#</th><th style="padding:6px 12px;border:1px solid #e5e7eb;text-align:left;background:#f9fafb;">Keyword</th><th style="padding:6px 12px;border:1px solid #e5e7eb;text-align:left;background:#f9fafb;">Position</th><th style="padding:6px 12px;border:1px solid #e5e7eb;text-align:left;background:#f9fafb;">URL</th></tr>`;
    const body = rows.map((r, i) =>
      `<tr><td style="padding:6px 12px;border:1px solid #e5e7eb;">${i + 1}</td><td style="padding:6px 12px;border:1px solid #e5e7eb;">${escapeHtml(r.keyword)}</td><td style="padding:6px 12px;border:1px solid #e5e7eb;">${escapeHtml(r.position)}</td><td style="padding:6px 12px;border:1px solid #e5e7eb;"><a href="${escapeHtml(r.url)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(r.url)}</a></td></tr>`
    ).join("\n");
    return `<h2 id="keyword-rankings">Keyword Rankings</h2>\n<table style="border-collapse:collapse;font-size:14px;width:100%;">\n${head}\n${body}\n</table>`;
  }
  // text
  const lines = ["Keyword Rankings", "-----------------"];
  if (rows.length === 0) {
    lines.push("(No keyword rankings provided.)");
  } else {
    rows.forEach((r, i) => {
      lines.push(`${i + 1}. ${r.keyword} — Position: ${r.position} — ${r.url}`);
    });
  }
  return lines.join("\n");
}

export function renderCompetitorAnalysis(input: ReportInput, format: ReportFormat): string {
  const urls = parseLines(input.competitorUrls);
  if (format === "markdown") {
    const lines = [`## Competitor Analysis`, ""];
    if (urls.length === 0) {
      lines.push("_No competitors provided._");
    } else {
      urls.forEach((u, i) => lines.push(`${i + 1}. ${u}`));
      lines.push("", `Total competitors analyzed: ${urls.length}`);
    }
    return lines.join("\n");
  }
  if (format === "html") {
    if (urls.length === 0) {
      return `<h2 id="competitor-analysis">Competitor Analysis</h2>\n<p style="color:#6b7280;font-style:italic;">No competitors provided.</p>`;
    }
    const items = urls.map((u, i) => `<li style="margin:4px 0;"><a href="${escapeHtml(u)}" style="color:#2563eb;text-decoration:none;">${i + 1}. ${escapeHtml(u)}</a></li>`).join("\n");
    return `<h2 id="competitor-analysis">Competitor Analysis</h2>\n<ul style="padding-left:20px;">\n${items}\n</ul>\n<p style="margin:8px 0 0 0;color:#6b7280;font-size:13px;">Total competitors analyzed: ${urls.length}</p>`;
  }
  const lines = ["Competitor Analysis", "-------------------"];
  if (urls.length === 0) {
    lines.push("(No competitors provided.)");
  } else {
    urls.forEach((u, i) => lines.push(`${i + 1}. ${u}`));
    lines.push("", `Total competitors analyzed: ${urls.length}`);
  }
  return lines.join("\n");
}

export function renderRecommendations(input: ReportInput, format: ReportFormat): string {
  const items = parseLines(input.topRecommendations);
  if (format === "markdown") {
    const lines = [`## Recommendations`, ""];
    if (items.length === 0) {
      lines.push("_No recommendations provided._");
    } else {
      items.forEach((r, i) => lines.push(`${i + 1}. **[Priority ${items.length - i}]** ${r}`));
    }
    return lines.join("\n");
  }
  if (format === "html") {
    if (items.length === 0) {
      return `<h2 id="recommendations">Recommendations</h2>\n<p style="color:#6b7280;font-style:italic;">No recommendations provided.</p>`;
    }
    const lis = items.map((r, i) => `<li style="margin:6px 0;"><strong>[Priority ${items.length - i}]</strong> ${escapeHtml(r)}</li>`).join("\n");
    return `<h2 id="recommendations">Recommendations</h2>\n<ol style="padding-left:20px;">\n${lis}\n</ol>`;
  }
  const lines = ["Recommendations", "---------------"];
  if (items.length === 0) {
    lines.push("(No recommendations provided.)");
  } else {
    items.forEach((r, i) => lines.push(`${i + 1}. [Priority ${items.length - i}] ${r}`));
  }
  return lines.join("\n");
}

function renderSection(
  id: SectionId,
  title: string,
  lines: string[],
  format: ReportFormat,
): string {
  if (format === "markdown") {
    return [`## ${title}`, "", ...lines].join("\n");
  }
  if (format === "html") {
    const body = lines
      .map((l) => {
        const m = l.match(/^\*\*(.+?):\*\*\s*(.*)$/);
        if (m) {
          return `<p style="margin:6px 0;"><strong>${escapeHtml(m[1])}:</strong> ${escapeHtml(m[2])}</p>`;
        }
        if (l.trim() === "") return "";
        return `<p style="margin:6px 0;">${escapeHtml(l)}</p>`;
      })
      .filter(Boolean)
      .join("\n");
    return `<h2 id="${id}">${escapeHtml(title)}</h2>\n${body}`;
  }
  const bar = "-".repeat(title.length);
  return [title, bar, ...lines].join("\n");
}

function renderScoreSection(
  id: SectionId,
  title: string,
  bullets: string[],
  format: ReportFormat,
): string {
  if (format === "markdown") {
    return [`## ${title}`, "", ...bullets.map((b) => `- ${b}`)].join("\n");
  }
  if (format === "html") {
    const items = bullets.map((b) => `<li style="margin:4px 0;">${escapeHtml(b)}</li>`).join("\n");
    return `<h2 id="${id}">${escapeHtml(title)}</h2>\n<ul style="padding-left:20px;">\n${items}\n</ul>`;
  }
  const bar = "-".repeat(title.length);
  return [title, bar, ...bullets.map((b) => `  • ${b}`)].join("\n");
}

// ---- Main report generator ----

export function generateReport(input: ReportInput): string {
  const v = validate(input);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const format = input.reportFormat;

  const parts: string[] = [];
  parts.push(buildCoverPage(input, format));
  parts.push("");
  parts.push(buildToc(input, format));
  parts.push("");

  for (const section of input.sectionsToInclude) {
    let body = "";
    switch (section) {
      case "executive-summary": body = renderExecutiveSummary(input, format); break;
      case "technical-seo": body = renderTechnicalSeo(input, format); break;
      case "on-page-seo": body = renderOnPageSeo(input, format); break;
      case "content-analysis": body = renderContentAnalysis(input, format); break;
      case "backlink-profile": body = renderBacklinkProfile(input, format); break;
      case "keyword-rankings": body = renderKeywordRankings(input, format); break;
      case "competitor-analysis": body = renderCompetitorAnalysis(input, format); break;
      case "recommendations": body = renderRecommendations(input, format); break;
    }
    parts.push(body);
    parts.push("");
  }

  if (format === "html") {
    return wrapHtml(parts.join("\n"), input);
  }
  return parts.join("\n").trim() + "\n";
}

function wrapHtml(body: string, input: ReportInput): string {
  const overall = computeOverallScore(input);
  const overallInfo = overall !== null ? scoreInfo(String(overall)) : null;
  const scoreBadge = overallInfo
    ? `<div style="background:${SCORE_COLOR_HEX[overallInfo.color]};color:#fff;padding:8px 16px;border-radius:6px;display:inline-block;font-weight:600;margin:8px 0 16px 0;">Overall Score: ${overall} / 100 — ${overallInfo.label}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SEO Audit Report — ${escapeHtml(input.clientName)}</title>
</head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;color:#111827;background:#ffffff;max-width:800px;margin:0 auto;">
<div style="background:#f9fafb;padding:24px;border-radius:8px;margin-bottom:24px;border:1px solid #e5e7eb;">
${body.split("\n").filter((l) => l.startsWith("<h1") || l.startsWith("<p") || l.startsWith("<table")).slice(0, 4).join("\n")}
${scoreBadge}
</div>
${body}
<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;">Generated by UnQTools SEO Report Generator on ${input.auditDate || "—"}. Auditor: ${escapeHtml(input.auditorName)}.</p>
</body>
</html>`;
}

// ---- Summary stats ----

export interface SummaryStats {
  totalSections: number;
  selectedSections: number;
  overallScore: number | null;
  overallLabel: string;
  overallColor: ScoreInfo["color"];
  scoresProvided: number;
  scoresTotal: number;
  keywordCount: number;
  competitorCount: number;
  recommendationCount: number;
}

export function computeSummaryStats(input: ReportInput): SummaryStats {
  const overall = computeOverallScore(input);
  const overallInfo = overall !== null ? scoreInfo(String(overall)) : { label: "Not available", color: "none" as const };
  const scores = ["technicalSeoScore", "onPageSeoScore", "contentScore", "backlinkScore"] as const;
  const scoresProvided = scores.filter((s) => input[s] !== "" && input[s] !== undefined).length;
  return {
    totalSections: ALL_SECTIONS.length,
    selectedSections: input.sectionsToInclude.length,
    overallScore: overall,
    overallLabel: overallInfo.label,
    overallColor: overallInfo.color,
    scoresProvided,
    scoresTotal: scores.length,
    keywordCount: parseKeywordRankings(input.keywordRankings).length,
    competitorCount: parseLines(input.competitorUrls).length,
    recommendationCount: parseLines(input.topRecommendations).length,
  };
}

// ---- History ----

const HISTORY_KEY = "unqtools:seo-report-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  clientName: string;
  websiteUrl: string;
  auditDate: string;
  format: ReportFormat;
  sectionsCount: number;
  overallScore: number | null;
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
// Excludes long text fields (executiveSummary, keywordRankings, topRecommendations, competitorUrls)
// to keep URL length manageable.

export function buildShareUrl(input: Partial<ReportInput>): string {
  const params = new URLSearchParams();
  const shortFields: (keyof ReportInput)[] = [
    "clientName", "websiteUrl", "auditDate", "auditorName",
    "reportFormat", "technicalSeoScore", "onPageSeoScore",
    "contentScore", "backlinkScore",
  ];
  for (const f of shortFields) {
    const v = input[f];
    if (v === undefined || v === null || v === "") continue;
    params.set(f, String(v));
  }
  if (input.sectionsToInclude && input.sectionsToInclude.length > 0) {
    params.set("sections", input.sectionsToInclude.join(","));
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ReportInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ReportInput> = {};
  const validFormats = REPORT_FORMATS as readonly string[];
  const validSections = ALL_SECTIONS as readonly string[];
  for (const [k, v] of params.entries()) {
    if (k === "reportFormat") {
      if (validFormats.includes(v)) out.reportFormat = v as ReportFormat;
    } else if (k === "sections") {
      const sections = v.split(",").filter((s) => validSections.includes(s)) as SectionId[];
      if (sections.length > 0) out.sectionsToInclude = sections;
    } else {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

// ---- HTML escaping ----

function escapeHtml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeMd(s: string): string {
  return (s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}
