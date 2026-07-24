/**
 * AES-256 Encryptor/Decryptor — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  passwordScore, generateSalt, generateIv, bytesToBase64, base64ToBytes,
  bytesToHex, hexToBytes, envelopeToJson, parseEnvelope, validateEnvelope,
  formatDuration, DEFAULT_OPTIONS,
} from "./logic";

describe("passwordScore", () => {
  it("scores empty password as 0", () => {
    const r = passwordScore("");
    expect(r.score).toBe(0);
    expect(r.label).toBe("Very weak");
  });
  it("scores short password as 0 or 1", () => {
    const r = passwordScore("abc");
    expect(r.score).toBeLessThanOrEqual(1);
  });
  it("scores long mixed password as 4", () => {
    const r = passwordScore("Abcdefgh1234567!@#");
    expect(r.score).toBe(4);
  });
  it("provides suggestions for weak passwords", () => {
    const r = passwordScore("abc");
    expect(r.suggestions.length).toBeGreaterThan(0);
  });
});

describe("generateSalt", () => {
  it("generates salt of requested length", () => {
    const s = generateSalt(16);
    expect(s.length).toBe(16);
  });
  it("generates different salts each call", () => {
    const s1 = generateSalt(16);
    const s2 = generateSalt(16);
    expect(Array.from(s1)).not.toEqual(Array.from(s2));
  });
});

describe("generateIv", () => {
  it("generates 12-byte IV for GCM", () => {
    expect(generateIv("aes-gcm").length).toBe(12);
  });
  it("generates 16-byte IV for CBC", () => {
    expect(generateIv("aes-cbc").length).toBe(16);
  });
});

describe("bytesToBase64 / base64ToBytes round-trip", () => {
  it("round-trips arbitrary bytes", () => {
    const original = new Uint8Array([0, 1, 2, 255, 128, 64, 32]);
    const b64 = bytesToBase64(original);
    const back = base64ToBytes(b64);
    expect(Array.from(back)).toEqual(Array.from(original));
  });
  it("round-trips empty bytes", () => {
    const b64 = bytesToBase64(new Uint8Array());
    expect(b64).toBe("");
    expect(base64ToBytes(b64).length).toBe(0);
  });
});

describe("bytesToHex / hexToBytes round-trip", () => {
  it("round-trips arbitrary bytes", () => {
    const original = new Uint8Array([0, 1, 2, 255, 128, 64, 32]);
    const hex = bytesToHex(original);
    const back = hexToBytes(hex);
    expect(Array.from(back)).toEqual(Array.from(original));
  });
  it("hex output is lowercase and zero-padded", () => {
    expect(bytesToHex(new Uint8Array([0, 15, 255]))).toBe("000fff");
  });
  it("handles hex with whitespace", () => {
    const back = hexToBytes("00 0f ff");
    expect(Array.from(back)).toEqual([0, 15, 255]);
  });
});

describe("envelopeToJson / parseEnvelope round-trip", () => {
  it("round-trips a valid envelope", () => {
    const env = {
      v: 1 as const,
      mode: "aes-gcm" as const,
      hash: "SHA-256" as const,
      iterations: 210_000,
      salt: "AAAAAAAAAAAAAAAA",
      iv: "AAAAAAAAAAAAAAAA",
      ciphertext: "AAAA",
    };
    const json = envelopeToJson(env);
    const parsed = parseEnvelope(json);
    if ("error" in parsed) throw new Error("Should not error");
    expect(parsed).toEqual(env);
  });
  it("errors on invalid JSON", () => {
    const r = parseEnvelope("not json");
    expect("error" in r).toBe(true);
  });
  it("errors on wrong version", () => {
    const r = parseEnvelope('{"v": 99}');
    expect("error" in r).toBe(true);
  });
  it("errors on missing fields", () => {
    const r = parseEnvelope('{"v": 1, "mode": "aes-gcm"}');
    expect("error" in r).toBe(true);
  });
});

describe("validateEnvelope", () => {
  it("warns on low iterations", () => {
    const warnings = validateEnvelope({
      v: 1, mode: "aes-gcm", hash: "SHA-256", iterations: 50_000,
      salt: "AAAAAAAAAAAAAAAA", iv: "AAAAAAAAAAAAAAAA", ciphertext: "AAAA",
    });
    expect(warnings.some((w) => w.includes("100,000"))).toBe(true);
  });
  it("passes for recommended params", () => {
    const warnings = validateEnvelope({
      v: 1, mode: "aes-gcm", hash: "SHA-256", iterations: 210_000,
      salt: "AAAAAAAAAAAAAAAA", iv: "AAAAAAAAAAAAAAAA", ciphertext: "AAAA",
    });
    expect(warnings.length).toBe(0);
  });
  it("warns on unknown mode", () => {
    const warnings = validateEnvelope({
      v: 1, mode: "unknown" as never, hash: "SHA-256", iterations: 210_000,
      salt: "AAAAAAAAAAAAAAAA", iv: "AAAAAAAAAAAAAAAA", ciphertext: "AAAA",
    });
    expect(warnings.some((w) => w.includes("Unknown mode"))).toBe(true);
  });
});

describe("formatDuration", () => {
  it("formats milliseconds", () => {
    expect(formatDuration(50)).toBe("50ms");
  });
  it("formats seconds", () => {
    expect(formatDuration(1500)).toBe("1.50s");
  });
  it("formats minutes + seconds", () => {
    expect(formatDuration(125_000)).toBe("2m 5s");
  });
});

describe("DEFAULT_OPTIONS", () => {
  it("uses recommended defaults", () => {
    expect(DEFAULT_OPTIONS.mode).toBe("aes-gcm");
    expect(DEFAULT_OPTIONS.iterations).toBeGreaterThanOrEqual(100_000);
    expect(DEFAULT_OPTIONS.hash).toBe("SHA-256");
  });
});
