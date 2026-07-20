/**
 * AI Product Feature Prioritization Helper (RICE) — pure logic.
 *
 * Scores and ranks a feature backlog using four frameworks:
 *   1. RICE  — (Reach × Impact × Confidence) ÷ Effort
 *   2. ICE    — Impact × Confidence × Ease
 *   3. MoSCoW — Must / Should / Could / Won't
 *   4. WSJF   — Cost of Delay ÷ Job Size
 *
 * Capabilities:
 *   - Auto-ranking + sortable table.
 *   - Sensitivity analysis — vary any R/I/C/E field and detect rank-order changes.
 *   - Divide-by-zero guard for zero/low effort.
 *   - Aggregate stats (avg score, top/bottom feature, total effort).
 *   - CSV / Markdown / JSON export.
 *   - History (localStorage, last 20) + shareable URL with full backlog encoded.
 *   - Optional BYO-key LLM AI-assist that drafts R/I/C/E from a description.
 *
 * Pure functions only — no DOM, no network. The optional LLM call (BYO API key)
 * lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type Framework = "rice" | "ice" | "moscow" | "wsjf";

export type Impact = 0.25 | 0.5 | 1 | 2 | 3;

export type MoscowCategory = "must" | "should" | "could" | "wont";

export type SortKey = "rank" | "name" | "rice" | "ice" | "wsjf" | "effort" | "reach" | "impact" | "confidence";

export type SortDir = "asc" | "desc";

export interface Feature {
  id: string;
  name: string;
  description: string;
  reach: number;        // people affected per period
  impact: Impact;       // 0.25 / 0.5 / 1 / 2 / 3
  confidence: number;   // 0–100 (%)
  effort: number;       // person-weeks (or any consistent unit)
  moscow: MoscowCategory;
  costOfDelay: number;  // for WSJF (value + urgency + risk reduction)
  jobSize: number;      // for WSJF (similar to effort, but separate to allow independence)
}

export interface ScoredFeature {
  feature: Feature;
  rice: number;
  ice: number;
  wsjf: number;
  rank: number;         // rank within the active framework (1 = highest)
}

export interface AggregateStats {
  count: number;
  avgRice: number;
  avgIce: number;
  avgWsjf: number;
  totalEffort: number;
  topFeature: string | null;
  bottomFeature: string | null;
  mustCount: number;
  shouldCount: number;
  couldCount: number;
  wontCount: number;
}

export interface SensitivityResult {
  field: "reach" | "impact" | "confidence" | "effort";
  baseRankOrder: string[];     // feature names in base rank order
  variations: { value: number; rankOrder: string[]; changed: boolean }[];
}

export interface HistoryEntry {
  ts: number;
  framework: Framework;
  featureCount: number;
  topFeature: string | null;
  avgRice: number;
}

// ---------- Constants ----------

export const HISTORY_MAX = 20;

export const FRAMEWORKS: { value: Framework; label: string; formula: string }[] = [
  { value: "rice", label: "RICE", formula: "(Reach × Impact × Confidence) ÷ Effort" },
  { value: "ice", label: "ICE", formula: "Impact × Confidence × Ease" },
  { value: "moscow", label: "MoSCoW", formula: "Must / Should / Could / Won't" },
  { value: "wsjf", label: "WSJF", formula: "Cost of Delay ÷ Job Size" },
];

export const IMPACT_VALUES: { value: Impact; label: string }[] = [
  { value: 0.25, label: "0.25 — Minimal" },
  { value: 0.5, label: "0.5 — Low" },
  { value: 1, label: "1 — Medium" },
  { value: 2, label: "2 — High" },
  { value: 3, label: "3 — Massive" },
];

export const CONFIDENCE_PRESETS: number[] = [50, 80, 100];

export const MOSCOW_CATEGORIES: { value: MoscowCategory; label: string; color: string }[] = [
  { value: "must", label: "Must have", color: "red" },
  { value: "should", label: "Should have", color: "amber" },
  { value: "could", label: "Could have", color: "blue" },
  { value: "wont", label: "Won't have (this time)", color: "gray" },
];

export const MOSCOW_RANK: Record<MoscowCategory, number> = {
  must: 0, should: 1, could: 2, wont: 3,
};

export const SENSITIVITY_FIELDS: { value: "reach" | "impact" | "confidence" | "effort"; label: string }[] = [
  { value: "reach", label: "Reach" },
  { value: "impact", label: "Impact" },
  { value: "confidence", label: "Confidence (%)" },
  { value: "effort", label: "Effort" },
];

export const HONESTY_NOTES: string[] = [
  "RICE (and ICE/MoSCoW/WSJF) is a decision aid, not truth. Inputs are estimates and can be subjective or gamed — a known RICE drawback.",
  "Use the scores to structure discussion, not replace judgment.",
  "AI-drafted scores are starting points you must review before committing to a roadmap.",
  "Nothing is uploaded or logged by us — your backlog stays on this device.",
];

export const SAMPLE_BACKLOGS: { label: string; features: Feature[] }[] = [
  {
    label: "SaaS feature backlog (5)",
    features: [
      {
        id: "f1", name: "Dark mode", description: "Toggle dark theme across the app.",
        reach: 5000, impact: 0.5, confidence: 100, effort: 3,
        moscow: "should", costOfDelay: 8, jobSize: 3,
      },
      {
        id: "f2", name: "Single sign-on (SSO)", description: "SAML + OIDC for enterprise accounts.",
        reach: 200, impact: 3, confidence: 80, effort: 8,
        moscow: "must", costOfDelay: 20, jobSize: 8,
      },
      {
        id: "f3", name: "Bulk CSV import", description: "Import 10k rows with validation.",
        reach: 800, impact: 1, confidence: 100, effort: 5,
        moscow: "should", costOfDelay: 10, jobSize: 5,
      },
      {
        id: "f4", name: "Onboarding tour", description: "5-step product tour for new users.",
        reach: 3000, impact: 1, confidence: 80, effort: 4,
        moscow: "could", costOfDelay: 7, jobSize: 4,
      },
      {
        id: "f5", name: "Audit log export", description: "Export 90-day audit logs as CSV/JSON.",
        reach: 100, impact: 2, confidence: 100, effort: 2,
        moscow: "must", costOfDelay: 15, jobSize: 2,
      },
    ],
  },
  {
    label: "Mobile app backlog (4)",
    features: [
      {
        id: "m1", name: "Offline mode", description: "Cache data and queue actions for offline use.",
        reach: 10000, impact: 3, confidence: 50, effort: 20,
        moscow: "must", costOfDelay: 30, jobSize: 20,
      },
      {
        id: "m2", name: "Push notifications", description: "Server-side push via FCM/APNS.",
        reach: 10000, impact: 1, confidence: 100, effort: 6,
        moscow: "should", costOfDelay: 12, jobSize: 6,
      },
      {
        id: "m3", name: "Biometric login", description: "Face ID / Touch ID login.",
        reach: 8000, impact: 0.5, confidence: 80, effort: 4,
        moscow: "could", costOfDelay: 6, jobSize: 4,
      },
      {
        id: "m4", name: "In-app feedback form", description: "3-field feedback form with screenshot attach.",
        reach: 5000, impact: 0.5, confidence: 100, effort: 3,
        moscow: "wont", costOfDelay: 4, jobSize: 3,
      },
    ],
  },
  {
    label: "Empty backlog",
    features: [],
  },
];

export const DEFAULT_FEATURE: Feature = {
  id: "",
  name: "",
  description: "",
  reach: 1000,
  impact: 1,
  confidence: 80,
  effort: 5,
  moscow: "should",
  costOfDelay: 10,
  jobSize: 5,
};

// ---------- Helpers ----------

let _idCounter = 0;
/** Generate a unique ID for new features. */
export function newFeatureId(): string {
  _idCounter += 1;
  return `f${Date.now().toString(36)}${_idCounter}`;
}

