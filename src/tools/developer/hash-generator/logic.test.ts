import { describe, it, expect } from "vitest";
import {
  hashString,
  hashBytes,
  bytesToHex,
  bytesToBase64,
  ALGORITHMS,
  DIGEST_LENGTHS,
  formatBytes,
} from "./logic";

describe("bytesToHex", () => {
  it("converts empty bytes", () => {
    expect(bytesToHex(new Uint8Array([]))).toBe("");
  });

  it("converts single byte", () => {
    expect(bytesToHex(new Uint8Array([0]))).toBe("00");
    expect(bytesToHex(new Uint8Array([255]))).toBe("ff");
    expect(bytesToHex(new Uint8Array([10]))).toBe("0a");
  });

  it("converts multiple bytes with proper padding", () => {
    expect(bytesToHex(new Uint8Array([0, 1, 255, 16]))).toBe("0001ff10");
  });

  it("produces lowercase output", () => {
    expect(bytesToHex(new Uint8Array([0xab, 0xcd]))).toBe("abcd");
  });
});

describe("bytesToBase64", () => {
  it("converts empty bytes", () => {
    expect(bytesToBase64(new Uint8Array([]))).toBe("");
  });

  it("converts Hello", () => {
    expect(bytesToBase64(new Uint8Array([72, 101, 108, 108, 111]))).toBe("SGVsbG8=");
  });
});

describe("ALGORITHMS", () => {
  it("includes all 4 SHA algorithms", () => {
    expect(ALGORITHMS).toContain("SHA-1");
    expect(ALGORITHMS).toContain("SHA-256");
    expect(ALGORITHMS).toContain("SHA-384");
    expect(ALGORITHMS).toContain("SHA-512");
    expect(ALGORITHMS.length).toBe(4);
  });
});

describe("DIGEST_LENGTHS", () => {
  it("has correct lengths in bytes", () => {
    expect(DIGEST_LENGTHS["SHA-1"]).toBe(20);
    expect(DIGEST_LENGTHS["SHA-256"]).toBe(32);
    expect(DIGEST_LENGTHS["SHA-384"]).toBe(48);
    expect(DIGEST_LENGTHS["SHA-512"]).toBe(64);
  });
});

describe("hashString", () => {
  it("hashes empty string (SHA-256)", async () => {
    const r = await hashString("", "SHA-256");
    // Known: SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    expect(r.hex).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(r.bytes.length).toBe(32);
  });

  it("hashes 'abc' (SHA-256)", async () => {
    const r = await hashString("abc", "SHA-256");
    // Known: SHA-256("abc") = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
    expect(r.hex).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("hashes 'abc' (SHA-1)", async () => {
    const r = await hashString("abc", "SHA-1");
    // Known: SHA-1("abc") = a9993e364706816aba3e25717850c26c9cd0d89d
    expect(r.hex).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
  });

  it("hashes 'abc' (SHA-512)", async () => {
    const r = await hashString("abc", "SHA-512");
    // Known: SHA-512("abc") = ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a...
    expect(r.hex.startsWith("ddaf35a193617aba")).toBe(true);
    expect(r.bytes.length).toBe(64);
  });

  it("produces hex of correct length", async () => {
    const r = await hashString("test", "SHA-256");
    expect(r.hex.length).toBe(64); // 32 bytes × 2 chars
  });

  it("produces Base64 of correct length", async () => {
    const r = await hashString("test", "SHA-256");
    // 32 bytes → 44 chars Base64 (with padding)
    expect(r.base64.length).toBe(44);
  });

  it("hashes UTF-8 emoji correctly", async () => {
    const r = await hashString("👍", "SHA-256");
    // Deterministic — just check it produces a stable 32-byte hash
    expect(r.bytes.length).toBe(32);
    const r2 = await hashString("👍", "SHA-256");
    expect(r.hex).toBe(r2.hex);
  });

  it("same input produces same hash (deterministic)", async () => {
    const r1 = await hashString("Hello, World!", "SHA-256");
    const r2 = await hashString("Hello, World!", "SHA-256");
    expect(r1.hex).toBe(r2.hex);
  });

  it("different inputs produce different hashes", async () => {
    const r1 = await hashString("Hello", "SHA-256");
    const r2 = await hashString("hello", "SHA-256");
    expect(r1.hex).not.toBe(r2.hex);
  });
});

describe("hashBytes", () => {
  it("matches hashString for same input", async () => {
    const text = "Test input";
    const r1 = await hashString(text, "SHA-256");
    const r2 = await hashBytes(new TextEncoder().encode(text), "SHA-256");
    expect(r1.hex).toBe(r2.hex);
  });
});

describe("formatBytes", () => {
  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats KB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });

  it("formats MB", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });
});
