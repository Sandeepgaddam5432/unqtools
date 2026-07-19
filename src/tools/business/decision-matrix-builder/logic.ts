/**
 * Decision Matrix Builder — pure logic.
 *
 * Parse options, criteria, weights, scores; compute weighted scores
 * per cell, totals per option, rank options, identify best, and run
 * ±10% sensitivity analysis. Pure functions only — no DOM, no network.
 */

// ---- Types ----

export interface Weight {
  criterion: string;
  weight: number;
}

export interface NormalizedWeight {
  criterion: string;
  rawWeight: number;
  normalizedWeight: number;
}

export interface Score {
  option: string;
  criterion: string;
  score: number;
}

export interface ScoreCell {
  option: string;
  criterion: string;
  score: number;
  normalizedWeight: number;
  weightedScore: number;
}

export interface OptionTotal {
  option: string;
  totalScore: number;
  rank: number;
}

export interface SensitivityVariation {
  label: string;
  winnerOption: string;
  winnerChanged: boolean;
}

export interface SensitivityResult {
  baseWinner: string;
  stable: boolean;
  variations: SensitivityVariation[];
}

export interface MatrixStats {
  optionsCount: number;
  criteriaCount: number;
  winnerOption: string;
  winnerTotal: number;
  marginOfVictory: number;
  totalWeight: number;
  normalizedTotalWeight: number;
  cellsCount: number;
  filledCellsCount: number;
}

export interface MatrixInput {
  decisionTitle: string;
  optionsText: string;
  criteriaText: string;
  weightsText: string;
  scoresText: string;
}

export interface HistoryEntry {
  ts: number;
  title: string;
  optionsCount: number;
  criteriaCount: number;
  winnerOption: string;
  winnerTotal: number;
}

// ---- Normalization / Parsing ----

/** Normalize an option/criterion name (lowercase + collapse whitespace). */
export function normalizeName(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Parse options — one per line. Returns trimmed, non-empty lines. */
export function parseOptions(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse criteria — one per line. */
export function parseCriteria(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse weights — `criterion,weight` per line. */
export function parseWeights(
  text: string,
): { weights: Weight[]; errors: string[] } {
  const weights: Weight[] = [];
  const errors: string[] = [];
  if (!text || !text.trim()) return { weights, errors };
  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;
    const parts = splitCsvRow(line).map((s) => s.trim());
    if (parts.length < 2) {
      errors.push(`Line ${idx + 1}: needs criterion,weight`);
      return;
    }
    const [criterion, weightStr] = parts;
    if (!criterion) {
      errors.push(`Line ${idx + 1}: criterion is required`);
      return;
    }
    const weight = Number(weightStr);
    if (!Number.isFinite(weight) || weight < 0) {
      errors.push(`Line ${idx + 1}: invalid weight "${weightStr}"`);
      return;
    }
    weights.push({ criterion, weight });
  });
  return { weights, errors };
}

/** Parse scores — `option,criterion,score` per line, score 1-5. */
export function parseScores(
  text: string,
): { scores: Score[]; errors: string[] } {
  const scores: Score[] = [];
  const errors: string[] = [];
  if (!text || !text.trim()) return { scores, errors };
  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;
    const parts = splitCsvRow(line).map((s) => s.trim());
    if (parts.length < 3) {
      errors.push(`Line ${idx + 1}: needs option,criterion,score`);
      return;
    }
    const [option, criterion, scoreStr] = parts;
    if (!option || !criterion) {
      errors.push(`Line ${idx + 1}: option and criterion are required`);
      return;
    }
    const score = Number(scoreStr);
    if (!validateScore(score)) {
      errors.push(`Line ${idx + 1}: score must be 1-5, got "${scoreStr}"`);
      return;
    }
    scores.push({ option, criterion, score });
  });
  return { scores, errors };
}

/** Split CSV row honoring quoted values (basic). */
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

/** Validate that a score is an integer 1-5. */
export function validateScore(score: number): boolean {
  return Number.isFinite(score) && Number.isInteger(score) && score >= 1 && score <= 5;
}

// ---- Weights ----

