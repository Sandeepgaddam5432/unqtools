/**
 * SEO KPI Dashboard Builder — pure logic.
 *
 * Paste KPI data as CSV (`kpi,value,target,date`) and build dashboards
 * with ASCII bar/line charts, status classification, and HTML/markdown/
 * text/CSV exports. Pure functions only — no DOM, no network.
 */

export type KpiStatus = "on-track" | "behind" | "critical" | "no-target";

export type KpiType = "metric" | "timeseries" | "comparison";

export interface KpiRecord {
  kpi: string;
  value: number;
  target: number;
  date: string;
}

export interface TrendInfo {
  direction: "up" | "down" | "flat" | "none";
  pctChange: number; // signed percent
  absChange: number;
  prev: number | null;
}

export interface KpiGroup {
  kpi: string;
  records: KpiRecord[];
  type: KpiType;
  latest: KpiRecord;
  targetProgress: number; // 0..100+ (capped to 100 if target > 0)
  trend: TrendInfo;
  status: KpiStatus;
}

export interface DashboardStats {
  totalKpis: number;
  onTrack: number;
  behind: number;
  critical: number;
  noTarget: number;
  avgProgress: number;
}

export const KPI_TEMPLATES: Record<string, string> = {
  traffic: `Organic Traffic,12500,15000,2026-01
Organic Traffic,13200,15000,2026-02
Organic Traffic,14100,15000,2026-03`,
  rankings: `Keyword Rankings,85,100,2026-01
Keyword Rankings,92,100,2026-02
Keyword Rankings,96,100,2026-03`,
  backlinks: `Backlinks,2400,3000,2026-01
Backlinks,2650,3000,2026-02
Backlinks,2780,3000,2026-03`,
  conversions: `Conversions,420,500,2026-01
Conversions,455,500,2026-02
Conversions,470,500,2026-03`,
  revenue: `Revenue,89000,100000,2026-01
Revenue,94500,100000,2026-02
Revenue,96800,100000,2026-03`,
  "bounce-rate": `Bounce Rate,52,40,2026-01
Bounce Rate,48,40,2026-02
Bounce Rate,45,40,2026-03`,
};

export const TEMPLATE_LABELS: Record<string, string> = {
  traffic: "Organic Traffic",
  rankings: "Keyword Rankings",
  backlinks: "Backlinks",
  conversions: "Conversions",
  revenue: "Revenue",
  "bounce-rate": "Bounce Rate (lower better)",
};

/** Split a CSV row, handling quoted values. */
export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

/** Normalize a KPI name (lowercase + collapse whitespace). */
export function normalizeKpiName(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Format a number for friendly display. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(1) + "k";
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2);
}

const CSV_HEADER_RE = /^(kpi|metric|name)/i;

