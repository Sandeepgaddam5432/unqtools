/**
 * AI Competitor Analysis Framework Draft — pure logic.
 *
 * Scaffold a structured competitive-analysis draft from user inputs across
 * four frameworks: Feature/pricing comparison matrix, per-competitor SWOT,
 * Porter's Five Forces, and a market positioning map with white-space
 * callouts. Pure functions only — no DOM, no network. The optional LLM
 * call (BYO API key) lives in ui.tsx because it touches the network.
 *
 * Honesty: the tool cannot browse or verify live competitor pricing or
 * features — it structures and reasons over *the facts you provide* and
 * flags anything it inferred. Analysis quality depends on your inputs.
 */

// ---------- Types ----------

export type Framework = "swot" | "matrix" | "porter" | "positioning";

export type PorterForce =
  | "rivalry"
  | "new-entrants"
  | "substitutes"
  | "buyer-power"
  | "supplier-power";

export type ForceLevel = "low" | "medium" | "high";

export type PositioningAxis =
  | "price" | "quality" | "ease-of-use" | "niche-breadth" | "enterprise-smb";

export interface CompetitorInputs {
  name: string;
  /** Strengths notes (one per line, or free text). */
  strengths: string;
  /** Weaknesses notes. */
  weaknesses: string;
  /** Pricing tier ($ / $$ / $$$ / $$$$) or description. */
  pricing: string;
  /** Key features (one per line). */
  features: string;
}

export interface AnalysisInputs {
  yourCompany: CompetitorInputs;
  competitors: CompetitorInputs[];
  industry: string;
  /** Optional notes you've gathered about the market overall. */
  marketNotes: string;
}

