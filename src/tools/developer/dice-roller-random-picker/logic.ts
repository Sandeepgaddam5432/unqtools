/**
 * Dice Roller & Random Picker — pure logic.
 *
 * Full RPG dice-notation parser supporting:
 *   - '3d6'        basic roll
 *   - '3d6+2'      constant modifier
 *   - '4d6kh3'     keep highest 3 (drop lowest)
 *   - '2d20kl1'    keep lowest 1 (disadvantage)
 *   - 'd6!'        exploding dice (reroll on max, capped at 100)
 *   - '1d20+1d4-2' multi-term expressions
 *
 * Plus random list picker (weighted/unweighted), coin flip, seeded PRNG
 * (mulberry32) for reproducibility, roll history (localStorage), stats,
 * shareable URL. Pure functions only — no DOM, no network. Safe to unit
 * test and to run inside a Web Worker.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DiceTerm {
  count: number;             // number of dice (>= 1)
  faces: number;             // faces per die (>= 2)
  keepHighest: number | null; // kh N
  keepLowest: number | null;  // kl N
  explode: boolean;           // ! reroll on max
  negate: boolean;            // subtract term from total
}

export interface ConstantTerm {
  value: number;
}

export type ParsedPart =
  | { kind: "dice"; term: DiceTerm }
  | { kind: "constant"; term: ConstantTerm };

export interface ParsedDice {
  ok: boolean;
  parts: ParsedPart[];
  error?: string;
}

export interface DicePartResult {
  kind: "dice";
  notation: string;
  rolls: number[];      // raw die rolls (including explosions)
  kept: number[];       // which were kept after kh/kl
  value: number;        // sum of kept
  negate: boolean;
}

export interface ConstantPartResult {
  kind: "constant";
  notation: string;
  value: number;
}

export type PartResult = DicePartResult | ConstantPartResult;

export interface RollResult {
  ok: boolean;
  expression: string;
  total: number;
  parts: PartResult[];
  error?: string;
}

export interface RollStats {
  count: number;
  sum: number;
  mean: number;
  min: number;
  max: number;
  distribution: Record<number, number>;
}

export interface WeightedItem { item: string; weight: number; }

export interface HistoryEntry {
  ts: number;
  expression: string;
  total: number;
  seed: number | null;
  parts: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export interface DiceType { value: string; faces: number; label: string; }

export const DICE_TYPES: ReadonlyArray<DiceType> = [
  { value: "d4", faces: 4, label: "d4" },
  { value: "d6", faces: 6, label: "d6" },
  { value: "d8", faces: 8, label: "d8" },
  { value: "d10", faces: 10, label: "d10" },
  { value: "d12", faces: 12, label: "d12" },
  { value: "d20", faces: 20, label: "d20" },
  { value: "d100", faces: 100, label: "d100" },
];

export const SAMPLE_EXPRESSIONS: ReadonlyArray<string> = [
  "3d6",
  "4d6kh3",
  "2d20kh1",
  "2d20kl1",
  "1d20+5",
  "1d20+1d4+2",
  "8d6!",
  "1d100",
];

export const MAX_DICE_PER_TERM = 1000;
export const MAX_EXPLOSIONS = 100;
export const SAMPLE_SEED = 1337;

// ---------------------------------------------------------------------------
// PRNG — mulberry32 (seeded) + fallback Math.random
// ---------------------------------------------------------------------------

export interface Prng { next(): number; }

export function mulberry32(seed: number): Prng {
  let s = seed >>> 0;
  return {
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Build a Prng: seeded if seed > 0, otherwise Math.random-based. */
export function createPrng(seed: number | null | undefined): Prng {
  if (seed === null || seed === undefined || !Number.isFinite(seed) || seed <= 0) {
    return { next: () => Math.random() };
  }
  return mulberry32(seed >>> 0);
}

// ---------------------------------------------------------------------------
// Dice notation parser
// ---------------------------------------------------------------------------

