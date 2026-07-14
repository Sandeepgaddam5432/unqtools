import { describe, it, expect, beforeEach } from "vitest";
import {
  bytesToHex,
  bytesToBase64,
  detectAlgorithmFromLength,
  hashBytes,
  compareHashes,
  parseChecksumFile,
  generateChecksumFile,
  formatBytes,
  diffHashes,
  md5,
  crc32,
  formatHash,
  batchToCsv,
  batchToJson,
  loadHashHistory,
  saveHashToHistory,
  clearHashHistory,
  detectFileType,
  estimateHashTime,
  SUPPORTED_ALGORITHMS,
  ALGORITHM_INFO,
} from "./logic";

describe("file-hash bytesToHex", () => {
  it("converts bytes to hex", () => {
    expect(bytesToHex(new Uint8Array([0, 1, 255]))).toBe("0001ff");
  });
});

describe("file-hash bytesToBase64", () => {
  it("converts bytes to base64", () => {
    expect(bytesToBase64(new Uint8Array([72, 101, 108, 108, 111]))).toBe("SGVsbG8=");
  });
});

describe("file-hash detectAlgorithmFromLength", () => {
  it("detects MD5 (32 chars)", () => { expect(detectAlgorithmFromLength("a".repeat(32))).toBe("MD5"); });
  it("detects SHA-1 (40 chars)", () => { expect(detectAlgorithmFromLength("a".repeat(40))).toBe("SHA-1"); });
  it("detects SHA-256 (64 chars)", () => { expect(detectAlgorithmFromLength("a".repeat(64))).toBe("SHA-256"); });
  it("detects SHA-384 (96 chars)", () => { expect(detectAlgorithmFromLength("a".repeat(96))).toBe("SHA-384"); });
  it("detects SHA-512 (128 chars)", () => { expect(detectAlgorithmFromLength("a".repeat(128))).toBe("SHA-512"); });
  it("detects CRC32 (8 chars)", () => { expect(detectAlgorithmFromLength("a".repeat(8))).toBe("CRC32"); });
  it("returns null for unknown length", () => { expect(detectAlgorithmFromLength("abc")).toBeNull(); });
});

