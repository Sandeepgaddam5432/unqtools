import { describe, it, expect, beforeEach } from "vitest";
import {
  detectFormat, parseJpegSegments, classifyApp1, stripJpeg,
  parsePngChunks, stripPng, parseRiffChunks, stripWebp,
  stripMetadata, applySuffix, computeBatchStats, formatBytes,
  createZipBlob, loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  DEFAULT_STRIP_OPTIONS,
} from "./logic";

// ===== Helpers to construct test byte arrays =====

/** Build a minimal valid JPEG with a single APP1 EXIF segment. */
function buildJpegWithExif(exifPayload: number[] = [0x45, 0x78, 0x69, 0x66, 0, 0, 0xaa]): Uint8Array {
  // SOI + APP1(EXIF) + DQT(minimal) + SOF0(minimal) + DHT(minimal) + SOS + EOI
  const segLen = exifPayload.length + 2; // 2 for length field
  return new Uint8Array([
    0xff, 0xd8,                                  // SOI
    0xff, 0xe1, (segLen >> 8) & 0xff, segLen & 0xff, // APP1 marker + length
    ...exifPayload,
    0xff, 0xd9,                                   // EOI
  ]);
}

function buildJpegWithXmp(): Uint8Array {
  const xmpId = Array.from("http://ns.adobe.com/xap/1.0/\0").map((c) => c.charCodeAt(0));
  const payload = [...xmpId, 0x3c, 0x78, 0x3a, 0x78, 0x6d, 0x70]; // "<x:xmp" snippet
  const segLen = payload.length + 2;
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe1, (segLen >> 8) & 0xff, segLen & 0xff, ...payload,
    0xff, 0xd9,
  ]);
}

function buildJpegWithIptc(): Uint8Array {
  const payload = [0x1c, 0x02, 0x00, 0x00, 0x00]; // minimal IPTC block
  const segLen = payload.length + 2;
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xed, (segLen >> 8) & 0xff, segLen & 0xff, ...payload,
    0xff, 0xd9,
  ]);
}

function buildPngWithText(textData = "Comment\0hello world"): Uint8Array {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const type = ["t", "E", "X", "t"].map((c) => c.charCodeAt(0));
  const data = Array.from(textData).map((c) => c.charCodeAt(0));
  const len = data.length;
  // CRC — placeholder, we don't verify CRC during strip
  const crc = [0, 0, 0, 0];
  // IHDR minimal (13 bytes data + type + len + crc)
  const ihdr = [
    0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
    0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0, 0, 0,
    0, 0, 0, 0,
  ];
  const textChunk = [
    (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff,
    ...type, ...data, ...crc,
  ];
  const iend = [0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];
  return new Uint8Array([...signature, ...ihdr, ...textChunk, ...iend]);
}

function buildWebpWithExif(): Uint8Array {
  // RIFF + WEBP + VP8 (lossy) + EXIF chunks
  const vp8Data = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const exifData = [0xde, 0xad, 0xbe, 0xef];
  // VP8 chunk
  const vp8 = ["V", "P", "8", " "].map((c) => c.charCodeAt(0));
  const exif = ["E", "X", "I", "F"].map((c) => c.charCodeAt(0));
  const vp8Chunk = [...vp8, vp8Data.length, 0, 0, 0, ...vp8Data];
  const exifChunk = [...exif, exifData.length, 0, 0, 0, ...exifData];
  const totalPayload = 4 + vp8Chunk.length + exifChunk.length; // 'WEBP' + chunks
  return new Uint8Array([
    0x52, 0x49, 0x46, 0x46,                          // RIFF
    totalPayload & 0xff, (totalPayload >>> 8) & 0xff, (totalPayload >>> 16) & 0xff, (totalPayload >>> 24) & 0xff,
    0x57, 0x45, 0x42, 0x50,                          // WEBP
    ...vp8Chunk, ...exifChunk,
  ]);
}

// ===== Tests =====

describe("file-metadata-stripper detectFormat", () => {
  it("detects JPEG", () => {
    expect(detectFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]))).toBe("jpeg");
  });
  it("detects PNG", () => {
    expect(detectFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("png");
  });
  it("detects WebP", () => {
    const w = buildWebpWithExif();
    expect(detectFormat(w)).toBe("webp");
  });
  it("returns unknown for arbitrary bytes", () => {
    expect(detectFormat(new Uint8Array([0, 1, 2, 3, 4, 5]))).toBe("unknown");
  });
  it("returns unknown for empty", () => {
    expect(detectFormat(new Uint8Array([]))).toBe("unknown");
  });
});

