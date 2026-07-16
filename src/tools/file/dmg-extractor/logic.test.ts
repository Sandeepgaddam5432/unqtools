import { describe, it, expect, beforeEach } from "vitest";
import {
  KOLY_SIGNATURE,
  KOLY_SIGNATURE_BYTES,
  KOLY_TRAILER_SIZE,
  KOLY_DEFAULT_HEADER_SIZE,
  UDIF_COMPRESSION_SCHEMES,
  hasKolyTrailer,
  isDmgFile,
  parseKolyTrailer,
  parsePlist,
  readPlistXml,
  getCompressionName,
  isReadOnly,
  isEncryptedFlag,
  parseDmg,
  formatBytes,
  loadHistory,
  saveToHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type KolyTrailer,
} from "./logic";

// ===== Byte helpers =====

function writeU32BE(value: number): number[] {
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ];
}

function writeU64BE(value: number): number[] {
  const high = Math.floor(value / 0x100000000);
  const low = value & 0xffffffff;
  return [...writeU32BE(high >>> 0), ...writeU32BE(low >>> 0)];
}

function writeString(s: string): number[] {
  return Array.from(s).map((c) => c.charCodeAt(0) & 0xff);
}

function writeHex(hex: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    out.push(parseInt(hex.slice(i, i + 2), 16));
  }
  return out;
}

// ===== Build a minimal DMG with a koly trailer =====

interface BuildDmgOptions {
  /** Data fork payload (raw bytes before the trailer). */
  dataFork?: Uint8Array;
  /** Optional XML plist to embed (will be referenced by the trailer). */
  plistXml?: string;
  /** Override the koly version (default 4). */
  version?: number;
  /** Override flags. */
  flags?: number;
  /** Override segment number/count (default 1/1 = single-segment). */
  segmentNumber?: number;
  segmentCount?: number;
  /** Corrupt the signature (replace with 'XXXX'). */
  badSignature?: boolean;
  /** Truncate the file (force length to N bytes). */
  truncate?: number;
}

function buildDmgBytes(opts: BuildDmgOptions = {}): Uint8Array {
  const dataFork = opts.dataFork ?? new Uint8Array(0);
  const plistXml = opts.plistXml ?? "";
  const plistBytes = plistXml ? new TextEncoder().encode(plistXml) : new Uint8Array(0);
  const plistOffset = dataFork.length;
  const plistLength = plistBytes.length;

  const trailer: number[] = [];
  if (opts.badSignature) {
    trailer.push(...writeString("XXXX"));
  } else {
    trailer.push(...writeString(KOLY_SIGNATURE));
  }
  trailer.push(...writeU32BE(opts.version ?? 4));
  trailer.push(...writeU32BE(KOLY_DEFAULT_HEADER_SIZE));
  trailer.push(...writeU32BE(opts.flags ?? 0));
  trailer.push(...writeU64BE(0)); // runningDataForkOffset
  trailer.push(...writeU64BE(0)); // dataForkOffset
  trailer.push(...writeU64BE(dataFork.length)); // dataForkLength
  trailer.push(...writeU64BE(plistOffset + plistLength)); // resourceForkOffset (after plist)
  trailer.push(...writeU64BE(0)); // resourceForkLength (empty)
  trailer.push(...writeU32BE(opts.segmentNumber ?? 1));
  trailer.push(...writeU32BE(opts.segmentCount ?? 1));
  // UUID: 16 bytes (arbitrary hex)
  trailer.push(...writeHex("0123456789abcdef0123456789abcdef"));
  trailer.push(...writeU64BE(plistOffset));
  trailer.push(...writeU64BE(plistLength));
  trailer.push(...writeU32BE(2)); // checksumType
  trailer.push(...writeU32BE(32)); // checksumBits
  // Checksum data + padding to 512 bytes
  while (trailer.length < KOLY_TRAILER_SIZE) {
    trailer.push(0);
  }
  if (trailer.length > KOLY_TRAILER_SIZE) {
    trailer.length = KOLY_TRAILER_SIZE;
  }

  const total = dataFork.length + plistBytes.length + KOLY_TRAILER_SIZE;
  const truncate = opts.truncate ?? total;
  const out = new Uint8Array(Math.min(total, truncate));
  out.set(dataFork, 0);
  if (plistBytes.length > 0) {
    out.set(plistBytes, dataFork.length);
  }
  out.set(new Uint8Array(trailer), dataFork.length + plistBytes.length);
  return out;
}