/** Parse the pasted KPI CSV blob. */
export function parseKpiCsv(input: string): { rows: KpiRecord[]; errors: string[] } {
  if (!input || !input.trim()) return { rows: [], errors: [] };
  const errors: string[] = [];
  const lines = input.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { rows: [], errors: [] };
  const firstLine = lines[0].toLowerCase();
  const hasHeader = CSV_HEADER_RE.test(firstLine);
  let colMap: { kpi: number; value: number; target: number; date: number } | null = null;
  const startIdx = hasHeader ? 1 : 0;
  if (hasHeader) {
    const headers = splitCsvRow(lines[0]).map((h) => h.toLowerCase().trim());
    const kpiIdx = headers.findIndex((h) => h === "kpi" || h === "metric" || h === "name");
    const valueIdx = headers.findIndex((h) => h === "value" || h === "actual");
    const targetIdx = headers.findIndex((h) => h === "target" || h === "goal");
    const dateIdx = headers.findIndex((h) => h === "date" || h === "period" || h === "month");
    if (kpiIdx >= 0 && valueIdx >= 0 && targetIdx >= 0 && dateIdx >= 0) {
      colMap = { kpi: kpiIdx, value: valueIdx, target: targetIdx, date: dateIdx };
    }
  }
  const rows: KpiRecord[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    let kpi: string, valueStr: string, targetStr: string, date: string;
    if (colMap) {
      kpi = normalizeKpiName(cols[colMap.kpi] ?? "");
      valueStr = (cols[colMap.value] ?? "").trim();
      targetStr = (cols[colMap.target] ?? "").trim();
      date = (cols[colMap.date] ?? "").trim();
    } else {
      kpi = normalizeKpiName(cols[0] ?? "");
      valueStr = (cols[1] ?? "").trim();
      targetStr = (cols[2] ?? "").trim();
      date = (cols[3] ?? "").trim();
    }
    if (!kpi) {
      errors.push(`Row ${i + 1}: missing KPI name — skipped`);
      continue;
    }
    const value = parseFloat(valueStr);
    const target = parseFloat(targetStr);
    if (!Number.isFinite(value)) {
      errors.push(`Row ${i + 1}: invalid value "${valueStr}" — skipped`);
      continue;
    }
    if (!Number.isFinite(target)) {
      errors.push(`Row ${i + 1}: invalid target "${targetStr}" — skipped`);
      continue;
    }
    if (!date) {
      errors.push(`Row ${i + 1}: missing date — skipped`);
      continue;
    }
    rows.push({ kpi, value, target, date });
  }
  return { rows, errors };
}

/** Group records by KPI name. */
export function groupKpis(records: KpiRecord[]): Map<string, KpiRecord[]> {
  const out = new Map<string, KpiRecord[]>();
  for (const r of records) {
    if (!out.has(r.kpi)) out.set(r.kpi, []);
    out.get(r.kpi)!.push(r);
  }
  return out;
}

/** Sort records by date ascending. */
export function sortByDate(records: KpiRecord[]): KpiRecord[] {
  return [...records].sort((a, b) => a.date.localeCompare(b.date));
}

/** Get the latest record (highest date). */
export function getLatestValue(records: KpiRecord[]): KpiRecord | null {
  if (records.length === 0) return null;
  const sorted = sortByDate(records);
  return sorted[sorted.length - 1];
}

/** Infer KPI type from records. */
export function inferKpiType(records: KpiRecord[]): KpiType {
  if (records.length === 0) return "metric";
  if (records.length === 1) return "metric";
  const dates = new Set(records.map((r) => r.date));
  if (dates.size > 1) return "timeseries";
  return "comparison";
}

/** Compute target progress as a percentage (0..100+). Capped at 100 for display. */
export function computeTargetProgress(value: number, target: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(target)) return 0;
  if (target <= 0) return 0;
  const pct = (value / target) * 100;
  return Math.round(pct * 10) / 10;
}

/** Compute trend (compared to previous date in a sorted series). */
export function computeTrend(records: KpiRecord[]): TrendInfo {
  if (records.length === 0) {
    return { direction: "none", pctChange: 0, absChange: 0, prev: null };
  }
  const sorted = sortByDate(records);
  if (sorted.length < 2) {
    return { direction: "none", pctChange: 0, absChange: 0, prev: null };
  }
  const prev = sorted[sorted.length - 2].value;
  const latest = sorted[sorted.length - 1].value;
  const absChange = Math.round((latest - prev) * 1000) / 1000;
  let pctChange = 0;
  if (prev !== 0) {
    pctChange = Math.round(((latest - prev) / Math.abs(prev)) * 1000) / 10;
  } else if (latest !== 0) {
    pctChange = latest > 0 ? 100 : -100;
  }
  const direction: TrendInfo["direction"] =
    absChange > 0 ? "up" : absChange < 0 ? "down" : "flat";
  return { direction, pctChange, absChange, prev };
}

/** Classify status based on value vs target. */
export function classifyStatus(value: number, target: number): KpiStatus {
  if (!Number.isFinite(value) || !Number.isFinite(target)) return "no-target";
  if (target === 0) return "no-target";
  const ratio = value / target;
  if (ratio >= 1) return "on-track";
  if (ratio < 0.5) return "critical";
  return "behind";
}

