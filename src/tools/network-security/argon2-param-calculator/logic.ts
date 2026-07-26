/**
 * Argon2 Parameter Calculator — pure logic.
 *
 * Helps tune Argon2id (RFC 9106) parameters to meet a target hashing time.
 * Provides OWASP-aligned presets, security-level scoring, memory/time
 * trade-off estimation, batch evaluation, and comparison tables.
 *
 * Pure only — no DOM, no crypto. Estimation uses an empirical throughput
 * model (Argon2id is roughly linear in memory cost × iterations × parallelism).
 */

export type Argon2Variant = "argon2id" | "argon2i" | "argon2d";

export interface Argon2Params {
  memoryKb: number;
  iterations: number;
  parallelism: number;
  variant: Argon2Variant;
  /** Output hash length in bytes. */
  hashLength: number;
}

export interface Argon2Estimate {
  params: Argon2Params;
  /** Estimated wall-clock time in milliseconds. */
  estimatedMs: number;
  /** Memory footprint in MB. */
  memoryMb: number;
  /** Security level score (0..100). */
  securityScore: number;
  /** Security tier label. */
  tier: SecurityTier;
  warnings: string[];
  notes: string[];
}

export type SecurityTier = "low" | "moderate" | "strong" | "maximum";

/** OWASP RFC 9106 recommended baseline. */
export const OWASP_PRESET: Argon2Params = {
  memoryKb: 19 * 1024, // 19 MB
  iterations: 2,
  parallelism: 1,
  variant: "argon2id",
  hashLength: 32,
};

export const PRESET_LEVELS: Array<{ id: string; label: string; params: Argon2Params }> = [
  { id: "test", label: "Test / Dev", params: { memoryKb: 64, iterations: 1, parallelism: 1, variant: "argon2id", hashLength: 16 } },
  { id: "low", label: "Low (interactive)", params: { memoryKb: 4 * 1024, iterations: 1, parallelism: 1, variant: "argon2id", hashLength: 24 } },
  { id: "moderate", label: "Moderate", params: { memoryKb: 8 * 1024, iterations: 2, parallelism: 2, variant: "argon2id", hashLength: 32 } },
  { id: "owasp", label: "OWASP RFC 9106", params: { ...OWASP_PRESET } },
  { id: "strong", label: "Strong", params: { memoryKb: 64 * 1024, iterations: 3, parallelism: 4, variant: "argon2id", hashLength: 32 } },
  { id: "maximum", label: "Maximum (paranoid)", params: { memoryKb: 256 * 1024, iterations: 4, parallelism: 8, variant: "argon2id", hashLength: 64 } },
];

/** Empirical throughput model — Argon2id at ~10 MiB/s per lane on a typical CPU. */
const THROUGHPUT_MB_PER_S = 10;

/** Estimate wall-clock time for a parameter set on a single-core baseline. */
export function estimateTimeMs(params: Argon2Params): number {
  const mb = params.memoryKb / 1024;
  // time = (memory / throughput) * iterations / parallelism (Amdahl-style approximation)
  const baseMs = (mb / THROUGHPUT_MB_PER_S) * 1000;
  const parallelFactor = Math.max(1, params.parallelism);
  return (baseMs * params.iterations) / parallelFactor;
}

/** Score the security level (0..100) based on memory, iterations, parallelism,
 *  variant, and hash length. Each component contributes a bounded slice:
 *  memory (0..40), iterations (0..20), parallelism (0..15), variant (0..5),
 *  hash length (0..20). */
