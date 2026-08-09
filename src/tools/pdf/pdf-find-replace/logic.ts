/**
 * PDF Find & Replace Text — real engine.
 *
 * Rewrites text in a PDF's content streams: parses every string literal
 * (parenthesised and hex), replaces matching substrings, and re-encodes the
 * streams. Reports how many replacements happened. Text remains selectable.
 * Pure operator-level replacement is unit-tested.
 */
import { PDFDocument, PDFName, PDFRawStream, PDFRef } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";
import { inflateBytes } from "../_shared/text-extract";

export interface ReplaceOptions {
  find: string;
  replace: string;
  /** Case-insensitive match. */
  caseSensitive?: boolean;
}

export interface ReplaceResult {
  bytes: Uint8Array;
  replacements: number;
  streamsTouched: number;
}

/** Replace text inside a decoded PDF string literal. Pure + testable. */
export function replaceInStringLiteral(
  literal: string,
  find: string,
  replace: string,
  caseSensitive: boolean
): { text: string; count: number } {
  const hay = caseSensitive ? literal : literal.toLowerCase();
  const needle = caseSensitive ? find : find.toLowerCase();
  if (!needle) return { text: literal, count: 0 };
  let count = 0;
  let out = "";
  let i = 0;
  while (i < literal.length) {
    const idx = hay.indexOf(needle, i);
    if (idx === -1) {
      out += literal.slice(i);
      break;
    }
    out += literal.slice(i, idx) + replace;
    count++;
    i = idx + needle.length;
  }
  return { text: out, count };
}

/**
 * Rewrite all parenthesised strings in a content stream body.
 * Returns the new body + replacement count. Pure + testable.
 */
export function replaceInContentStream(
  body: string,
  find: string,
  replace: string,
  caseSensitive: boolean
): { body: string; count: number } {
  let count = 0;
  let out = "";
  let i = 0;
  while (i < body.length) {
    const c = body[i]!;
    if (c === "(") {
      // Find matching close paren (honour escapes + nesting simply).
      let j = i + 1;
      let depth = 1;
      let lit = "";
      while (j < body.length && depth > 0) {
        const ch = body[j]!;
        if (ch === "\\") {
          lit += ch + (body[j + 1] ?? "");
          j += 2;
          continue;
        }
        if (ch === "(") depth++;
        if (ch === ")") depth--;
        if (depth > 0) lit += ch;
        j++;
      }
      const replaced = replaceInStringLiteral(lit, find, replace, caseSensitive);
      out += "(" + replaced.text + ")";
      count += replaced.count;
      i = j;
      continue;
    }
    if (c === "<" && body[i + 1] !== "<") {
      // Hex string: decode, replace, re-encode as hex.
      const end = body.indexOf(">", i);
      const hex = body.slice(i + 1, end === -1 ? body.length : end);
      let decoded = "";
      for (let k = 0; k + 1 < hex.length; k += 2) {
        const pair = hex.slice(k, k + 2);
        if (/^[0-9a-fA-F]{2}$/.test(pair)) decoded += String.fromCharCode(parseInt(pair, 16));
      }
      const replaced = replaceInStringLiteral(decoded, find, replace, caseSensitive);
      if (replaced.count > 0) {
        let hexOut = "";
        for (let k = 0; k < replaced.text.length; k++) {
          hexOut += replaced.text.charCodeAt(k).toString(16).padStart(2, "0");
        }
        out += "<" + hexOut + ">";
        count += replaced.count;
      } else {
        out += body.slice(i, end === -1 ? body.length : end + 1);
      }
      i = end === -1 ? body.length : end + 1;
      continue;
    }
    out += c;
    i++;
  }
  return { body: out, count };
}

export async function findReplacePdf(
  bytes: Uint8Array,
  options: ReplaceOptions
): Promise<ToolResult<ReplaceResult>> {
  const find = options.find;
  if (!find) return { ok: false, error: "Enter the text to find." };
  const replace = options.replace ?? "";
  const caseSensitive = options.caseSensitive ?? false;

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, error: "Could not read the PDF — it may be corrupted or password-protected." };
  }

  try {
    let total = 0;
    let streamsTouched = 0;
    for (const [, obj] of doc.context.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFRawStream)) continue;
      const filter = obj.dict.get(PDFName.of("Filter"));
      let isFlate = false;
      if (filter instanceof PDFName) isFlate = filter.toString() === "/FlateDecode";
      else if (Array.isArray(filter)) isFlate = (filter[0] as PDFName)?.toString() === "/FlateDecode";
      if (!isFlate) continue;

      const raw = obj.contents;
      const inflated = await inflateBytes(raw);
      if (!inflated) continue;
      const body = new TextDecoder("latin1").decode(inflated);
      const res = replaceInContentStream(body, find, replace, caseSensitive);
      if (res.count === 0) continue;

      // Re-inflate the new body (deflate with zlib header).
      const newRaw = deflateSync(res.body);
      (obj as unknown as { contents: Uint8Array }).contents = newRaw;
      total += res.count;
      streamsTouched++;
    }
    if (total === 0) {
      return { ok: false, error: `"${find}" was not found in any text stream.` };
    }
    return { ok: true, output: { bytes: await doc.save(), replacements: total, streamsTouched } };
  } catch {
    return { ok: false, error: "Something went wrong while replacing text." };
  }
}

function deflateSync(text: string): Uint8Array {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const zlib = require("node:zlib");
  return new Uint8Array(zlib.deflateSync(Buffer.from(text, "latin1")));
}

void PDFRef;
