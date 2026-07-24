/** Text Deduplicator — pure logic. */

export type Mode = "lines" | "words";
export type MatchMethod = "exact" | "case-insensitive" | "fuzzy";

export interface DedupeOptions {
  mode: Mode;
  method: MatchMethod;
  fuzzyThreshold?: number; // 0-1 — similarity below this counts as duplicate
  keepFirst?: boolean;
  sortOutput?: boolean;
}

export interface DedupeResult {
  output: string;
  inputCount: number;
  outputCount: number;
  duplicatesRemoved: number;
  warnings: string[];
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length]!;
}

function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

export function process(input: string, options: DedupeOptions): DedupeResult | { error: string } {
  const warnings: string[] = [];
  const threshold = options.fuzzyThreshold ?? 0.85;
  if (threshold < 0 || threshold > 1) return { error: "Fuzzy threshold must be between 0 and 1" };
  const items = options.mode === "lines"
    ? input.split("\n")
    : (input.match(/\S+/g) ?? []);
  const inputCount = items.length;
  const kept: string[] = [];
  const seenKeys: string[] = [];
  const seenLower: string[] = [];
  for (const item of items) {
    let isDup = false;
    if (options.method === "exact") {
      if (seenKeys.includes(item)) isDup = true;
      else seenKeys.push(item);
    } else if (options.method === "case-insensitive") {
      const low = item.toLowerCase();
      if (seenLower.includes(low)) isDup = true;
      else seenLower.push(low);
    } else {
      for (const k of seenKeys) {
        if (similarity(k, item) >= threshold) { isDup = true; break; }
      }
      if (!isDup) seenKeys.push(item);
    }
    if (!isDup) kept.push(item);
  }
  let output = kept;
  if (options.sortOutput) output = [...kept].sort();
  if (inputCount === 0 || (inputCount === 1 && items[0] === "")) warnings.push("Input is empty.");
  return {
    output: output.join(options.mode === "lines" ? "\n" : " "),
    inputCount,
    outputCount: output.length,
    duplicatesRemoved: inputCount - output.length,
    warnings,
  };
}

export function batchToCsv(results: DedupeResult[], labels: string[]): string {
  const lines = ["Label,InputCount,OutputCount,DuplicatesRemoved"];
  results.forEach((r, i) => {
    if ("error" in r) return;
    lines.push(`${labels[i] ?? i},${r.inputCount},${r.outputCount},${r.duplicatesRemoved}`);
  });
  return lines.join("\n");
}
