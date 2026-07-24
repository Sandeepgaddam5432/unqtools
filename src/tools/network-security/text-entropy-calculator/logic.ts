/** Text Entropy Calculator — pure logic. */

export interface EntropyOptions {
  caseSensitive?: boolean;
  base?: number; // log base: 2 (bits), 10, e
}

export interface EntropyResult {
  shannonEntropy: number; // bits per char (default base 2)
  charCount: number;
  uniqueChars: number;
  topChars: { char: string; count: number; frequency: number }[];
  randomnessScore: number; // 0-100
  warnings: string[];
}

export function process(input: string, options: EntropyOptions = {}): EntropyResult {
  const warnings: string[] = [];
  const base = options.base ?? 2;
  const text = options.caseSensitive === false ? input.toLowerCase() : input;
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
  const topChars = [...counts.entries()]
    .map(([char, count]) => ({ char, count, frequency: count / total }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const maxEntropy = total > 0 ? Math.log(counts.size) / Math.log(base) : 0;
  const randomnessScore = maxEntropy > 0 ? Math.round((entropy / maxEntropy) * 100) : 0;
  if (total === 0) warnings.push("Input is empty.");
  if (total < 10) warnings.push("Sample size is small — entropy may not be statistically significant.");
  return {
    shannonEntropy: Math.round(entropy * 1000) / 1000,
    charCount: total,
    uniqueChars: counts.size,
    topChars,
    randomnessScore,
    warnings,
  };
}

export function toCsv(r: EntropyResult): string {
  const lines = ["Char,Count,Frequency"];
  for (const c of r.topChars) {
    const display = c.char === " " ? "(space)" : c.char === "\n" ? "(newline)" : c.char === "\t" ? "(tab)" : c.char;
    lines.push(`"${display}",${c.count},${c.frequency.toFixed(4)}`);
  }
  return lines.join("\n");
}