// ===== localStorage mock =====

let store: Record<string, string> = {};
beforeEach(() => {
  store = {};
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    length: Object.keys(store).length,
  } as Storage;
});

// ===== hasKolyTrailer / isDmgFile =====

describe("dmg-extractor hasKolyTrailer", () => {
  it("returns true for a valid koly trailer at the end", () => {
    const bytes = buildDmgBytes({ dataFork: new TextEncoder().encode("DATA") });
    expect(hasKolyTrailer(bytes)).toBe(true);
  });
  it("returns false for a corrupted signature", () => {
    const bytes = buildDmgBytes({ badSignature: true });
    expect(hasKolyTrailer(bytes)).toBe(false);
  });
  it("returns false for a file smaller than 512 bytes", () => {
    expect(hasKolyTrailer(new Uint8Array(100))).toBe(false);
  });
  it("returns false for empty input", () => {
    expect(hasKolyTrailer(new Uint8Array(0))).toBe(false);
  });
  it("accepts an empty data fork (trailer only)", () => {
    const bytes = buildDmgBytes({});
    expect(hasKolyTrailer(bytes)).toBe(true);
  });
});

describe("dmg-extractor isDmgFile", () => {
  it("matches hasKolyTrailer behavior", () => {
    const bytes = buildDmgBytes();
    expect(isDmgFile(bytes)).toBe(true);
  });
  it("returns false for a non-DMG file", () => {
    expect(isDmgFile(new Uint8Array([1, 2, 3, 4]))).toBe(false);
  });
});

// ===== parseKolyTrailer =====

describe("dmg-extractor parseKolyTrailer", () => {
  it("parses the signature correctly", () => {
    const bytes = buildDmgBytes();
    const t = parseKolyTrailer(bytes);
    expect(t.signature).toBe(KOLY_SIGNATURE);
    expect(t.isValid).toBe(true);
  });
  it("parses version (default 4)", () => {
    const bytes = buildDmgBytes({ version: 4 });
    const t = parseKolyTrailer(bytes);
    expect(t.version).toBe(4);
  });
  it("parses a non-default version", () => {
    const bytes = buildDmgBytes({ version: 5 });
    const t = parseKolyTrailer(bytes);
    expect(t.version).toBe(5);
  });
  it("parses headerSize (always 512)", () => {
    const bytes = buildDmgBytes();
    const t = parseKolyTrailer(bytes);
    expect(t.headerSize).toBe(KOLY_DEFAULT_HEADER_SIZE);
  });
  it("parses flags", () => {
    const bytes = buildDmgBytes({ flags: 0x02 });
    const t = parseKolyTrailer(bytes);
    expect(t.flags).toBe(0x02);
  });
  it("parses dataForkLength correctly", () => {
    const data = new TextEncoder().encode("Hello DMG");
    const bytes = buildDmgBytes({ dataFork: data });
    const t = parseKolyTrailer(bytes);
    expect(t.dataForkLength).toBe(data.length);
  });
  it("parses plistOffset and plistLength", () => {
    const plist = "<plist>test</plist>";
    const data = new TextEncoder().encode("DATA");
    const bytes = buildDmgBytes({ dataFork: data, plistXml: plist });
    const t = parseKolyTrailer(bytes);
    expect(t.plistOffset).toBe(data.length);
    expect(t.plistLength).toBe(plist.length);
  });
  it("parses segmentNumber and segmentCount", () => {
    const bytes = buildDmgBytes({ segmentNumber: 2, segmentCount: 5 });
    const t = parseKolyTrailer(bytes);
    expect(t.segmentNumber).toBe(2);
    expect(t.segmentCount).toBe(5);
  });
  it("parses a 16-byte UUID as hex", () => {
    const bytes = buildDmgBytes();
    const t = parseKolyTrailer(bytes);
    expect(t.uuid).toMatch(/^[0-9a-f]{32}$/);
  });
  it("parses checksum fields", () => {
    const bytes = buildDmgBytes();
    const t = parseKolyTrailer(bytes);
    expect(t.checksumType).toBe(2);
    expect(t.checksumBits).toBe(32);
  });
  it("returns isValid=false when signature is corrupted", () => {
    const bytes = buildDmgBytes({ badSignature: true });
    const t = parseKolyTrailer(bytes);
    expect(t.isValid).toBe(false);
  });
  it("returns an empty trailer when input is too small", () => {
    const t = parseKolyTrailer(new Uint8Array(50));
    expect(t.isValid).toBe(false);
    expect(t.signature).toBe("");
    expect(t.version).toBe(0);
  });
});

