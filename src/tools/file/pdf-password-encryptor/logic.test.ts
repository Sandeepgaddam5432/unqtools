import { describe, it, expect, beforeEach } from "vitest";
import {
  PDF_PADDING,
  DEFAULT_PERMISSIONS,
  getEncryptionParams,
  encodePermissions, decodePermissions, describePermissions,
  padPassword,
  rc4Init, rc4Crypt,
  computeO, computeEncryptionKey, computeU,
  buildEncryptDict, toPdfHexString, toPdfInt,
  generateDocumentId,
  injectEncryptObject,
  encryptPdf, encryptBatch,
  formatBytes, toHex,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
  type EncryptionLevel, type PermissionFlags,
} from "./logic";

// ===== getEncryptionParams =====

describe("pdf-password-encryptor getEncryptionParams", () => {
  it("returns V=1 R=2 for rc4-40", () => {
    const p = getEncryptionParams("rc4-40");
    expect(p.V).toBe(1);
    expect(p.R).toBe(2);
    expect(p.length).toBe(40);
    expect(p.keyLengthBytes).toBe(5);
  });
  it("returns V=2 R=3 for rc4-128", () => {
    const p = getEncryptionParams("rc4-128");
    expect(p.V).toBe(2);
    expect(p.R).toBe(3);
    expect(p.length).toBe(128);
    expect(p.keyLengthBytes).toBe(16);
  });
  it("returns V=4 R=4 for aes-128", () => {
    const p = getEncryptionParams("aes-128");
    expect(p.V).toBe(4);
    expect(p.R).toBe(4);
    expect(p.length).toBe(128);
    expect(p.keyLengthBytes).toBe(16);
  });
});

// ===== encodePermissions / decodePermissions =====

describe("pdf-password-encryptor encodePermissions", () => {
  it("sets must-be-1 bits (13-32, 7, 8)", () => {
    const P = encodePermissions({ ...DEFAULT_PERMISSIONS }, 3);
    expect((P & 0xfffff000) >>> 0).toBe(0xfffff000);
    expect((P & 0xc0) >>> 0).toBe(0xc0);
  });
  it("clears bit 3 (print) when print=false", () => {
    const P = encodePermissions({ ...DEFAULT_PERMISSIONS, print: false }, 3);
    expect(P & 0x04).toBe(0);
  });
  it("sets bit 3 (print) when print=true", () => {
    const P = encodePermissions({ ...DEFAULT_PERMISSIONS, print: true }, 3);
    expect(P & 0x04).toBe(0x04);
  });
  it("clears bit 4 (modify) when modify=false", () => {
    const P = encodePermissions({ ...DEFAULT_PERMISSIONS, modify: false }, 3);
    expect(P & 0x08).toBe(0);
  });
  it("clears bit 5 (copy) when copy=false", () => {
    const P = encodePermissions({ ...DEFAULT_PERMISSIONS, copy: false }, 3);
    expect(P & 0x10).toBe(0);
  });
  it("clears bit 9 (fillForms) when fillForms=false for R=3", () => {
    const P = encodePermissions({ ...DEFAULT_PERMISSIONS, fillForms: false }, 3);
    expect(P & 0x100).toBe(0);
  });
  it("ignores R=3+ bits for R=2", () => {
    const P = encodePermissions({ ...DEFAULT_PERMISSIONS, fillForms: false, assemble: false }, 2);
    // Bits 9-12 should still be set to 1 for R=2 (they're not user-settable)
    expect(P & 0x100).toBe(0x100);
    expect(P & 0x400).toBe(0x400);
  });
  it("returns unsigned 32-bit value", () => {
    const P = encodePermissions({ ...DEFAULT_PERMISSIONS }, 3);
    expect(P).toBeGreaterThanOrEqual(0);
    expect(P).toBeLessThanOrEqual(0xffffffff);
  });
});

