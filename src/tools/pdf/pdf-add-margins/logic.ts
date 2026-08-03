/**
 * Add Margins to PDF — pure logic using pdf-lib.
 */
export interface PdfResult { ok: true; outputBytes: Uint8Array; pageCount: number; modified: number; }
export type PdfError = { ok: false; error: string; }

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function getPageSpec(spec: string, total: number): number[] {
  switch (spec) {
    case "all": return Array.from({ length: total }, (_, i) => i);
    case "first": return [0];
    case "last": return [total - 1];
    case "odd": return Array.from({ length: total }, (_, i) => i).filter(i => i % 2 === 0);
    case "even": return Array.from({ length: total }, (_, i) => i).filter(i => i % 2 === 1);
    default: return Array.from({ length: total }, (_, i) => i);
  }
}
