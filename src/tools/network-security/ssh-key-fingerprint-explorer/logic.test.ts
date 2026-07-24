/**
 * SSH Key Fingerprint Explorer — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  parseSshKey, md5, formatMd5Fingerprint, generateRandomart,
  generateAuthorizedKeysEntry, bytesToHex,
} from "./logic";

// Test key: a real ED25519 key (test fixture)
const TEST_ED25519_KEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIE7s9vK4l7VqL8p9O3nW2xY5m1p3q4r5s6t7u8v9w0x1y2z3 test@example.com";

describe("parseSshKey", () => {
  it("parses ed25519 key", () => {
    const r = parseSshKey(TEST_ED25519_KEY);
    if ("error" in r) throw new Error("Should not error");
    expect(r.type).toBe("ssh-ed25519");
    expect(r.comment).toBe("test@example.com");
    expect(r.bitCount).toBe(256);
  });
  it("errors on empty input", () => {
    expect("error" in parseSshKey("")).toBe(true);
  });
  it("errors on missing base64", () => {
    expect("error" in parseSshKey("ssh-ed25519")).toBe(true);
  });
  it("flags unknown key type", () => {
    const r = parseSshKey("ssh-foo AAAAC3NzaC1lZDI1NTE5AAAAIE7s9vK4l7VqL8p9O3nW2xY5m1p3q4r5s6t7u8v9w0x1y2z3 user");
    if ("error" in r) throw new Error("Should not error");
    expect(r.type).toBe("unknown");
    expect(r.isValid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe("md5", () => {
  it("hashes empty string to known MD5", () => {
    expect(md5(new TextEncoder().encode(""))).toBe("d41d8cd98f00b204e9800998ecf8427e");
  });
  it("hashes 'abc'", () => {
    expect(md5(new TextEncoder().encode("abc"))).toBe("900150983cd24fb0d6963f7d28e17f72");
  });
  it("hashes 'The quick brown fox jumps over the lazy dog'", () => {
    expect(md5(new TextEncoder().encode("The quick brown fox jumps over the lazy dog"))).toBe("9e107d9d372bb6826bd81d3542a419d6");
  });
});

describe("formatMd5Fingerprint", () => {
  it("formats hex as colon-separated pairs", () => {
    expect(formatMd5Fingerprint("d41d8cd98f00b204e9800998ecf8427e")).toBe("d4:1d:8c:d9:8f:00:b2:04:e9:80:09:98:ec:f8:42:7e");
  });
});

describe("generateRandomart", () => {
  it("generates 11-line ASCII art", () => {
    const art = generateRandomart("d41d8cd98f00b204e9800998ecf8427e");
    const lines = art.split("\n");
    expect(lines.length).toBe(11);
    expect(lines[0]).toContain("+---[IMG]---+");
  });
  it("uses pipe characters as borders", () => {
    const art = generateRandomart("abc123");
    expect(art).toContain("|");
  });
});

describe("generateAuthorizedKeysEntry", () => {
  it("reconstructs authorized_keys line", () => {
    const r = parseSshKey(TEST_ED25519_KEY);
    if ("error" in r) throw new Error("Should not error");
    const line = generateAuthorizedKeysEntry(r);
    expect(line).toBe(TEST_ED25519_KEY);
  });
});

describe("bytesToHex", () => {
  it("converts bytes to lowercase hex", () => {
    expect(bytesToHex(new Uint8Array([0, 15, 255]))).toBe("000fff");
  });
});
