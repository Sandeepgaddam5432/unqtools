/** Duplicate Lines Remover — pure logic. Remove duplicate lines with options. */

export interface DedupeOptions {
  caseSensitive: boolean;
  trim: boolean;
  keep: "first" | "last";
  sort: boolean;
  sortMode: "alphabetical" | "numeric" | "length" | "locale";
  collapseBlanks: boolean;
}

export const DEFAULT_OPTIONS: DedupeOptions = {
  caseSensitive: true,
  trim: false,
  keep: "first",
  sort: false,
  sortMode: "alphabetical",
  collapseBlanks: false,
};

export interface DedupeResult {
  output: string;
  removedCount: number;
  originalCount: number;
  remainingCount: number;
  removedLines: string[];
}

export function removeDuplicateLines(input: string, opts: DedupeOptions): DedupeResult {
  if (!input)
    return { output: "", removedCount: 0, originalCount: 0, remainingCount: 0, removedLines: [] };

  const o = { ...DEFAULT_OPTIONS, ...opts };
  const lines = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const originalCount = lines.length;

  const seen = new Map<string, number>(); // key → index in result
  const result: string[] = [];
  const removed: string[] = [];

  for (const line of lines) {
    const key = o.trim ? line.trim() : line;
    const lookupKey = o.caseSensitive ? key : key.toLowerCase();

    if (seen.has(lookupKey)) {
      removed.push(line);
      if (o.keep === "last") {
        // Replace the existing entry
        const existingIdx = seen.get(lookupKey)!;
        result[existingIdx] = line;
      }
    } else {
      seen.set(lookupKey, result.length);
      result.push(line);
    }
  }

  if (o.sort) {
    result.sort((a, b) => {
      const ka = o.trim ? a.trim() : a;
      const kb = o.trim ? b.trim() : b;
      if (o.sortMode === "numeric") return (parseFloat(ka) || 0) - (parseFloat(kb) || 0);
      if (o.sortMode === "length") return ka.length - kb.length;
      if (o.sortMode === "locale") return ka.localeCompare(kb);
      return ka.localeCompare(kb, undefined, { numeric: true });
    });
  }

  if (o.collapseBlanks) {
    for (let i = result.length - 1; i > 0; i--) {
      if (result[i]!.trim() === "" && result[i - 1]!.trim() === "") {
        result.splice(i, 1);
      }
    }
  }

  return {
    output: result.join("\n"),
    removedCount: removed.length,
    originalCount,
    remainingCount: result.length,
    removedLines: removed,
  };
}
