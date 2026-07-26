import { describe, it, expect } from "vitest";
import {
  ALGORITHM_BITS,
  BROKEN_ALGORITHMS,
  EMPTY_HASHES,
  decodeInput,
  hexToBytes,
  base64ToBytes,
  bytesToHex,
  bytesToBase64,
  formatHash,
  normalizeHash,
  compareHashes,
  detectAlgorithmFromLength,
  findMatch,
  computeSha,
  computeHmac,
  computeAll,
  resultsToCsv,
  resultsToText,
  md5,
  formatFileSize,
  getEmptyHash,
} from "./logic";

describe("hashing-tool codec helpers", () => {
  it("hexToBytes round-trips", () => {
    const b = hexToBytes("48656c6c6f");
    expect(new TextDecoder().decode(b)).toBe("Hello");
  });

  it("hexToBytes tolerates spaces and colons", () => {
    expect(hexToBytes("48:65 6c-6c")).toHaveLength(4);
  });

  it("hexToBytes rejects odd length", () => {
    expect(() => hexToBytes("abc")).toThrow();
  });

  it("hexToBytes rejects non-hex", () => {
    expect(() => hexToBytes("xyz")).toThrow();
  });

  it("base64ToBytes round-trips", () => {
    expect(new TextDecoder().decode(base64ToBytes("SGVsbG8="))).toBe("Hello");
  });

  it("base64ToBytes handles url-safe", () => {
    expect(base64ToBytes("SGVsbG8").length).toBe(5);
  });

  it("bytesToHex returns lowercase", () => {
    expect(bytesToHex(new Uint8Array([0xff, 0x00, 0xab]))).toBe("ff00ab");
  });

  it("bytesToBase64 returns padded", () => {
    expect(bytesToBase64(new TextEncoder().encode("Hello"))).toBe("SGVsbG8=");
  });
});

describe("hashing-tool decodeInput", () => {
  it("decodes UTF-8", () => {
    expect(decodeInput("Hello", "utf-8")).toEqual(new TextEncoder().encode("Hello"));
  });

  it("decodes hex", () => {
    expect(decodeInput("48656c6c6f", "hex")).toEqual(new TextEncoder().encode("Hello"));
  });

  it("decodes base64", () => {
    expect(decodeInput("SGVsbG8=", "base64")).toEqual(new TextEncoder().encode("Hello"));
  });
});

describe("hashing-tool compare + detect", () => {
  it("normalizeHash strips separators and lowercases", () => {
    expect(normalizeHash("AB:CD EF-01")).toBe("abcdef01");
  });

  it("compareHashes matches case-insensitively", () => {
    expect(compareHashes("ABCDEF", "ab:cd:ef")).toBe(true);
  });

  it("compareHashes returns false for empty expected", () => {
    expect(compareHashes("abc", "")).toBe(false);
  });

  it("detectAlgorithmFromLength detects all 5", () => {
    expect(detectAlgorithmFromLength("a".repeat(32))).toBe("MD5");
    expect(detectAlgorithmFromLength("a".repeat(40))).toBe("SHA-1");
    expect(detectAlgorithmFromLength("a".repeat(64))).toBe("SHA-256");
    expect(detectAlgorithmFromLength("a".repeat(96))).toBe("SHA-384");
    expect(detectAlgorithmFromLength("a".repeat(128))).toBe("SHA-512");
    expect(detectAlgorithmFromLength("xyz")).toBeNull();
  });
});

describe("hashing-tool md5 (RFC 1321)", () => {
  it("empty string → known empty hash", () => {
    expect(md5(new TextEncoder().encode(""))).toBe(EMPTY_HASHES.MD5);
  });

  it("'a' → 0cc175b9c0f1b6a831c399e269772661", () => {
    expect(md5(new TextEncoder().encode("a"))).toBe("0cc175b9c0f1b6a831c399e269772661");
  });

  it("'abc' → 900150983cd24fb0d6963f7d28e17f72", () => {
    expect(md5(new TextEncoder().encode("abc"))).toBe("900150983cd24fb0d6963f7d28e17f72");
  });

  it("'message digest' → f96b697d7cb7938d525a2f31aaf161d0", () => {
    expect(md5(new TextEncoder().encode("message digest"))).toBe("f96b697d7cb7938d525a2f31aaf161d0");
  });

  it("long input (RFC test 7) → 57edf4a22be3c955ac49da2e2107b67a", () => {
    const s = "12345678901234567890123456789012345678901234567890123456789012345678901234567890";
    expect(md5(new TextEncoder().encode(s))).toBe("57edf4a22be3c955ac49da2e2107b67a");
  });
});