describe("pdf-password-encryptor decodePermissions", () => {
  it("roundtrips through encode → decode for R=3", () => {
    const flags: PermissionFlags = {
      print: true, modify: true, copy: false, annotate: true,
      fillForms: false, extractAccessibility: true, assemble: false, printHighQuality: true,
    };
    const P = encodePermissions(flags, 3);
    const decoded = decodePermissions(P, 3);
    expect(decoded.print).toBe(flags.print);
    expect(decoded.modify).toBe(flags.modify);
    expect(decoded.copy).toBe(flags.copy);
    expect(decoded.annotate).toBe(flags.annotate);
    expect(decoded.fillForms).toBe(flags.fillForms);
    expect(decoded.assemble).toBe(flags.assemble);
    expect(decoded.printHighQuality).toBe(flags.printHighQuality);
  });
});

describe("pdf-password-encryptor describePermissions", () => {
  it("returns 8 lines", () => {
    const lines = describePermissions(DEFAULT_PERMISSIONS);
    expect(lines.length).toBe(8);
  });
  it("uses ✓ for allowed", () => {
    const lines = describePermissions({ ...DEFAULT_PERMISSIONS, print: true });
    expect(lines[0]).toMatch(/✓ Print allowed/);
  });
  it("uses ✗ for denied", () => {
    const lines = describePermissions({ ...DEFAULT_PERMISSIONS, modify: false });
    expect(lines[1]).toMatch(/✗ Modify contents denied/);
  });
});

// ===== padPassword =====

describe("pdf-password-encryptor padPassword", () => {
  it("returns 32 bytes", () => {
    expect(padPassword("hello").length).toBe(32);
  });
  it("prepends password bytes", () => {
    const padded = padPassword("AB");
    expect(padded[0]).toBe(0x41); // 'A'
    expect(padded[1]).toBe(0x42); // 'B'
    expect(padded[2]).toBe(PDF_PADDING[2]);
  });
  it("truncates passwords longer than 32 bytes", () => {
    const longPw = "A".repeat(50);
    const padded = padPassword(longPw);
    expect(padded.length).toBe(32);
    expect(padded[0]).toBe(0x41);
    expect(padded[31]).toBe(0x41);
  });
  it("handles empty password (just padding)", () => {
    const padded = padPassword("");
    expect(padded).toEqual(PDF_PADDING);
  });
  it("accepts Uint8Array input", () => {
    const pw = new Uint8Array([0x41, 0x42]);
    const padded = padPassword(pw);
    expect(padded[0]).toBe(0x41);
    expect(padded[1]).toBe(0x42);
  });
});

// ===== RC4 =====

describe("pdf-password-encryptor rc4Init", () => {
  it("returns 256-byte permutation", () => {
    const S = rc4Init(new Uint8Array([1, 2, 3]));
    expect(S.length).toBe(256);
  });
  it("contains all bytes 0-255", () => {
    const S = rc4Init(new Uint8Array([1, 2, 3]));
    const seen = new Set<number>();
    for (const b of S) seen.add(b);
    expect(seen.size).toBe(256);
  });
});

describe("pdf-password-encryptor rc4Crypt", () => {
  it("is symmetric (decrypt = encrypt)", () => {
    const key = new Uint8Array([1, 2, 3, 4, 5]);
    const plaintext = new TextEncoder().encode("hello world");
    const encrypted = rc4Crypt(key, plaintext);
    const decrypted = rc4Crypt(key, encrypted);
    expect(Array.from(decrypted)).toEqual(Array.from(plaintext));
  });
  it("produces different output than input for non-empty data", () => {
    const key = new Uint8Array([0xff]);
    const plaintext = new TextEncoder().encode("hello");
    const encrypted = rc4Crypt(key, plaintext);
    expect(Array.from(encrypted)).not.toEqual(Array.from(plaintext));
  });
  it("produces empty output for empty input", () => {
    const key = new Uint8Array([1, 2, 3]);
    const encrypted = rc4Crypt(key, new Uint8Array(0));
    expect(encrypted.length).toBe(0);
  });
  it("matches known RC4 test vector", () => {
    // RFC 6229 test vector: key "Key" (0x4b 0x65 0x79), plaintext "Plaintext"
    // → BB F3 16 E8 D9 40 AF 0A D3
    const key = new TextEncoder().encode("Key");
    const plaintext = new TextEncoder().encode("Plaintext");
    const encrypted = rc4Crypt(key, plaintext);
    const expected = [0xbb, 0xf3, 0x16, 0xe8, 0xd9, 0x40, 0xaf, 0x0a, 0xd3];
    expect(Array.from(encrypted)).toEqual(expected);
  });
});