/** Build KPI groups from raw records (full pipeline). */
export function buildKpiGroups(records: KpiRecord[]): KpiGroup[] {
  const grouped = groupKpis(records);
  const out: KpiGroup[] = [];
  for (const [kpi, recs] of grouped) {
    const sorted = sortByDate(recs);
    const latest = sorted[sorted.length - 1];
    const progress = computeTargetProgress(latest.value, latest.target);
    const trend = computeTrend(sorted);
    const status = classifyStatus(latest.value, latest.target);
    out.push({
      kpi,
      records: sorted,
      type: inferKpiType(sorted),
      latest,
      targetProgress: progress,
      trend,
      status,
    });
  }
  out.sort((a, b) => a.kpi.localeCompare(b.kpi));
  return out;
}

/** Filter groups by KPI name substring. */
export function filterByKpi(groups: KpiGroup[], query: string): KpiGroup[] {
  const q = (query || "").toLowerCase().trim();
  if (!q) return groups;
  return groups.filter((g) => g.kpi.includes(q));
}

/** Compute summary stats across all groups. */
export function computeSummaryStats(groups: KpiGroup[]): DashboardStats {
  if (groups.length === 0) {
    return { totalKpis: 0, onTrack: 0, behind: 0, critical: 0, noTarget: 0, avgProgress: 0 };
  }
  let onTrack = 0;
  let behind = 0;
  let critical = 0;
  let noTarget = 0;
  let progressSum = 0;
  for (const g of groups) {
    if (g.status === "on-track") onTrack++;
    else if (g.status === "behind") behind++;
    else if (g.status === "critical") critical++;
    else noTarget++;
    progressSum += g.targetProgress;
  }
  return {
    totalKpis: groups.length,
    onTrack,
    behind,
    critical,
    noTarget,
    avgProgress: Math.round((progressSum / groups.length) * 10) / 10,
  };
}

/** Generate an ASCII bar chart. Width is the number of full-block chars. */
export function generateBarChart(label: string, pct: number, width = 30): string {
  const p = Math.max(0, Math.min(100, pct));
  const filled = Math.round((p / 100) * width);
  const empty = width - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  return `${label.padEnd(20).slice(0, 20)} ${bar} ${p.toFixed(1)}%`;
}

/** Generate an ASCII line chart (text-based, height×width grid). */
export function generateLineChart(
  values: number[],
  width = 10,
  height = 5,
): string {
  if (values.length === 0) return "";
  if (values.length === 1) return `${values[0]}`;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  // Sample points to fit width
  const sampled: number[] = [];
  if (values.length <= width) {
    sampled.push(...values);
    while (sampled.length < width) sampled.push(values[values.length - 1]);
  } else {
    for (let i = 0; i < width; i++) {
      const idx = Math.floor((i / (width - 1)) * (values.length - 1));
      sampled.push(values[idx]);
    }
  }
  // Build grid
  const grid: string[][] = [];
  for (let r = 0; r < height; r++) grid.push(new Array(width).fill(" "));
  for (let c = 0; c < width; c++) {
    const v = sampled[c];
    const normalized = (v - min) / range;
    const row = height - 1 - Math.round(normalized * (height - 1));
    if (row >= 0 && row < height) grid[row][c] = "●";
    if (c > 0) {
      const prevV = sampled[c - 1];
      const prevNorm = (prevV - min) / range;
      const prevRow = height - 1 - Math.round(prevNorm * (height - 1));
      const lo = Math.min(prevRow, row);
      const hi = Math.max(prevRow, row);
      for (let r2 = lo; r2 <= hi; r2++) {
        if (r2 >= 0 && r2 < height && grid[r2][c - 1] === " ") grid[r2][c - 1] = "│";
      }
    }
  }
  const lines = grid.map((row) => row.join(""));
  const header = `min: ${formatNumber(min)} | max: ${formatNumber(max)}`;
  return header + "\n" + lines.join("\n");
}

