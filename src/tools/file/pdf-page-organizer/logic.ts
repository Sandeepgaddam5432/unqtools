/**
 * PDF Page Organizer — pure logic.
 * Page-range parsing + plan generation. Actual PDF manipulation in ui.tsx via pdf-lib.
 */

export type Operation =
  | { kind: "delete"; pages: number[] }
  | { kind: "rotate"; pages: number[]; angle: 90 | 180 | 270 }
  | { kind: "extract"; pages: number[] }
  | { kind: "duplicate"; pages: number[] }
  | { kind: "reverse" }
  | { kind: "reorder"; newOrder: number[] }
  | { kind: "splitRanges"; ranges: number[][] };

export interface PageRange {
  start: number;
  end: number;
}

/** Parse page-range syntax like "1-5,8,12-15" into a list of 0-indexed page numbers. */
export function parsePageRanges(input: string, totalPages: number): number[] {
  const clean = input.trim().replace(/\s+/g, "");
  if (!clean) return [];
  const parts = clean.split(",");
  const result: number[] = [];
  for (const part of parts) {
    const rangeMatch = /^(\d+)-(\d+)$/.exec(part);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (start > end) continue;
      for (let i = start; i <= end; i++) {
        if (i >= 1 && i <= totalPages) result.push(i - 1);
      }
    } else {
      const n = Number(part);
      if (!Number.isNaN(n) && n >= 1 && n <= totalPages) result.push(n - 1);
    }
  }
  return [...new Set(result)];
}

/** Generate a list of split ranges from a string like "1-3,4-6,7-10". */
export function parseSplitRanges(input: string, totalPages: number): number[][] {
  const clean = input.trim();
  if (!clean) return [];
  // Auto-split into N equal parts
  if (/^split(\d+)$/.test(clean)) {
    const n = Number(clean.replace("split", ""));
    const size = Math.ceil(totalPages / n);
    const out: number[][] = [];
    for (let i = 0; i < totalPages; i += size) {
      const chunk: number[] = [];
      for (let j = i; j < Math.min(i + size, totalPages); j++) chunk.push(j);
      out.push(chunk);
    }
    return out;
  }
  // "every-N" — every N pages
  if (/^every(\d+)$/.test(clean)) {
    const n = Number(clean.replace("every", ""));
    const out: number[][] = [];
    for (let i = 0; i < totalPages; i += n) {
      const chunk: number[] = [];
      for (let j = i; j < Math.min(i + n, totalPages); j++) chunk.push(j);
      out.push(chunk);
    }
    return out;
  }
  // Comma-separated ranges
  const parts = clean.split(",");
  const out: number[][] = [];
  for (const part of parts) {
    const r = parsePageRanges(part, totalPages);
    if (r.length > 0) out.push(r);
  }
  return out;
}

/** Apply operations to a list of page indices. Returns new page order. */
export function applyOperations(totalPages: number, operations: Operation[]): number[] {
  let pages = Array.from({ length: totalPages }, (_, i) => i);
  for (const op of operations) {
    switch (op.kind) {
      case "delete": {
        const toDelete = new Set(op.pages);
        pages = pages.filter((p) => !toDelete.has(p));
        break;
      }
      case "extract": {
        const toExtract = new Set(op.pages);
        pages = pages.filter((p) => toExtract.has(p));
        break;
      }
      case "duplicate": {
        const toDup = new Set(op.pages);
        const newPages: number[] = [];
        for (const p of pages) {
          newPages.push(p);
          if (toDup.has(p)) newPages.push(p);
        }
        pages = newPages;
        break;
      }
      case "reverse": {
        pages = pages.reverse();
        break;
      }
      case "reorder": {
        pages = [...op.newOrder];
        break;
      }
      case "splitRanges":
      case "rotate": {
        // These don't change order, just affect output structure
        break;
      }
    }
  }
  return pages;
}

/** Generate a plan summary for display. */
export function summarizePlan(operations: Operation[], totalPages: number): string {
  if (operations.length === 0) return `No operations. PDF will pass through unchanged (${totalPages} pages).`;
  const lines: string[] = [`Operations (${operations.length}):`];
  for (let i = 0; i < operations.length; i++) {
    const op = operations[i]!;
    let desc = `${i + 1}. ${op.kind}`;
    if (op.kind === "delete" || op.kind === "extract" || op.kind === "duplicate") {
      desc += `: pages ${op.pages.map((p) => p + 1).join(", ")}`;
    } else if (op.kind === "rotate") {
      desc += `: pages ${op.pages.map((p) => p + 1).join(", ")} by ${op.angle}°`;
    } else if (op.kind === "splitRanges") {
      desc += `: ${op.ranges.length} chunks`;
    } else if (op.kind === "reorder") {
      desc += `: ${op.newOrder.length} pages in new order`;
    }
    lines.push(desc);
  }
  return lines.join("\n");
}

/** Build a CSV of the final page mapping (original page → new position). */
export function pageMappingToCsv(finalOrder: number[]): string {
  const lines = ["NewPosition,OriginalPage"];
  for (let i = 0; i < finalOrder.length; i++) {
    lines.push(`${i + 1},${finalOrder[i]! + 1}`);
  }
  return lines.join("\n");
}

/** Format a human-readable summary of the final result. */
export function formatResultSummary(originalPages: number, finalPages: number, operations: Operation[]): string {
  const delta = finalPages - originalPages;
  return [
    `PDF Page Organization Summary`,
    `=============================`,
    `Original pages: ${originalPages}`,
    `Final pages: ${finalPages}`,
    `Delta: ${delta > 0 ? "+" : ""}${delta}`,
    `Operations applied: ${operations.length}`,
    ``,
  ].join("\n");
}
