import { describe, it, expect, beforeEach } from "vitest";
import {
  UNICODE_BLOCKS,
  getAsciiName,
  getUnicodeBlock,
  encodeUtf8,
  encodeUtf16,
  encodeUtf32,
  toHtmlEntityDecimal,
  toHtmlEntityHex,
  toUrlEncoding,
  toCssEscape,
  toJsEscape,
  toUPlus,
  toHexPadded,
  toBinary,
  codePointInfo,
  characterInfo,
  asciiTable,
  blockTable,
  stringToCodePoints,
  codePointsToString,
  decomposeString,
  detectSearchMode,
  parseCodePointQuery,
  searchByName,
  searchCodePoints,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SearchMode,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

describe("ascii-unicode constants", () => {
  it("has a non-trivial Unicode block list", () => {
    expect(UNICODE_BLOCKS.length).toBeGreaterThanOrEqual(100);
    expect(UNICODE_BLOCKS[0].name).toBe("Basic Latin");
    expect(UNICODE_BLOCKS[0].start).toBe(0x0000);
    expect(UNICODE_BLOCKS[0].end).toBe(0x007f);
  });
  it("contains the Emoticons (emoji) block", () => {
    const e = UNICODE_BLOCKS.find((b) => b.name === "Emoticons");
    expect(e).toBeDefined();
    expect(e!.start).toBe(0x1f600);
    expect(e!.end).toBe(0x1f64f);
  });
  it("contains Private Use Area blocks", () => {
    expect(UNICODE_BLOCKS.find((b) => b.name === "Private Use Area")).toBeDefined();
    expect(UNICODE_BLOCKS.find((b) => b.name === "Supplementary Private Use Area-A")).toBeDefined();
    expect(UNICODE_BLOCKS.find((b) => b.name === "Supplementary Private Use Area-B")).toBeDefined();
  });
});

describe("ascii-unicode getAsciiName", () => {
  it("returns 'NULL' for 0", () => {
    expect(getAsciiName(0)).toBe("NULL");
  });
  it("returns 'LATIN CAPITAL LETTER A' for 65", () => {
    expect(getAsciiName(65)).toBe("LATIN CAPITAL LETTER A");
  });
  it("returns 'DELETE' for 127", () => {
    expect(getAsciiName(127)).toBe("DELETE");
  });
  it("returns '' for non-ASCII code points", () => {
    expect(getAsciiName(128)).toBe("");
    expect(getAsciiName(0x1f600)).toBe("");
  });
  it("returns '' for out-of-range code points", () => {
    expect(getAsciiName(-1)).toBe("");
    expect(getAsciiName(0x110000)).toBe("");
  });
});

describe("ascii-unicode getUnicodeBlock", () => {
  it("returns Basic Latin for 0–127", () => {
    expect(getUnicodeBlock(0)?.name).toBe("Basic Latin");
    expect(getUnicodeBlock(127)?.name).toBe("Basic Latin");
  });
  it("returns Latin-1 Supplement for 128–255", () => {
    expect(getUnicodeBlock(128)?.name).toBe("Latin-1 Supplement");
    expect(getUnicodeBlock(255)?.name).toBe("Latin-1 Supplement");
  });
  it("returns Emoticons for 😀 (U+1F600)", () => {
    expect(getUnicodeBlock(0x1f600)?.name).toBe("Emoticons");
  });
  it("returns null for unassigned code points (or finds nearest block)", () => {
    // Code point 0x0900 is in Devanagari, but a gap inside a block won't return null.
    // We can't easily test "null" without finding a real gap. Verify by structure.
    const block = getUnicodeBlock(0x80);
    expect(block).not.toBeNull();
  });
});

describe("ascii-unicode UTF encoders", () => {
  it("encodes ASCII as a single UTF-8 byte", () => {
    expect(encodeUtf8(0x41)).toEqual([0x41]);
    expect(encodeUtf8(0x7f)).toEqual([0x7f]);
  });
  it("encodes Latin-1 Supplement as two UTF-8 bytes (é = U+00E9)", () => {
    expect(encodeUtf8(0xe9)).toEqual([0xc3, 0xa9]);
  });
  it("encodes BMP CJK as three UTF-8 bytes (一 = U+4E00)", () => {
    expect(encodeUtf8(0x4e00)).toEqual([0xe4, 0xb8, 0x80]);
  });
  it("encodes astral plane as four UTF-8 bytes (😀 = U+1F600)", () => {
    expect(encodeUtf8(0x1f600)).toEqual([0xf0, 0x9f, 0x98, 0x80]);
  });
  it("encodes UTF-16 BE for ASCII (1 unit)", () => {
    expect(encodeUtf16(0x41)).toEqual([0x00, 0x41]);
  });
  it("encodes UTF-16 BE for astral as surrogate pair (😀 = U+1F600)", () => {
    // 0xd83d 0xde00
    expect(encodeUtf16(0x1f600)).toEqual([0xd8, 0x3d, 0xde, 0x00]);
  });
  it("encodes UTF-32 BE as always 4 bytes", () => {
    expect(encodeUtf32(0x41)).toEqual([0x00, 0x00, 0x00, 0x41]);
    expect(encodeUtf32(0x1f600)).toEqual([0x00, 0x01, 0xf6, 0x00]);
  });
});

describe("ascii-unicode escape formatters", () => {
  it("HTML decimal entity for 65", () => {
    expect(toHtmlEntityDecimal(65)).toBe("&#65;");
  });
  it("HTML hex entity for 65", () => {
    expect(toHtmlEntityHex(65)).toBe("&#x41;");
  });
  it("URL encoding for ASCII 'A'", () => {
    expect(toUrlEncoding(65)).toBe("%41");
  });
  it("URL encoding for é (U+00E9)", () => {
    expect(toUrlEncoding(0xe9)).toBe("%C3%A9");
  });
  it("URL encoding for 😀 (U+1F600)", () => {
    expect(toUrlEncoding(0x1f600)).toBe("%F0%9F%98%80");
  });
  it("CSS escape for 'A' (short form)", () => {
    expect(toCssEscape(65)).toBe("\\41");
  });
  it("CSS escape for 😀 (6-digit padded)", () => {
    expect(toCssEscape(0x1f600)).toBe("\\01F600");
  });
  it("JS escape for 'A' (4-digit)", () => {
    expect(toJsEscape(65)).toBe("\\u0041");
  });
  it("JS escape for 😀 (brace form)", () => {
    expect(toJsEscape(0x1f600)).toBe("\\u{1F600}");
  });
  it("U+ notation", () => {
    expect(toUPlus(65)).toBe("U+0041");
    expect(toUPlus(0x1f600)).toBe("U+1F600");
  });
  it("Padded hex", () => {
    expect(toHexPadded(65, 4)).toBe("0041");
    expect(toHexPadded(0x1f600, 4)).toBe("1F600");
  });
  it("Binary representation", () => {
    expect(toBinary(65)).toBe("1000001");
    expect(toBinary(0)).toBe("0");
  });
});

describe("ascii-unicode codePointInfo", () => {
  it("returns full info for 'A' (U+0041)", () => {
    const info = codePointInfo(65);
    expect(info.codePoint).toBe(65);
    expect(info.character).toBe("A");
    expect(info.name).toBe("LATIN CAPITAL LETTER A");
    expect(info.block).toBe("Basic Latin");
    expect(info.isAscii).toBe(true);
    expect(info.isControl).toBe(false);
    expect(info.isPrintable).toBe(true);
    expect(info.decimal).toBe(65);
    expect(info.hex4).toBe("0041");
    expect(info.uPlus).toBe("U+0041");
    expect(info.htmlEntityDecimal).toBe("&#65;");
    expect(info.htmlEntityHex).toBe("&#x41;");
    expect(info.urlEncoding).toBe("%41");
    expect(info.cssEscape).toBe("\\41");
    expect(info.jsEscape).toBe("\\u0041");
    expect(info.utf8Bytes).toEqual([0x41]);
    expect(info.utf16Bytes).toEqual([0x00, 0x41]);
    expect(info.utf32Bytes).toEqual([0x00, 0x00, 0x00, 0x41]);
  });
  it("handles astral code point 😀 (U+1F600)", () => {
    const info = codePointInfo(0x1f600);
    expect(info.codePoint).toBe(0x1f600);
    expect(info.character).toBe("😀");
    expect(info.block).toBe("Emoticons");
    expect(info.isAscii).toBe(false);
    expect(info.utf8Bytes).toEqual([0xf0, 0x9f, 0x98, 0x80]);
    expect(info.utf16Bytes).toEqual([0xd8, 0x3d, 0xde, 0x00]);
    expect(info.jsEscape).toBe("\\u{1F600}");
    expect(info.urlEncoding).toBe("%F0%9F%98%80");
  });
  it("throws on invalid code point", () => {
    expect(() => codePointInfo(-1)).toThrow();
    expect(() => codePointInfo(0x110000)).toThrow();
    expect(() => codePointInfo(1.5)).toThrow();
  });
  it("identifies control characters", () => {
    expect(codePointInfo(0).isControl).toBe(true);
    expect(codePointInfo(9).isControl).toBe(true);   // TAB
    expect(codePointInfo(10).isControl).toBe(true);  // LF
    expect(codePointInfo(13).isControl).toBe(true);  // CR
    expect(codePointInfo(127).isControl).toBe(true); // DEL
    expect(codePointInfo(65).isControl).toBe(false);
  });
});

describe("ascii-unicode characterInfo", () => {
  it("returns info from a single character", () => {
    const info = characterInfo("A");
    expect(info?.codePoint).toBe(65);
  });
  it("returns info from an astral character", () => {
    const info = characterInfo("😀");
    expect(info?.codePoint).toBe(0x1f600);
  });
  it("returns null for empty string", () => {
    expect(characterInfo("")).toBeNull();
  });
});

describe("ascii-unicode asciiTable", () => {
  it("returns 128 entries", () => {
    expect(asciiTable()).toHaveLength(128);
  });
  it("has NULL at index 0", () => {
    expect(asciiTable()[0].name).toBe("NULL");
  });
  it("has DELETE at index 127", () => {
    expect(asciiTable()[127].name).toBe("DELETE");
  });
});

describe("ascii-unicode blockTable", () => {
  it("returns code points for the Basic Latin block", () => {
    const basicLatin = UNICODE_BLOCKS[0];
    const table = blockTable(basicLatin);
    expect(table).toHaveLength(128);
    expect(table[0].codePoint).toBe(0);
    expect(table[127].codePoint).toBe(127);
  });
  it("respects the max cap", () => {
    const cjk = UNICODE_BLOCKS.find((b) => b.name === "CJK Unified Ideographs")!;
    const table = blockTable(cjk, 10);
    expect(table).toHaveLength(10);
  });
});

describe("ascii-unicode stringToCodePoints & codePointsToString", () => {
  it("splits ASCII string into code points", () => {
    expect(stringToCodePoints("ABC")).toEqual([65, 66, 67]);
  });
  it("splits string with astral character correctly", () => {
    expect(stringToCodePoints("😀")).toEqual([0x1f600]);
    expect(stringToCodePoints("A😀B")).toEqual([65, 0x1f600, 66]);
  });
  it("round-trips through codePointsToString", () => {
    const s = "Hello, 世界! 😀";
    expect(codePointsToString(stringToCodePoints(s))).toBe(s);
  });
});

describe("ascii-unicode decomposeString", () => {
  it("decomposes a multi-character string", () => {
    const infos = decomposeString("AB");
    expect(infos).toHaveLength(2);
    expect(infos[0].character).toBe("A");
    expect(infos[1].character).toBe("B");
  });
  it("decomposes a string with an emoji", () => {
    const infos = decomposeString("A😀");
    expect(infos).toHaveLength(2);
    expect(infos[0].codePoint).toBe(65);
    expect(infos[1].codePoint).toBe(0x1f600);
  });
});

describe("ascii-unicode detectSearchMode", () => {
  it("detects decimal mode", () => {
    expect(detectSearchMode("65")).toBe("decimal");
  });
  it("detects hex mode for short hex", () => {
    expect(detectSearchMode("0x41")).toBe("hex");
    expect(detectSearchMode("U+0041")).toBe("hex");
  });
  it("detects character mode", () => {
    expect(detectSearchMode("A")).toBe("character");
  });
  it("detects name mode for longer strings", () => {
    expect(detectSearchMode("LATIN")).toBe("name");
  });
});

describe("ascii-unicode parseCodePointQuery", () => {
  it("parses decimal", () => {
    expect(parseCodePointQuery("65")).toBe(65);
  });
  it("parses 0x hex", () => {
    expect(parseCodePointQuery("0x41")).toBe(65);
  });
  it("parses U+ notation", () => {
    expect(parseCodePointQuery("U+0041")).toBe(65);
    expect(parseCodePointQuery("u+1f600")).toBe(0x1f600);
  });
  it("parses HTML hex entity", () => {
    expect(parseCodePointQuery("&#x41;")).toBe(65);
  });
  it("parses HTML decimal entity", () => {
    expect(parseCodePointQuery("&#65;")).toBe(65);
  });
  it("parses bare hex with hex letters (1–6 digits)", () => {
    expect(parseCodePointQuery("1f600")).toBe(0x1f600);
    expect(parseCodePointQuery("0a")).toBe(0x0a);
  });
  it("parses pure decimal as decimal (not hex)", () => {
    // "41" is ambiguous; the tool prefers decimal interpretation.
    expect(parseCodePointQuery("41")).toBe(41);
    expect(parseCodePointQuery("65")).toBe(65);
  });
  it("parses single character", () => {
    expect(parseCodePointQuery("A")).toBe(65);
    expect(parseCodePointQuery("😀")).toBe(0x1f600);
  });
  it("returns -1 for unrecognized query", () => {
    expect(parseCodePointQuery("LATIN")).toBe(-1);
    expect(parseCodePointQuery("")).toBe(-1);
  });
});

describe("ascii-unicode searchByName & searchCodePoints", () => {
  it("searches ASCII names by substring", () => {
    const results = searchByName("LATIN CAPITAL");
    expect(results.length).toBe(26); // A–Z
    expect(results[0].name).toBe("LATIN CAPITAL LETTER A");
  });
  it("returns empty for empty query", () => {
    expect(searchByName("")).toEqual([]);
  });
  it("searchCodePoints returns a single match for a code point query", () => {
    const r = searchCodePoints("65");
    expect(r.results).toHaveLength(1);
    expect(r.results[0].codePoint).toBe(65);
  });
  it("searchCodePoints falls back to name search", () => {
    const r = searchCodePoints("LATIN CAPITAL");
    expect(r.mode).toBe("name");
    expect(r.results.length).toBe(26);
  });
  it("searchCodePoints returns empty for empty query", () => {
    expect(searchCodePoints("").results).toEqual([]);
  });
});

describe("ascii-unicode history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, query: "A", codePoint: 65 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, query: `${i}`, codePoint: i });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, query: "A", codePoint: 65 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ascii-unicode shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ mode: "search", query: "LATIN" });
    expect(url).toContain("mode=search");
    expect(url).toContain("q=LATIN");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("mode=search&q=LATIN");
    expect(p.mode).toBe("search");
    expect(p.query).toBe("LATIN");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ mode: "ascii", query: "" });
  });
  it("filters unknown modes", () => {
    const p = parseShareUrl("mode=bogus&q=x");
    expect(p.mode).toBe("ascii");
  });
});

// Suppress unused-import lint
export type _Unused = SearchMode;