// ===== computeO =====

describe("pdf-password-encryptor computeO", () => {
  it("returns 32 bytes", () => {
    const params = getEncryptionParams("rc4-40");
    const O = computeO("user", "owner", params);
    expect(O.length).toBe(32);
  });
  it("uses user password when owner password is empty", () => {
    const params = getEncryptionParams("rc4-40");
    const O1 = computeO("user", "", params);
    const O2 = computeO("user", "user", params);
    expect(Array.from(O1)).toEqual(Array.from(O2));
  });
  it("produces different /O for different owner passwords", () => {
    const params = getEncryptionParams("rc4-40");
    const O1 = computeO("user", "owner1", params);
    const O2 = computeO("user", "owner2", params);
    expect(Array.from(O1)).not.toEqual(Array.from(O2));
  });
});

// ===== computeEncryptionKey =====

describe("pdf-password-encryptor computeEncryptionKey", () => {
  it("returns 5 bytes for rc4-40", () => {
    const params = getEncryptionParams("rc4-40");
    const O = computeO("user", "owner", params);
    const P = encodePermissions(DEFAULT_PERMISSIONS, params.R);
    const id = new Uint8Array(16).fill(0xab);
    const key = computeEncryptionKey("user", O, P, id, params);
    expect(key.length).toBe(5);
  });
  it("returns 16 bytes for rc4-128", () => {
    const params = getEncryptionParams("rc4-128");
    const O = computeO("user", "owner", params);
    const P = encodePermissions(DEFAULT_PERMISSIONS, params.R);
    const id = new Uint8Array(16).fill(0xab);
    const key = computeEncryptionKey("user", O, P, id, params);
    expect(key.length).toBe(16);
  });
  it("returns different keys for different passwords", () => {
    const params = getEncryptionParams("rc4-40");
    const O1 = computeO("user1", "owner", params);
    const O2 = computeO("user2", "owner", params);
    const P = encodePermissions(DEFAULT_PERMISSIONS, params.R);
    const id = new Uint8Array(16).fill(0xab);
    const k1 = computeEncryptionKey("user1", O1, P, id, params);
    const k2 = computeEncryptionKey("user2", O2, P, id, params);
    expect(Array.from(k1)).not.toEqual(Array.from(k2));
  });
});

// ===== computeU =====

describe("pdf-password-encryptor computeU", () => {
  it("returns 32 bytes for R=2", () => {
    const params = getEncryptionParams("rc4-40");
    const O = computeO("user", "owner", params);
    const P = encodePermissions(DEFAULT_PERMISSIONS, params.R);
    const id = new Uint8Array(16).fill(0xab);
    const key = computeEncryptionKey("user", O, P, id, params);
    const U = computeU(key, id, params);
    expect(U.length).toBe(32);
  });
  it("returns 32 bytes for R=3", () => {
    const params = getEncryptionParams("rc4-128");
    const O = computeO("user", "owner", params);
    const P = encodePermissions(DEFAULT_PERMISSIONS, params.R);
    const id = new Uint8Array(16).fill(0xab);
    const key = computeEncryptionKey("user", O, P, id, params);
    const U = computeU(key, id, params);
    expect(U.length).toBe(32);
  });
  it("produces different /U for different document IDs", () => {
    const params = getEncryptionParams("rc4-40");
    const O = computeO("user", "owner", params);
    const P = encodePermissions(DEFAULT_PERMISSIONS, params.R);
    const id1 = new Uint8Array(16).fill(0xab);
    const id2 = new Uint8Array(16).fill(0xcd);
    const key1 = computeEncryptionKey("user", O, P, id1, params);
    const key2 = computeEncryptionKey("user", O, P, id2, params);
    const U1 = computeU(key1, id1, params);
    const U2 = computeU(key2, id2, params);
    expect(Array.from(U1)).not.toEqual(Array.from(U2));
  });
});