export function securityScore(params: Argon2Params): number {
  const memLog = Math.log2(Math.max(1, params.memoryKb));
  const memScore = Math.min(40, (memLog / 20) * 40);
  const iterLog = Math.log2(Math.max(1, params.iterations));
  const iterScore = Math.min(20, (iterLog / 3) * 20);
  const parLog = Math.log2(Math.max(1, params.parallelism));
  const parScore = Math.min(15, (parLog / 3) * 15);
  const variantBonus = params.variant === "argon2id" ? 5 : params.variant === "argon2i" ? 3 : 0;
  const hashLog = Math.log2(Math.max(1, params.hashLength));
  const hashScore = Math.min(20, ((hashLog - 4) / 2) * 20);
  const raw = memScore + iterScore + parScore + variantBonus + hashScore;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/** Map a score to a security tier. */
export function scoreToTier(score: number): SecurityTier {
  if (score >= 80) return "maximum";
  if (score >= 60) return "strong";
  if (score >= 40) return "moderate";
  return "low";
}

/** Produce a full estimate for a parameter set. */
export function estimate(params: Argon2Params): Argon2Estimate {
  const warnings: string[] = [];
  const notes: string[] = [];
  if (params.memoryKb < 1024) warnings.push("Memory cost below 1 MiB — vulnerable to GPU attacks.");
  if (params.iterations < 1) warnings.push("Iterations must be at least 1.");
  if (params.parallelism < 1) warnings.push("Parallelism must be at least 1.");
  if (params.hashLength < 16) warnings.push("Hash length below 16 bytes — consider increasing.");
  if (params.variant !== "argon2id") notes.push(`${params.variant} is less resistant to side-channel attacks than argon2id.`);

  const estimatedMs = estimateTimeMs(params);
  const memoryMb = params.memoryKb / 1024;
  const score = securityScore(params);
  const tier = scoreToTier(score);

  if (estimatedMs < 50) notes.push("Hash time is very fast — consider increasing memory or iterations.");
  if (estimatedMs > 5000) warnings.push("Hash time exceeds 5s — may hurt user experience.");

  return { params, estimatedMs, memoryMb, securityScore: score, tier, warnings, notes };
}

/** Tune parameters to meet a target wall-clock time, keeping parallelism fixed. */
export function tuneForTime(targetMs: number, parallelism = 1, memoryKb = 19 * 1024): Argon2Params {
  let iterations = 1;
  let mem = memoryKb;
  let est = estimateTimeMs({ memoryKb: mem, iterations, parallelism, variant: "argon2id", hashLength: 32 });
  // First, scale iterations up to target.
  while (est < targetMs && iterations < 10) {
    iterations++;
    est = estimateTimeMs({ memoryKb: mem, iterations, parallelism, variant: "argon2id", hashLength: 32 });
  }
  // If still below, scale memory.
  while (est < targetMs && mem < 4 * 1024 * 1024) {
    mem *= 2;
    est = estimateTimeMs({ memoryKb: mem, iterations, parallelism, variant: "argon2id", hashLength: 32 });
  }
  return { memoryKb: mem, iterations, parallelism, variant: "argon2id", hashLength: 32 };
}

/** Explore the memory/time trade-off: how does total cost vary with memory? */
export function memoryTradeoff(params: Argon2Params, multipliers: number[] = [0.5, 1, 2, 4, 8]): Array<{ memoryKb: number; iterations: number; estimatedMs: number; securityScore: number }> {
  return multipliers.map((m) => {
    const memoryKb = Math.max(1, Math.round(params.memoryKb * m));
    const p: Argon2Params = { ...params, memoryKb };
    return {
      memoryKb,
      iterations: params.iterations,
      estimatedMs: estimateTimeMs(p),
      securityScore: securityScore(p),
    };
  });
}

/** Compare two parameter sets side-by-side. */
export function compareParams(a: Argon2Params, b: Argon2Params): {
  a: Argon2Estimate; b: Argon2Estimate;
  timeRatio: number; memoryRatio: number; scoreDelta: number;
} {
  const ea = estimate(a);
  const eb = estimate(b);
  return {
    a: ea, b: eb,
    timeRatio: eb.estimatedMs / Math.max(1, ea.estimatedMs),
    memoryRatio: b.memoryKb / Math.max(1, a.memoryKb),
    scoreDelta: eb.securityScore - ea.securityScore,
  };
}

/** Build a CLI command string for the argon2 CLI. */
export function toCliCommand(params: Argon2Params, password = "PASSWORD"): string {
  return [
    `echo -n '${password}' | argon2 ${"SALT"}`,
    `-id`, // argon2id
    `-t ${params.iterations}`,
    `-m ${Math.round(Math.log2(params.memoryKb))}`,
    `-p ${params.parallelism}`,
    `-l ${params.hashLength}`,
  ].join(" \\\n  ");
}

/** Build the libargon2 / argon2-cffi options object. */
export function toOptionsObject(params: Argon2Params): string {
  return JSON.stringify({
    type: params.variant,
    memoryCost: params.memoryKb,
    timeCost: params.iterations,
    parallelism: params.parallelism,
    hashLength: params.hashLength,
  }, null, 2);
}

export interface BatchItem { params: Argon2Params; label: string; }

/** Evaluate a batch of parameter sets. */
export function batchEstimate(items: BatchItem[]): Array<BatchItem & Argon2Estimate> {
  return items.map((it) => ({ ...it, ...estimate(it.params) }));
}

export interface BatchStats {
  count: number; avgScore: number; maxScore: number; minScore: number;
  avgTimeMs: number; maxMemoryMb: number;
}

export function batchStats(items: Array<BatchItem & Argon2Estimate>): BatchStats {
  if (items.length === 0) return { count: 0, avgScore: 0, maxScore: 0, minScore: 0, avgTimeMs: 0, maxMemoryMb: 0 };
  const scores = items.map((i) => i.securityScore);
  const times = items.map((i) => i.estimatedMs);
  const mems = items.map((i) => i.memoryMb);
  return {
    count: items.length,
    avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / items.length),
    maxScore: Math.max(...scores),
    minScore: Math.min(...scores),
    avgTimeMs: Math.round(times.reduce((a, b) => a + b, 0) / items.length),
    maxMemoryMb: Math.max(...mems),
  };
}

