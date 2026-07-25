/**
 * URL Decode — pure conversion logic. No DOM access.
 */
export interface UrlDecodeOptions {
  /** True → decodeURIComponent (preserves Unicode). False → decode only %xx sequences. */
  component: boolean;
  /** True → also convert + to space (form-encoding behavior). */
  plusToSpace: boolean;
}

export interface UrlDecodeResult {
  output: string;
  inputLength: number;
  outputLength: number;
  invalidSequences: number;
}

/** Replace + with space if requested. */
export function normalizePlus(input: string, plusToSpace: boolean): string {
  return plusToSpace ? input.replace(/\+/g, " ") : input;
}

/** Pure decoder for %XX sequences (no plus handling). Returns decoded string + invalid count. */
export function decodePercent(input: string): { output: string; invalid: number } {
  let out = "";
  let invalid = 0;
  let i = 0;
  const utf8Bytes: number[] = [];
  const flush = () => {
    if (utf8Bytes.length === 0) return;
    let s = "";
    let j = 0;
    while (j < utf8Bytes.length) {
      const b1 = utf8Bytes[j]!;
      if (b1 < 0x80) { s += String.fromCharCode(b1); j++; }
      else if (b1 < 0xc0) { s += "\uFFFD"; j++; }
      else if (b1 < 0xe0) { s += String.fromCharCode(((b1 & 0x1f) << 6) | (utf8Bytes[j + 1]! & 0x3f)); j += 2; }
      else if (b1 < 0xf0) { s += String.fromCharCode(((b1 & 0x0f) << 12) | ((utf8Bytes[j + 1]! & 0x3f) << 6) | (utf8Bytes[j + 2]! & 0x3f)); j += 3; }
      else { const cp = ((b1 & 0x07) << 18) | ((utf8Bytes[j + 1]! & 0x3f) << 12) | ((utf8Bytes[j + 2]! & 0x3f) << 6) | (utf8Bytes[j + 3]! & 0x3f); s += String.fromCodePoint(cp); j += 4; }
    }
    out += s;
    utf8Bytes.length = 0;
  };
  while (i < input.length) {
    const ch = input[i]!;
    if (ch === "%") {
      const hex = input.slice(i + 1, i + 3);
      if (/^[0-9a-fA-F]{2}$/.test(hex)) {
        utf8Bytes.push(parseInt(hex, 16));
        i += 3;
        continue;
      } else {
        invalid++;
        out += ch;
        i++;
      }
    } else {
      flush();
      out += ch;
      i++;
    }
  }
  flush();
  return { output: out, invalid };
}

/** Full URL decode pipeline. */
export function urlDecode(input: string, opts: UrlDecodeOptions): UrlDecodeResult {
  if (!input) return { output: "", inputLength: 0, outputLength: 0, invalidSequences: 0 };
  const normalized = normalizePlus(input, opts.plusToSpace);
  if (opts.component) {
    try {
      const output = decodeURIComponent(normalized);
      return { output, inputLength: input.length, outputLength: output.length, invalidSequences: 0 };
    } catch {
      const r = decodePercent(normalized);
      return { output: r.output, inputLength: input.length, outputLength: r.output.length, invalidSequences: r.invalid };
    }
  }
  const r = decodePercent(normalized);
  return { output: r.output, inputLength: input.length, outputLength: r.output.length, invalidSequences: r.invalid };
}

export function validateOptions(opts: UrlDecodeOptions): { ok: true } | { error: string } {
  if (typeof opts.component !== "boolean") return { error: "component must be boolean" };
  if (typeof opts.plusToSpace !== "boolean") return { error: "plusToSpace must be boolean" };
  return { ok: true };
}
