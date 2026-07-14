import { describe, it, expect } from "vitest";
import {
  base32Decode,
  base32Encode,
  generateRandomSecret,
  validateOptions,
  generateTotp,
  secondsRemaining,
  buildOtpAuthUri,
  DEFAULT_OPTIONS,
  type TotpOptions,
} from "./logic";

describe("totp base32Decode", () => {
  it("decodes a simple base32 string", () => {
    // "Hello" in base32 is "JBSWY3DP"
    const bytes = base32Decode("JBSWY3DP");
    expect(Array.from(bytes)).toEqual([72, 101, 108, 108, 111]);
  });

  it("decodes with spaces and lowercase", () => {
    const bytes = base32Decode("jbsw y3dp");
    expect(Array.from(bytes)).toEqual([72, 101, 108, 108, 111]);
  });

  it("decodes with padding", () => {
    const bytes = base32Decode("JBSWY3DP====");
    expect(Array.from(bytes)).toEqual([72, 101, 108, 108, 111]);
  });

  it("throws on empty input", () => {
    expect(() => base32Decode("")).toThrow(/empty/i);
    expect(() => base32Decode("   ")).toThrow(/empty/i);
  });

  it("throws on invalid characters", () => {
    expect(() => base32Decode("JBSWY3DP!")).toThrow(/invalid base32/i);
    expect(() => base32Decode("01289")).toThrow(/invalid base32/i);
  });
});

describe("totp base32Encode", () => {
  it("encodes bytes to base32", () => {
    expect(base32Encode(new Uint8Array([72, 101, 108, 108, 111]))).toBe("JBSWY3DP");
  });

  it("round-trips through encode/decode", () => {
    const original = "JBSWY3DPEHPK3PXP";
    const bytes = base32Decode(original);
    expect(base32Encode(bytes)).toBe(original);
  });

  it("returns empty string for empty input", () => {
    expect(base32Encode(new Uint8Array([]))).toBe("");
  });
});

describe("totp generateRandomSecret", () => {
  it("generates a secret of the right byte length", () => {
    const secret = generateRandomSecret(20);
    const bytes = base32Decode(secret);
    expect(bytes.length).toBe(20);
  });

  it("generates unique secrets", () => {
    const secrets = new Set<string>();
    for (let i = 0; i < 20; i++) secrets.add(generateRandomSecret(20));
    expect(secrets.size).toBeGreaterThan(15);
  });

  it("throws on too-short length", () => {
    expect(() => generateRandomSecret(5)).toThrow();
  });
});

describe("totp validateOptions", () => {
  const valid: TotpOptions = { secret: "JBSWY3DP", ...DEFAULT_OPTIONS };

  it("accepts valid options", () => {
    expect(validateOptions(valid)).toBeNull();
  });

  it("rejects empty secret", () => {
    expect(validateOptions({ ...valid, secret: "" })).toMatch(/secret/i);
  });

  it("rejects period out of range", () => {
    expect(validateOptions({ ...valid, period: 0 })).toMatch(/period/i);
    expect(validateOptions({ ...valid, period: 601 })).toMatch(/period/i);
    expect(validateOptions({ ...valid, period: 1.5 })).toMatch(/period/i);
  });

  it("rejects invalid digits", () => {
    expect(validateOptions({ ...valid, digits: 5 })).toMatch(/digits/i);
    expect(validateOptions({ ...valid, digits: 7 })).toMatch(/digits/i);
    expect(validateOptions({ ...valid, digits: 10 })).toMatch(/digits/i);
  });

  it("rejects invalid algorithm", () => {
    expect(validateOptions({ ...valid, algorithm: "MD5" as any })).toMatch(/algorithm/i);
  });
});

describe("totp generateTotp", () => {
  const opts: TotpOptions = { secret: "JBSWY3DPEHPK3PXP", ...DEFAULT_OPTIONS };

  it("generates a 6-digit code with default digits", async () => {
    const code = await generateTotp(opts, 1700000000000);
    expect(code).toMatch(/^\d{6}$/);
  });

  it("generates an 8-digit code when digits=8", async () => {
    const code = await generateTotp({ ...opts, digits: 8 }, 1700000000000);
    expect(code).toMatch(/^\d{8}$/);
  });

  it("produces the same code for the same time window", async () => {
    // Two timestamps within the same 30-second window (5 seconds apart)
    const code1 = await generateTotp(opts, 1700000000000);
    const code2 = await generateTotp(opts, 1700000005000);
    expect(code1).toBe(code2);
  });

  it("produces different codes for different time windows", async () => {
    // Two timestamps in different 30-second windows (35 seconds apart)
    const code1 = await generateTotp(opts, 1700000000000);
    const code2 = await generateTotp(opts, 1700000035000);
    expect(code1).not.toBe(code2);
  });

  it("produces different codes for different secrets", async () => {
    const code1 = await generateTotp({ ...opts, secret: "JBSWY3DPEHPK3PXP" }, 1700000000000);
    const code2 = await generateTotp({ ...opts, secret: "KRSXG5DPEHPK3PXP" }, 1700000000000);
    expect(code1).not.toBe(code2);
  });

  it("produces different codes for different algorithms", async () => {
    const ts = 1700000000000;
    const sha1 = await generateTotp({ ...opts, algorithm: "SHA-1" }, ts);
    const sha256 = await generateTotp({ ...opts, algorithm: "SHA-256" }, ts);
    expect(sha1).not.toBe(sha256);
  });

  it("throws on invalid options", async () => {
    await expect(generateTotp({ ...opts, secret: "" })).rejects.toThrow();
    await expect(generateTotp({ ...opts, digits: 7 } as any)).rejects.toThrow();
  });

  it("RFC 6238 — produces same code for same counter with same inputs", async () => {
    // Using the RFC 6238 test seed (20 bytes "12345678901234567890" base32-encoded)
    // This is "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    const rfcOpts: TotpOptions = {
      secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
      period: 30,
      digits: 8,
      algorithm: "SHA-1",
    };
    // T=59s → expected "94287082"
    const code = await generateTotp(rfcOpts, 59 * 1000);
    expect(code).toBe("94287082");
  });
});

describe("totp secondsRemaining", () => {
  it("returns the right number of seconds until next refresh", () => {
    // 1000ms into a 30s window → 29 seconds remaining
    expect(secondsRemaining(30, 1000)).toBe(29);
    // 29000ms into a 30s window → 1 second remaining
    expect(secondsRemaining(30, 29000)).toBe(1);
    // 30000ms is start of new window → 30 seconds remaining
    expect(secondsRemaining(30, 30000)).toBe(30);
  });
});

describe("totp buildOtpAuthUri", () => {
  it("builds a valid otpauth:// URI", () => {
    const opts: TotpOptions = { secret: "JBSWY3DPEHPK3PXP", ...DEFAULT_OPTIONS };
    const uri = buildOtpAuthUri(opts, "alice@example.com", "Acme");
    // Label format: issuer:account — issuer and account are URL-encoded,
    // but the literal ":" between them is NOT encoded.
    expect(uri).toMatch(/^otpauth:\/\/totp\/Acme:alice%40example\.com\?/);
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
    expect(uri).toContain("algorithm=SHA1");
    expect(uri).toContain("issuer=Acme");
  });
});