describe("file-metadata-stripper parseJpegSegments", () => {
  it("parses SOI + APP1 + EOI", () => {
    const bytes = buildJpegWithExif();
    const segs = parseJpegSegments(bytes);
    expect(segs.length).toBe(3);
    expect(segs[0].marker).toBe(0xd8);
    expect(segs[1].marker).toBe(0xe1);
    expect(segs[2].marker).toBe(0xd9);
  });
  it("returns empty for non-JPEG", () => {
    expect(parseJpegSegments(new Uint8Array([0, 1, 2, 3]))).toEqual([]);
  });
  it("parses multiple APP segments", () => {
    const seg1 = [0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
    const seg2 = [0xff, 0xe1, 0, 0x0a, 0x45, 0x78, 0x69, 0x66, 0, 0, 0xaa, 0xbb];
    const bytes = new Uint8Array([0xff, 0xd8, ...seg1, ...seg2, 0xff, 0xd9]);
    const segs = parseJpegSegments(bytes);
    expect(segs.length).toBe(4);
    expect(segs[1].marker).toBe(0xe0);
    expect(segs[2].marker).toBe(0xe1);
  });
});

describe("file-metadata-stripper classifyApp1", () => {
  it("detects EXIF marker", () => {
    const bytes = buildJpegWithExif();
    // APP1 segment is at offset 2; segStart = offset after marker = 4 (length field)
    expect(classifyApp1(bytes, 4)).toBe("EXIF");
  });
  it("detects XMP marker", () => {
    const bytes = buildJpegWithXmp();
    expect(classifyApp1(bytes, 4)).toBe("XMP");
  });
  it("returns unknown for non-EXIF/XMP APP1", () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 0x05, 0x01, 0x02, 0x03, 0xff, 0xd9]);
    expect(classifyApp1(bytes, 4)).toBe("unknown");
  });
});

describe("file-metadata-stripper stripJpeg", () => {
  it("removes EXIF APP1 segment", () => {
    const bytes = buildJpegWithExif();
    const { output, removed } = stripJpeg(bytes, DEFAULT_STRIP_OPTIONS);
    expect(removed.length).toBe(1);
    expect(removed[0].type).toBe("APP1-EXIF");
    expect(output.length).toBeLessThan(bytes.length);
    // Output starts with SOI
    expect(output[0]).toBe(0xff);
    expect(output[1]).toBe(0xd8);
    // Output ends with EOI
    expect(output[output.length - 1]).toBe(0xd9);
    expect(output[output.length - 2]).toBe(0xff);
  });

  it("removes XMP APP1 segment", () => {
    const bytes = buildJpegWithXmp();
    const { output, removed } = stripJpeg(bytes, DEFAULT_STRIP_OPTIONS);
    expect(removed.length).toBe(1);
    expect(removed[0].type).toBe("APP1-XMP");
    expect(output.length).toBeLessThan(bytes.length);
  });

  it("removes IPTC APP13 segment", () => {
    const bytes = buildJpegWithIptc();
    const { output, removed } = stripJpeg(bytes, DEFAULT_STRIP_OPTIONS);
    expect(removed.length).toBe(1);
    expect(removed[0].type).toBe("APP13-IPTC");
    expect(output.length).toBeLessThan(bytes.length);
  });

  it("preserves EXIF when stripExif=false", () => {
    const bytes = buildJpegWithExif();
    const { output, removed, remaining } = stripJpeg(bytes, { ...DEFAULT_STRIP_OPTIONS, stripExif: false });
    expect(removed.length).toBe(0);
    expect(remaining.length).toBe(1);
    expect(output.length).toBe(bytes.length);
  });

  it("preserves XMP when stripXmp=false", () => {
    const bytes = buildJpegWithXmp();
    const { removed, remaining } = stripJpeg(bytes, { ...DEFAULT_STRIP_OPTIONS, stripXmp: false });
    expect(removed.length).toBe(0);
    expect(remaining.length).toBe(1);
  });

  it("preserves IPTC when stripIptc=false", () => {
    const bytes = buildJpegWithIptc();
    const { removed, remaining } = stripJpeg(bytes, { ...DEFAULT_STRIP_OPTIONS, stripIptc: false });
    expect(removed.length).toBe(0);
    expect(remaining.length).toBe(1);
  });

  it("handles JPEG without metadata (no change)", () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]); // SOI + EOI
    const { output, removed } = stripJpeg(bytes, DEFAULT_STRIP_OPTIONS);
    expect(removed.length).toBe(0);
    expect(output.length).toBe(bytes.length);
  });

  it("removes multiple segments at once", () => {
    const seg1 = [0xff, 0xe1, 0, 0x0a, 0x45, 0x78, 0x69, 0x66, 0, 0, 0xaa, 0xbb]; // EXIF
    const seg2 = [0xff, 0xed, 0, 0x06, 0x1c, 0x02, 0, 0, 0];                      // IPTC
    const bytes = new Uint8Array([0xff, 0xd8, ...seg1, ...seg2, 0xff, 0xd9]);
    const { output, removed } = stripJpeg(bytes, DEFAULT_STRIP_OPTIONS);
    expect(removed.length).toBe(2);
    expect(output.length).toBeLessThan(bytes.length);
  });
});