describe("file-hash hashBytes (SHA-256)", () => {
  it("hashes empty string", async () => {
    const hash = await hashBytes(new TextEncoder().encode(""), "SHA-256");
    expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
  it("hashes 'abc'", async () => {
    const hash = await hashBytes(new TextEncoder().encode("abc"), "SHA-256");
    expect(hash).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("hashes with SHA-1", async () => {
    const hash = await hashBytes(new TextEncoder().encode("abc"), "SHA-1");
    expect(hash).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
  });
  it("hashes with SHA-512", async () => {
    const hash = await hashBytes(new TextEncoder().encode("abc"), "SHA-512");
    expect(hash).toBe("ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f");
  });
});

describe("file-hash md5", () => {
  it("hashes empty string", () => {
    expect(md5(new Uint8Array())).toBe("d41d8cd98f00b204e9800998ecf8427e");
  });
  it("hashes 'abc'", () => {
    expect(md5(new TextEncoder().encode("abc"))).toBe("900150983cd24fb0d6963f7d28e17f72");
  });
  it("hashes 'message digest'", () => {
    expect(md5(new TextEncoder().encode("message digest"))).toBe("f96b697d7cb7938d525a2f31aaf161d0");
  });
});

describe("file-hash crc32", () => {
  it("hashes empty string", () => {
    expect(crc32(new Uint8Array())).toBe("00000000");
  });
  it("hashes 'abc'", () => {
    expect(crc32(new TextEncoder().encode("abc"))).toBe("352441c2");
  });
});

describe("file-hash compareHashes", () => {
  it("matches case-insensitive", () => {
    expect(compareHashes("ABCDEF", "abcdef")).toBe(true);
  });
  it("ignores whitespace", () => {
    expect(compareHashes("  abc  ", "abc")).toBe(true);
  });
  it("detects mismatch", () => {
    expect(compareHashes("abc", "abd")).toBe(false);
  });
});

describe("file-hash parseChecksumFile", () => {
  it("parses SHASUMS format", () => {
    const content = "aabbccdd  file1.txt\neeff1122  file2.txt";
    const entries = parseChecksumFile(content);
    expect(entries).toHaveLength(2);
    expect(entries[0].filename).toBe("file1.txt");
    expect(entries[0].hash).toBe("aabbccdd");
  });
  it("parses with asterisk prefix", () => {
    const entries = parseChecksumFile("aabbccdd *binary.bin");
    expect(entries[0].filename).toBe("binary.bin");
  });
  it("detects algorithm from hash length", () => {
    const entries = parseChecksumFile(`${"a".repeat(64)}  file.txt`);
    expect(entries[0].algorithm).toBe("SHA-256");
  });
  it("skips empty lines", () => {
    expect(parseChecksumFile("\n\n  \n")).toHaveLength(0);
  });
});

describe("file-hash generateChecksumFile", () => {
  it("generates checksum file content", () => {
    const content = generateChecksumFile([
      { filename: "file1.txt", hash: "abc", algorithm: "MD5" },
    ]);
    expect(content).toContain("abc  file1.txt");
  });
});

describe("file-hash formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1048576)).toBe("1.0 MB");
  });
});

describe("file-hash diffHashes", () => {
  it("finds differing chars", () => {
    const diff = diffHashes("abcdef", "abcdez");
    expect(diff[0].match).toBe(true);
    expect(diff[5].match).toBe(false);
  });
});

describe("file-hash formatHash", () => {
  it("lowercases", () => { expect(formatHash("ABCDEF", "lower")).toBe("abcdef"); });
  it("uppercases", () => { expect(formatHash("abcdef", "upper")).toBe("ABCDEF"); });
  it("converts to base64", () => { expect(formatHash("616263", "base64")).toBe("YWJj"); });
});

describe("file-hash batchToCsv / batchToJson", () => {
  it("generates CSV", () => {
    const csv = batchToCsv([{ filename: "test.txt", hash: "abc", size: 100 }], "SHA-256");
    expect(csv).toContain("filename,algorithm,hash");
    expect(csv).toContain("test.txt");
  });
  it("generates JSON", () => {
    const json = JSON.parse(batchToJson([{ filename: "test.txt", hash: "abc", size: 100 }], "SHA-256"));
    expect(json.count).toBe(1);
    expect(json.algorithm).toBe("SHA-256");
  });
});

describe("file-hash history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
  });
  it("saves and loads", () => {
    saveHashToHistory({ filename: "test.txt", algorithm: "SHA-256", hash: "abc", size: 100, computedAt: "2026-01-01" });
    expect(loadHashHistory()).toHaveLength(1);
  });
  it("clears", () => {
    saveHashToHistory({ filename: "test.txt", algorithm: "SHA-256", hash: "abc", size: 100, computedAt: "2026-01-01" });
    clearHashHistory();
    expect(loadHashHistory()).toEqual([]);
  });
});

describe("file-hash detectFileType", () => {
  it("detects PNG", () => {
    expect(detectFileType(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe("PNG image");
  });
  it("detects JPEG", () => {
    expect(detectFileType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("JPEG image");
  });
  it("detects PDF", () => {
    expect(detectFileType(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe("PDF document");
  });
  it("returns unknown for random bytes", () => {
    expect(detectFileType(new Uint8Array([0x00, 0x00, 0x00, 0x00]))).toBe("unknown");
  });
});

describe("file-hash estimateHashTime", () => {
  it("estimates for small file", () => {
    expect(estimateHashTime(1024)).toMatch(/second/);
  });
  it("estimates for large file", () => {
    // 5GB at ~500MB/s ≈ 10 seconds
    expect(estimateHashTime(5 * 1024 * 1024 * 1024)).toMatch(/second/);
  });
});

describe("file-hash SUPPORTED_ALGORITHMS", () => {
  it("includes 6 algorithms", () => {
    expect(SUPPORTED_ALGORITHMS).toHaveLength(6);
  });
});

describe("file-hash ALGORITHM_INFO", () => {
  it("marks MD5 and SHA-1 as deprecated", () => {
    expect(ALGORITHM_INFO["MD5"].deprecated).toBe(true);
    expect(ALGORITHM_INFO["SHA-1"].deprecated).toBe(true);
    expect(ALGORITHM_INFO["SHA-256"].deprecated).toBe(false);
  });
});
