/**
 * File Type Detector — unit tests.
 */
import { describe, it, expect } from "vitest";
import { detectFileType, detectionToCsv, SIGNATURES } from "./logic";

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

describe("detectFileType — common types", () => {
  it("detects PNG", () => {
    const r = detectFileType(hexToBytes("89504e470d0a1a0a"));
    expect(r.name).toContain("PNG");
    expect(r.mimeType).toBe("image/png");
    expect(r.confidence).toBeGreaterThan(0.9);
  });
  it("detects JPEG", () => {
    const r = detectFileType(hexToBytes("ffd8ffe000104a464946"));
    expect(r.mimeType).toBe("image/jpeg");
  });
  it("detects GIF", () => {
    const r = detectFileType(hexToBytes("474946383961"));
    expect(r.mimeType).toBe("image/gif");
  });
  it("detects PDF", () => {
    const r = detectFileType(hexToBytes("255044462d312e34"));
    expect(r.mimeType).toBe("application/pdf");
  });
  it("detects ZIP", () => {
    const r = detectFileType(hexToBytes("504b0304"));
    expect(r.mimeType).toBe("application/zip");
  });
  it("detects GZIP", () => {
    const r = detectFileType(hexToBytes("1f8b08"));
    expect(r.mimeType).toBe("application/gzip");
  });
  it("detects 7z", () => {
    const r = detectFileType(hexToBytes("377abcaf271c"));
    expect(r.mimeType).toBe("application/x-7z-compressed");
  });
  it("detects RAR v5", () => {
    const r = detectFileType(hexToBytes("526172211a070100"));
    expect(r.mimeType).toBe("application/x-rar");
  });
  it("detects ELF executable", () => {
    const r = detectFileType(hexToBytes("7f454c46"));
    expect(r.mimeType).toBe("application/x-executable");
  });
  it("detects SQLite database", () => {
    const r = detectFileType(hexToBytes("53514c69746520666f726d6174203320"));
    expect(r.mimeType).toBe("application/x-sqlite3");
  });
  it("detects TrueType font", () => {
    const r = detectFileType(hexToBytes("00010000"));
    expect(r.mimeType).toBe("font/ttf");
  });
});

describe("detectFileType — plain text", () => {
  it("detects plain text (no null bytes)", () => {
    const r = detectFileType(new TextEncoder().encode("Hello, world!"));
    expect(r.isText).toBe(true);
    expect(r.name.toLowerCase()).toContain("text");
  });
  it("flags binary when null bytes present", () => {
    const bytes = new Uint8Array([0x68, 0x00, 0x65, 0x6c, 0x6c, 0x6f]);
    const r = detectFileType(bytes);
    expect(r.isText).toBe(false);
  });
});

describe("detectFileType — extension mismatch", () => {
  it("flags mismatch when declared ext != detected", () => {
    const r = detectFileType(hexToBytes("89504e470d0a1a0a"), "jpg");
    expect(r.mismatch).toBe(true);
    expect(r.warnings.some((w) => w.includes("mismatch") || w.includes("does not match"))).toBe(true);
  });
  it("passes when declared ext matches", () => {
    const r = detectFileType(hexToBytes("89504e470d0a1a0a"), "png");
    expect(r.mismatch).toBe(false);
  });
});

describe("detectFileType — first bytes hex", () => {
  it("returns hex string of first 64 bytes", () => {
    const r = detectFileType(hexToBytes("89504e470d0a1a0a"));
    expect(r.firstBytesHex).toContain("89");
    expect(r.firstBytesHex).toContain("50");
    expect(r.firstBytesHex).toContain("4e");
    expect(r.firstBytesHex).toContain("47");
  });
});

describe("detectFileType — unknown", () => {
  it("returns Unknown binary for unrecognized bytes", () => {
    const r = detectFileType(new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]));
    expect(r.name.toLowerCase()).toContain("unknown");
    expect(r.confidence).toBe(0);
  });
});

describe("SIGNATURES database", () => {
  it("contains at least 50 signatures", () => {
    expect(SIGNATURES.length).toBeGreaterThan(50);
  });
  it("all signatures have valid hex", () => {
    for (const sig of SIGNATURES) {
      const hex = typeof sig.signature === "string" ? sig.signature : sig.signature.hex;
      const clean = hex.replace(/\s+/g, "");
      expect(clean.length % 2).toBe(0);
      expect(/^[0-9a-f]*$/.test(clean)).toBe(true);
    }
  });
});

describe("detectionToCsv", () => {
  it("generates CSV with header", () => {
    const r = detectFileType(hexToBytes("89504e470d0a1a0a"), "png");
    const csv = detectionToCsv([{ fileName: "test.png", result: r }]);
    expect(csv.split("\n")[0]).toContain("FileName");
    expect(csv).toContain("test.png");
    expect(csv).toContain("image/png");
  });
});
