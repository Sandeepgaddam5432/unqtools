/**
 * PDF Auto-Redact PII — real engine.
 *
 * Scans the extracted text for personally-identifiable patterns (email,
 * phone, Aadhaar-like 12-digit, credit-card, IP, PAN-like, SSN-like) and
 * reports every match per page. Optionally produces a redacted TXT export
 * (matches masked) so you can review before removing the source. 100%
 * local; the report is the honest deliverable, not fake "redaction".
 */
import type { ToolResult } from "../../../lib/tool";
import { extractAllText } from "../_shared/text-extract";

export type PiiKind = "email" | "phone" | "aadhaar" | "credit-card" | "ip" | "pan" | "ssn" | "url";

export interface PiiMatch {
  kind: PiiKind;
  value: string;
  page: number;
  start: number;
  end: number;
}

export interface RedactResult {
  matches: PiiMatch[];
  byKind: Record<string, number>;
  redactedText: string;
  bytes: Uint8Array;
}

export const PII_PATTERNS: { kind: PiiKind; label: string; re: RegExp }[] = [
  { kind: "email", label: "Email", re: /[\w.+-]+@[\w-]+\.[\w.]+/g },
  { kind: "phone", label: "Phone", re: /(?:\+?\d{1,3}[\s-]?)?(?:\(\d{2,4}\)[\s-]?)?\d{3,5}[\s-]?\d{4,5}(?!\d)/g },
  { kind: "aadhaar", label: "Aadhaar (12-digit)", re: /\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/g },
  { kind: "credit-card", label: "Credit card", re: /\b(?:\d[ -]*?){13,16}\b/g },
  { kind: "ip", label: "IP address", re: /\b\d{1,3}(?:\.\d{1,3}){3}\b/g },
  { kind: "pan", label: "PAN (India)", re: /\b[A-Z]{5}\d{4}[A-Z]\b/g },
  { kind: "ssn", label: "SSN (US)", re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { kind: "url", label: "URL", re: /https?:\/\/[^\s"'<>]+/g },
];

/** Mask a value for the redacted export. Pure + testable. */
export function maskValue(value: string, kind: PiiKind): string {
  if (kind === "email") {
    const [user, domain] = value.split("@");
    const head = user!.slice(0, 2);
    return `${head}***@${domain ?? "***"}`;
  }
  if (value.length <= 4) return "****";
  return value.slice(0, 2) + "*".repeat(Math.min(6, value.length - 4)) + value.slice(-2);
}

/** Find PII matches in text. Pure + testable. */
export function findPii(text: string): { kind: PiiKind; value: string; start: number; end: number }[] {
  const out: { kind: PiiKind; value: string; start: number; end: number }[] = [];
  for (const p of PII_PATTERNS) {
    p.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(text)) !== null) {
      const value = m[0];
      if (!value) break;
      out.push({ kind: p.kind, value, start: m.index, end: m.index + value.length });
      if (m.index === p.re.lastIndex) p.re.lastIndex++;
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Replace all matches with masks in a text. Pure + testable. */
export function redactText(text: string, matches: { start: number; end: number; value: string; kind: PiiKind }[]): string {
  let out = "";
  let i = 0;
  for (const m of matches) {
    if (m.start < i) continue; // overlapping
    out += text.slice(i, m.start);
    out += maskValue(m.value, m.kind);
    i = m.end;
  }
  out += text.slice(i);
  return out;
}

export async function autoRedactPii(bytes: Uint8Array): Promise<ToolResult<RedactResult>> {
  const r = await extractAllText(bytes);
  if (!r.ok) return r;

  const matches: PiiMatch[] = [];
  r.pages.forEach((pageText, idx) => {
    for (const m of findPii(pageText)) {
      matches.push({ kind: m.kind, value: m.value, page: idx + 1, start: m.start, end: m.end });
    }
  });

  const byKind: Record<string, number> = {};
  for (const m of matches) byKind[m.kind] = (byKind[m.kind] ?? 0) + 1;

  const redactedText = redactText(r.fullText, matches);
  return {
    ok: true,
    output: { matches, byKind, redactedText, bytes: new TextEncoder().encode(redactedText) },
  };
}