/** Create a new feature with defaults and a fresh id. */
export function createFeature(name = "", description = ""): Feature {
  return { ...DEFAULT_FEATURE, id: newFeatureId(), name, description };
}

/** Clamp a number to a min/max range. */
export function clampNum(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(Math.max(n, min), max);
}

/** Validate a single feature — returns a list of error messages. */
export function validateFeature(f: Feature): string[] {
  const errors: string[] = [];
  if (!f.name.trim()) errors.push("Name is required.");
  if (f.reach < 0) errors.push("Reach must be ≥ 0.");
  if (!IMPACT_VALUES.some((i) => i.value === f.impact)) errors.push("Impact must be one of 0.25, 0.5, 1, 2, 3.");
  if (f.confidence < 0 || f.confidence > 100) errors.push("Confidence must be 0–100.");
  if (f.effort < 0) errors.push("Effort must be ≥ 0.");
  if (!MOSCOW_CATEGORIES.some((c) => c.value === f.moscow)) errors.push("MoSCoW category is invalid.");
  if (f.costOfDelay < 0) errors.push("Cost of delay must be ≥ 0.");
  if (f.jobSize <= 0) errors.push("Job size must be > 0 for WSJF.");
  return errors;
}

// ---------- Scoring ----------

/**
 * Compute RICE = (Reach × Impact × Confidence) ÷ Effort.
 * Guards against divide-by-zero (returns 0 when effort is 0).
 */