// ===== toPdfHexString / toPdfInt =====

describe("pdf-password-encryptor toPdfHexString/toPdfInt", () => {
  it("formats bytes as PDF hex string", () => {
    const hex = toPdfHexString(new Uint8Array([0xab, 0xcd, 0xef]));
    expect(hex).toBe("<abcdef>");
  });
  it("formats empty bytes", () => {
    expect(toPdfHexString(new Uint8Array(0))).toBe("<>");
  });
  it("formats integer as PDF literal", () => {
    expect(toPdfInt(42)).toBe("42");
  });
  it("formats negative integer", () => {
    expect(toPdfInt(-44)).toBe("-44");
  });
});

// ===== buildEncryptDict =====

describe("pdf-password-encryptor buildEncryptDict", () => {
  it("includes /Type /Encrypt", () => {
    const O = new Uint8Array(32).fill(0x01);
    const U = new Uint8Array(32).fill(0x02);
    const dict = buildEncryptDict(O, U, -44, getEncryptionParams("rc4-40"));
    expect(dict).toContain("/Type /Encrypt");
  });
  it("includes /Filter /Standard", () => {
    const O = new Uint8Array(32).fill(0x01);
    const U = new Uint8Array(32).fill(0x02);
    const dict = buildEncryptDict(O, U, -44, getEncryptionParams("rc4-40"));
    expect(dict).toContain("/Filter /Standard");
  });
  it("includes V and R values", () => {
    const O = new Uint8Array(32).fill(0x01);
    const U = new Uint8Array(32).fill(0x02);
    const dict = buildEncryptDict(O, U, -44, getEncryptionParams("rc4-128"));
    expect(dict).toContain("/V 2");
    expect(dict).toContain("/R 3");
  });
  it("includes /O and /U hex strings", () => {
    const O = new Uint8Array(32).fill(0xab);
    const U = new Uint8Array(32).fill(0xcd);
    const dict = buildEncryptDict(O, U, -44, getEncryptionParams("rc4-40"));
    expect(dict).toContain("/O <");
    expect(dict).toContain("/U <");
    expect(dict).toContain("abababab");
  });
  it("includes /CF for AES", () => {
    const O = new Uint8Array(32).fill(0x01);
    const U = new Uint8Array(32).fill(0x02);
    const dict = buildEncryptDict(O, U, -44, getEncryptionParams("aes-128"));
    expect(dict).toContain("/CF");
    expect(dict).toContain("/AESV2");
    expect(dict).toContain("/StmF /StdCF");
  });
});

// ===== generateDocumentId =====

describe("pdf-password-encryptor generateDocumentId", () => {
  it("returns 16 bytes", () => {
    expect(generateDocumentId().length).toBe(16);
  });
  it("returns different values on subsequent calls (probabilistic)", () => {
    const id1 = generateDocumentId();
    const id2 = generateDocumentId();
    expect(Array.from(id1)).not.toEqual(Array.from(id2));
  });
});

// ===== injectEncryptObject =====