/** Render a CSV comparison table from a batch. */
export function renderBatchCsv(items: Array<BatchItem & Argon2Estimate>): string {
  const lines = ["label,variant,memory_kb,iterations,parallelism,hash_length,estimated_ms,security_score,tier"];
  for (const it of items) {
    lines.push([it.label, it.params.variant, String(it.params.memoryKb), String(it.params.iterations),
      String(it.params.parallelism), String(it.params.hashLength), String(Math.round(it.estimatedMs)),
      String(it.securityScore), it.tier].join(","));
  }
  return lines.join("\n");
}

/** Render a plain-text report for a single estimate. */
export function renderReport(e: Argon2Estimate): string {
  const lines: string[] = [];
  lines.push("Argon2 Parameter Report");
  lines.push("=".repeat(40));
  lines.push(`Variant:     ${e.params.variant}`);
  lines.push(`Memory:      ${e.params.memoryKb} KiB (${e.memoryMb.toFixed(2)} MiB)`);
  lines.push(`Iterations:  ${e.params.iterations}`);
  lines.push(`Parallelism: ${e.params.parallelism}`);
  lines.push(`Hash length: ${e.params.hashLength} bytes`);
  lines.push("");
  lines.push(`Estimated time: ${e.estimatedMs.toFixed(2)} ms`);
  lines.push(`Security score: ${e.securityScore} / 100 (${e.tier})`);
  if (e.warnings.length) { lines.push(""); lines.push("Warnings:"); e.warnings.forEach((w) => lines.push(`  ! ${w}`)); }
  if (e.notes.length) { lines.push(""); lines.push("Notes:"); e.notes.forEach((n) => lines.push(`  • ${n}`)); }
  return lines.join("\n");
}

/** Build a comparison table for the OWASP presets. */
export function presetComparisonTable(): string {
  const lines = ["Preset,Memory (MiB),Iterations,Parallelism,Est. ms,Score,Tier"];
  for (const p of PRESET_LEVELS) {
    const e = estimate(p.params);
    lines.push([p.label, e.memoryMb.toFixed(1), p.params.iterations, p.params.parallelism,
      e.estimatedMs.toFixed(1), e.securityScore, e.tier].join(","));
  }
  return lines.join("\n");
}

export function getPresetLevels() { return [...PRESET_LEVELS]; }