export function calculateRice(f: Feature): number {
  if (f.effort <= 0) return 0;
  const confidence = f.confidence / 100;
  return Math.round((f.reach * f.impact * confidence) / f.effort);
}

/**
 * Compute ICE = Impact × Confidence × Ease.
 * Ease = 11 − clamp(effort, 1, 10) → 1–10, where low effort = high ease.
 */
export function calculateIce(f: Feature): number {
  const confidence = f.confidence / 100;
  const ease = 11 - clampNum(f.effort, 1, 10);
  return Math.round(f.impact * confidence * ease * 100) / 100;
}

/**
 * Compute WSJF = Cost of Delay ÷ Job Size.
 * Guards against divide-by-zero.
 */
export function calculateWsjf(f: Feature): number {
  if (f.jobSize <= 0) return 0;
  return Math.round((f.costOfDelay / f.jobSize) * 100) / 100;
}

/** Score a single feature across all four frameworks. */
export function scoreFeature(f: Feature): { rice: number; ice: number; wsjf: number } {
  return {
    rice: calculateRice(f),
    ice: calculateIce(f),
    wsjf: calculateWsjf(f),
  };
}

// ---------- Ranking + sorting ----------

/** Score and rank all features by the active framework (rank 1 = highest). */
export function rankFeatures(features: Feature[], framework: Framework): ScoredFeature[] {
  const scored = features.map((f) => {
    const s = scoreFeature(f);
    return { feature: f, rice: s.rice, ice: s.ice, wsjf: s.wsjf, rank: 0 };
  });
  // Sort by framework-specific score (or MoSCoW order).
  scored.sort((a, b) => {
    if (framework === "rice") return b.rice - a.rice;
    if (framework === "ice") return b.ice - a.ice;
    if (framework === "wsjf") return b.wsjf - a.wsjf;
    // moscow: by category, then by RICE as tiebreaker.
    const catA = MOSCOW_RANK[a.feature.moscow];
    const catB = MOSCOW_RANK[b.feature.moscow];
    if (catA !== catB) return catA - catB;
    return b.rice - a.rice;
  });
  // Assign ranks (1-indexed).
  scored.forEach((s, i) => { s.rank = i + 1; });
  return scored;
}

