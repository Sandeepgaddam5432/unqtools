import { describe, it, expect } from "vitest";
import {
  encryptText,
  decryptText,
  generatePassword,
  estimateStrength,
  getStats,
  formatBytes,
} from "./logic";

describe("AES Encrypt/Decrypt", () => {
  const defaultOpts = {
    mode: "AES-GCM" as const,
    keySize: 256 as const,
    password: "test-password-123",
    iterations: 100000,
    outputFormat: "base64" as const,
  };

  it("encrypts and decrypts with AES-GCM", async () => {
    const plaintext = "Hello, World!";
    const enc = await encryptText(plaintext, defaultOpts);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    expect(enc.fullOutput).toBeTruthy();

    const dec = await decryptText(enc.fullOutput, {
      ...defaultOpts,
      inputFormat: "base64",
    });
    expect(dec.ok).toBe(true);
    if (!dec.ok) return;
    expect(dec.plaintext).toBe(plaintext);
  });

  it("encrypts and decrypts with AES-CBC", async () => {
    const plaintext = "Secret message for CBC mode";
    const opts = { ...defaultOpts, mode: "AES-CBC" as const };
    const enc = await encryptText(plaintext, opts);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;

    const dec = await decryptText(enc.fullOutput, {
      ...opts,
      inputFormat: "base64",
    });
    expect(dec.ok).toBe(true);
    if (!dec.ok) return;
    expect(dec.plaintext).toBe(plaintext);
  });

  it("supports hex output format", async () => {
    const plaintext = "Hex test";
    const opts = { ...defaultOpts, outputFormat: "hex" as const };
    const enc = await encryptText(plaintext, opts);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    expect(/^[0-9a-f]+$/.test(enc.fullOutput)).toBe(true);

    const dec = await decryptText(enc.fullOutput, {
      ...opts,
      inputFormat: "hex",
    });
    expect(dec.ok).toBe(true);
    if (!dec.ok) return;
    expect(dec.plaintext).toBe(plaintext);
  });

  it("handles unicode text", async () => {
    const plaintext = "Héllo wörld 日本語 🎉";
    const enc = await encryptText(plaintext, defaultOpts);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;

    const dec = await decryptText(enc.fullOutput, {
      ...defaultOpts,
      inputFormat: "base64",
    });
    expect(dec.ok).toBe(true);
    if (!dec.ok) return;
    expect(dec.plaintext).toBe(plaintext);
  });

  it("fails with wrong password", async () => {
    const enc = await encryptText("secret", defaultOpts);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;

    const dec = await decryptText(enc.fullOutput, {
      ...defaultOpts,
      password: "wrong-password",
      inputFormat: "base64",
    });
    expect(dec.ok).toBe(false);
  });

  it("fails with empty plaintext", async () => {
    const enc = await encryptText("", defaultOpts);
    expect(enc.ok).toBe(false);
  });

  it("fails with empty password", async () => {
    const enc = await encryptText("test", { ...defaultOpts, password: "" });
    expect(enc.ok).toBe(false);
  });

  it("fails with too-short input for decryption", async () => {
    const dec = await decryptText("YQ==", {
      ...defaultOpts,
      inputFormat: "base64",
    });
    expect(dec.ok).toBe(false);
  });

  it("supports 128-bit key size", async () => {
    const opts = { ...defaultOpts, keySize: 128 as const };
    const enc = await encryptText("128-bit test", opts);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;

    const dec = await decryptText(enc.fullOutput, { ...opts, inputFormat: "base64" });
    expect(dec.ok).toBe(true);
    if (!dec.ok) return;
    expect(dec.plaintext).toBe("128-bit test");
  });

  it("supports 192-bit key size", async () => {
    const opts = { ...defaultOpts, keySize: 192 as const };
    const enc = await encryptText("192-bit test", opts);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;

    const dec = await decryptText(enc.fullOutput, { ...opts, inputFormat: "base64" });
    expect(dec.ok).toBe(true);
    if (!dec.ok) return;
    expect(dec.plaintext).toBe("192-bit test");
  });

  it("produces different ciphertexts for same plaintext (random IV)", async () => {
    const enc1 = await encryptText("same text", defaultOpts);
    const enc2 = await encryptText("same text", defaultOpts);
    expect(enc1.ok && enc2.ok).toBe(true);
    if (!enc1.ok || !enc2.ok) return;
    expect(enc1.fullOutput).not.toBe(enc2.fullOutput);
  });

  it("generatePassword returns correct length", () => {
    const pw = generatePassword(32);
    expect(pw.length).toBe(32);
  });

  it("generatePassword without symbols", () => {
    const pw = generatePassword(20, false);
    expect(pw.length).toBe(20);
    expect(/[^a-zA-Z0-9]/.test(pw)).toBe(false);
  });

  it("estimateStrength rates weak passwords", () => {
    expect(estimateStrength("abc").label).toBe("Weak");
  });

  it("estimateStrength rates strong passwords", () => {
    const result = estimateStrength("MyStr0ng!Pass#2024$Secure");
    expect(result.label).toBe("Strong");
  });

  it("estimateStrength handles empty password", () => {
    expect(estimateStrength("").score).toBe(0);
  });

  it("getStats calculates sizes correctly", () => {
    const stats = getStats("hello", "encrypted-output-longer");
    expect(stats.inputSize).toBe(5);
    expect(stats.ratio).toBeGreaterThan(1);
  });

  it("formatBytes works correctly", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });
});
