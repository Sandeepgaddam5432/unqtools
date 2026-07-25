/** Text Entropy Calculator — pure logic. */

export interface EntropyOptions {
  caseSensitive?: boolean;
  base?: number; // log base: 2 (bits), 10, e (Math.E)
  /** When true, ignore whitespace characters. */
  ignoreWhitespace?: boolean;
  /** Optional alphabet to restrict analysis to. */
  alphabet?: string[];
}

export interface CharFrequency {
  char: string;
  count: number;
  frequency: number;
  percentage: number;
}

export interface HistogramBar {
  char: string;
  count: number;
  normalizedHeight: number; // 0-1
}

export interface EntropyResult {
  shannonEntropy: number; // bits per char (default base 2)
  totalBits: number; // shannonEntropy * charCount
  charCount: number;
  uniqueChars: number;
  topChars: CharFrequency[];
  allChars: CharFrequency[];
  randomnessScore: number; // 0-100
  maxEntropy: number; // log2(uniqueChars) if all uniform
  entropyRatio: number; // 0-1, actual / max
  histogram: HistogramBar[];
  warnings: string[];
}

/** Compute Shannon entropy and supporting metrics for a string. */
export function process(input: string, options: EntropyOptions = {}): EntropyResult {
  const warnings: string[] = [];
  const base = options.base ?? 2;
  let text = options.caseSensitive === false ? input.toLowerCase() : input;
  if (options.ignoreWhitespace) {
    text = text.replace(/\s+/g, "");
  }
  if (options.alphabet && options.alphabet.length > 0) {
    const allowed = new Set(options.alphabet);
    text = Array.from(text).filter((ch) => allowed.has(ch)).join("");
  }

  const counts = new Map<string, number>();
  for (const ch of text) {
    counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  const total = text.length;

  let entropy = 0;
  if (total > 0 && counts.size > 0) {
    for (const count of counts.values()) {
      const p = count / total;
      entropy -= p * (Math.log(p) / Math.log(base));
    }
  }

  const allChars: CharFrequency[] = [...counts.entries()]
    .map(([char, count]) => ({
      char,
      count,
      frequency: count / total,
      percentage: (count / total) * 100,
    }))
    .sort((a, b) => b.count - a.count);

  const topChars = allChars.slice(0, 10);

  const maxEntropy = total > 0 && counts.size > 0 ? Math.log(counts.size) / Math.log(base) : 0;
  const entropyRatio = maxEntropy > 0 ? entropy / maxEntropy : 0;
  const randomnessScore = Math.round(entropyRatio * 100);

  // Histogram bars for top 30 chars
  const maxCount = allChars.length > 0 ? allChars[0]!.count : 1;
  const histogram: HistogramBar[] = allChars.slice(0, 30).map((c) => ({
    char: c.char,
    count: c.count,
    normalizedHeight: maxCount > 0 ? c.count / maxCount : 0,
  }));

  if (total === 0) warnings.push("Input is empty.");
  if (total > 0 && total < 10) warnings.push("Sample size is small — entropy may not be statistically significant.");
  if (total > 0 && counts.size === 1) warnings.push("Only one unique character — entropy is 0.");
  if (total > 0 && entropyRatio > 0.95) warnings.push("Distribution is near-uniform — high entropy.");

  return {
    shannonEntropy: Math.round(entropy * 1000) / 1000,
    totalBits: Math.round(entropy * total * 1000) / 1000,
    charCount: total,
    uniqueChars: counts.size,
    topChars,
    allChars,
    randomnessScore,
    maxEntropy: Math.round(maxEntropy * 1000) / 1000,
    entropyRatio: Math.round(entropyRatio * 1000) / 1000,
    histogram,
    warnings,
  };
}

/** Batch: process multiple inputs. */
export function processBatch(inputs: string[], options: EntropyOptions = {}): EntropyResult[] {
  return inputs.map((s) => process(s, options));
}

/** Convert an entropy result to a CSV string. */
export function toCsv(r: EntropyResult): string {
  const lines = ["Char,Count,Frequency,Percentage"];
  for (const c of r.allChars) {
    const display = c.char === " " ? "(space)" : c.char === "\n" ? "(newline)" : c.char === "\t" ? "(tab)" : c.char;
    lines.push(`"${display}",${c.count},${c.frequency.toFixed(6)},${c.percentage.toFixed(4)}%`);
  }
  return lines.join("\n");
}

/** Generate an ASCII histogram for terminal display. */
export function toAsciiHistogram(r: EntropyResult, maxWidth = 40): string {
  const lines: string[] = [];
  for (const bar of r.histogram) {
    const display = bar.char === " " ? "␣" : bar.char === "\n" ? "⏎" : bar.char === "\t" ? "⇥" : bar.char;
    const barWidth = Math.max(1, Math.round(bar.normalizedHeight * maxWidth));
    lines.push(`${display.padEnd(2)} ${"█".repeat(barWidth)} ${bar.count}`);
  }
  return lines.join("\n");
}

/** Format an entropy result as a human-readable summary. */
export function formatSummary(r: EntropyResult): string {
  const lines = [
    `Shannon entropy: ${r.shannonEntropy} bits/char`,
    `Total bits: ${r.totalBits}`,
    `Characters: ${r.charCount}`,
    `Unique chars: ${r.uniqueChars}`,
    `Max possible entropy: ${r.maxEntropy} bits/char`,
    `Entropy ratio: ${r.entropyRatio}`,
    `Randomness score: ${r.randomnessScore}%`,
  ];
  return lines.join("\n");
}

/** Compute a "randomness verdict" from the entropy ratio. */
export function randomnessVerdict(r: EntropyResult): string {
  if (r.charCount === 0) return "Empty input.";
  if (r.randomnessScore >= 90) return "Excellent — looks like uniform random data.";
  if (r.randomnessScore >= 70) return "Good — fairly random distribution.";
  if (r.randomnessScore >= 40) return "Moderate — some pattern detected.";
  if (r.randomnessScore >= 10) return "Low — strong patterns present.";
  return "Very low — highly predictable.";
}

/** Validate entropy options. */
export function validateOptions(opts: EntropyOptions): { ok: true } | { error: string } {
  if (opts.base != null && (opts.base <= 0 || opts.base === 1)) {
    return { error: "Base must be > 0 and ≠ 1." };
  }
  return { ok: true };
}