describe("file-metadata-stripper parsePngChunks", () => {
  it("parses IHDR + tEXt + IEND", () => {
    const bytes = buildPngWithText();
    const chunks = parsePngChunks(bytes);
    expect(chunks.length).toBe(3);
    expect(chunks[0].type).toBe("IHDR");
    expect(chunks[1].type).toBe("tEXt");
    expect(chunks[2].type).toBe("IEND");
  });
  it("returns empty for non-PNG", () => {
    expect(parsePngChunks(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]))).toEqual([]);
  });
});

describe("file-metadata-stripper stripPng", () => {
  it("removes tEXt chunk", () => {
    const bytes = buildPngWithText();
    const { output, removed } = stripPng(bytes, DEFAULT_STRIP_OPTIONS);
    expect(removed.length).toBe(1);
    expect(removed[0].type).toBe("PNG-tEXt");
    expect(output.length).toBeLessThan(bytes.length);
    // PNG signature preserved
    expect(output[0]).toBe(0x89);
    expect(output[1]).toBe(0x50);
    // IEND preserved
    expect(String.fromCharCode(output[output.length - 8], output[output.length - 7], output[output.length - 6], output[output.length - 5])).toBe("IEND");
  });
  it("preserves text when stripPngText=false", () => {
    const bytes = buildPngWithText();
    const { removed, remaining } = stripPng(bytes, { ...DEFAULT_STRIP_OPTIONS, stripPngText: false });
    expect(removed.length).toBe(0);
    expect(remaining.length).toBe(1);
  });
});

describe("file-metadata-stripper parseRiffChunks", () => {
  it("parses VP8 + EXIF chunks in WebP", () => {
    const bytes = buildWebpWithExif();
    const chunks = parseRiffChunks(bytes);
    expect(chunks.length).toBe(2);
    expect(chunks[0].fourcc).toBe("VP8 ");
    expect(chunks[1].fourcc).toBe("EXIF");
  });
});

describe("file-metadata-stripper stripWebp", () => {
  it("removes EXIF chunk", () => {
    const bytes = buildWebpWithExif();
    const { output, removed } = stripWebp(bytes, DEFAULT_STRIP_OPTIONS);
    expect(removed.length).toBe(1);
    expect(removed[0].type).toBe("WebP-EXIF");
    expect(output.length).toBeLessThan(bytes.length);
    // RIFF + WEBP signature preserved
    expect(output[0]).toBe(0x52);
    expect(output[1]).toBe(0x49);
    expect(output[8]).toBe(0x57);
    expect(output[9]).toBe(0x45);
  });
  it("updates RIFF size in header", () => {
    const bytes = buildWebpWithExif();
    const { output } = stripWebp(bytes, DEFAULT_STRIP_OPTIONS);
    const newRiffSize = output.length - 8;
    const declaredSize = output[4] | (output[5] << 8) | (output[6] << 16) | (output[7] << 24);
    expect(declaredSize).toBe(newRiffSize);
  });
});

describe("file-metadata-stripper stripMetadata dispatcher", () => {
  it("throws on unknown format", () => {
    expect(() => stripMetadata(new Uint8Array([0, 1, 2, 3]), DEFAULT_STRIP_OPTIONS)).toThrow();
  });
  it("dispatches to JPEG stripper", () => {
    const bytes = buildJpegWithExif();
    const result = stripMetadata(bytes);
    expect(result.format).toBe("jpeg");
    expect(result.changed).toBe(true);
    expect(result.bytesSaved).toBeGreaterThan(0);
  });
  it("dispatches to PNG stripper", () => {
    const bytes = buildPngWithText();
    const result = stripMetadata(bytes);
    expect(result.format).toBe("png");
    expect(result.bytesSaved).toBeGreaterThan(0);
  });
  it("dispatches to WebP stripper", () => {
    const bytes = buildWebpWithExif();
    const result = stripMetadata(bytes);
    expect(result.format).toBe("webp");
    expect(result.bytesSaved).toBeGreaterThan(0);
  });
  it("reports changed=false when no metadata present", () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const result = stripMetadata(bytes);
    expect(result.changed).toBe(false);
    expect(result.bytesSaved).toBe(0);
  });
});

