/**
 * Shared page-range parsing for PDF tools.
 *
 * Accepts specs like "1-3, 5, 8-10", "4-" (to end) and "-3" (from start).
 * Returns 0-based page indices; order preserved, duplicates allowed (useful
 * for intentionally repeating pages while merging).
 */
import type { ToolResult } from "../../../lib/tool";

export function parsePageRanges(spec: string, pageCount: number): ToolResult<number[]> {
  if (pageCount < 1) {
    return { ok: false, error: "The document has no pages." };
  }
  const trimmed = spec.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a page range, e.g. 1-3, 5, 8-10." };
  }
  const indices: number[] = [];
  for (const rawPart of trimmed.split(",")) {
    const part = rawPart.replace(/\s+/g, "");
    if (!part) continue;
    if (/^\d+$/.test(part)) {
      const page = Number(part);
      if (page < 1 || page > pageCount) {
        return {
          ok: false,
          error: `Page ${page} is out of range (document has ${pageCount} page${pageCount === 1 ? "" : "s"}).`,
        };
      }
      indices.push(page - 1);
      continue;
    }
    const match = part.match(/^(\d*)-(\d*)$/);
    if (!match || (match[1] === "" && match[2] === "")) {
      return { ok: false, error: `Could not understand "${part}". Use formats like 1-3, 5, or 8-.` };
    }
    const start = match[1] === "" ? 1 : Number(match[1]);
    const end = match[2] === "" ? pageCount : Number(match[2]);
    if (start < 1 || end > pageCount || start > end) {
      return {
        ok: false,
        error: `Range "${part}" is invalid for a document with ${pageCount} page${pageCount === 1 ? "" : "s"}.`,
      };
    }
    for (let p = start; p <= end; p++) indices.push(p - 1);
  }
  if (indices.length === 0) {
    return { ok: false, error: "Enter a page range, e.g. 1-3, 5, 8-10." };
  }
  return { ok: true, output: indices };
}

/** Strip a trailing .pdf extension (case-insensitive) from a filename. */
export function stripPdfExtension(name: string): string {
  return name.replace(/\.pdf$/i, "");
}