/** Normalize weights so they sum to 100. Returns raw + normalized. */
export function normalizeWeights(weights: Weight[]): NormalizedWeight[] {
  if (weights.length === 0) return [];
  const total = weights.reduce((s, w) => s + w.weight, 0);
  if (total <= 0) {
    // Equal weights as fallback
    const equal = 100 / weights.length;
    return weights.map((w) => ({
      criterion: w.criterion,
      rawWeight: w.weight,
      normalizedWeight: equal,
    }));
  }
  return weights.map((w) => ({
    criterion: w.criterion,
    rawWeight: w.weight,
    normalizedWeight: (w.weight / total) * 100,
  }));
}

/** Total of raw weights. */
export function totalRawWeight(weights: Weight[]): number {
  return weights.reduce((s, w) => s + w.weight, 0);
}

// ---- Scoring ----

/** Look up a score by normalized option + criterion names. Returns 0 if not found. */
export function lookupScore(
  option: string,
  criterion: string,
  scores: Score[],
): number {
  const o = normalizeName(option);
  const c = normalizeName(criterion);
  const found = scores.find(
    (s) => normalizeName(s.option) === o && normalizeName(s.criterion) === c,
  );
  return found ? found.score : 0;
}

/** Weighted score for a cell = score × normalizedWeight. */
export function calculateWeightedScore(score: number, normalizedWeight: number): number {
  return score * normalizedWeight;
}

/** Build all cells (option × criterion). */
export function buildCells(
  options: string[],
  criteria: string[],
  normalizedWeights: NormalizedWeight[],
  scores: Score[],
): ScoreCell[] {
  const cells: ScoreCell[] = [];
  for (const option of options) {
    for (const criterion of criteria) {
      const score = lookupScore(option, criterion, scores);
      const nw = normalizedWeights.find(
        (w) => normalizeName(w.criterion) === normalizeName(criterion),
      );
      const weight = nw ? nw.normalizedWeight : 0;
      cells.push({
        option,
        criterion,
        score,
        normalizedWeight: weight,
        weightedScore: calculateWeightedScore(score, weight),
      });
    }
  }
  return cells;
}

/** Compute total weighted score per option. */
export function calculateOptionTotals(
  cells: ScoreCell[],
  options: string[],
): OptionTotal[] {
  return options.map((option) => {
    const totalScore = cells
      .filter((c) => c.option === option)
      .reduce((s, c) => s + c.weightedScore, 0);
    return { option, totalScore, rank: 0 };
  });
}

/** Rank options by total score (descending). Returns new array with rank assigned. Does not mutate input. */
export function rankOptions(totals: OptionTotal[]): OptionTotal[] {
  return [...totals]
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return a.option.localeCompare(b.option);
    })
    .map((t, i) => ({ ...t, rank: i + 1 }));
}

/** Identify the best (highest-scoring) option. Returns empty string if none. */
export function identifyBestOption(ranked: OptionTotal[]): string {
  if (ranked.length === 0) return "";
  return ranked[0].option;
}

/** Margin of victory = top.total − second.total. Returns 0 if fewer than 2 options. */
export function calculateMarginOfVictory(ranked: OptionTotal[]): number {
  if (ranked.length < 2) return 0;
  return ranked[0].totalScore - ranked[1].totalScore;
}

// ---- Sensitivity analysis ----

/** Vary each criterion weight ±10% and re-rank; flag if winner changes. */
export function sensitivityAnalysis(
  options: string[],
  criteria: string[],
  weights: Weight[],
  scores: Score[],
): SensitivityResult {
  if (options.length === 0 || criteria.length === 0) {
    return { baseWinner: "", stable: true, variations: [] };
  }
  const baseNormalized = normalizeWeights(weights);
  const baseCells = buildCells(options, criteria, baseNormalized, scores);
  const baseTotals = calculateOptionTotals(baseCells, options);
  const baseRanked = rankOptions(baseTotals);
  const baseWinner = identifyBestOption(baseRanked);

  const variations: SensitivityVariation[] = [];
  let stable = true;

  for (const criterion of criteria) {
    for (const factor of [1.1, 0.9]) {
      const varied: Weight[] = weights.map((w) =>
        normalizeName(w.criterion) === normalizeName(criterion)
          ? { criterion: w.criterion, weight: w.weight * factor }
          : w,
      );
      const nw = normalizeWeights(varied);
      const cells = buildCells(options, criteria, nw, scores);
      const totals = calculateOptionTotals(cells, options);
      const ranked = rankOptions(totals);
      const winner = identifyBestOption(ranked);
      const winnerChanged = winner !== baseWinner;
      if (winnerChanged) stable = false;
      const label = `${criterion} ${factor > 1 ? "+10%" : "−10%"}`;
      variations.push({ label, winnerOption: winner, winnerChanged });
    }
  }

  return { baseWinner, stable, variations };
}

