import { describe, it, expect, beforeEach } from "vitest";
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

// ===== v8.1 upgrade tests =====

import {
  generateHotp,
  DEFAULT_HOTP,
  generateSteamCode,
  loadAccounts,
  saveAccounts,
  addAccount,
  removeAccount,
  generateBackupCodes,
  checkTimeSkew,
  buildOtpAuthUriForAccount,
  parseOtpAuthUri,
  generateCodesForAccounts,
  exportAccountsJson,
  importAccountsJson,
  loadCodeHistory,
  saveCodeToHistory,
  clearCodeHistory,
  generateNextCodes,
  checkSecretStrength,
  ALGORITHM_REFERENCE,
  buildTotpShareUrl,
  type TotpAccount,
} from "./logic";

describe("totp generateHotp", () => {
  it("generates a 6-digit HOTP code", async () => {
    const code = await generateHotp({ secret: "JBSWY3DPEHPK3PXP", counter: 1, ...DEFAULT_HOTP });
    expect(code).toMatch(/^\d{6}$/);
  });
  it("produces same code for same counter", async () => {
    const c1 = await generateHotp({ secret: "JBSWY3DPEHPK3PXP", counter: 5, ...DEFAULT_HOTP });
    const c2 = await generateHotp({ secret: "JBSWY3DPEHPK3PXP", counter: 5, ...DEFAULT_HOTP });
    expect(c1).toBe(c2);
  });
  it("produces different codes for different counters", async () => {
    const c1 = await generateHotp({ secret: "JBSWY3DPEHPK3PXP", counter: 1, ...DEFAULT_HOTP });
    const c2 = await generateHotp({ secret: "JBSWY3DPEHPK3PXP", counter: 2, ...DEFAULT_HOTP });
    expect(c1).not.toBe(c2);
  });
  it("throws on invalid counter", async () => {
    await expect(generateHotp({ secret: "JBSWY3DPEHPK3PXP", counter: -1, ...DEFAULT_HOTP })).rejects.toThrow();
  });
});

describe("totp generateSteamCode", () => {
  it("generates a 5-char Steam code", async () => {
    const code = await generateSteamCode("JBSWY3DPEHPK3PXP");
    expect(code).toHaveLength(5);
    expect(code).toMatch(/^[23456789BCDFGHJKMNPQRTVWXY]+$/);
  });
  it("uses custom alphabet (no 0, 1, A, E, I, L, O, S, U, Z)", async () => {
    const code = await generateSteamCode("JBSWY3DPEHPK3PXP");
    expect(code).not.toMatch(/[01AEILOSUZ]/);
  });
});

describe("totp accounts (localStorage)", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
  });
  it("starts empty", () => {
    expect(loadAccounts()).toEqual([]);
  });
  it("adds and loads accounts", () => {
    const updated = addAccount({
      issuer: "Google", account: "user@example.com", secret: "JBSWY3DPEHPK3PXP",
      period: 30, digits: 6, algorithm: "SHA-1", type: "totp",
    });
    expect(updated).toHaveLength(1);
    expect(updated[0].issuer).toBe("Google");
    expect(updated[0].id).toBeTruthy();
  });
  it("removes accounts by ID", () => {
    const added = addAccount({
      issuer: "Test", account: "user", secret: "JBSWY3DPEHPK3PXP",
      period: 30, digits: 6, algorithm: "SHA-1", type: "totp",
    });
    const id = added[0].id;
    const after = removeAccount(id);
    expect(after).toHaveLength(0);
  });
});

describe("totp generateBackupCodes", () => {
  it("generates 8 codes by default", () => {
    const bc = generateBackupCodes();
    expect(bc.codes).toHaveLength(8);
  });
  it("formats codes as XXXX-XXXX", () => {
    const bc = generateBackupCodes(2, 8);
    expect(bc.codes[0]).toMatch(/^\d{4}-\d{4}$/);
  });
  it("generates unique codes", () => {
    const bc = generateBackupCodes(20, 8);
    expect(new Set(bc.codes).size).toBe(20);
  });
});

describe("totp checkTimeSkew", () => {
  it("returns no warning when skew is small", () => {
    const now = Date.now();
    const r = checkTimeSkew(now + 2000); // 2s skew
    expect(r.isSignificant).toBe(false);
    expect(r.warning).toBeNull();
  });
  it("returns warning when skew >5s", () => {
    const now = Date.now();
    const r = checkTimeSkew(now - 10000); // 10s behind
    expect(r.isSignificant).toBe(true);
    expect(r.warning).toBeTruthy();
  });
  it("returns no info when no reference time", () => {
    const r = checkTimeSkew();
    expect(r.skewSeconds).toBe(0);
  });
});

