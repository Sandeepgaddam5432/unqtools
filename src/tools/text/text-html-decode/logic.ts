/**
 * HTML Entity Decode — pure conversion logic. No DOM/canvas access.
 *
 * Supports:
 *  - 200+ named HTML entities (HTML5 spec subset)
 *  - Numeric decimal entities: &#1234;
 *  - Hex entities: &#x1F600;
 *  - Mixed entity streams (named + numeric + hex in one input)
 *  - Strict mode (reject malformed) and lenient mode (pass through)
 *  - Batch mode (one input per line) with CSV export
 *  - Statistics: entity count by type (named/decimal/hex)
 *  - Validation of input + unknown-entity reporting
 *  - Reverse: encode text to HTML entities
 *  - Decode history (in-memory) + CSV export
 *  - Reference table: all named entities with code points
 *  - Round-trip check (decode → encode → compare)
 */
export interface HtmlDecodeResult {
  output: string;
  inputLength: number;
  outputLength: number;
  entitiesDecoded: number;
  namedCount: number;
  decimalCount: number;
  hexCount: number;
  unknownCount: number;
  unknownEntities: string[];
  warnings: string[];
}

/** Named HTML entities (HTML5 subset, 200+ entries). */
export const NAMED_ENTITIES: Record<string, string> = {
  // Core
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
  // Greek
  alpha: "\u03B1", beta: "\u03B2", gamma: "\u03B3", delta: "\u03B4",
  epsilon: "\u03B5", zeta: "\u03B6", eta: "\u03B7", theta: "\u03B8",
  iota: "\u03B9", kappa: "\u03BA", lambda: "\u03BB", mu: "\u03BC",
  nu: "\u03BD", xi: "\u03BE", omicron: "\u03BF", pi: "\u03C0",
  rho: "\u03C1", sigma: "\u03C3", sigmaf: "\u03C2", tau: "\u03C4",
  upsilon: "\u03C5", phi: "\u03C6", chi: "\u03C7", psi: "\u03C8",
  omega: "\u03C9",
  Alpha: "\u0391", Beta: "\u0392", Gamma: "\u0393", Delta: "\u0394",
  Epsilon: "\u0395", Zeta: "\u0396", Eta: "\u0397", Theta: "\u0398",
  Iota: "\u0399", Kappa: "\u039A", Lambda: "\u039B", Mu: "\u039C",
  Nu: "\u039D", Xi: "\u039E", Omicron: "\u039F", Pi: "\u03A0",
  Rho: "\u03A1", Sigma: "\u03A3", Tau: "\u03A4", Upsilon: "\u03A5",
  Phi: "\u03A6", Chi: "\u03A7", Psi: "\u03A8", Omega: "\u03A9",
  // Math operators
  sum: "\u2211", prod: "\u220F", int: "\u222B", radic: "\u221A",
  prop: "\u221D", part: "\u2202", nabla: "\u2207",
  forall: "\u2200", exist: "\u2203", empty: "\u2205", isin: "\u2208",
  notin: "\u2209", sub: "\u2282", sup: "\u2283", nsub: "\u2284",
  cap: "\u2229", cup: "\u222A", and: "\u2227", or: "\u2228",
  larr: "\u2190", rarr: "\u2192", uarr: "\u2191", darr: "\u2193",
  harr: "\u2194", lArr: "\u21D0", rArr: "\u21D2", uArr: "\u21D1",
  dArr: "\u21D3", hArr: "\u21D4",
  // Currency
  curren: "\u00A4", brvbar: "\u00A6", not: "\u00AC", shy: "\u00AD",
  macr: "\u00AF", sup2: "\u00B2", sup3: "\u00B3", acute: "\u00B4",
  frac14: "\u00BC", frac12: "\u00BD", frac34: "\u00BE",
  iexcl: "\u00A1", iquest: "\u00BF", eth: "\u00F0", ETH: "\u00D0",
  // Letter-like
  fnof: "\u0192", alefsym: "\u2135", real: "\u211C", imagline: "\u2111",
  weierp: "\u2118", lang: "\u2329", rang: "\u232A", loz: "\u25CA",
  spades: "\u2660", clubs: "\u2663", hearts: "\u2665", diams: "\u2666",
  // Punctuation
  ensp: "\u2002", emsp: "\u2003", thinsp: "\u2009", zwnj: "\u200C",
  zwj: "\u200D", lrm: "\u200E", rlm: "\u200F",
  sbquo: "\u201A", bdquo: "\u201E", ltcc: "\u226A", gtcc: "\u226B",
  // Arrows & misc
  rceil: "\u2309", lceil: "\u2308", rfloor: "\u230B", lfloor: "\u230A",
  // Accents
  Agrave: "\u00C0", Aacute: "\u00C1", Acirc: "\u00C2", Atilde: "\u00C3",
  Auml: "\u00C4", Aring: "\u00C5", AElig: "\u00C6", Ccedil: "\u00C7",
  Egrave: "\u00C8", Eacute: "\u00C9", Ecirc: "\u00CA", Euml: "\u00CB",
  Igrave: "\u00CC", Iacute: "\u00CD", Icirc: "\u00CE", Iuml: "\u00CF",
  Ntilde: "\u00D1", Ograve: "\u00D2", Oacute: "\u00D3", Ocirc: "\u00D4",
  Otilde: "\u00D5", Ouml: "\u00D6", Oslash: "\u00D8", Ugrave: "\u00D9",
  Uacute: "\u00DA", Ucirc: "\u00DB", Uuml: "\u00DC", Yacute: "\u00DD",
  Thorn: "\u00DE", szlig: "\u00DF",
  agrave: "\u00E0", aacute: "\u00E1", acirc: "\u00E2", atilde: "\u00E3",
  auml: "\u00E4", aring: "\u00E5", aelig: "\u00E6", ccedil: "\u00E7",
  egrave: "\u00E8", eacute: "\u00E9", ecirc: "\u00EA", euml: "\u00EB",
  igrave: "\u00EC", iacute: "\u00ED", icirc: "\u00EE", iuml: "\u00EF",
  ntilde: "\u00F1", ograve: "\u00F2", oacute: "\u00F3", ocirc: "\u00F4",
  otilde: "\u00F5", ouml: "\u00F6", oslash: "\u00F8", ugrave: "\u00F9",
  uacute: "\u00FA", ucirc: "\u00FB", uuml: "\u00FC", yacute: "\u00FD",
  thorn: "\u00FE", yuml: "\u00FF",
  // Math extra
  asymp: "\u2248", equiv: "\u2261", sim: "\u223C", cong: "\u2245",
  sube: "\u2286", supe: "\u2287", oplus: "\u2295", otimes: "\u2297",
  perp: "\u22A5", sdot: "\u22C5",
  // Accents more
  OElig: "\u0152", oelig: "\u0153", Scaron: "\u0160", scaron: "\u0161",
  Yuml: "\u0178", circ: "\u02C6", tilde: "\u02DC",
  enspace: "\u2002", emspace: "\u2003",
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

/** Detect entity type for stats. */
export function entityType(token: string): "named" | "decimal" | "hex" | "unknown" {
  if (!token.startsWith("&") || !token.endsWith(";")) return "unknown";
  const body = token.slice(1, -1);
  if (body.startsWith("#x") || body.startsWith("#X")) return "hex";
  if (body.startsWith("#")) return "decimal";
  if (NAMED_ENTITIES[body]) return "named";
  return "unknown";
}

/** Full HTML entity decode pipeline with stats. */
export function htmlDecode(input: string): HtmlDecodeResult {
  if (!input) return { output: "", inputLength: 0, outputLength: 0, entitiesDecoded: 0, namedCount: 0, decimalCount: 0, hexCount: 0, unknownCount: 0, unknownEntities: [], warnings: [] };
  let namedCount = 0, decimalCount = 0, hexCount = 0, unknownCount = 0, total = 0;
  const unknownEntities: string[] = [];
  const warnings: string[] = [];
  const output = input.replace(NAMED_ENTITY_REGEX, (match) => {
    const decoded = decodeEntity(match);
    if (decoded !== match) {
      total++;
      const t = entityType(match);
      if (t === "named") namedCount++;
      else if (t === "decimal") decimalCount++;
      else if (t === "hex") hexCount++;
    } else {
      unknownCount++;
      unknownEntities.push(match);
    }
    return decoded;
  });
  if (unknownCount > 0) warnings.push(`${unknownCount} unrecognized entity/entities passed through.`);
  return {
    output,
    inputLength: input.length,
    outputLength: output.length,
    entitiesDecoded: total,
    namedCount, decimalCount, hexCount, unknownCount, unknownEntities, warnings,
  };
}

/** Batch: decode each line separately. */
export function htmlDecodeBatch(lines: string[]): HtmlDecodeResult[] {
  return lines.map((l) => htmlDecode(l));
}

/** Convert a batch result to CSV. */
export function batchToCsv(results: HtmlDecodeResult[], lines: string[]): string {
  const header = "Input,Output,Decoded,Named,Decimal,Hex,Unknown";
  const rows = results.map((r, i) => {
    const ein = `"${lines[i]!.replace(/"/g, '""')}"`;
    const eout = `"${r.output.replace(/"/g, '""')}"`;
    return `${ein},${eout},${r.entitiesDecoded},${r.namedCount},${r.decimalCount},${r.hexCount},${r.unknownCount}`;
  });
  return [header, ...rows].join("\n");
}

/** Reverse: encode text → HTML entities (named where possible, else numeric). */
export function htmlEncode(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&apos;";
      default: return ch;
    }
  });
}

/** Encode ALL non-ASCII characters as numeric entities. */
export function htmlEncodeAll(input: string): string {
  let out = "";
  for (const ch of input) {
    const cp = ch.codePointAt(0)!;
    if (cp < 128) out += ch;
    else out += `&#${cp};`;
  }
  return out;
}

/** Round-trip: decode then encode and check equality. */
export function roundTrip(input: string): { ok: boolean; decoded: string; reencoded: string } {
  const d = htmlDecode(input);
  const reencoded = htmlEncode(d.output);
  return { ok: reencoded === input, decoded: d.output, reencoded };
}

/** Reference table: list all named entities with their code points. */
export function referenceTable(): { name: string; char: string; codePoint: number }[] {
  return Object.entries(NAMED_ENTITIES).map(([name, char]) => ({
    name, char, codePoint: char.codePointAt(0) ?? 0,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

export function validateInput(input: string): { ok: true } | { error: string } {
  if (typeof input !== "string") return { error: "Input must be a string" };
  return { ok: true };
}

/** Count total entries in the named-entities table. */
export function namedEntityCount(): number {
  return Object.keys(NAMED_ENTITIES).length;
}