/** Render a single KPI card (text-based). */
export function renderKpiCard(group: KpiGroup): string {
  const arrow = group.trend.direction === "up" ? "↑" : group.trend.direction === "down" ? "↓" : group.trend.direction === "flat" ? "→" : "·";
  const pct = group.trend.pctChange > 0 ? `+${group.trend.pctChange}%` : `${group.trend.pctChange}%`;
  const statusLabel = group.status.toUpperCase();
  const lines = [
    `┌── ${group.kpi} ${"─".repeat(Math.max(2, 28 - group.kpi.length))}`,
    `│ Value:   ${formatNumber(group.latest.value)}`,
    `│ Target:  ${formatNumber(group.latest.target)}`,
    `│ Progress: ${group.targetProgress.toFixed(1)}%`,
    `│ Trend:   ${arrow} ${pct}`,
    `│ Status:  ${statusLabel}`,
    `│ Date:    ${group.latest.date}`,
    `└${"─".repeat(32)}`,
  ];
  return lines.join("\n");
}

/** Escape a string for CSV. */
function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render the dashboard as text. */
export function renderTextDashboard(groups: KpiGroup[], stats: DashboardStats): string {
  const lines: string[] = [];
  lines.push("=== SEO KPI DASHBOARD ===");
  lines.push(`Total KPIs: ${stats.totalKpis} | On-track: ${stats.onTrack} | Behind: ${stats.behind} | Critical: ${stats.critical} | Avg progress: ${stats.avgProgress}%`);
  lines.push("");
  for (const g of groups) {
    lines.push(renderKpiCard(g));
    lines.push(generateBarChart(g.kpi, g.targetProgress, 30));
    if (g.type === "timeseries" && g.records.length > 1) {
      lines.push(generateLineChart(g.records.map((r) => r.value)));
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Render the dashboard as CSV (kpi, value, target, progress, trend, status). */
export function renderCsvDashboard(groups: KpiGroup[]): string {
  const lines = ["kpi,value,target,progress_pct,trend_direction,trend_pct,status,date"];
  for (const g of groups) {
    lines.push([
      escapeCsv(g.kpi),
      g.latest.value.toString(),
      g.latest.target.toString(),
      g.targetProgress.toFixed(1),
      g.trend.direction,
      g.trend.pctChange.toFixed(1),
      g.status,
      g.latest.date,
    ].join(","));
  }
  return lines.join("\n");
}

/** Escape HTML. */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return c;
    }
  });
}

/** Build a small inline SVG bar for HTML dashboard. */
function svgBar(pct: number, color: string, width = 200, height = 14): string {
  const p = Math.max(0, Math.min(100, pct));
  const filled = (p / 100) * width;
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="progress ${p.toFixed(1)}%"><rect x="0" y="0" width="${width}" height="${height}" fill="#e5e7eb" rx="2"/><rect x="0" y="0" width="${filled}" height="${height}" fill="${color}" rx="2"/></svg>`;
}

/** Build a small inline SVG sparkline. */
function svgSparkline(values: number[], width = 200, height = 36): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="trend"><polyline points="${points}" fill="none" stroke="#3b82f6" stroke-width="1.5"/></svg>`;
}