describe("file-metadata-stripper applySuffix", () => {
  it("inserts suffix before extension", () => {
    expect(applySuffix("photo.jpg", "stripped")).toBe("photo-stripped.jpg");
  });
  it("handles filenames with multiple dots", () => {
    expect(applySuffix("my.photo.archive.png", "stripped")).toBe("my.photo.archive-stripped.png");
  });
  it("handles filenames without extension", () => {
    expect(applySuffix("README", "stripped")).toBe("README-stripped");
  });
  it("handles hidden files starting with dot", () => {
    expect(applySuffix(".gitignore", "stripped")).toBe(".gitignore-stripped");
  });
});

describe("file-metadata-stripper computeBatchStats", () => {
  it("aggregates stats across successful and errored results", () => {
    const jpeg1 = stripMetadata(buildJpegWithExif());
    const jpeg2 = stripMetadata(buildJpegWithXmp());
    const stats = computeBatchStats([jpeg1, jpeg2, { error: "bad file" }]);
    expect(stats.totalFiles).toBe(3);
    expect(stats.successCount).toBe(2);
    expect(stats.errorCount).toBe(1);
    expect(stats.totalBytesSaved).toBe(jpeg1.bytesSaved + jpeg2.bytesSaved);
  });
  it("handles empty input", () => {
    const stats = computeBatchStats([]);
    expect(stats.totalFiles).toBe(0);
    expect(stats.successCount).toBe(0);
  });
});

describe("file-metadata-stripper formatBytes", () => {
  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("formats bytes", () => {
    expect(formatBytes(512)).toBe("512 B");
  });
  it("formats KB", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
  });
  it("formats MB", () => {
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});

describe("file-metadata-stripper createZipBlob", () => {
  it("creates a Blob with ZIP signature", async () => {
    const blob = createZipBlob([{ name: "test.txt", data: new TextEncoder().encode("hello") }]);
    expect(blob).toBeInstanceOf(Blob);
    const buf = new Uint8Array(await blob.arrayBuffer());
    // ZIP local file header signature
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
  });
  it("handles multiple files", async () => {
    const blob = createZipBlob([
      { name: "a.txt", data: new TextEncoder().encode("aaa") },
      { name: "b.txt", data: new TextEncoder().encode("bbb") },
    ]);
    const buf = new Uint8Array(await blob.arrayBuffer());
    // Should contain 2 local file headers
    let count = 0;
    for (let i = 0; i < buf.length - 4; i++) {
      if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x03 && buf[i + 3] === 0x04) count++;
    }
    expect(count).toBe(2);
  });
});

describe("file-metadata-stripper history (localStorage)", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
      key: (i: number) => Object.keys(store)[i] ?? null,
      get length() { return Object.keys(store).length; },
    } as Storage;
  });

  it("returns empty when no history", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("saves and loads entries", () => {
    const entry = {
      name: "photo.jpg", format: "jpeg" as const,
      originalSize: 1000, strippedSize: 900, bytesSaved: 100,
      removedTypes: ["APP1-EXIF"], strippedAt: new Date().toISOString(),
    };
    saveToHistory(entry);
    const history = loadHistory();
    expect(history.length).toBe(1);
    expect(history[0].name).toBe("photo.jpg");
  });

  it("caps history at 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        name: `f${i}.jpg`, format: "jpeg",
        originalSize: 100, strippedSize: 90, bytesSaved: 10,
        removedTypes: [], strippedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory().length).toBe(10);
  });

  it("clears history", () => {
    saveToHistory({
      name: "x.jpg", format: "jpeg",
      originalSize: 1, strippedSize: 1, bytesSaved: 0,
      removedTypes: [], strippedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("file-metadata-stripper share URL", () => {
  beforeEach(() => {
    (globalThis as { window?: typeof globalThis & { location: { origin: string; pathname: string } } }).window = globalThis as unknown as typeof globalThis & { location: { origin: string; pathname: string } };
    (globalThis as { location?: { origin: string; pathname: string } }).location = {
      origin: "https://example.com",
      pathname: "/tools/file-metadata-stripper",
    };
  });

  it("builds share URL with option params", () => {
    const url = buildShareUrl(DEFAULT_STRIP_OPTIONS);
    expect(url).toContain("exif=true");
    expect(url).toContain("xmp=true");
    expect(url).toContain("iptc=true");
    expect(url).toContain("png=true");
  });
  it("parses share URL back to options", () => {
    const url = buildShareUrl(DEFAULT_STRIP_OPTIONS);
    const hash = url.substring(url.indexOf("#"));
    const parsed = parseShareUrl(hash);
    expect(parsed).toEqual(DEFAULT_STRIP_OPTIONS);
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
    expect(parseShareUrl("#")).toBeNull();
  });
});