describe("pdf-password-encryptor injectEncryptObject", () => {
  function makePdf(): Uint8Array {
    return new TextEncoder().encode(
      "%PDF-1.4\n" +
      "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
      "2 0 obj\n<< /Type /Pages /Count 0 >>\nendobj\n" +
      "xref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n" +
      "trailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n109\n%%EOF\n"
    );
  }
  it("injects an /Encrypt object", () => {
    const pdf = makePdf();
    const dict = "<< /Type /Encrypt /Filter /Standard >>";
    const out = injectEncryptObject(pdf, dict, "<abcdef>");
    const outStr = new TextDecoder().decode(out);
    expect(outStr).toContain("3 0 obj");
    expect(outStr).toContain("/Type /Encrypt");
  });
  it("adds /Encrypt reference to trailer", () => {
    const pdf = makePdf();
    const dict = "<< /Type /Encrypt >>";
    const out = injectEncryptObject(pdf, dict, "<abcdef>");
    const outStr = new TextDecoder().decode(out);
    expect(outStr).toMatch(/\/Encrypt\s+3 0 R/);
  });
  it("adds /ID if not present", () => {
    const pdf = makePdf();
    const dict = "<< /Type /Encrypt >>";
    const out = injectEncryptObject(pdf, dict, "<abcdef>");
    const outStr = new TextDecoder().decode(out);
    expect(outStr).toContain("/ID [<abcdef> <abcdef>]");
  });
  it("throws if trailer not found", () => {
    const pdf = new TextEncoder().encode("%PDF-1.4\n%%EOF\n");
    expect(() => injectEncryptObject(pdf, "<< >>", "<abcdef>")).toThrow(/startxref|trailer/);
  });
  it("produces output larger than input", () => {
    const pdf = makePdf();
    const dict = "<< /Type /Encrypt /Filter /Standard /V 1 /R 2 /Length 40 /O <a> /U <b> /P -44 >>";
    const out = injectEncryptObject(pdf, dict, "<abcdef>");
    expect(out.length).toBeGreaterThan(pdf.length);
  });
});

// ===== encryptPdf =====

describe("pdf-password-encryptor encryptPdf", () => {
  function makePdf(): Uint8Array {
    return new TextEncoder().encode(
      "%PDF-1.4\n" +
      "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
      "2 0 obj\n<< /Type /Pages /Count 0 >>\nendobj\n" +
      "trailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n109\n%%EOF\n"
    );
  }
  it("computes /O and /U of correct length", () => {
    const result = encryptPdf(makePdf(), {
      userPassword: "user", ownerPassword: "owner",
      permissions: DEFAULT_PERMISSIONS, level: "rc4-40",
    });
    expect(result.O.length).toBe(32);
    expect(result.U.length).toBe(32);
  });
  it("computes /P as unsigned 32-bit", () => {
    const result = encryptPdf(makePdf(), {
      userPassword: "user", ownerPassword: "owner",
      permissions: DEFAULT_PERMISSIONS, level: "rc4-40",
    });
    expect(result.P).toBeGreaterThanOrEqual(0);
    expect(result.P).toBeLessThanOrEqual(0xffffffff);
  });
  it("encrypts bytes (output larger than input due to /Encrypt dict)", () => {
    const result = encryptPdf(makePdf(), {
      userPassword: "user", ownerPassword: "owner",
      permissions: DEFAULT_PERMISSIONS, level: "rc4-128",
    });
    expect(result.encryptedSize).toBeGreaterThan(result.originalSize);
  });
  it("throws on empty PDF", () => {
    expect(() => encryptPdf(new Uint8Array(0), {
      userPassword: "user", ownerPassword: "owner",
      permissions: DEFAULT_PERMISSIONS, level: "rc4-40",
    })).toThrow(/empty/i);
  });
  it("throws when both passwords are empty", () => {
    expect(() => encryptPdf(makePdf(), {
      userPassword: "", ownerPassword: "",
      permissions: DEFAULT_PERMISSIONS, level: "rc4-40",
    })).toThrow(/at least one/i);
  });
  it("produces valid /Encrypt dict body", () => {
    const result = encryptPdf(makePdf(), {
      userPassword: "user", ownerPassword: "owner",
      permissions: DEFAULT_PERMISSIONS, level: "aes-128",
    });
    expect(result.encryptDictBody).toContain("/V 4");
    expect(result.encryptDictBody).toContain("/R 4");
    expect(result.encryptDictBody).toContain("/AESV2");
  });
});