/** Render the dashboard as HTML with inline CSS (email-friendly). */
export function renderHtmlDashboard(groups: KpiGroup[], stats: DashboardStats): string {
  const colorFor = (s: KpiStatus) =>
    s === "on-track" ? "#10b981" : s === "behind" ? "#f59e0b" : s === "critical" ? "#ef4444" : "#6b7280";
  const cards = groups.map((g) => {
    const trendSym = g.trend.direction === "up" ? "▲" : g.trend.direction === "down" ? "▼" : g.trend.direction === "flat" ? "■" : "·";
    const trendPct = g.trend.pctChange > 0 ? `+${g.trend.pctChange}%` : `${g.trend.pctChange}%`;
    const spark = g.type === "timeseries" && g.records.length > 1
      ? `<div style="margin-top:8px">${svgSparkline(g.records.map((r) => r.value))}</div>`
      : "";
    return `
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin-bottom:12px;font-family:Arial,Helvetica,sans-serif">
      <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:6px">${escapeHtml(g.kpi)}</div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#374151;margin-bottom:6px">
        <span>Value: <strong>${escapeHtml(formatNumber(g.latest.value))}</strong></span>
        <span>Target: ${escapeHtml(formatNumber(g.latest.target))}</span>
        <span>Trend: ${trendSym} ${trendPct}</span>
      </div>
      <div style="margin-bottom:6px">${svgBar(g.targetProgress, colorFor(g.status))}</div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#6b7280">
        <span>Progress: ${g.targetProgress.toFixed(1)}%</span>
        <span style="color:${colorFor(g.status)};font-weight:700">${g.status.toUpperCase()}</span>
        <span>Date: ${escapeHtml(g.latest.date)}</span>
      </div>
      ${spark}
    </div>`;
  }).join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SEO KPI Dashboard</title>
</head>
<body style="margin:0;padding:16px;background:#f9fafb;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:720px;margin:0 auto">
    <h1 style="font-size:20px;color:#111827;margin:0 0 12px">SEO KPI Dashboard</h1>
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:14px;font-size:12px;color:#374151">
      <strong>${stats.totalKpis}</strong> KPIs ·
      <span style="color:#10b981">${stats.onTrack} on-track</span> ·
      <span style="color:#f59e0b">${stats.behind} behind</span> ·
      <span style="color:#ef4444">${stats.critical} critical</span> ·
      avg progress <strong>${stats.avgProgress}%</strong>
    </div>
    ${cards}
    <p style="font-size:11px;color:#9ca3af;margin-top:16px">Generated by UnQTools — 100% client-side.</p>
  </div>
</body>
</html>`;
}

/** Render the dashboard as Markdown. */
export function renderMarkdownDashboard(groups: KpiGroup[], stats: DashboardStats): string {
  const lines: string[] = [];
  lines.push("# SEO KPI Dashboard");
  lines.push("");
  lines.push(`- **Total KPIs:** ${stats.totalKpis}`);
  lines.push(`- **On-track:** ${stats.onTrack}`);
  lines.push(`- **Behind:** ${stats.behind}`);
  lines.push(`- **Critical:** ${stats.critical}`);
  lines.push(`- **Average progress:** ${stats.avgProgress}%`);
  lines.push("");
  lines.push("## KPI Summary");
  lines.push("");
  lines.push("| KPI | Value | Target | Progress | Trend | Status | Date |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const g of groups) {
    const arrow = g.trend.direction === "up" ? "↑" : g.trend.direction === "down" ? "↓" : g.trend.direction === "flat" ? "→" : "·";
    const pct = g.trend.pctChange > 0 ? `+${g.trend.pctChange}%` : `${g.trend.pctChange}%`;
    lines.push(`| ${g.kpi} | ${formatNumber(g.latest.value)} | ${formatNumber(g.latest.target)} | ${g.targetProgress.toFixed(1)}% | ${arrow} ${pct} | ${g.status} | ${g.latest.date} |`);
  }
  lines.push("");
  for (const g of groups) {
    if (g.type === "timeseries" && g.records.length > 1) {
      lines.push(`## ${g.kpi} — Trend`);
      lines.push("");
      lines.push("```");
      lines.push(generateLineChart(g.records.map((r) => r.value)));
      lines.push("```");
      lines.push("");
    }
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:seo-kpi-dashboard-builder:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  totalKpis: number;
  onTrack: number;
  critical: number;
  avgProgress: number;
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

export function buildShareUrl(data: string): string {
  const params = new URLSearchParams();
  if (data) params.set("data", data);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { data: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { data: "" };
  const params = new URLSearchParams(clean);
  return { data: params.get("data") ?? "" };
}