/** Re-sort an already-scored list by a custom key. */
export function sortScored(
  list: ScoredFeature[],
  key: SortKey,
  dir: SortDir = "desc",
): ScoredFeature[] {
  const sorted = [...list];
  sorted.sort((a, b) => {
    let av: number | string;
    let bv: number | string;
    switch (key) {
      case "name": av = a.feature.name.toLowerCase(); bv = b.feature.name.toLowerCase(); break;
      case "rice": av = a.rice; bv = b.rice; break;
      case "ice": av = a.ice; bv = b.ice; break;
      case "wsjf": av = a.wsjf; bv = b.wsjf; break;
      case "effort": av = a.feature.effort; bv = b.feature.effort; break;
      case "reach": av = a.feature.reach; bv = b.feature.reach; break;
      case "impact": av = a.feature.impact; bv = b.feature.impact; break;
      case "confidence": av = a.feature.confidence; bv = b.feature.confidence; break;
      case "rank":
      default: av = a.rank; bv = b.rank; break;
    }
    if (typeof av === "string" && typeof bv === "string") {
      return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return dir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });
  return sorted;
}

// ---------- Aggregate stats ----------

export function computeStats(features: Feature[], framework: Framework): AggregateStats {
  const scored = rankFeatures(features, framework);
  const n = features.length;
  const avgRice = n ? Math.round(scored.reduce((s, f) => s + f.rice, 0) / n) : 0;
  const avgIce = n ? Math.round(scored.reduce((s, f) => s + f.ice, 0) / n * 100) / 100 : 0;
  const avgWsjf = n ? Math.round(scored.reduce((s, f) => s + f.wsjf, 0) / n * 100) / 100 : 0;
  const totalEffort = features.reduce((s, f) => s + f.effort, 0);
  const top = scored[0]?.feature.name ?? null;
  const bottom = scored[scored.length - 1]?.feature.name ?? null;
  return {
    count: n,
    avgRice,
    avgIce,
    avgWsjf,
    totalEffort,
    topFeature: top,
    bottomFeature: bottom,
    mustCount: features.filter((f) => f.moscow === "must").length,
    shouldCount: features.filter((f) => f.moscow === "should").length,
    couldCount: features.filter((f) => f.moscow === "could").length,
    wontCount: features.filter((f) => f.moscow === "wont").length,
  };
}

// ---------- Sensitivity analysis ----------

/**
 * For the given field, vary each feature's value across `values` and detect
 * whether the rank order changes (i.e., the ranking is "sensitive" to that field).
 */
export function sensitivityAnalysis(
  features: Feature[],
  framework: Framework,
  field: "reach" | "impact" | "confidence" | "effort",
  values: number[],
): SensitivityResult {
  const baseRanked = rankFeatures(features, framework);
  const baseRankOrder = baseRanked.map((s) => s.feature.name);
  const variations = values.map((value) => {
    const varied = features.map((f) => ({ ...f, [field]: value })) as Feature[];
    const ranked = rankFeatures(varied, framework);
    const rankOrder = ranked.map((s) => s.feature.name);
    const changed = JSON.stringify(rankOrder) !== JSON.stringify(baseRankOrder);
    return { value, rankOrder, changed };
  });
  return { field, baseRankOrder, variations };
}

// ---------- Render helpers ----------

/** Render scored features as CSV. */
export function renderCsv(features: Feature[], framework: Framework): string {
  const scored = rankFeatures(features, framework);
  const header = [
    "rank", "name", "framework_score",
    "reach", "impact", "confidence_pct", "effort",
    "moscow", "cost_of_delay", "job_size", "rice", "ice", "wsjf", "description",
  ];
  const lines = [header.join(",")];
  for (const s of scored) {
    lines.push([
      String(s.rank),
      escapeCsv(s.feature.name),
      String(scoreForFramework(s, framework)),
      String(s.feature.reach),
      String(s.feature.impact),
      String(s.feature.confidence),
      String(s.feature.effort),
      s.feature.moscow,
      String(s.feature.costOfDelay),
      String(s.feature.jobSize),
      String(s.rice),
      String(s.ice),
      String(s.wsjf),
      escapeCsv(s.feature.description),
    ].join(","));
  }
  return lines.join("\n");
}

function scoreForFramework(s: ScoredFeature, framework: Framework): number {
  if (framework === "rice") return s.rice;
  if (framework === "ice") return s.ice;
  if (framework === "wsjf") return s.wsjf;
  return MOSCOW_RANK[s.feature.moscow]; // moscow
}

/** Render scored features as a Markdown table. */
export function renderMarkdown(features: Feature[], framework: Framework): string {
  const scored = rankFeatures(features, framework);
  const formula = FRAMEWORKS.find((f) => f.value === framework)!.formula;
  let md = `# Feature Prioritization — ${framework.toUpperCase()}\n\n`;
  md += `**Formula:** ${formula}\n\n`;
  md += `| Rank | Name | Score | Reach | Impact | Confidence | Effort | MoSCoW |\n`;
  md += `|------|------|-------|-------|--------|------------|--------|--------|\n`;
  for (const s of scored) {
    md += `| ${s.rank} | ${s.feature.name} | ${scoreForFramework(s, framework)} | ${s.feature.reach} | ${s.feature.impact} | ${s.feature.confidence}% | ${s.feature.effort} | ${s.feature.moscow} |\n`;
  }
  return md;
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

/** Parse a CSV of features (header row expected: rank,name,reach,impact,confidence,effort,moscow). */
export function parseFeaturesCsv(csv: string): Feature[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  // Skip header if it looks like one.
  const firstLower = lines[0].toLowerCase();
  const hasHeader = /name|reach|impact|effort/.test(firstLower);
  const startIdx = hasHeader ? 1 : 0;
  const out: Feature[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    if (cols.length < 6) continue;
    const impactNum = Number(cols[3]);
    const validImpacts: number[] = IMPACT_VALUES.map((x) => x.value);
    const moscowVal = (cols[6] ?? "should") as MoscowCategory;
    out.push({
      id: newFeatureId(),
      name: cols[1] ?? "",
      description: cols[7] ?? "",
      reach: Number(cols[2]) || 0,
      impact: (validImpacts.includes(impactNum) ? impactNum : 1) as Impact,
      confidence: clampNum(Number(cols[4]) || 80, 0, 100),
      effort: Number(cols[5]) || 1,
      moscow: MOSCOW_CATEGORIES.some((c) => c.value === moscowVal) ? moscowVal : "should",
      costOfDelay: 10,
      jobSize: Number(cols[5]) || 1,
    });
  }
  return out;
}

// ---------- LLM prompt (BYO key, called from ui.tsx) ----------

export function buildLlmPrompt(feature: Feature): string {
  return [
    `You are a senior product manager using the RICE prioritization framework.`,
    `Draft realistic RICE inputs for this feature:`,
    ``,
    `Name: ${feature.name}`,
    `Description: ${feature.description || "(no description provided)"}`,
    ``,
    `Respond in this exact format (no preamble, no commentary):`,
    `Reach: <number — people affected per month>`,
    `Impact: <one of 0.25, 0.5, 1, 2, 3>`,
    `Confidence: <percent 0–100>`,
    `Effort: <person-weeks, >= 1>`,
    `Rationale: <one sentence explaining the score>`,
  ].join("\n");
}

export interface LlmDraftResult {
  reach: number | null;
  impact: Impact | null;
  confidence: number | null;
  effort: number | null;
  rationale: string;
  warnings: string[];
}

/** Parse the LLM response into a draft result. */
export function renderLlmResult(out: string): LlmDraftResult {
  const text = (out || "").trim();
  const reachMatch = text.match(/Reach:\s*([\d.]+)/i);
  const impactMatch = text.match(/Impact:\s*([\d.]+)/i);
  const confMatch = text.match(/Confidence:\s*([\d.]+)/i);
  const effortMatch = text.match(/Effort:\s*([\d.]+)/i);
  const rationaleMatch = text.match(/Rationale:\s*(.+)$/im);
  const warnings: string[] = [];

  let impact: Impact | null = null;
  if (impactMatch) {
    const n = Number(impactMatch[1]);
    const valid = IMPACT_VALUES.map((i) => i.value);
    if (valid.includes(n as Impact)) impact = n as Impact;
    else warnings.push(`LLM suggested impact ${n}, not in valid set; defaulting to 1.`);
  }

  const reach = reachMatch ? Number(reachMatch[1]) : null;
  const confidence = confMatch ? clampNum(Number(confMatch[1]), 0, 100) : null;
  const effort = effortMatch ? Number(effortMatch[1]) : null;
  const rationale = rationaleMatch ? rationaleMatch[1].trim() : "";

  if (reach === null) warnings.push("Could not parse Reach from LLM output.");
  if (confidence === null) warnings.push("Could not parse Confidence from LLM output.");
  if (effort === null) warnings.push("Could not parse Effort from LLM output.");

  return { reach, impact, confidence, effort, rationale, warnings };
}

/** Apply LLM draft to a feature (returns a new Feature). */
export function applyLlmDraft(feature: Feature, draft: LlmDraftResult): Feature {
  return {
    ...feature,
    reach: draft.reach ?? feature.reach,
    impact: draft.impact ?? feature.impact,
    confidence: draft.confidence ?? feature.confidence,
    effort: draft.effort ?? feature.effort,
  };
}

// ---------- History (localStorage) ----------

const HISTORY_KEY = "unqtools:ai-product-feature-prioritization-helper:history";

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

export function buildShareUrl(features: Feature[], framework: Framework): string {
  const params = new URLSearchParams();
  params.set("fw", framework);
  if (features.length > 0) {
    // Compact encoding: each feature as name|reach|impact|confidence|effort|moscow separated by ;
    const compact = features.map((f) => [
      f.name,
      f.reach,
      f.impact,
      f.confidence,
      f.effort,
      f.moscow,
    ].join("|")).join(";");
    params.set("items", compact);
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { framework: Framework; features: Feature[] } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { framework: "rice", features: [] };
  const params = new URLSearchParams(clean);
  const fwStr = params.get("fw") ?? "rice";
  const framework: Framework = FRAMEWORKS.some((f) => f.value === fwStr)
    ? fwStr as Framework
    : "rice";
  const itemsStr = params.get("items") ?? "";
  const features: Feature[] = [];
  if (itemsStr) {
    const items = itemsStr.split(";");
    for (const item of items) {
      const cols = item.split("|");
      if (cols.length < 6) continue;
      const impactNum = Number(cols[2]);
      const moscowVal = cols[5] as MoscowCategory;
      const validImpacts = IMPACT_VALUES.map((x) => x.value);
      features.push({
        id: newFeatureId(),
        name: cols[0] ?? "",
        description: "",
        reach: Number(cols[1]) || 0,
        impact: (validImpacts.includes(impactNum as Impact) ? impactNum : 1) as Impact,
        confidence: clampNum(Number(cols[3]) || 80, 0, 100),
        effort: Number(cols[4]) || 1,
        moscow: MOSCOW_CATEGORIES.some((c) => c.value === moscowVal) ? moscowVal : "should",
        costOfDelay: 10,
        jobSize: Number(cols[4]) || 1,
      });
    }
  }
  return { framework, features };
}