// ===== parsePlist =====

describe("dmg-extractor parsePlist", () => {
  it("detects UDZO compression", () => {
    const xml = `<plist><dict><key>Compression</key><string>UDZO</string></dict></plist>`;
    const result = parsePlist(xml);
    expect(result.compressionScheme).toBe("UDZO");
  });
  it("detects UDBZ compression", () => {
    const xml = `<plist><dict><key>Compression</key><string>UDBZ</string></dict></plist>`;
    expect(parsePlist(xml).compressionScheme).toBe("UDBZ");
  });
  it("detects ULFO compression", () => {
    expect(parsePlist(`<plist>ULFO</plist>`).compressionScheme).toBe("ULFO");
  });
  it("detects UDRO (raw/uncompressed)", () => {
    expect(parsePlist(`<plist>UDRO</plist>`).compressionScheme).toBe("UDRO");
  });
  it("returns null when no compression marker is found", () => {
    expect(parsePlist(`<plist>no compression here</plist>`).compressionScheme).toBeNull();
  });
  it("extracts partition entries from plist", () => {
    const xml = `<plist>
      <dict>
        <key>Name</key><string>disk0s1</string>
        <key>Content</key><string>Apple_partition_map</string>
        <key>StartingSector</key><integer>0</integer>
        <key>SectorCount</key><integer>63</integer>
      </dict>
      <dict>
        <key>Name</key><string>disk0s2</string>
        <key>Content</key><string>Apple_HFS</string>
        <key>StartingSector</key><integer>64</integer>
        <key>SectorCount</key><integer>1000000</integer>
      </dict>
    </plist>`;
    const result = parsePlist(xml);
    expect(result.partitions.length).toBe(2);
    expect(result.partitions[0]!.name).toBe("disk0s1");
    expect(result.partitions[0]!.type).toBe("Apple_partition_map");
    expect(result.partitions[1]!.type).toBe("Apple_HFS");
    expect(result.partitions[1]!.blockCount).toBe(1000000);
  });
  it("returns empty partitions when plist has no dict blocks", () => {
    const xml = `<plist><string>simple</string></plist>`;
    expect(parsePlist(xml).partitions).toEqual([]);
  });
});

// ===== readPlistXml =====