export interface SwotEntry {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface PerCompetitorSwot {
  name: string;
  swot: SwotEntry;
}

export interface FeatureMatrixRow {
  competitor: string;
  /** Feature name → present/absent/maybe. */
  features: Record<string, boolean>;
  pricing: string;
}

export interface FeatureMatrix {
  /** Union of all feature names across all competitors. */
  featureNames: string[];
  rows: FeatureMatrixRow[];
}

export interface PorterForceAssessment {
  force: PorterForce;
  level: ForceLevel;
  notes: string;
}

export interface PorterAssessment {
  forces: PorterForceAssessment[];
  overallAttractiveness: "high" | "medium" | "low";
  summary: string;
}

export interface PositioningPoint {
  name: string;
  x: number; // 0..100 along axis X
  y: number; // 0..100 along axis Y
  isYou: boolean;
}

export interface PositioningMap {
  xAxis: PositioningAxis;
  yAxis: PositioningAxis;
  points: PositioningPoint[];
  whiteSpace: string[];
}

export interface WhiteSpaceOpportunity {
  title: string;
  rationale: string;
  source: "matrix" | "positioning";
}

export interface AnalysisOutput {
  swots: PerCompetitorSwot[];
  featureMatrix: FeatureMatrix;
  porter: PorterAssessment;
  positioningMap: PositioningMap;
  whiteSpace: WhiteSpaceOpportunity[];
  warnings: string[];
}

export interface HistoryEntry {
  ts: number;
  yourCompany: string;
  competitorCount: number;
  industry: string;
}

export interface ShareState {
  inputs: Partial<AnalysisInputs>;
}

export interface LlmEnhancement {
  polishedSummary: string;
  polishedSwots: Array<{ name: string; opportunities: string[]; threats: string[] }>;
  polishedPorterNotes: string[];
  whiteSpaceIdeas: string[];
  suggestions: string[];
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-competitor-analysis-framework:history";
export const HISTORY_MAX = 20;
export const LLM_KEY_STORAGE = "unqtools:ai-competitor-analysis-framework:llm-key";

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  swot: "SWOT",
  matrix: "Feature / Pricing Matrix",
  porter: "Porter's Five Forces",
  positioning: "Positioning Map",
};

export const PORTER_FORCE_LABELS: Record<PorterForce, string> = {
  rivalry: "Competitive Rivalry",
  "new-entrants": "Threat of New Entrants",
  substitutes: "Threat of Substitutes",
  "buyer-power": "Buyer Power",
  "supplier-power": "Supplier Power",
};

export const FORCE_LEVEL_LABELS: Record<ForceLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const AXIS_LABELS: Record<PositioningAxis, string> = {
  price: "Price (low → high)",
  quality: "Quality (low → high)",
  "ease-of-use": "Ease of Use (low → high)",
  "niche-breadth": "Niche → Broad",
  "enterprise-smb": "Enterprise → SMB",
};

/** Inline hint + sample for each input field. */
export const FIELD_HINTS: Record<string, { hint: string; sample: string }> = {
  industry: { hint: "Your industry or market segment.", sample: "B2B product analytics" },
  marketNotes: {
    hint: "Optional notes you've gathered about the market overall (size, trends, segments).",
    sample: "Market growing 18% YoY; mid-market segment underserved.",
  },
  competitorName: { hint: "Competitor or company name.", sample: "Acme Analytics" },
  strengths: {
    hint: "Strengths, one per line. Be concrete (a feature, a metric, a proof point).",
    sample: "Strong enterprise brand\n200+ integrations\nISO 27001 certified",
  },
  weaknesses: {
    hint: "Weaknesses, one per line. Be concrete.",
    sample: "Slow UI\nNo free tier\nPricey for SMBs",
  },
  pricing: { hint: "Pricing tier ($, $$, $$$, $$$$) or description.", sample: "$$$" },
  features: {
    hint: "Key features, one per line.",
    sample: "Dashboards\nFunnels\nCohorts\nSQL explorer",
  },
};

// ---------- Validation ----------

/** Validate inputs and return human-readable warnings. */
export function validateInputs(inputs: AnalysisInputs): string[] {
  const warnings: string[] = [];
  if (!inputs.yourCompany.name || !inputs.yourCompany.name.trim()) {
    warnings.push("Your company name is required.");
  }
  if (!inputs.competitors || inputs.competitors.length === 0) {
    warnings.push("Add at least one competitor to generate a meaningful analysis.");
  }
  if (inputs.competitors.length > 0) {
    const named = inputs.competitors.filter((c) => c.name && c.name.trim());
    if (named.length === 0) {
      warnings.push("At least one competitor needs a name to populate the matrix and SWOTs.");
    }
  }
  if (!inputs.yourCompany.strengths || !inputs.yourCompany.strengths.trim()) {
    warnings.push("Your company strengths are empty — add at least one to ground the SWOT.");
  }
  if (!inputs.yourCompany.features || !inputs.yourCompany.features.trim()) {
    warnings.push("Your company features are empty — add at least one for the matrix to be useful.");
  }
  for (const c of inputs.competitors) {
    if (c.name && c.name.trim() && (!c.strengths || !c.strengths.trim()) && (!c.weaknesses || !c.weaknesses.trim())) {
      warnings.push(`Competitor "${c.name}" has no strengths or weaknesses — the SWOT will be thin.`);
    }
  }
  return warnings;
}

// ---------- Helpers ----------

/** Split a multiline string into trimmed non-empty lines. */
export function splitLines(s: string): string[] {
  if (!s) return [];
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** Normalize a competitor name (trim, collapse spaces). */
export function normalizeName(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

// ---------- SWOT ----------

/**
 * Derive a SWOT for a competitor from their inputs and the overall
 * industry context. Opportunities and threats are inferred from gaps in
 * the competitor's own weaknesses and the industry notes; we flag the
 * inference in the rationale.
 */
export function deriveSwot(c: CompetitorInputs, marketNotes: string): SwotEntry {
  const strengths = splitLines(c.strengths);
  const weaknesses = splitLines(c.weaknesses);
  // Opportunities: invert each weakness into an opportunity for someone in this market.
  const opportunities: string[] = weaknesses.map((w) =>
    `Address "${w}" — a competitor that solves this could capture share.`,
  );
  // Threats: derived from market notes if present (each line is a threat axis).
  const threats: string[] = splitLines(marketNotes).map((n) =>
    `Market force: ${n}`,
  );
  if (threats.length === 0) {
    threats.push("Add market notes to derive threats.");
  }
  return { strengths, weaknesses, opportunities, threats };
}

/** Build per-competitor SWOTs (your company + competitors). */
export function buildSwots(inputs: AnalysisInputs): PerCompetitorSwot[] {
  const out: PerCompetitorSwot[] = [];
  out.push({
    name: inputs.yourCompany.name || "[your company]",
    swot: deriveSwot(inputs.yourCompany, inputs.marketNotes),
  });
  for (const c of inputs.competitors) {
    const name = normalizeName(c.name);
    if (!name) continue;
    out.push({ name, swot: deriveSwot(c, inputs.marketNotes) });
  }
  return out;
}

// ---------- Feature / pricing matrix ----------

/** Build a feature/pricing matrix from your company + competitors. */
export function buildFeatureMatrix(inputs: AnalysisInputs): FeatureMatrix {
  const rows: FeatureMatrixRow[] = [];
  const allNames = new Set<string>();
  const push = (c: CompetitorInputs) => {
    const feats = splitLines(c.features);
    const featMap: Record<string, boolean> = {};
    for (const f of feats) {
      const key = f.toLowerCase();
      allNames.add(key);
      featMap[key] = true;
    }
    rows.push({
      competitor: normalizeName(c.name) || "[unnamed]",
      features: featMap,
      pricing: (c.pricing || "—").trim() || "—",
    });
  };
  push(inputs.yourCompany);
  for (const c of inputs.competitors) {
    if (normalizeName(c.name)) push(c);
  }
  const featureNames = Array.from(allNames).sort();
  return { featureNames, rows };
}

// ---------- Porter's Five Forces ----------

/**
 * Synthesize a Porter's Five Forces assessment from inputs. Each force is
 * rated low/medium/high using simple heuristics over the inputs (e.g.,
 * more competitors → higher rivalry). Notes cite the inputs.
 */
export function buildPorter(inputs: AnalysisInputs): PorterAssessment {
  const forces: PorterForceAssessment[] = [];
  const competitorCount = inputs.competitors.filter((c) => normalizeName(c.name)).length;
  // Rivalry: scales with number of named competitors.
  const rivalryLevel: ForceLevel = competitorCount >= 5 ? "high" : competitorCount >= 2 ? "medium" : "low";
  forces.push({
    force: "rivalry",
    level: rivalryLevel,
    notes: `${competitorCount} named competitor${competitorCount === 1 ? "" : "s"} in ${inputs.industry || "[industry]"}. ${splitLines(inputs.marketNotes).length > 0 ? "Market notes suggest active competition." : "Add market notes for a sharper read."}`,
  });
  // New entrants: inferred from industry breadth.
  const newEntrantsLevel: ForceLevel = /smb|small business|niche/i.test(inputs.industry) ? "high" : "medium";
  forces.push({
    force: "new-entrants",
    level: newEntrantsLevel,
    notes: `${/smb|small business|niche/i.test(inputs.industry) ? "Low barriers for SMB/niche tools." : "Moderate barriers assumed — verify with regulatory/capex data."}`,
  });
  // Substitutes: inferred from your weaknesses (each weakness suggests a substitute angle).
  const yourWeaknesses = splitLines(inputs.yourCompany.weaknesses);
  const subLevel: ForceLevel = yourWeaknesses.length >= 3 ? "high" : yourWeaknesses.length >= 1 ? "medium" : "low";
  forces.push({
    force: "substitutes",
    level: subLevel,
    notes: yourWeaknesses.length > 0
      ? `Your weaknesses (${yourWeaknesses.length}) suggest substitute angles: ${yourWeaknesses.slice(0, 3).join("; ")}.`
      : "No weaknesses listed — substitutes hard to assess.",
  });
  // Buyer power: inferred from competitor count + your pricing.
  const buyerLevel: ForceLevel = competitorCount >= 4 ? "high" : competitorCount >= 2 ? "medium" : "low";
  forces.push({
    force: "buyer-power",
    level: buyerLevel,
    notes: `${competitorCount} alternatives gives buyers ${buyerLevel} leverage. Your pricing tier: ${inputs.yourCompany.pricing || "(unspecified)"}.`,
  });
  // Supplier power: inferred from industry (generic default).
  const supplierLevel: ForceLevel = /saas|software|cloud/i.test(inputs.industry) ? "low" : "medium";
  forces.push({
    force: "supplier-power",
    level: supplierLevel,
    notes: `SaaS/cloud markets typically have low supplier power (commodity infra). Verify with your stack audit.`,
  });
  // Overall attractiveness: high if forces skew low, low if skew high.
  const scoreMap: Record<ForceLevel, number> = { low: 1, medium: 2, high: 3 };
  const total = forces.reduce((s, f) => s + scoreMap[f.level], 0);
  const overallAttractiveness: PorterAssessment["overallAttractiveness"] =
    total <= 7 ? "high" : total <= 11 ? "medium" : "low";
  const summary = `Industry attractiveness is ${overallAttractiveness} (force score ${total}/15). ${
    overallAttractiveness === "high"
      ? "Favorable structure — focus on differentiation and growth."
      : overallAttractiveness === "medium"
        ? "Mixed structure — pick battles carefully; some forces are favorable."
        : "Tough structure — defensive posture; seek niches or adjacencies."
  }`;
  return { forces, overallAttractiveness, summary };
}

// ---------- Positioning map ----------

/**
 * Estimate a competitor's position on an axis from their inputs. Returns
 * a 0..100 value. Inferences are flagged in the white-space rationale.
 */
export function estimateAxis(c: CompetitorInputs, axis: PositioningAxis): number {
  const pricing = (c.pricing || "").trim();
  const strengths = (c.strengths || "").toLowerCase();
  const weaknesses = (c.weaknesses || "").toLowerCase();
  const feats = splitLines(c.features).length;
  switch (axis) {
    case "price": {
      if (/^\${4,}$/.test(pricing) || /premium|enterprise/i.test(pricing)) return 90;
      if (/^\${3}$/.test(pricing)) return 70;
      if (/^\${2}$/.test(pricing)) return 50;
      if (/^\$$/.test(pricing)) return 25;
      if (/free|freemium/i.test(pricing)) return 10;
      return 50;
    }
    case "quality": {
      let score = 50;
      if (/quality|premium|enterprise|best/i.test(strengths)) score += 20;
      if (/slow|buggy|low quality|outdated|legacy/i.test(weaknesses)) score -= 20;
      if (feats >= 6) score += 10;
      return Math.max(5, Math.min(95, score));
    }
    case "ease-of-use": {
      let score = 50;
      if (/easy|simple|intuitive|no.?code|self.?serve/i.test(strengths)) score += 25;
      if (/slow|complex|steep|hard|clunky|legacy/i.test(weaknesses)) score -= 25;
      return Math.max(5, Math.min(95, score));
    }
    case "niche-breadth": {
      // More features → broader. 0 = niche, 100 = broad.
      return Math.max(10, Math.min(95, feats * 12 + 20));
    }
    case "enterprise-smb": {
      // 0 = SMB, 100 = Enterprise.
      if (/enterprise|global|fortune/i.test(strengths)) return 85;
      if (/smb|small business|startup|consumer/i.test(strengths)) return 20;
      if (/^\${4,}$/.test(pricing)) return 80;
      if (/^\$$/.test(pricing) || /free/i.test(pricing)) return 20;
      return 50;
    }
    default:
      return 50;
  }
}

/**
 * Build a positioning map for two axes. Includes white-space callouts
 * for empty quadrants.
 */
export function buildPositioningMap(
  inputs: AnalysisInputs,
  xAxis: PositioningAxis = "price",
  yAxis: PositioningAxis = "quality",
): PositioningMap {
  const points: PositioningPoint[] = [];
  points.push({
    name: inputs.yourCompany.name || "[you]",
    x: estimateAxis(inputs.yourCompany, xAxis),
    y: estimateAxis(inputs.yourCompany, yAxis),
    isYou: true,
  });
  for (const c of inputs.competitors) {
    const name = normalizeName(c.name);
    if (!name) continue;
    points.push({
      name,
      x: estimateAxis(c, xAxis),
      y: estimateAxis(c, yAxis),
      isYou: false,
    });
  }
  // White-space: quadrants with no point within 30 units.
  const whiteSpace: string[] = [];
  const quads: Array<{ label: string; xRange: [number, number]; yRange: [number, number] }> = [
    { label: "low-X / low-Y", xRange: [0, 50], yRange: [0, 50] },
    { label: "low-X / high-Y", xRange: [0, 50], yRange: [50, 100] },
    { label: "high-X / low-Y", xRange: [50, 100], yRange: [0, 50] },
    { label: "high-X / high-Y", xRange: [50, 100], yRange: [50, 100] },
  ];
  for (const q of quads) {
    const hasPoint = points.some((p) =>
      p.x >= q.xRange[0] && p.x <= q.xRange[1] && p.y >= q.yRange[0] && p.y <= q.yRange[1]);
    if (!hasPoint) {
      whiteSpace.push(
        `Quadrant "${q.label}" on ${AXIS_LABELS[xAxis]} × ${AXIS_LABELS[yAxis]} is unoccupied — candidate for white space. (Inferred from ${points.length} plotted companies.)`,
      );
    }
  }
  if (whiteSpace.length === 0) {
    whiteSpace.push(
      `All four quadrants on ${AXIS_LABELS[xAxis]} × ${AXIS_LABELS[yAxis]} are occupied — try different axes to find white space.`,
    );
  }
  return { xAxis, yAxis, points, whiteSpace };
}

// ---------- White-space synthesis ----------

/** Synthesize white-space opportunities from the matrix and the positioning map. */
export function deriveWhiteSpace(
  matrix: FeatureMatrix,
  positioning: PositioningMap,
): WhiteSpaceOpportunity[] {
  const out: WhiteSpaceOpportunity[] = [];
  // Matrix-driven: features absent across ALL competitors (green-field).
  for (const f of matrix.featureNames) {
    const present = matrix.rows.filter((r) => r.features[f]).length;
    if (present === 1) {
      // Only one competitor has it — verify it's you (catch-up gap) or others.
      const holder = matrix.rows.find((r) => r.features[f]);
      if (holder && holder.competitor !== "[your company]" && matrix.rows[0].competitor !== holder.competitor) {
        out.push({
          title: `Catch-up gap: only ${holder.competitor} ships "${f}"`,
          rationale: `Feature "${f}" is shipped by only one competitor (${holder.competitor}). Your company and ${matrix.rows.length - 2} other(s) lack it. Consider catching up — or positioning away from it.`,
          source: "matrix",
        });
      }
    }
  }
  // Positioning-driven: each white-space callout from the map.
  for (const ws of positioning.whiteSpace) {
    out.push({
      title: `Positioning white space`,
      rationale: ws,
      source: "positioning",
    });
  }
  return out;
}

// ---------- Top-level generate ----------

/** Generate the full analysis: SWOTs + matrix + Porter + positioning + white space + warnings. */
export function generate(
  inputs: AnalysisInputs,
  xAxis: PositioningAxis = "price",
  yAxis: PositioningAxis = "quality",
): AnalysisOutput {
  const warnings = validateInputs(inputs);
  const swots = buildSwots(inputs);
  const featureMatrix = buildFeatureMatrix(inputs);
  const porter = buildPorter(inputs);
  const positioningMap = buildPositioningMap(inputs, xAxis, yAxis);
  const whiteSpace = deriveWhiteSpace(featureMatrix, positioningMap);
  return { swots, featureMatrix, porter, positioningMap, whiteSpace, warnings };
}

// ---------- Render ----------

/** Render the full analysis as a Markdown report. */
export function renderMarkdown(output: AnalysisOutput, inputs: AnalysisInputs): string {
  const lines: string[] = [];
  lines.push(`# Competitive Analysis — ${inputs.yourCompany.name || "[your company]"}`);
  lines.push("");
  lines.push(`_Generated by UnQTools AI Competitor Analysis Framework Draft. The tool structures and reasons over the facts you provide; it cannot browse or verify live competitor data. Audit any inference before acting._`);
  lines.push("");
  lines.push("## Inputs");
  lines.push("");
  lines.push(`- **Your company:** ${inputs.yourCompany.name || "—"}`);
  lines.push(`- **Industry:** ${inputs.industry || "—"}`);
  lines.push(`- **Competitors:** ${inputs.competitors.filter((c) => normalizeName(c.name)).map((c) => normalizeName(c.name)).join(", ") || "—"}`);
  lines.push(`- **Market notes:** ${inputs.marketNotes || "—"}`);
  lines.push("");
  if (output.warnings.length > 0) {
    lines.push("## Warnings");
    lines.push("");
    for (const w of output.warnings) lines.push(`- ${w}`);
    lines.push("");
  }
  lines.push("## SWOT (per company)");
  lines.push("");
  for (const s of output.swots) {
    lines.push(`### ${s.name}`);
    lines.push("");
    lines.push(`**Strengths:**`);
    for (const x of s.swot.strengths) lines.push(`- ${x}`);
    if (s.swot.strengths.length === 0) lines.push("- _(none provided)_");
    lines.push("");
    lines.push(`**Weaknesses:**`);
    for (const x of s.swot.weaknesses) lines.push(`- ${x}`);
    if (s.swot.weaknesses.length === 0) lines.push("- _(none provided)_");
    lines.push("");
    lines.push(`**Opportunities (inferred from weaknesses):**`);
    for (const x of s.swot.opportunities) lines.push(`- ${x}`);
    lines.push("");
    lines.push(`**Threats (inferred from market notes):**`);
    for (const x of s.swot.threats) lines.push(`- ${x}`);
    lines.push("");
  }
  lines.push("## Feature / Pricing Matrix");
  lines.push("");
  if (output.featureMatrix.featureNames.length === 0) {
    lines.push("_(No features provided — add features per company to populate the matrix.)_");
    lines.push("");
  } else {
    const header = ["Company", ...output.featureMatrix.featureNames, "Pricing"].join(" | ");
    const sep = ["---", ...output.featureMatrix.featureNames.map(() => "---"), "---"].join(" | ");
    lines.push(`| ${header} |`);
    lines.push(`| ${sep} |`);
    for (const r of output.featureMatrix.rows) {
      const cells = output.featureMatrix.featureNames.map((f) => r.features[f] ? "✓" : "—");
      lines.push(`| ${[r.competitor, ...cells, r.pricing].join(" | ")} |`);
    }
    lines.push("");
  }
  lines.push("## Porter's Five Forces");
  lines.push("");
  lines.push(`**Overall attractiveness: ${output.porter.overallAttractiveness}**`);
  lines.push("");
  lines.push(output.porter.summary);
  lines.push("");
  for (const f of output.porter.forces) {
    lines.push(`### ${PORTER_FORCE_LABELS[f.force]} — ${FORCE_LEVEL_LABELS[f.level]}`);
    lines.push("");
    lines.push(f.notes);
    lines.push("");
  }
  lines.push(`## Positioning Map — ${AXIS_LABELS[output.positioningMap.xAxis]} × ${AXIS_LABELS[output.positioningMap.yAxis]}`);
  lines.push("");
  for (const p of output.positioningMap.points) {
    lines.push(`- ${p.isYou ? "**[you]** " : ""}${p.name}: (${p.x}, ${p.y})`);
  }
  lines.push("");
  if (output.whiteSpace.length > 0) {
    lines.push("## White-space opportunities");
    lines.push("");
    for (const w of output.whiteSpace) {
      lines.push(`### ${w.title}`);
      lines.push("");
      lines.push(`_Source: ${w.source}_`);
      lines.push("");
      lines.push(w.rationale);
      lines.push("");
    }
  }
  return lines.join("\n");
}

/** Render the full analysis as JSON. */
export function renderJson(output: AnalysisOutput, inputs: AnalysisInputs): string {
  return JSON.stringify({ inputs, output, generatedAt: new Date().toISOString() }, null, 2);
}

// ---------- History (localStorage) ----------

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

export function buildShareUrl(inputs: AnalysisInputs): string {
  const params = new URLSearchParams();
  if (inputs.yourCompany.name) params.set("yname", inputs.yourCompany.name);
  if (inputs.yourCompany.strengths) params.set("yst", inputs.yourCompany.strengths);
  if (inputs.yourCompany.weaknesses) params.set("ywk", inputs.yourCompany.weaknesses);
  if (inputs.yourCompany.pricing) params.set("ypr", inputs.yourCompany.pricing);
  if (inputs.yourCompany.features) params.set("yft", inputs.yourCompany.features);
  if (inputs.industry) params.set("ind", inputs.industry);
  if (inputs.marketNotes) params.set("mkt", inputs.marketNotes);
  // Serialize competitors compactly.
  const named = inputs.competitors.filter((c) => normalizeName(c.name));
  if (named.length > 0) {
    params.set("comps", JSON.stringify(named));
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  let clean = hash;
  if (clean.startsWith("#") || clean.startsWith("?")) clean = clean.slice(1);
  if (!clean) return { inputs: {} };
  const params = new URLSearchParams(clean);
  const inputs: Partial<AnalysisInputs> = {};
  const yourCompany: Partial<CompetitorInputs> = {};
  if (params.get("yname")) yourCompany.name = params.get("yname")!;
  if (params.get("yst")) yourCompany.strengths = params.get("yst")!;
  if (params.get("ywk")) yourCompany.weaknesses = params.get("ywk")!;
  if (params.get("ypr")) yourCompany.pricing = params.get("ypr")!;
  if (params.get("yft")) yourCompany.features = params.get("yft")!;
  if (Object.keys(yourCompany).length > 0) inputs.yourCompany = yourCompany as CompetitorInputs;
  if (params.get("ind")) inputs.industry = params.get("ind")!;
  if (params.get("mkt")) inputs.marketNotes = params.get("mkt")!;
  const compsRaw = params.get("comps");
  if (compsRaw) {
    try {
      const arr = JSON.parse(compsRaw);
      if (Array.isArray(arr)) {
        inputs.competitors = arr.filter(
          (x) => typeof x === "object" && x !== null && !Array.isArray(x),
        ) as CompetitorInputs[];
      }
    } catch {
      // ignore
    }
  }
  return { inputs };
}

// ---------- Optional LLM enhancement ----------

export function buildLlmPrompt(inputs: AnalysisInputs): string {
  return [
    "You are an expert competitive strategist. Polish the inputs below into a sharper competitive-analysis synthesis. The tool cannot browse live data — synthesize only from the inputs provided; flag inferences.",
    "",
    "Inputs:",
    `- Your company: ${inputs.yourCompany.name || "(empty)"}`,
    `- Your strengths: ${inputs.yourCompany.strengths || "(empty)"}`,
    `- Your weaknesses: ${inputs.yourCompany.weaknesses || "(empty)"}`,
    `- Your pricing: ${inputs.yourCompany.pricing || "(empty)"}`,
    `- Your features: ${inputs.yourCompany.features || "(empty)"}`,
    `- Industry: ${inputs.industry || "(empty)"}`,
    `- Market notes: ${inputs.marketNotes || "(empty)"}`,
    `- Competitors: ${inputs.competitors.filter((c) => c.name).map((c) => `${c.name} (strengths: ${c.strengths || "—"}, weaknesses: ${c.weaknesses || "—"}, pricing: ${c.pricing || "—"}, features: ${c.features || "—"})`).join("; ") || "(none)"}`,
    "",
    "Output a JSON object with:",
    '- "polishedSummary": string (3–4 sentence executive synthesis of the competitive landscape)',
    '- "polishedSwots": array of { "name": string, "opportunities": string[], "threats": string[] } (one per competitor, plus one for "you")',
    '- "polishedPorterNotes": array of strings (one synthesized note per Porter force, in order: rivalry, new-entrants, substitutes, buyer-power, supplier-power)',
    '- "whiteSpaceIdeas": array of strings (3–5 concrete white-space ideas citing the input they are based on)',
    '- "suggestions": array of strings (specific improvements the user could make to the inputs)',
    "",
    "Be honest. If a competitor's inputs are thin, say so in suggestions. Do not invent competitor details.",
  ].join("\n");
}

export function renderLlmResult(rawText: string):
  | { ok: true; result: LlmEnhancement }
  | { ok: false; error: string } {
  let s = (rawText || "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  let obj: unknown;
  try {
    obj = JSON.parse(s);
  } catch {
    return { ok: false, error: "Could not parse LLM output as JSON. Try again." };
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return { ok: false, error: "LLM output was not a JSON object." };
  }
  const o = obj as Record<string, unknown>;
  const polishedSwots = Array.isArray(o.polishedSwots)
    ? (o.polishedSwots as unknown[])
        .filter((x) => typeof x === "object" && x !== null && !Array.isArray(x))
        .map((x) => {
          const r = x as Record<string, unknown>;
          return {
            name: typeof r.name === "string" ? r.name : "",
            opportunities: Array.isArray(r.opportunities) ? (r.opportunities as unknown[]).filter((y) => typeof y === "string") as string[] : [],
            threats: Array.isArray(r.threats) ? (r.threats as unknown[]).filter((y) => typeof y === "string") as string[] : [],
          };
        })
    : [];
  const result: LlmEnhancement = {
    polishedSummary: typeof o.polishedSummary === "string" ? o.polishedSummary : "",
    polishedSwots,
    polishedPorterNotes: Array.isArray(o.polishedPorterNotes)
      ? (o.polishedPorterNotes as unknown[]).filter((x) => typeof x === "string") as string[]
      : [],
    whiteSpaceIdeas: Array.isArray(o.whiteSpaceIdeas)
      ? (o.whiteSpaceIdeas as unknown[]).filter((x) => typeof x === "string") as string[]
      : [],
    suggestions: Array.isArray(o.suggestions)
      ? (o.suggestions as unknown[]).filter((x) => typeof x === "string") as string[]
      : [],
  };
  return { ok: true, result };
}