describe("totp buildOtpAuthUriForAccount", () => {
  it("builds URI for TOTP account", () => {
    const account: TotpAccount = {
      id: "x", issuer: "Google", account: "user@example.com", secret: "JBSWY3DPEHPK3PXP",
      period: 30, digits: 6, algorithm: "SHA-1", type: "totp", addedAt: "2026-01-01T00:00:00Z",
    };
    const uri = buildOtpAuthUriForAccount(account);
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
  });
  it("builds URI for HOTP account with counter", () => {
    const account: TotpAccount = {
      id: "x", issuer: "Test", account: "user", secret: "JBSWY3DPEHPK3PXP",
      period: 30, digits: 6, algorithm: "SHA-1", type: "hotp", counter: 5, addedAt: "2026-01-01T00:00:00Z",
    };
    const uri = buildOtpAuthUriForAccount(account);
    expect(uri).toMatch(/^otpauth:\/\/hotp\//);
    expect(uri).toContain("counter=5");
  });
});

describe("totp parseOtpAuthUri", () => {
  it("parses a TOTP URI", () => {
    const uri = "otpauth://totp/Google:user%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Google&algorithm=SHA1&digits=6&period=30";
    const parsed = parseOtpAuthUri(uri);
    expect(parsed?.type).toBe("totp");
    expect(parsed?.issuer).toBe("Google");
    expect(parsed?.account).toBe("user@example.com");
    expect(parsed?.secret).toBe("JBSWY3DPEHPK3PXP");
  });
  it("returns null for non-otpauth URI", () => {
    expect(parseOtpAuthUri("https://example.com")).toBeNull();
  });
});

describe("totp generateCodesForAccounts", () => {
  it("generates codes for multiple accounts", async () => {
    const accounts: TotpAccount[] = [
      { id: "1", issuer: "A", account: "u1", secret: "JBSWY3DPEHPK3PXP", period: 30, digits: 6, algorithm: "SHA-1", type: "totp", addedAt: "" },
      { id: "2", issuer: "B", account: "u2", secret: "JBSWY3DPEHPK3PXP", period: 30, digits: 6, algorithm: "SHA-1", type: "totp", addedAt: "" },
    ];
    const results = await generateCodesForAccounts(accounts);
    expect(results).toHaveLength(2);
    expect(results[0].code).toMatch(/^\d{6}$/);
  });
});

describe("totp export/import accounts", () => {
  it("round-trips accounts through JSON", () => {
    const accounts: TotpAccount[] = [
      { id: "1", issuer: "A", account: "u1", secret: "JBSWY3DPEHPK3PXP", period: 30, digits: 6, algorithm: "SHA-1", type: "totp", addedAt: "2026-01-01" },
    ];
    const json = exportAccountsJson(accounts);
    const imported = importAccountsJson(json);
    expect(imported).toEqual(accounts);
  });
  it("throws on invalid import", () => {
    expect(() => importAccountsJson("not valid")).toThrow();
  });
});

describe("totp code history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
  });
  it("saves and loads", () => {
    saveCodeToHistory("Google", "123456");
    const h = loadCodeHistory();
    expect(h).toHaveLength(1);
    expect(h[0].code).toBe("123456");
  });
  it("clears", () => {
    saveCodeToHistory("A", "111");
    clearCodeHistory();
    expect(loadCodeHistory()).toEqual([]);
  });
});

describe("totp generateNextCodes", () => {
  it("generates N future codes", async () => {
    const codes = await generateNextCodes({ secret: "JBSWY3DPEHPK3PXP", period: 30, digits: 6, algorithm: "SHA-1" }, 3);
    expect(codes).toHaveLength(3);
    expect(codes[0].code).toMatch(/^\d{6}$/);
  });
});

describe("totp checkSecretStrength", () => {
  it("rates short secrets as Weak", () => {
    const s = checkSecretStrength("JBSWY3DP"); // 5 bytes = 40 bits
    expect(s.label).toBe("Weak");
  });
  it("rates 20-byte secrets as Strong", () => {
    const s = checkSecretStrength("JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP"); // ~20 bytes
    expect(s.label).toBe("Strong");
  });
});

describe("totp ALGORITHM_REFERENCE", () => {
  it("includes SHA-1, SHA-256, SHA-512", () => {
    const names = ALGORITHM_REFERENCE.map((a) => a.name);
    expect(names).toContain("SHA-1");
    expect(names).toContain("SHA-256");
    expect(names).toContain("SHA-512");
  });
});