describe("dmg-extractor readPlistXml", () => {
  it("reads the plist when referenced correctly", () => {
    const plist = "<plist><key>Compression</key><string>UDZO</string></plist>";
    const bytes = buildDmgBytes({ dataFork: new TextEncoder().encode("DATA"), plistXml: plist });
    const t = parseKolyTrailer(bytes);
    const xml = readPlistXml(bytes, t);
    expect(xml).toBe(plist);
  });
  it("returns empty string when plistLength is 0", () => {
    const bytes = buildDmgBytes({ dataFork: new TextEncoder().encode("DATA") });
    const t = parseKolyTrailer(bytes);
    expect(readPlistXml(bytes, t)).toBe("");
  });
  it("returns empty string when plist offset+length exceeds file", () => {
    const bytes = buildDmgBytes({ dataFork: new TextEncoder().encode("DATA"), plistXml: "X".repeat(10) });
    // Manually craft a trailer with an out-of-bounds plist reference
    const t: KolyTrailer = {
      ...parseKolyTrailer(bytes),
      plistOffset: 1000000,
      plistLength: 100,
    };
    expect(readPlistXml(bytes, t)).toBe("");
  });
});

// ===== getCompressionName =====

describe("dmg-extractor getCompressionName", () => {
  it("returns 'Unknown' for null scheme", () => {
    expect(getCompressionName(null)).toBe("Unknown");
  });
  it("returns 'zlib (DEFLATE)' for UDZO", () => {
    expect(getCompressionName("UDZO")).toBe("zlib (DEFLATE)");
  });
  it("returns 'bzip2' for UDBZ", () => {
    expect(getCompressionName("UDBZ")).toBe("bzip2");
  });
  it("returns 'LZFSE' for ULFO", () => {
    expect(getCompressionName("ULFO")).toBe("LZFSE");
  });
  it("returns 'Raw (uncompressed)' for UDRO", () => {
    expect(getCompressionName("UDRO")).toBe("Raw (uncompressed)");
  });
  it("returns 'Unknown' prefix for an unknown scheme", () => {
    expect(getCompressionName("XYZW")).toContain("Unknown");
  });
  it("matches all known compression schemes", () => {
    for (const [scheme] of Object.entries(UDIF_COMPRESSION_SCHEMES)) {
      const name = getCompressionName(scheme);
      expect(name).not.toContain("Unknown");
    }
  });
});

// ===== isReadOnly / isEncryptedFlag =====

describe("dmg-extractor flags", () => {
  it("isReadOnly returns true when flag 0x08 is set", () => {
    const t: KolyTrailer = { ...parseKolyTrailer(buildDmgBytes({ flags: 0x08 })) };
    expect(isReadOnly(t)).toBe(true);
  });
  it("isReadOnly returns true when flags are 0 (default read-only)", () => {
    const t: KolyTrailer = { ...parseKolyTrailer(buildDmgBytes({ flags: 0 })) };
    expect(isReadOnly(t)).toBe(true);
  });
  it("isEncryptedFlag returns true when flag 0x02 is set", () => {
    const t: KolyTrailer = { ...parseKolyTrailer(buildDmgBytes({ flags: 0x02 })) };
    expect(isEncryptedFlag(t)).toBe(true);
  });
  it("isEncryptedFlag returns false for a non-encrypted DMG", () => {
    const t: KolyTrailer = { ...parseKolyTrailer(buildDmgBytes({ flags: 0 })) };
    expect(isEncryptedFlag(t)).toBe(false);
  });
});

// ===== parseDmg =====