// ---- Summary stats ----

export function summaryStats(
  options: string[],
  criteria: string[],
  weights: Weight[],
  normalizedWeights: NormalizedWeight[],
  cells: ScoreCell[],
  ranked: OptionTotal[],
): MatrixStats {
  const winner = identifyBestOption(ranked);
  const winnerTotal = ranked.length > 0 ? ranked[0].totalScore : 0;
  return {
    optionsCount: options.length,
    criteriaCount: criteria.length,
    winnerOption: winner,
    winnerTotal,
    marginOfVictory: calculateMarginOfVictory(ranked),
    totalWeight: totalRawWeight(weights),
    normalizedTotalWeight: normalizedWeights.reduce((s, w) => s + w.normalizedWeight, 0),
    cellsCount: cells.length,
    filledCellsCount: cells.filter((c) => c.score > 0).length,
  };
}

// ---- Renderers ----

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function fmt(n: number, decimals = 2): string {
  return Number.isFinite(n) ? n.toFixed(decimals) : "0.00";
}

/** Score → CSS background color class (for HTML renderer). */
export function scoreColor(score: number): string {
  if (score >= 5) return "#16a34a"; // green-600
  if (score === 4) return "#65a30d"; // lime-600
  if (score === 3) return "#ca8a04"; // yellow-600
  if (score === 2) return "#ea580c"; // orange-600
  if (score === 1) return "#dc2626"; // red-600
  return "#e5e7eb"; // gray-200 (missing)
}

/** Render the matrix as a plain-text report. */
export function renderText(
  input: MatrixInput,
  options: string[],
  criteria: string[],
  normalizedWeights: NormalizedWeight[],
  cells: ScoreCell[],
  ranked: OptionTotal[],
  stats: MatrixStats,
  sensitivity: SensitivityResult,
): string {
  const L: string[] = [];
  L.push("=".repeat(60));
  L.push("DECISION MATRIX REPORT");
  L.push("=".repeat(60));
  L.push("");
  L.push(`Decision: ${input.decisionTitle || "(untitled)"}`);
  L.push(`Options: ${stats.optionsCount}`);
  L.push(`Criteria: ${stats.criteriaCount}`);
  L.push(`Total raw weight: ${stats.totalWeight} (normalized to ${fmt(stats.normalizedTotalWeight)})`);
  L.push(`Cells filled: ${stats.filledCellsCount}/${stats.cellsCount}`);
  L.push("");

  L.push("-".repeat(60));
  L.push("WEIGHTS (normalized to 100)");
  L.push("-".repeat(60));
  normalizedWeights.forEach((w) => {
    L.push(`  ${w.criterion.padEnd(24)} ${fmt(w.normalizedWeight)}% (raw: ${w.rawWeight})`);
  });
  L.push("");

  L.push("-".repeat(60));
  L.push("SCORES + WEIGHTED SCORES");
  L.push("-".repeat(60));
  // Header row
  const optCol = 18;
  const critCol = 16;
  L.push(
    "  " + "Option".padEnd(optCol) + "Criterion".padEnd(critCol) +
      "Score".padStart(6) + "Weight".padStart(9) + "Weighted".padStart(9),
  );
  for (const c of cells) {
    L.push(
      "  " + c.option.slice(0, optCol - 1).padEnd(optCol) +
        c.criterion.slice(0, critCol - 1).padEnd(critCol) +
        String(c.score).padStart(6) +
        fmt(c.normalizedWeight, 1).padStart(8) + "%" +
        fmt(c.weightedScore).padStart(9),
    );
  }
  L.push("");

  L.push("-".repeat(60));
  L.push("RANKING");
  L.push("-".repeat(60));
  ranked.forEach((t) => {
    const marker = t.rank === 1 ? " ★" : "  ";
    L.push(`${marker} #${t.rank}  ${t.option.padEnd(28)} ${fmt(t.totalScore).padStart(10)}`);
  });
  L.push("");
  L.push(`Winner: ${stats.winnerOption || "—"}`);
  L.push(`Margin of victory: ${fmt(stats.marginOfVictory)}`);
  L.push("");

  L.push("-".repeat(60));
  L.push("SENSITIVITY ANALYSIS (±10% weight variation)");
  L.push("-".repeat(60));
  L.push(`Base winner: ${sensitivity.baseWinner || "—"}`);
  L.push(`Stable: ${sensitivity.stable ? "YES — winner is robust" : "NO — winner changes under variation"}`);
  if (sensitivity.variations.length > 0) {
    sensitivity.variations.forEach((v) => {
      const flag = v.winnerChanged ? " ⚠" : "";
      L.push(`  ${v.label.padEnd(24)} → ${v.winnerOption || "—"}${flag}`);
    });
  }
  L.push("");
  return L.join("\n");
}

