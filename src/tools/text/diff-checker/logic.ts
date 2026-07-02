/** Diff Checker — pure logic. Line/word/char diff using LCS algorithm. */

export type DiffMode = "line" | "word" | "char";
export type DiffPart = { type: "equal" | "add" | "del"; text: string };

function tokenize(text: string, mode: DiffMode): string[] {
  if (mode === "line") return text.split(/(\n)/);
  if (mode === "word") return text.split(/(\s+)/);
  return Array.from(text);
}

function lcs(a: string[], b: string[]): number[][] {
  const m = a.length,
    n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] =
        a[i - 1] === b[j - 1] ? dp[i - 1]![j - 1]! + 1 : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    }
  }
  return dp;
}

export function diff(oldText: string, newText: string, mode: DiffMode): DiffPart[] {
  const a = tokenize(oldText, mode).filter((t) => t !== "");
  const b = tokenize(newText, mode).filter((t) => t !== "");
  const dp = lcs(a, b);
  const result: DiffPart[] = [];
  let i = a.length,
    j = b.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.unshift({ type: "equal", text: a[i - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      result.unshift({ type: "add", text: b[j - 1]! });
      j--;
    } else if (i > 0) {
      result.unshift({ type: "del", text: a[i - 1]! });
      i--;
    }
  }
  // Merge consecutive same-type parts
  const merged: DiffPart[] = [];
  for (const part of result) {
    const last = merged[merged.length - 1];
    if (last && last.type === part.type) last.text += part.text;
    else merged.push({ ...part });
  }
  return merged;
}

export interface DiffStats {
  additions: number;
  deletions: number;
  unchanged: number;
}

export function diffStats(parts: DiffPart[]): DiffStats {
  let additions = 0,
    deletions = 0,
    unchanged = 0;
  for (const p of parts) {
    if (p.type === "add") additions += p.text.length;
    else if (p.type === "del") deletions += p.text.length;
    else unchanged += p.text.length;
  }
  return { additions, deletions, unchanged };
}

export function diffPercentage(parts: DiffPart[]): number {
  const stats = diffStats(parts);
  const total = stats.additions + stats.deletions + stats.unchanged;
  if (total === 0) return 0;
  return ((stats.additions + stats.deletions) / total) * 100;
}
