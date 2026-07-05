/**
 * Client-side helpers for PDF tools — binary downloads + size formatting.
 */

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

/** Trigger a browser download for raw bytes (used for generated PDFs). */
export function downloadBytes(bytes: Uint8Array, filename: string, mime = "application/pdf"): void {
  const copy = bytes.slice();
  const blob = new Blob([copy.buffer as ArrayBuffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
