/**
 * File Hash Verifier — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  detectAlgorithmFromLength, compareHashes, formatHashWithColons, toUpperHash,
  generateHashlistFile, parseHashlistFile, formatFileSize, resultsToCsv, md5, bufferToHex,
  type FileVerifyResult, type HashAlgorithm,
} from "./logic";

describe("detectAlgorithmFromLength", () => {
  it("detects MD5 (32 chars)", () => {
    expect(detectAlgorithmFromLength("d41d8cd98f00b204e9800998ecf8427e")).toBe("MD5");
  });
  it("detects SHA-1 (40 chars)", () => {
    expect(detectAlgorithmFromLength("aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d")).toBe("SHA-1");
  });
  it("detects SHA-256 (64 chars)", () => {
    const hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    expect(detectAlgorithmFromLength(hash)).toBe("SHA-256");
  });
  it("detects SHA-384 (96 chars)", () => {
    const hash = "38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95b";
    expect(detectAlgorithmFromLength(hash)).toBe("SHA-384");
  });
  it("detects SHA-512 (128 chars)", () => {
    const hash = "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";
    expect(detectAlgorithmFromLength(hash)).toBe("SHA-512");
  });
  it("returns null for unknown length", () => {
    expect(detectAlgorithmFromLength("abc123")).toBe(null);
  });
  it("handles colons and spaces", () => {
    expect(detectAlgorithmFromLength("d4:1d:8c:d9:8f:00:b2:04:e9:80:09:98:ec:f8:42:7e")).toBe("MD5");
  });
});

describe("compareHashes", () => {
  it("matches identical hashes", () => {
    expect(compareHashes("abc123", "abc123")).toBe(true);
  });
  it("matches case-insensitively", () => {
    expect(compareHashes("ABC123", "abc123")).toBe(true);
  });
  it("matches with different separators", () => {
    expect(compareHashes("d4:1d:8c:d9", "d41d8cd9")).toBe(true);
  });
  it("rejects different hashes", () => {
    expect(compareHashes("abc123", "xyz789")).toBe(false);
  });
});

describe("formatHashWithColons", () => {
  it("inserts colons every 2 chars", () => {
    expect(formatHashWithColons("d41d8cd9")).toBe("d4:1d:8c:d9");
  });
});

describe("toUpperHash", () => {
  it("uppercases the hash", () => {
    expect(toUpperHash("abc123")).toBe("ABC123");
  });
});

describe("generateHashlistFile", () => {
  it("generates .sha256sum file content", () => {
    const results: FileVerifyResult[] = [{
      fileName: "test.txt",
      fileSize: 100,
      hashes: [{ algorithm: "SHA-256", hash: "abc123", hashLength: 64 }],
      isMatch: true,
      warnings: [],
    }];
    const content = generateHashlistFile(results, "SHA-256");
    expect(content).toContain("abc123");
    expect(content).toContain("test.txt");
  });
  it("skips results without the requested algorithm", () => {
    const results: FileVerifyResult[] = [{
      fileName: "test.txt",
      fileSize: 100,
      hashes: [{ algorithm: "MD5", hash: "abc123", hashLength: 32 }],
      isMatch: false,
      warnings: [],
    }];
    const content = generateHashlistFile(results, "SHA-256");
    expect(content).toBe("");
  });
});

describe("parseHashlistFile", () => {
  it("parses standard .sha256sum format", () => {
    const content = "abc123  test.txt\ndef456  other.txt";
    const parsed = parseHashlistFile(content);
    expect(parsed.length).toBe(2);
    expect(parsed[0]).toEqual({ hash: "abc123", fileName: "test.txt" });
  });
  it("handles binary mode prefix '*'", () => {
    const parsed = parseHashlistFile("abc123 *test.txt");
    expect(parsed[0]).toEqual({ hash: "abc123", fileName: "test.txt" });
  });
  it("skips malformed lines", () => {
    const parsed = parseHashlistFile("not a hash line\nabc123  test.txt");
    expect(parsed.length).toBe(1);
  });
});

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });
  it("formats KB", () => {
    expect(formatFileSize(2048)).toBe("2.00 KB");
  });
  it("formats MB", () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.00 MB");
  });
  it("formats GB", () => {
    expect(formatFileSize(2 * 1024 * 1024 * 1024)).toBe("2.00 GB");
  });
});

describe("resultsToCsv", () => {
  it("generates CSV with header", () => {
    const results: FileVerifyResult[] = [{
      fileName: "test.txt", fileSize: 100,
      hashes: [{ algorithm: "SHA-256", hash: "abc", hashLength: 64 }],
      isMatch: true, warnings: [],
    }];
    const csv = resultsToCsv(results);
    expect(csv.split("\n")[0]).toContain("FileName");
    expect(csv).toContain("test.txt");
    expect(csv).toContain("abc");
  });
});

describe("md5", () => {
  it("hashes empty bytes", () => {
    expect(md5(new Uint8Array())).toBe("d41d8cd98f00b204e9800998ecf8427e");
  });
  it("hashes 'abc'", () => {
    expect(md5(new TextEncoder().encode("abc"))).toBe("900150983cd24fb0d6963f7d28e17f72");
  });
});

describe("bufferToHex", () => {
  it("converts ArrayBuffer to hex", () => {
    const buf = new Uint8Array([0, 15, 255]).buffer;
    expect(bufferToHex(buf)).toBe("000fff");
  });
});