// ===== encryptBatch =====

describe("pdf-password-encryptor encryptBatch", () => {
  it("processes multiple files", () => {
    const pdf1 = new TextEncoder().encode("%PDF-1.4\ntrailer\n<< /Root 1 0 R >>\nstartxref\n0\n%%EOF\n");
    const pdf2 = new TextEncoder().encode("%PDF-1.4\ntrailer\n<< /Root 1 0 R >>\nstartxref\n0\n%%EOF\n");
    const result = encryptBatch(
      [{ fileName: "a.pdf", bytes: pdf1 }, { fileName: "b.pdf", bytes: pdf2 }],
      { userPassword: "u", ownerPassword: "o", permissions: DEFAULT_PERMISSIONS, level: "rc4-40" },
    );
    expect(result.outputs.length).toBe(2);
    expect(result.outputs[0]!.result).not.toBeNull();
    expect(result.outputs[1]!.result).not.toBeNull();
  });
  it("reports errors for invalid PDFs", () => {
    const result = encryptBatch(
      [{ fileName: "bad.pdf", bytes: new Uint8Array(0) }],
      { userPassword: "u", ownerPassword: "o", permissions: DEFAULT_PERMISSIONS, level: "rc4-40" },
    );
    expect(result.outputs[0]!.error).not.toBeNull();
    expect(result.outputs[0]!.result).toBeNull();
  });
});

// ===== formatBytes / toHex =====

describe("pdf-password-encryptor formatBytes/toHex", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
  it("formats hex", () => {
    expect(toHex(new Uint8Array([0xab, 0xcd]))).toBe("abcd");
  });
  it("formats empty hex", () => {
    expect(toHex(new Uint8Array(0))).toBe("");
  });
});

// ===== History (localStorage) =====

describe("pdf-password-encryptor history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
      key: (i: number) => Object.keys(store)[i] ?? null,
      get length() { return Object.keys(store).length; },
    } as Storage;
  });

  it("returns empty when no history", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    saveToHistory({
      fileCount: 2, level: "rc4-128",
      totalOriginal: 1000, totalEncrypted: 1100,
      permissions: ["print"], encryptedAt: new Date().toISOString(),
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileCount: 1, level: "rc4-40",
        totalOriginal: 100, totalEncrypted: 110,
        permissions: [], encryptedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory()).toHaveLength(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileCount: 1, level: "rc4-40",
      totalOriginal: 100, totalEncrypted: 110,
      permissions: [], encryptedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Share URL =====

describe("pdf-password-encryptor share URL", () => {
  beforeEach(() => {
    (globalThis as unknown as { window: typeof globalThis & { location: { origin: string; pathname: string } } }).window = globalThis as unknown as typeof globalThis & { location: { origin: string; pathname: string } };
    (globalThis as { location?: { origin: string; pathname: string } }).location = {
      origin: "https://example.com",
      pathname: "/tools/pdf-password-encryptor",
    };
  });

  it("builds share URL with options", () => {
    const url = buildShareUrl({
      level: "aes-128", print: true, modify: false, copy: true, annotate: false,
    });
    expect(url).toContain("level=aes-128");
    expect(url).toContain("print=true");
    expect(url).toContain("modify=false");
  });
  it("parses share URL back", () => {
    const url = buildShareUrl({
      level: "rc4-128", print: true, modify: false, copy: true, annotate: false,
    });
    const hash = url.substring(url.indexOf("#"));
    const parsed = parseShareUrl(hash);
    expect(parsed?.level).toBe("rc4-128");
    expect(parsed?.print).toBe(true);
    expect(parsed?.modify).toBe(false);
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("defaults to rc4-128 for invalid level", () => {
    expect(parseShareUrl("#level=invalid")?.level).toBe("rc4-128");
  });
});
