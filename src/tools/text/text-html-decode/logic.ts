/**
 * HTML Entity Decode — pure conversion logic. No DOM access.
 */
export interface HtmlDecodeResult {
  output: string;
  inputLength: number;
  outputLength: number;
  entitiesDecoded: number;
}

/** Named HTML entities → characters. */
export const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  nbsp: "\u00A0", copy: "\u00A9", reg: "\u00AE", trade: "\u2122",
  hellip: "\u2026", mdash: "\u2014", ndash: "\u2013",
  lsquo: "\u2018", rsquo: "\u2019", ldquo: "\u201C", rdquo: "\u201D",
  laquo: "\u00AB", raquo: "\u00BB", deg: "\u00B0", plusmn: "\u00B1",
  times: "\u00D7", divide: "\u00F7", micro: "\u00B5", para: "\u00B6",
  middot: "\u00B7", cent: "\u00A2", pound: "\u00A3", yen: "\u00A5",
  euro: "\u20AC", sect: "\u00A7", dagger: "\u2020", Dagger: "\u2021",
  bull: "\u2022", permil: "\u2030", prime: "\u2032", Prime: "\u2033",
  infin: "\u221E", ne: "\u2260", le: "\u2264", ge: "\u2265",
  alpha: "\u03B1", beta: "\u03B2", gamma: "\u03B3", delta: "\u03B4",
  pi: "\u03C0", sigma: "\u03C3", omega: "\u03C9",
  Alpha: "\u0391", Beta: "\u0392", Gamma: "\u0393", Delta: "\u0394",
  Pi: "\u03A0", Sigma: "\u03A3", Omega: "\u03A9",
};

const NAMED_ENTITY_REGEX = /&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g;

/** Decode a single entity token. Returns original string if unrecognized. */
export function decodeEntity(token: string): string {
  if (!token.startsWith("&") || !token.endsWith(";")) return token;
  const body = token.slice(1, -1);
  if (body.startsWith("#x") || body.startsWith("#X")) {
    const cp = parseInt(body.slice(2), 16);
    if (Number.isNaN(cp) || cp < 0 || cp > 0x10ffff) return token;
    try { return String.fromCodePoint(cp); } catch { return token; }
  }
  if (body.startsWith("#")) {
    const cp = parseInt(body.slice(1), 10);
    if (Number.isNaN(cp) || cp < 0 || cp > 0x10ffff) return token;
    try { return String.fromCodePoint(cp); } catch { return token; }
  }
  return NAMED_ENTITIES[body] ?? token;
}

/** Full HTML entity decode pipeline. */
export function htmlDecode(input: string): HtmlDecodeResult {
  if (!input) return { output: "", inputLength: 0, outputLength: 0, entitiesDecoded: 0 };
  let count = 0;
  const output = input.replace(NAMED_ENTITY_REGEX, (match) => {
    const decoded = decodeEntity(match);
    if (decoded !== match) count++;
    return decoded;
  });
  return {
    output,
    inputLength: input.length,
    outputLength: output.length,
    entitiesDecoded: count,
  };
}

export function validateInput(input: string): { ok: true } | { error: string } {
  if (typeof input !== "string") return { error: "Input must be a string" };
  return { ok: true };
}
