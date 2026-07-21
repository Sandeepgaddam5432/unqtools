import { describe, it, expect, beforeEach } from "vitest";
import {
  SUPPORTED_BYTES_PER_LINE,
  SUPPORTED_GROUP_SIZES,
  INSPECTOR_TYPES,
  hexStringToBytes, bytesToHexString, byteToHex, byteToAscii,
  stringToBytes, formatByteSize, parseOffset,
  renderHexDump, renderHexDumpText, parseHexDumpText,
  setByte, setBytes, insertBytes, deleteBytes, replaceBytes,
  search, bytesToAsciiString, findNextMatch, findPrevMatch,
  formatByte, formatBytes,
  inspect, inspectBoth,
  checksum, crc32, adler32, allChecksums,
  detectFileType,
  loadHistory, saveHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  initUndo, pushUndo, undo, redo,
  type Endian, type DisplayFormat, type InspectorType, type HexDumpOptions,
  type ChecksumAlgorithm, type HistoryEntry,
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

const u8 = (arr: number[]) => new Uint8Array(arr);

describe("hex-dump constants", () => {
  it("exposes supported bytes per line", () => {
    expect(SUPPORTED_BYTES_PER_LINE).toEqual([8, 16, 32]);
  });
  it("exposes supported group sizes", () => {
    expect(SUPPORTED_GROUP_SIZES).toEqual([1, 2, 4, 8]);
  });
  it("exposes 16 inspector types", () => {
    expect(INSPECTOR_TYPES.length).toBe(16);
    expect(INSPECTOR_TYPES).toContain("int32");
    expect(INSPECTOR_TYPES).toContain("uleb128");
  });
});

describe("hex-dump conversion helpers", () => {
  it("hexStringToBytes converts hex string to bytes", () => {
    expect(hexStringToBytes("FFD8FFE0")).toEqual(u8([0xff, 0xd8, 0xff, 0xe0]));
  });
  it("hexStringToBytes handles spaces and 0x prefix", () => {
    expect(hexStringToBytes("0xFF D8 FF E0")).toEqual(u8([0xff, 0xd8, 0xff, 0xe0]));
  });
  it("hexStringToBytes handles lowercase", () => {
    expect(hexStringToBytes("ffd8ffe0")).toEqual(u8([0xff, 0xd8, 0xff, 0xe0]));
  });
  it("hexStringToBytes rejects odd length", () => {
    expect(() => hexStringToBytes("FFF")).toThrow();
  });
  it("hexStringToBytes rejects non-hex", () => {
    expect(() => hexStringToBytes("ZZ")).toThrow();
  });
  it("hexStringToBytes empty returns empty array", () => {
    expect(hexStringToBytes("")).toEqual(new Uint8Array(0));
  });
  it("bytesToHexString converts bytes to hex", () => {
    expect(bytesToHexString(u8([0xff, 0xd8, 0xff]))).toBe("FFD8FF");
  });
  it("bytesToHexString supports lowercase and separator", () => {
    expect(bytesToHexString(u8([0xff, 0xd8]), false, " ")).toBe("ff d8");
  });
  it("byteToHex returns 2-digit hex", () => {
    expect(byteToHex(0)).toBe("00");
    expect(byteToHex(255)).toBe("FF");
    expect(byteToHex(15, false)).toBe("0f");
  });
  it("byteToAscii returns printable char or dot", () => {
    expect(byteToAscii(65)).toBe("A");
    expect(byteToAscii(32)).toBe(" ");
    expect(byteToAscii(0)).toBe(".");
    expect(byteToAscii(127)).toBe(".");
    expect(byteToAscii(126)).toBe("~");
  });
  it("stringToBytes encodes UTF-8", () => {
    expect(stringToBytes("AB")).toEqual(u8([0x41, 0x42]));
  });
  it("formatByteSize formats human-readable", () => {
    expect(formatByteSize(0)).toBe("0 B");
    expect(formatByteSize(1024)).toBe("1.00 KB");
    expect(formatByteSize(1048576)).toBe("1.00 MB");
  });
  it("parseOffset handles decimal and hex", () => {
    expect(parseOffset("0x1F")).toBe(31);
    expect(parseOffset("1F")).toBe(31);
    expect(parseOffset("31")).toBe(31);
    expect(parseOffset("xyz")).toBe(-1);
  });
});

describe("hex-dump rendering", () => {
  it("renders a basic hex dump", () => {
    const bytes = u8([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x21, 0x00, 0xff]);
    const lines = renderHexDump(bytes, { bytesPerLine: 8 });
    expect(lines).toHaveLength(1);
    expect(lines[0].offset).toBe(0);
    expect(lines[0].hex).toBe("48 65 6C 6C 6F 21 00 FF");
    expect(lines[0].ascii).toBe("Hello!..");
  });
  it("renders with multiple lines", () => {
    const bytes = u8(Array.from({ length: 24 }, (_, i) => i));
    const lines = renderHexDump(bytes, { bytesPerLine: 8 });
    expect(lines).toHaveLength(3);
    expect(lines[0].offset).toBe(0);
    expect(lines[1].offset).toBe(8);
    expect(lines[2].offset).toBe(16);
  });
  it("pads the last line", () => {
    const bytes = u8([0x01, 0x02, 0x03]);
    const lines = renderHexDump(bytes, { bytesPerLine: 8 });
    expect(lines).toHaveLength(1);
    expect(lines[0].hex).toContain("  ");
    expect(lines[0].bytes).toEqual([1, 2, 3]);
  });
  it("supports groupSize=2", () => {
    const bytes = u8([0x01, 0x02, 0x03, 0x04]);
    const lines = renderHexDump(bytes, { bytesPerLine: 4, groupSize: 2 });
    expect(lines[0].hex).toBe("0102 0304");
  });
  it("supports decimal offset", () => {
    const bytes = u8([0xab, 0xcd]);
    const lines = renderHexDump(bytes, { bytesPerLine: 8, offsetBase: "dec" });
    expect(lines[0].offset).toBe(0);
  });
  it("supports startOffset", () => {
    const bytes = u8([0x01, 0x02, 0x03, 0x04]);
    const lines = renderHexDump(bytes, { bytesPerLine: 8, startOffset: 100 });
    expect(lines[0].offset).toBe(100);
  });
  it("renderHexDumpText produces copyable output", () => {
    const bytes = u8([0x48, 0x49]);
    const text = renderHexDumpText(bytes, { bytesPerLine: 8 });
    expect(text).toContain("48 49");
    expect(text).toContain("HI");
  });
  it("parseHexDumpText parses back", () => {
    const bytes = u8([0xff, 0xd8, 0xff, 0xe0]);
    const text = renderHexDumpText(bytes, { bytesPerLine: 8 });
    const parsed = parseHexDumpText(text);
    expect(Array.from(parsed)).toEqual([0xff, 0xd8, 0xff, 0xe0]);
  });
  it("parseHexDumpText tolerates colon format", () => {
    const parsed = parseHexDumpText("00000000: FF D8 FF E0  ....");
    expect(Array.from(parsed)).toEqual([0xff, 0xd8, 0xff, 0xe0]);
  });
});

describe("hex-dump editing", () => {
  it("setByte overwrites in place", () => {
    const orig = u8([1, 2, 3]);
    const out = setByte(orig, 1, 0xff);
    expect(Array.from(out)).toEqual([1, 0xff, 3]);
    // Original is unchanged
    expect(Array.from(orig)).toEqual([1, 2, 3]);
  });
  it("setByte throws for out-of-range offset", () => {
    expect(() => setByte(u8([1, 2]), 5, 0)).toThrow();
  });
  it("setBytes overwrites a range", () => {
    const out = setBytes(u8([1, 2, 3, 4]), 1, [0xaa, 0xbb]);
    expect(Array.from(out)).toEqual([1, 0xaa, 0xbb, 4]);
  });
  it("insertBytes shifts later bytes right", () => {
    const out = insertBytes(u8([1, 2, 3]), 1, [0xaa]);
    expect(Array.from(out)).toEqual([1, 0xaa, 2, 3]);
  });
  it("insertBytes at end appends", () => {
    const out = insertBytes(u8([1, 2]), 2, [0xaa]);
    expect(Array.from(out)).toEqual([1, 2, 0xaa]);
  });
  it("deleteBytes shifts later bytes left", () => {
    const out = deleteBytes(u8([1, 2, 3, 4]), 1, 2);
    expect(Array.from(out)).toEqual([1, 4]);
  });
  it("replaceBytes can change length", () => {
    const out = replaceBytes(u8([1, 2, 3, 4]), 1, 2, [0xaa]);
    expect(Array.from(out)).toEqual([1, 0xaa, 4]);
  });
  it("replaceBytes can grow", () => {
    const out = replaceBytes(u8([1, 2, 3]), 1, 0, [0xaa, 0xbb]);
    expect(Array.from(out)).toEqual([1, 0xaa, 0xbb, 2, 3]);
  });
});

describe("hex-dump search", () => {
  const bytes = u8([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd8, 0xff, 0xe0]);
  it("searches for hex bytes", () => {
    const r = search(bytes, "FFD8", "hex");
    expect(r.matches).toHaveLength(2);
    expect(r.matches[0].offset).toBe(0);
    expect(r.matches[1].offset).toBe(4);
    expect(r.matches[0].length).toBe(2);
  });
  it("searches for ASCII text", () => {
    const textBytes = u8([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    const r = search(textBytes, "Hello", "text");
    expect(r.matches).toHaveLength(2);
    expect(r.matches[0].offset).toBe(0);
    expect(r.matches[1].offset).toBe(5);
  });
  it("searches with regex", () => {
    const textBytes = u8([0x41, 0x42, 0x43, 0x44]); // "ABCD"
    // 'B.D' matches 'BCD' at index 1 (B, any char, D)
    const r = search(textBytes, "B.D", "regex");
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0].offset).toBe(1);
    expect(r.matches[0].length).toBe(3);
  });
  it("returns error for invalid regex", () => {
    const r = search(bytes, "(", "regex");
    expect(r.error).toBeDefined();
  });
  it("returns error for invalid hex", () => {
    const r = search(bytes, "ZZ", "hex");
    expect(r.error).toBeDefined();
  });
  it("returns empty for empty query", () => {
    expect(search(bytes, "", "hex").matches).toEqual([]);
  });
  it("findNextMatch returns next match from offset", () => {
    const matches = [{ offset: 0, length: 2 }, { offset: 4, length: 2 }];
    expect(findNextMatch(matches, 0)).toBe(0);
    expect(findNextMatch(matches, 1)).toBe(1);
    expect(findNextMatch(matches, 99)).toBe(-1);
  });
  it("findPrevMatch returns previous match", () => {
    const matches = [{ offset: 0, length: 2 }, { offset: 4, length: 2 }];
    expect(findPrevMatch(matches, 5)).toBe(1);
    expect(findPrevMatch(matches, 4)).toBe(0);
    expect(findPrevMatch(matches, 0)).toBe(-1);
  });
  it("bytesToAsciiString renders non-printable as dot", () => {
    expect(bytesToAsciiString(u8([0x41, 0x00, 0x42]))).toBe("A.B");
  });
});

describe("hex-dump display formats", () => {
  it("formatByte renders each format", () => {
    expect(formatByte(0xff, "hex")).toBe("FF");
    expect(formatByte(0xff, "dec")).toBe("255");
    expect(formatByte(0xff, "bin")).toBe("11111111");
    expect(formatByte(0xff, "oct")).toBe("377");
  });
  it("formatBytes renders a slice", () => {
    expect(formatBytes(u8([0x01, 0x02]), "hex")).toBe("01 02");
    expect(formatBytes(u8([0x01, 0x02]), "bin")).toBe("00000001 00000010");
  });
});

describe("hex-dump data inspector", () => {
  it("reads uint8", () => {
    const r = inspect(u8([0xff]), 0, "uint8");
    expect(r.value).toBe("255");
    expect(r.bytesConsumed).toBe(1);
  });
  it("reads int8 signed", () => {
    expect(inspect(u8([0xff]), 0, "int8").value).toBe("-1");
    expect(inspect(u8([0x7f]), 0, "int8").value).toBe("127");
  });
  it("reads uint16 BE and LE", () => {
    expect(inspect(u8([0x01, 0x02]), 0, "uint16").value).toBe("258"); // BE: 0x0102
    const both = inspectBoth(u8([0x01, 0x02]), 0, "uint16");
    expect(both).toHaveLength(2);
    expect(both[0].value).toBe("258"); // BE
    expect(both[1].value).toBe("513"); // LE: 0x0201
  });
  it("reads int16 signed", () => {
    expect(inspect(u8([0xff, 0xff]), 0, "int16").value).toBe("-1");
  });
  it("reads uint32 BE", () => {
    expect(inspect(u8([0x01, 0x02, 0x03, 0x04]), 0, "uint32").value).toBe("16909060");
  });
  it("reads int32 signed", () => {
    expect(inspect(u8([0xff, 0xff, 0xff, 0xff]), 0, "int32").value).toBe("-1");
  });
  it("reads uint64 BE", () => {
    const r = inspect(u8([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]), 0, "uint64");
    expect(r.value).toBe("72057594037927936");
  });
  it("reads int64 signed (negative)", () => {
    const r = inspect(u8([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]), 0, "int64");
    expect(r.value).toBe("-1");
  });
  it("reads float32", () => {
    // 0x3F800000 = 1.0 in float32 BE
    const r = inspect(u8([0x3f, 0x80, 0x00, 0x00]), 0, "float32");
    expect(parseFloat(r.value)).toBeCloseTo(1.0, 5);
  });
  it("reads float64", () => {
    // 0x3FF0000000000000 = 1.0 in float64 BE
    const r = inspect(u8([0x3f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]), 0, "float64");
    expect(parseFloat(r.value)).toBeCloseTo(1.0, 5);
  });
  it("reads uleb128", () => {
    // 624485 = 0xE5 0x8E 0x26
    const r = inspect(u8([0xe5, 0x8e, 0x26]), 0, "uleb128");
    expect(r.value).toBe("624485");
    expect(r.bytesConsumed).toBe(3);
  });
  it("reads sleb128 negative", () => {
    // -624485 = 0x9B 0xF1 0x59
    const r = inspect(u8([0x9b, 0xf1, 0x59]), 0, "sleb128");
    expect(r.value).toBe("-624485");
  });
  it("reads ascii string", () => {
    const r = inspect(u8([0x48, 0x65, 0x6c, 0x6c, 0x6f]), 0, "ascii");
    expect(r.value).toBe("Hello");
  });
  it("reads utf8 string", () => {
    // 'é' = 0xC3 0xA9 in UTF-8
    const r = inspect(u8([0xc3, 0xa9]), 0, "utf8");
    expect(r.value).toBe("é");
  });
  it("reads utf16be string", () => {
    // 'AB' = 0x00 0x41 0x00 0x42 in UTF-16 BE
    const r = inspect(u8([0x00, 0x41, 0x00, 0x42]), 0, "utf16be");
    expect(r.value).toContain("A");
  });
  it("returns out-of-range for offset past end", () => {
    const r = inspect(u8([0x01]), 5, "uint8");
    expect(r.value).toBe("(out of range)");
  });
});

describe("hex-dump checksums", () => {
  it("sum8 sums bytes mod 256", () => {
    expect(checksum(u8([1, 2, 3, 4]), "sum8")).toBe("0A");
  });
  it("sum16 sums mod 65536", () => {
    expect(checksum(u8([0xff, 0xff]), "sum16")).toBe("01FE");
  });
  it("xor8 XORs all bytes", () => {
    expect(checksum(u8([0xff, 0x0f]), "xor8")).toBe("F0");
  });
  it("crc32 of empty is 0", () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
  it("crc32 of '123456789' is 0xCBF43926", () => {
    expect(crc32(stringToBytes("123456789"))).toBe(0xcbf43926);
  });
  it("adler32 of empty is 1", () => {
    expect(adler32(new Uint8Array(0))).toBe(1);
  });
  it("adler32 of 'Wikipedia' is 0x11E60398", () => {
    expect(adler32(stringToBytes("Wikipedia"))).toBe(0x11e60398);
  });
  it("allChecksums returns all 6", () => {
    const cs = allChecksums(u8([1, 2, 3]));
    expect(Object.keys(cs)).toHaveLength(6);
    expect(cs.crc32).toBeDefined();
  });
});

describe("hex-dump file type detection", () => {
  it("detects PNG", () => {
    const png = u8([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const m = detectFileType(png);
    expect(m?.name).toBe("PNG image");
  });
  it("detects JPEG", () => {
    const jpg = u8([0xff, 0xd8, 0xff, 0xe0]);
    expect(detectFileType(jpg)?.name).toBe("JPEG image");
  });
  it("detects PDF", () => {
    const pdf = u8([0x25, 0x50, 0x44, 0x46]);
    expect(detectFileType(pdf)?.name).toBe("PDF document");
  });
  it("detects ZIP", () => {
    const zip = u8([0x50, 0x4b, 0x03, 0x04]);
    expect(detectFileType(zip)?.name).toBe("ZIP archive");
  });
  it("returns null for unknown", () => {
    expect(detectFileType(u8([0x01, 0x02, 0x03]))).toBeNull();
  });
});

describe("hex-dump undo / redo", () => {
  it("initUndo creates initial state", () => {
    const state = initUndo(u8([1, 2, 3]));
    expect(state.past).toEqual([]);
    expect(Array.from(state.present)).toEqual([1, 2, 3]);
    expect(state.future).toEqual([]);
  });
  it("pushUndo adds to past and clears future", () => {
    const s0 = initUndo(u8([1, 2, 3]));
    const s1 = pushUndo(s0, u8([1, 0xff, 3]));
    expect(s1.past).toHaveLength(1);
    expect(s1.future).toEqual([]);
    expect(Array.from(s1.present)).toEqual([1, 0xff, 3]);
  });
  it("undo moves present to future", () => {
    const s0 = initUndo(u8([1, 2, 3]));
    const s1 = pushUndo(s0, u8([1, 0xff, 3]));
    const s2 = undo(s1);
    expect(Array.from(s2.present)).toEqual([1, 2, 3]);
    expect(s2.future).toHaveLength(1);
  });
  it("redo moves future to present", () => {
    const s0 = initUndo(u8([1, 2, 3]));
    const s1 = pushUndo(s0, u8([1, 0xff, 3]));
    const s2 = undo(s1);
    const s3 = redo(s2);
    expect(Array.from(s3.present)).toEqual([1, 0xff, 3]);
    expect(s3.future).toEqual([]);
  });
  it("undo with empty past is a no-op", () => {
    const s0 = initUndo(u8([1, 2, 3]));
    expect(undo(s0)).toBe(s0);
  });
});

describe("hex-dump history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, name: "test.bin", size: 10, hexPreview: "FFD8FF" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, name: `f${i}.bin`, size: i, hexPreview: `${i.toString(16)}` });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, name: "x", size: 1, hexPreview: "00" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("hex-dump shareable URL", () => {
  it("builds share URL for small data", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(u8([0xff, 0xd8]));
    expect(url).toContain("hex=FFD8");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("marks truncated for large data", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const big = new Uint8Array(2048);
    const url = buildShareUrl(big);
    expect(url).toContain("truncated=1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("hex=FFD8FF");
    expect(Array.from(p.bytes)).toEqual([0xff, 0xd8, 0xff]);
    expect(p.truncated).toBe(false);
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.bytes.length).toBe(0);
  });
});

// Suppress unused-import lint
export type _Unused =
  | Endian | DisplayFormat | InspectorType | HexDumpOptions
  | ChecksumAlgorithm | HistoryEntry;