describe("hashing-tool WebCrypto SHA", () => {
  it("computeSha SHA-256 empty → known empty", async () => {
    const h = await computeSha("SHA-256", new Uint8Array(0));
    expect(h).toBe(EMPTY_HASHES["SHA-256"]);
  });

  it("computeSha SHA-1 'abc' → known value", async () => {
    const h = await computeSha("SHA-1", new TextEncoder().encode("abc"));
    expect(h).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
  });

  it("computeSha SHA-512 'abc' → known value", async () => {
    const h = await computeSha("SHA-512", new TextEncoder().encode("abc"));
    expect(h).toBe("ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f");
  });

  it("computeHmac SHA-256 RFC 4231 test 1", async () => {
    // key = 0x0b * 20, data = "Hi There"
    const key = new Uint8Array(20).fill(0x0b);
    const data = new TextEncoder().encode("Hi There");
    const h = await computeHmac("SHA-256", data, key);
    expect(h).toBe("b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7");
  });

  it("computeHmac rejects MD5", async () => {
    await expect(computeHmac("MD5", new Uint8Array(0), new Uint8Array(0))).rejects.toThrow(/not supported/);
  });
});

describe("hashing-tool computeAll", () => {
  it("computes 5 algorithms with correct empty hashes", async () => {
    const results = await computeAll(new Uint8Array(0));
    expect(results).toHaveLength(5);
    expect(results[0]!.algorithm).toBe("MD5");
    expect(results[0]!.hex).toBe(EMPTY_HASHES.MD5);
    expect(results[1]!.hex).toBe(EMPTY_HASHES["SHA-1"]);
    expect(results[2]!.hex).toBe(EMPTY_HASHES["SHA-256"]);
  });

  it("flags MD5 and SHA-1 as broken", async () => {
    const results = await computeAll(new TextEncoder().encode("x"));
    expect(results.find((r) => r.algorithm === "MD5")?.brokenForSecurity).toBe(true);
    expect(results.find((r) => r.algorithm === "SHA-1")?.brokenForSecurity).toBe(true);
    expect(results.find((r) => r.algorithm === "SHA-256")?.brokenForSecurity).toBe(false);
  });

  it("findMatch detects the matching algorithm", async () => {
    const results = await computeAll(new TextEncoder().encode("abc"));
    const sha256 = results.find((r) => r.algorithm === "SHA-256")!;
    expect(findMatch(results, sha256.hex)).toBe("SHA-256");
  });
});

describe("hashing-tool exports", () => {
  it("resultsToCsv has header and 5 rows", async () => {
    const results = await computeAll(new TextEncoder().encode("a"));
    const csv = resultsToCsv(results, "utf-8", 1);
    const lines = csv.split("\n");
    expect(lines[0]).toMatch(/Algorithm,BitLength/);
    expect(lines.length).toBe(6);
  });

  it("resultsToText includes algorithm names", async () => {
    const results = await computeAll(new Uint8Array(0));
    const txt = resultsToText(results, "utf-8", 0);
    expect(txt).toContain("MD5 (128-bit)");
    expect(txt).toContain("broken — checksum only");
  });
});

describe("hashing-tool misc", () => {
  it("formatFileSize formats correctly", () => {
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(1024 * 5)).toBe("5.00 KB");
    expect(formatFileSize(1024 * 1024 * 3)).toBe("3.00 MB");
  });

  it("formatHash returns hex or base64", async () => {
    const r = (await computeAll(new TextEncoder().encode("a")))[0]!;
    expect(formatHash(r, "hex")).toBe(r.hex);
    expect(formatHash(r, "base64")).toBe(r.base64);
  });

  it("ALGORITHM_BITS + BROKEN_ALGORITHMS constants", () => {
    expect(ALGORITHM_BITS["SHA-256"]).toBe(256);
    expect(BROKEN_ALGORITHMS.has("MD5")).toBe(true);
    expect(BROKEN_ALGORITHMS.has("SHA-256")).toBe(false);
  });

  it("getEmptyHash returns the known value", () => {
    expect(getEmptyHash("MD5")).toBe(EMPTY_HASHES.MD5);
  });
});