/**
 * Parse a dice expression like '3d6+2', '4d6kh3', '2d20kl1', 'd6!',
 * '1d20+1d4-2'. Returns a discriminated union — on error the UI shows
 * `error`.
 */
export function parseDiceNotation(input: string): ParsedDice {
  const cleaned = (input || "").toLowerCase().replace(/\s+/g, "");
  if (!cleaned) return { ok: false, parts: [], error: "Empty expression." };

  const parts: ParsedPart[] = [];
  let idx = 0;
  let firstTerm = true;

  while (idx < cleaned.length) {
    // Sign for this term.
    let negate = false;
    if (cleaned[idx] === "+") { idx++; }
    else if (cleaned[idx] === "-") { negate = true; idx++; }
    else if (!firstTerm) {
      return { ok: false, parts: [], error: `Expected '+' or '-' at position ${idx}.` };
    }
    firstTerm = false;

    const rest = cleaned.slice(idx);

    // Try to parse a dice term: [count]d<faces>[modifiers]
    const diceMatch = rest.match(/^(\d*)d(\d+)(?:(kh|kl)(\d+))?(!)?/);
    if (diceMatch) {
      const count = diceMatch[1] ? parseInt(diceMatch[1], 10) : 1;
      const faces = parseInt(diceMatch[2], 10);
      const keepDir = diceMatch[3] as "kh" | "kl" | undefined;
      const keepN = diceMatch[4] ? parseInt(diceMatch[4], 10) : null;
      const explode = !!diceMatch[5];

      if (count < 1) return { ok: false, parts: [], error: `Invalid dice count: ${count}.` };
      if (count > MAX_DICE_PER_TERM) {
        return { ok: false, parts: [], error: `Dice count ${count} exceeds max of ${MAX_DICE_PER_TERM}.` };
      }
      if (faces < 2) return { ok: false, parts: [], error: `Invalid faces: ${faces} (must be >= 2).` };
      if (keepDir && (keepN === null || keepN < 1 || keepN > count)) {
        return { ok: false, parts: [], error: `Keep count must be 1..${count}.` };
      }

      const term: DiceTerm = {
        count,
        faces,
        keepHighest: keepDir === "kh" ? keepN : null,
        keepLowest: keepDir === "kl" ? keepN : null,
        explode,
        negate,
      };
      parts.push({ kind: "dice", term });
      idx += diceMatch[0].length;
    } else {
      // Try to parse a constant modifier (e.g. +2, -1).
      const constMatch = rest.match(/^(\d+)/);
      if (constMatch) {
        const value = parseInt(constMatch[1], 10) * (negate ? -1 : 1);
        parts.push({ kind: "constant", term: { value } });
        idx += constMatch[0].length;
      } else {
        return {
          ok: false,
          parts: [],
          error: `Unexpected character at position ${idx}: "${cleaned[idx] ?? ""}".`,
        };
      }
    }
  }

  return { ok: true, parts };
}

/** Format a DiceTerm back into canonical notation. */
export function formatTerm(term: DiceTerm): string {
  const sign = term.negate ? "-" : "";
  let s = `${sign}${term.count}d${term.faces}`;
  if (term.keepHighest !== null) s += `kh${term.keepHighest}`;
  if (term.keepLowest !== null) s += `kl${term.keepLowest}`;
  if (term.explode) s += "!";
  return s;
}

// ---------------------------------------------------------------------------
// Rolling
// ---------------------------------------------------------------------------

/** Roll a single die with `faces` sides. Returns 1..faces. */
export function rollDie(prng: Prng, faces: number): number {
  if (faces < 2) throw new Error(`Invalid faces: ${faces} (must be >= 2).`);
  return 1 + Math.floor(prng.next() * faces);
}