describe("dmg-extractor parseDmg", () => {
  it("returns isValid=true for a valid DMG", () => {
    const bytes = buildDmgBytes({ dataFork: new TextEncoder().encode("DATA") });
    const info = parseDmg(bytes);
    expect(info.isValid).toBe(true);
    expect(info.trailer).not.toBeNull();
    expect(info.trailer!.isValid).toBe(true);
  });
  it("detects multi-segment DMG", () => {
    const bytes = buildDmgBytes({ segmentCount: 3 });
    const info = parseDmg(bytes);
    expect(info.isMultiSegment).toBe(true);
  });
  it("reports single-segment when segmentCount=1", () => {
    const bytes = buildDmgBytes({ segmentCount: 1 });
    const info = parseDmg(bytes);
    expect(info.isMultiSegment).toBe(false);
  });
  it("detects encrypted flag", () => {
    const bytes = buildDmgBytes({ flags: 0x02 });
    const info = parseDmg(bytes);
    expect(info.isEncrypted).toBe(true);
  });
  it("detects compression scheme from embedded plist", () => {
    const bytes = buildDmgBytes({ plistXml: "<plist>UDZO</plist>" });
    const info = parseDmg(bytes);
    expect(info.compressionScheme).toBe("UDZO");
    expect(info.compressionName).toBe("zlib (DEFLATE)");
  });
  it("parses partitions from embedded plist", () => {
    const bytes = buildDmgBytes({
      plistXml: `<plist><dict><key>Name</key><string>s1</string><key>Content</key><string>Apple_HFS</string></dict></plist>`,
    });
    const info = parseDmg(bytes);
    expect(info.partitions.length).toBe(1);
    expect(info.partitions[0]!.type).toBe("Apple_HFS");
  });
  it("returns error string for non-DMG file", () => {
    const info = parseDmg(new Uint8Array([1, 2, 3]));
    expect(info.isValid).toBe(false);
    expect(info.error).toMatch(/koly/);
  });
  it("returns correct file size", () => {
    const bytes = buildDmgBytes({ dataFork: new TextEncoder().encode("DATA") });
    const info = parseDmg(bytes);
    expect(info.fileSize).toBe(bytes.length);
  });
});

// ===== formatBytes =====

describe("dmg-extractor formatBytes", () => {
  it("formats 0 as '0 B'", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("formats 1024 as '1.0 KB'", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
  it("formats 500 as '500 B'", () => {
    expect(formatBytes(500)).toBe("500 B");
  });
  it("formats 1MB", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });
});

// ===== History =====

describe("dmg-extractor history", () => {
  it("returns empty array when no history", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    const entry = {
      fileName: "test.dmg",
      fileSize: 1024,
      version: 4,
      compressionScheme: "UDZO" as const,
      segmentCount: 1,
      inspectedAt: "2026-01-01T00:00:00.000Z",
    };
    const updated = saveToHistory(entry);
    expect(updated.length).toBe(1);
    expect(loadHistory().length).toBe(1);
    expect(loadHistory()[0]!.fileName).toBe("test.dmg");
  });
  it("limits to 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileName: `f${i}.dmg`,
        fileSize: i,
        version: 4,
        compressionScheme: "UDZO",
        segmentCount: 1,
        inspectedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory().length).toBe(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileName: "x.dmg",
      fileSize: 1,
      version: 4,
      compressionScheme: null,
      segmentCount: 1,
      inspectedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Shareable URL =====

describe("dmg-extractor shareUrl", () => {
  it("builds a URL when window is available", () => {
    (globalThis as { window?: unknown }).window = {
      location: { origin: "https://unqtools.app", pathname: "/tools/dmg-extractor" },
    };
    const url = buildShareUrl();
    expect(url).toContain("https://unqtools.app");
    expect(url).toContain("/tools/dmg-extractor");
    delete (globalThis as { window?: unknown }).window;
  });
  it("returns empty string when window is undefined", () => {
    expect(buildShareUrl()).toBe("");
  });
  it("parses '#inspect' to true", () => {
    expect(parseShareUrl("#inspect")).toBe(true);
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("no-hash")).toBeNull();
  });
});

// ===== Constants =====

describe("dmg-extractor constants", () => {
  it("KOLY_SIGNATURE is 'koly'", () => {
    expect(KOLY_SIGNATURE).toBe("koly");
  });
  it("KOLY_SIGNATURE_BYTES is [0x6b, 0x6f, 0x6c, 0x79]", () => {
    expect(KOLY_SIGNATURE_BYTES).toEqual([0x6b, 0x6f, 0x6c, 0x79]);
  });
  it("KOLY_TRAILER_SIZE is 512", () => {
    expect(KOLY_TRAILER_SIZE).toBe(512);
  });
  it("KOLY_DEFAULT_HEADER_SIZE is 512", () => {
    expect(KOLY_DEFAULT_HEADER_SIZE).toBe(512);
  });
});