/** Render the matrix as CSV: option, criterion, score, weight, weighted_score. */
export function renderCsv(
  options: string[],
  criteria: string[],
  normalizedWeights: NormalizedWeight[],
  cells: ScoreCell[],
  ranked: OptionTotal[],
): string {
  const lines = ["option,criterion,score,normalized_weight,weighted_score"];
  for (const c of cells) {
    lines.push(
      [
        escapeCsv(c.option),
        escapeCsv(c.criterion),
        String(c.score),
        fmt(c.normalizedWeight),
        fmt(c.weightedScore),
      ].join(","),
    );
  }
  lines.push("");
  lines.push("option,total_weighted_score,rank");
  for (const t of ranked) {
    lines.push([escapeCsv(t.option), fmt(t.totalScore), String(t.rank)].join(","));
  }
  lines.push("");
  for (const w of normalizedWeights) {
    lines.push(
      ["#weight", escapeCsv(w.criterion), fmt(w.normalizedWeight)].join(","),
    );
  }
  return lines.join("\n");
}

/** Render the matrix as a color-coded HTML table. */
export function renderHtml(
  input: MatrixInput,
  options: string[],
  criteria: string[],
  normalizedWeights: NormalizedWeight[],
  cells: ScoreCell[],
  ranked: OptionTotal[],
  stats: MatrixStats,
  sensitivity: SensitivityResult,
): string {
  const esc = escapeHtml;
  const winner = stats.winnerOption;

  const weightRow = criteria
    .map((c) => {
      const nw = normalizedWeights.find(
        (w) => normalizeName(w.criterion) === normalizeName(c),
      );
      const pct = nw ? fmt(nw.normalizedWeight, 1) : "0.0";
      return `<th class="weight">${esc(c)}<br/><span class="pct">${pct}%</span></th>`;
    })
    .join("");

  const bodyRows = options
    .map((option) => {
      const isWinner = option === winner;
      const cellsHtml = criteria
        .map((criterion) => {
          const cell = cells.find(
            (cc) => cc.option === option && cc.criterion === criterion,
          );
          const score = cell ? cell.score : 0;
          const ws = cell ? cell.weightedScore : 0;
          const color = scoreColor(score);
          const txt = score > 0 ? String(score) : "—";
          return `<td class="score" style="background:${color}22;border-left:3px solid ${color}" title="weighted: ${fmt(ws)}">${txt}</td>`;
        })
        .join("");
      const total = ranked.find((t) => t.option === option)?.totalScore ?? 0;
      const rank = ranked.find((t) => t.option === option)?.rank ?? 0;
      return `<tr class="${isWinner ? "winner" : ""}">
        <td class="opt">${rank === 1 ? "★ " : ""}${esc(option)}</td>
        ${cellsHtml}
        <td class="total">${fmt(total)}</td>
      </tr>`;
    })
    .join("");

  const variationsHtml = sensitivity.variations
    .map(
      (v) =>
        `<tr class="${v.winnerChanged ? "changed" : ""}"><td>${esc(v.label)}</td><td>${esc(v.winnerOption || "—")}</td><td>${v.winnerChanged ? "⚠ changed" : "same"}</td></tr>`,
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(input.decisionTitle || "Decision Matrix")}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;margin:40px;max-width:960px}
  h1{font-size:22px;margin:0 0 4px;color:#111}
  .muted{color:#666;font-size:13px;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}
  th,td{padding:8px 10px;border:1px solid #eee;text-align:left}
  th{background:#f5f5f5;text-transform:uppercase;font-size:11px;letter-spacing:.03em;color:#555}
  th.weight{font-size:11px;text-align:center}
  th.weight .pct{display:block;font-weight:normal;color:#888;font-size:10px}
  td.score{text-align:center;font-weight:bold;font-size:14px}
  td.opt{font-weight:500}
  td.total{text-align:right;font-weight:bold;background:#fafafa;font-family:monospace}
  tr.winner{background:#dcfce7 !important}
  tr.winner td.opt{color:#166534}
  tr.changed{background:#fef3c7}
  .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0;font-size:13px}
  .summary div{padding:8px 10px;background:#fafafa;border-radius:6px}
  .summary strong{display:block;color:#555;font-size:10px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}
  .summary .val{font-size:15px;color:#111}
  h2{font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:#555;margin:24px 0 8px;border-bottom:1px solid #eee;padding-bottom:4px}
  @media print{body{margin:12mm}}
</style></head><body>
<h1>${esc(input.decisionTitle || "Decision Matrix")}</h1>
<div class="muted">${stats.optionsCount} options · ${stats.criteriaCount} criteria · cells ${stats.filledCellsCount}/${stats.cellsCount}</div>
<div class="summary">
  <div><strong>Winner</strong><span class="val">${esc(winner || "—")}</span></div>
  <div><strong>Winner total</strong><span class="val">${fmt(stats.winnerTotal)}</span></div>
  <div><strong>Margin of victory</strong><span class="val">${fmt(stats.marginOfVictory)}</span></div>
  <div><strong>Total weight (raw)</strong><span class="val">${fmt(stats.totalWeight, 0)}</span></div>
</div>
<h2>Score matrix</h2>
<table>
  <thead><tr><th>Option</th>${weightRow}<th class="total">Total</th></tr></thead>
  <tbody>${bodyRows}</tbody>
</table>
<h2>Sensitivity analysis (±10% weight variation)</h2>
<div class="muted">Base winner: <strong>${esc(sensitivity.baseWinner || "—")}</strong> · Stable: <strong>${sensitivity.stable ? "YES" : "NO"}</strong></div>
<table>
  <thead><tr><th>Variation</th><th>Winner</th><th>Status</th></tr></thead>
  <tbody>${variationsHtml}</tbody>
</table>
</body></html>`;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:decision-matrix-builder:history";
const HISTORY_MAX = 20;

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

export function buildShareUrl(input: Partial<MatrixInput>): string {
  const params = new URLSearchParams();
  if (input.decisionTitle) params.set("title", input.decisionTitle);
  if (input.optionsText) params.set("opts", input.optionsText);
  if (input.criteriaText) params.set("crit", input.criteriaText);
  if (input.weightsText) params.set("weights", input.weightsText);
  if (input.scoresText) params.set("scores", input.scoresText);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<MatrixInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<MatrixInput> = {};
  if (params.get("title")) out.decisionTitle = params.get("title")!;
  if (params.get("opts")) out.optionsText = params.get("opts")!;
  if (params.get("crit")) out.criteriaText = params.get("crit")!;
  if (params.get("weights")) out.weightsText = params.get("weights")!;
  if (params.get("scores")) out.scoresText = params.get("scores")!;
  return out;
}