/** Roll a single dice term, applying explode + kh/kl. */
export function rollDiceTerm(prng: Prng, term: DiceTerm): DicePartResult {
  const rolls: number[] = [];
  for (let i = 0; i < term.count; i++) {
    let r = rollDie(prng, term.faces);
    rolls.push(r);
    if (term.explode && r === term.faces) {
      let explosions = 0;
      while (r === term.faces && explosions < MAX_EXPLOSIONS) {
        r = rollDie(prng, term.faces);
        rolls.push(r);
        explosions++;
      }
    }
  }

  let kept: number[];
  if (term.keepHighest !== null) {
    // Sort indices by value desc, take first N, then preserve original order for those indices.
    const indices = rolls.map((v, i) => ({ v, i }));
    indices.sort((a, b) => b.v - a.v);
    const keptIdx = new Set(indices.slice(0, term.keepHighest).map((x) => x.i));
    kept = rolls.filter((_, i) => keptIdx.has(i));
  } else if (term.keepLowest !== null) {
    const indices = rolls.map((v, i) => ({ v, i }));
    indices.sort((a, b) => a.v - b.v);
    const keptIdx = new Set(indices.slice(0, term.keepLowest).map((x) => x.i));
    kept = rolls.filter((_, i) => keptIdx.has(i));
  } else {
    kept = rolls.slice();
  }

  const value = kept.reduce((a, b) => a + b, 0);
  return {
    kind: "dice",
    notation: formatTerm(term),
    rolls,
    kept,
    value,
    negate: term.negate,
  };
}

/** Evaluate a full parsed dice expression. */
export function rollExpression(prng: Prng, expr: string): RollResult {
  const parsed = parseDiceNotation(expr);
  if (!parsed.ok) {
    return { ok: false, expression: expr, total: 0, parts: [], error: parsed.error };
  }
  let total = 0;
  const partResults: PartResult[] = [];
  for (const part of parsed.parts) {
    if (part.kind === "constant") {
      total += part.term.value;
      partResults.push({
        kind: "constant",
        notation: (part.term.value >= 0 ? "+" : "") + part.term.value,
        value: part.term.value,
      });
    } else {
      const res = rollDiceTerm(prng, part.term);
      total += res.negate ? -res.value : res.value;
      partResults.push(res);
    }
  }
  return { ok: true, expression: expr, total, parts: partResults };
}

// ---------------------------------------------------------------------------
// Random picker + coin flip
// ---------------------------------------------------------------------------

/** Pick one item uniformly from a list. */
export function pickFromList(prng: Prng, items: string[]): string {
  if (items.length === 0) throw new Error("Cannot pick from an empty list.");
  const idx = Math.floor(prng.next() * items.length);
  return items[idx];
}

/** Pick one item using weighted probabilities. */
export function pickWeighted(prng: Prng, items: WeightedItem[]): string {
  if (items.length === 0) throw new Error("Cannot pick from an empty list.");
  const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
  if (total <= 0) throw new Error("All weights are zero or negative — cannot pick.");
  let r = prng.next() * total;
  for (const it of items) {
    if (it.weight <= 0) continue;
    r -= it.weight;
    if (r < 0) return it.item;
  }
  return items[items.length - 1].item;
}

/** Flip a coin — returns 'heads' or 'tails' with equal probability. */
export function flipCoin(prng: Prng): "heads" | "tails" {
  return prng.next() < 0.5 ? "heads" : "tails";
}

/**
 * Parse a picker list. Each line is either:
 *   - 'item'              (weight = 1)
 *   - 'item :: weight'    (weight = N)
 *   - 'item:N'            (weight = N, shorthand)
 * Blank lines are skipped. Returns the raw items + weighted items.
 */
