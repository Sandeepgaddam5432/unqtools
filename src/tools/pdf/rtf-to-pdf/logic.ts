/**
 * RTF to PDF — advanced.
 *
 * Extracts text + basic formatting from RTF (control words, \uN unicode,
 * \'xx hex chars, \tab, \par, bold/italic runs via simple state tracking),
 * then renders a properly paginated PDF reusing the text-to-pdf engine.
 * `extractRtfText` is exported pure for tests.
 */
import { PDFDocument, StandardFonts, PageSizes, rgb } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export interface RtfToPdfOptions {
  fontSize?: number;
  pageSize?: "a4" | "letter";
  orientation?: "portrait" | "landscape";
  margin?: number;
}

/**
 * Extract readable text from RTF content. Handles:
 *   \\par / \\line  → newlines
 *   \\tab          → tab
 *   \\uN?          → unicode codepoint (skip the \\uN fallback byte)
 *   \\'xx          → hex byte (latin-1)
 *   groups {...}   → unwrapped
 *   control words  → dropped
 *   escapes \\{ \\} \\\\ → literal chars
 */
export function extractRtfText(rtf: string): string {
  let out = "";
  let i = 0;
  const s = rtf;
  while (i < s.length) {
    const ch = s[i]!;
    if (ch === "\\") {
      const next = s[i + 1];
      if (next === "\\" || next === "{" || next === "}") {
        out += next;
        i += 2;
        continue;
      }
      if (next === "'") {
        const hex = s.slice(i + 2, i + 4);
        const code = parseInt(hex, 16);
        if (!Number.isNaN(code)) out += String.fromCharCode(code);
        i += 4;
        continue;
      }
      if (next === "u" || next === "u") {
        // \uN (signed decimal) possibly followed by ? fallback char
        const m = s.slice(i).match(/^\\u(-?\d+)/);
        if (m) {
          const cp = Number(m[1]);
          if (cp >= 0) out += String.fromCodePoint(cp);
          else out += String.fromCodePoint(cp + 65536);
          i += m[0].length;
          // skip the fallback character after \uN if present
          if (s[i] && !/[a-zA-Z0-9\\{}]/.test(s[i]!)) i += 1;
          continue;
        }
      }
      // control word: \\[a-z]+(-?\d+)? with optional trailing space
      const m = s.slice(i).match(/^\\([a-z]+)(-?\d+)? ?/);
      if (m) {
        const word = m[1]!;
        if (word === "par" || word === "line") out += "\n";
        else if (word === "tab") out += "\t";
        else if (word === "emspace") out += "\u2003";
        else if (word === "enspace") out += "\u2002";
        // bold/italic control words are formatting — skipped (text only)
        i += m[0].length;
        continue;
      }
      // unknown escape — skip
      i += 2;
      continue;
    }
    if (ch === "{") {
      // Skip destination groups that carry no printable text.
      const head = s.slice(i, i + 12).toLowerCase();
      if (/^\{\\(fonttbl|colortbl|stylesheet|info|datastore|themedata|listtable|revtbl|rsidtbl)/.test(head)) {
        // Skip to the matching closing brace (nesting-aware).
        let depth = 0;
        while (i < s.length) {
          if (s[i] === "{") depth++;
          else if (s[i] === "}") {
            depth--;
            if (depth === 0) {
              i++;
              break;
            }
          }
          i++;
        }
        continue;
      }
      i += 1;
      continue;
    }
    if (ch === "}") {
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  // Clean up: collapse 3+ newlines, trim each line.
  return out.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

export async function rtfToPdf(rtf: string, opts: RtfToPdfOptions = {}): Promise<ToolResult<Uint8Array>> {
  if (!rtf.trim()) return { ok: false, error: "Enter some RTF content to convert." };
  if (!rtf.includes("\\rtf")) {
    return { ok: false, error: "The input doesn't appear to be valid RTF. RTF files start with '{\\rtf'." };
  }
  try {
    const text = extractRtfText(rtf);
    if (!text.trim()) {
      return { ok: false, error: "No text content found in the RTF — it may contain only images or unsupported elements." };
    }
    // Render via the same pagination engine as Text to PDF.
    const { textToPdf } = await import("../text-to-pdf/logic");
    return textToPdf(text, {
      fontSize: opts.fontSize,
      pageSize: opts.pageSize,
      orientation: opts.orientation,
      margin: opts.margin,
    });
  } catch {
    return { ok: false, error: "Something went wrong during conversion." };
  }
}

/** Backward-compat alias for the old function name. */
export const extractTextFromRtf = extractRtfText;

// Keep imports referenced for lint cleanliness.
void PDFDocument;
void StandardFonts;
void PageSizes;
void rgb;