export function parsePickerList(input: string): { items: string[]; weighted: WeightedItem[]; } {
  const lines = (input || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const items: string[] = [];
  const weighted: WeightedItem[] = [];
  for (const line of lines) {
    let item: string;
    let weight = 1;
    if (line.includes("::")) {
      const [a, b] = splitOnce(line, "::");
      item = a.trim();
      const w = Number((b ?? "").trim());
      if (Number.isFinite(w) && w > 0) weight = w;
    } else if (/^(.+):(\d+(?:\.\d+)?)$/.test(line)) {
      const m = line.match(/^(.+):(\d+(?:\.\d+)?)$/);
      item = (m?.[1] ?? "").trim();
      const w = Number(m?.[2] ?? "1");
      if (Number.isFinite(w) && w > 0) weight = w;
    } else {
      item = line;
    }
    if (item) {
      items.push(item);
      weighted.push({ item, weight });
    }
  }
  return { items, weighted };
}

function splitOnce(s: string, sep: string): [string, string | undefined] {
  const i = s.indexOf(sep);
  if (i < 0) return [s, undefined];
  return [s.slice(0, i), s.slice(i + sep.length)];
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/** Compute sum, mean, min, max, distribution for a list of rolls. */
export function computeRollStats(rolls: number[]): RollStats {
  if (rolls.length === 0) {
    return { count: 0, sum: 0, mean: 0, min: 0, max: 0, distribution: {} };
  }
  let sum = 0;
  let min = rolls[0];
  let max = rolls[0];
  const distribution: Record<number, number> = {};
  for (const r of rolls) {
    sum += r;
    if (r < min) min = r;
    if (r > max) max = r;
    distribution[r] = (distribution[r] ?? 0) + 1;
  }
  return {
    count: rolls.length,
    sum,
    mean: sum / rolls.length,
    min,
    max,
    distribution,
  };
}

/** Collect all individual die rolls from a RollResult (excluding constant parts). */
export function collectDieRolls(result: RollResult): number[] {
  const out: number[] = [];
  for (const p of result.parts) {
    if (p.kind === "dice") out.push(...p.rolls);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Output renderers
// ---------------------------------------------------------------------------

/** Render a roll result as human-readable text. */
export function renderRollText(result: RollResult): string {
  if (!result.ok) return `Error: ${result.error ?? "unknown"}`;
  const lines: string[] = [];
  lines.push(`Expression: ${result.expression}`);
  lines.push(`Total: ${result.total}`);
  for (const p of result.parts) {
    if (p.kind === "dice") {
      const sign = p.negate ? "-" : "+";
      lines.push(`  ${sign} ${p.notation}: [${p.rolls.join(", ")}] → kept [${p.kept.join(", ")}] = ${p.value}`);
    } else {
      lines.push(`  ${p.notation} = ${p.value}`);
    }
  }
  return lines.join("\n");
}

/** Render a roll result as JSON. */
export function renderRollJson(result: RollResult): string {
  return JSON.stringify({
    expression: result.expression,
    ok: result.ok,
    total: result.total,
    error: result.error ?? null,
    parts: result.parts.map((p) =>
      p.kind === "dice"
        ? { kind: "dice", notation: p.notation, rolls: p.rolls, kept: p.kept, value: p.value, negate: p.negate }
        : { kind: "constant", notation: p.notation, value: p.value },
    ),
  }, null, 2);
}

/** Render multiple roll totals as CSV (index, expression, total). */
export function renderRollsCsv(rolls: Array<{ expression: string; total: number }>): string {
  const lines = ["index,expression,total"];
  rolls.forEach((r, i) => {
    const expr = `"${r.expression.replace(/"/g, '""')}"`;
    lines.push(`${i},${expr},${r.total}`);
  });
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:dice-roller:history";
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

// ---------------------------------------------------------------------------
// Shareable URL (config encoded in fragment — never sent to server)
// ---------------------------------------------------------------------------

export interface ShareConfig {
  expression: string;
  seed: number | null;
}

export function buildShareUrl(cfg: ShareConfig): string {
  const params = new URLSearchParams();
  if (cfg.expression) params.set("expr", cfg.expression);
  if (cfg.seed !== null && Number.isFinite(cfg.seed) && cfg.seed > 0) {
    params.set("seed", String(cfg.seed));
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareConfig {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { expression: "", seed: null };
  const params = new URLSearchParams(clean);
  const expression = params.get("expr") ?? "";
  const seedStr = params.get("seed");
  let seed: number | null = null;
  if (seedStr !== null) {
    const n = Number(seedStr);
    if (Number.isFinite(n) && n > 0) seed = n >>> 0;
  }
  return { expression, seed };
}
