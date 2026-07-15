import { describe, it, expect, beforeEach } from "vitest";
import { PDFDocument } from "pdf-lib";
import { encryptPdf, DEFAULT_PERMISSIONS } from "../pdf-password-encryptor/logic";
import {
  inferEncryptionLevel,
  signedToUnsigned,
  parsePdfHexString,
  extractEncryptDictText,
  parseEncryptDict,
  extractDocumentId,
  verifyUserPassword,
  removeSecurity,
  removeSecurityBatch,
  formatBytes, toHex,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl, parseShareUrl,
} from "./logic";

// Helper: make a real, valid PDF using pdf-lib
async function makeValidPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage();
  doc.setTitle("Test PDF");
  const bytes = await doc.save();
  return bytes as unknown as Uint8Array;
}

// Helper: make an encrypted PDF with our own encryptor (operates on a real PDF)
async function makeEncryptedPdf(
  userPassword: string,
  ownerPassword: string,
  level: "rc4-40" | "rc4-128" | "aes-128" = "rc4-40",
): Promise<Uint8Array> {
  const original = await makeValidPdf();
  return encryptPdf(original, {
    userPassword, ownerPassword, permissions: DEFAULT_PERMISSIONS, level,
  }).encryptedBytes;
}

// ===== inferEncryptionLevel =====

describe("pdf-security-remover inferEncryptionLevel", () => {
  it("returns rc4-40 for V=1 R=2", () => {
    expect(inferEncryptionLevel(1, 2)).toBe("rc4-40");
  });
  it("returns rc4-128 for V=2 R=3", () => {
    expect(inferEncryptionLevel(2, 3)).toBe("rc4-128");
  });
  it("returns aes-128 for V=4 R=4", () => {
    expect(inferEncryptionLevel(4, 4)).toBe("aes-128");
  });
  it("returns null for unknown combination", () => {
    expect(inferEncryptionLevel(5, 6)).toBeNull();
  });
  it("returns null for null inputs", () => {
    expect(inferEncryptionLevel(null, null)).toBeNull();
  });
});

// ===== signedToUnsigned =====

describe("pdf-security-remover signedToUnsigned", () => {
  it("converts -44 to 0xffffffd4", () => {
    expect(signedToUnsigned(-44)).toBe(0xffffffd4);
  });
  it("preserves positive values", () => {
    expect(signedToUnsigned(100)).toBe(100);
  });
  it("handles 0", () => {
    expect(signedToUnsigned(0)).toBe(0);
  });
});

// ===== parsePdfHexString =====

describe("pdf-security-remover parsePdfHexString", () => {
  it("parses a simple hex string", () => {
    const bytes = parsePdfHexString("<abcdef>");
    expect(Array.from(bytes)).toEqual([0xab, 0xcd, 0xef]);
  });
  it("parses an empty hex string", () => {
    expect(parsePdfHexString("<>").length).toBe(0);
  });
  it("handles whitespace inside hex", () => {
    const bytes = parsePdfHexString("<ab cd ef>");
    expect(Array.from(bytes)).toEqual([0xab, 0xcd, 0xef]);
  });
  it("handles uppercase hex", () => {
    const bytes = parsePdfHexString("<ABCDEF>");
    expect(Array.from(bytes)).toEqual([0xab, 0xcd, 0xef]);
  });
  it("truncates odd-length hex", () => {
    const bytes = parsePdfHexString("<abc>");
    expect(bytes.length).toBe(2);
  });
});

// ===== extractEncryptDictText =====

describe("pdf-security-remover extractEncryptDictText", () => {
  it("returns hasEncrypt=false for non-encrypted PDF", () => {
    const pdf = new TextEncoder().encode(
      "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\nstartxref\n0\n%%EOF\n"
    );
    const result = extractEncryptDictText(pdf);
    expect(result.hasEncrypt).toBe(false);
  });
  it("returns hasEncrypt=true for encrypted PDF", async () => {
    const pdf = await makeEncryptedPdf("user", "owner");
    const result = extractEncryptDictText(pdf);
    expect(result.hasEncrypt).toBe(true);
    expect(result.objNum).not.toBeNull();
  });
  it("extracts dictionary text", async () => {
    const pdf = await makeEncryptedPdf("user", "owner");
    const result = extractEncryptDictText(pdf);
    expect(result.dictText).toContain("/Filter /Standard");
  });
  it("returns hasEncrypt=false when trailer is missing", () => {
    const pdf = new TextEncoder().encode("%PDF-1.4 no trailer here");
    const result = extractEncryptDictText(pdf);
    expect(result.hasEncrypt).toBe(false);
  });
});

// ===== parseEncryptDict =====

describe("pdf-security-remover parseEncryptDict", () => {
  it("returns hasEncrypt=false for non-encrypted PDF", () => {
    const pdf = new TextEncoder().encode(
      "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\nstartxref\n0\n%%EOF\n"
    );
    const parsed = parseEncryptDict(pdf);
    expect(parsed.hasEncrypt).toBe(false);
  });
  it("parses V, R, Length from encrypted PDF", async () => {
    const pdf = await makeEncryptedPdf("user", "owner", "rc4-40");
    const parsed = parseEncryptDict(pdf);
    expect(parsed.hasEncrypt).toBe(true);
    expect(parsed.V).toBe(1);
    expect(parsed.R).toBe(2);
    expect(parsed.length).toBe(40);
  });
  it("parses 32-byte /O and /U hashes", async () => {
    const pdf = await makeEncryptedPdf("user", "owner", "rc4-128");
    const parsed = parseEncryptDict(pdf);
    expect(parsed.O).not.toBeNull();
    expect(parsed.U).not.toBeNull();
    expect(parsed.O!.length).toBe(32);
    expect(parsed.U!.length).toBe(32);
  });
  it("parses /P permission integer", async () => {
    const pdf = await makeEncryptedPdf("user", "owner");
    const parsed = parseEncryptDict(pdf);
    expect(parsed.P).not.toBeNull();
  });
  it("decodes permission flags", async () => {
    const pdf = await makeEncryptedPdf("user", "owner");
    const parsed = parseEncryptDict(pdf);
    expect(parsed.permissions).not.toBeNull();
    expect(parsed.permissions!.print).toBe(true); // DEFAULT_PERMISSIONS.print = true
  });
  it("infers encryption level", async () => {
    const pdf = await makeEncryptedPdf("user", "owner", "aes-128");
    const parsed = parseEncryptDict(pdf);
    expect(parsed.level).toBe("aes-128");
  });
  it("stores raw dictionary text", async () => {
    const pdf = await makeEncryptedPdf("user", "owner");
    const parsed = parseEncryptDict(pdf);
    expect(parsed.rawText).toContain("/Filter");
  });
});

// ===== extractDocumentId =====

describe("pdf-security-remover extractDocumentId", () => {
  it("returns null for PDF without /ID", () => {
    const pdf = new TextEncoder().encode(
      "%PDF-1.4\ntrailer\n<< /Root 1 0 R >>\nstartxref\n0\n%%EOF\n"
    );
    expect(extractDocumentId(pdf)).toBeNull();
  });
  it("extracts 16-byte document ID from encrypted PDF", async () => {
    const pdf = await makeEncryptedPdf("user", "owner");
    const id = extractDocumentId(pdf);
    expect(id).not.toBeNull();
    expect(id!.length).toBe(16);
  });
});

// ===== verifyUserPassword =====

describe("pdf-security-remover verifyUserPassword", () => {
  it("returns true for correct user password", async () => {
    const pdf = await makeEncryptedPdf("correct-password", "owner");
    const parsed = parseEncryptDict(pdf);
    const id = extractDocumentId(pdf)!;
    expect(verifyUserPassword("correct-password", parsed, id)).toBe(true);
  });
  it("returns false for wrong user password", async () => {
    const pdf = await makeEncryptedPdf("correct-password", "owner");
    const parsed = parseEncryptDict(pdf);
    const id = extractDocumentId(pdf)!;
    expect(verifyUserPassword("wrong-password", parsed, id)).toBe(false);
  });
  it("returns false for non-encrypted PDF", () => {
    const pdf = new TextEncoder().encode(
      "%PDF-1.4\ntrailer\n<< /Root 1 0 R >>\nstartxref\n0\n%%EOF\n"
    );
    const parsed = parseEncryptDict(pdf);
    const id = extractDocumentId(pdf) ?? new Uint8Array(16);
    expect(verifyUserPassword("any", parsed, id)).toBe(false);
  });
  it("works with rc4-128 level", async () => {
    const pdf = await makeEncryptedPdf("mypassword", "owner", "rc4-128");
    const parsed = parseEncryptDict(pdf);
    const id = extractDocumentId(pdf)!;
    expect(verifyUserPassword("mypassword", parsed, id)).toBe(true);
  });
  it("works with aes-128 level", async () => {
    const pdf = await makeEncryptedPdf("mypassword", "owner", "aes-128");
    const parsed = parseEncryptDict(pdf);
    const id = extractDocumentId(pdf)!;
    expect(verifyUserPassword("mypassword", parsed, id)).toBe(true);
  });
});

// ===== removeSecurity =====

describe("pdf-security-remover removeSecurity", () => {
  it("roundtrips a non-encrypted PDF (no /Encrypt to remove)", async () => {
    const pdf = await makeValidPdf();
    const out = await removeSecurity(pdf);
    expect(out.length).toBeGreaterThan(0);
    // Output should not contain /Encrypt (none was there to begin with)
    const outStr = new TextDecoder().decode(out);
    expect(outStr).not.toMatch(/\/Encrypt\s+\d+\s+0\s+R/);
  });
  it("preserves PDF structure", async () => {
    const pdf = await makeValidPdf();
    const out = await removeSecurity(pdf);
    expect(out.length).toBeGreaterThan(0);
  });
  it("throws on empty input", async () => {
    await expect(removeSecurity(new Uint8Array(0))).rejects.toThrow();
  });
  it("throws on non-PDF input", async () => {
    await expect(removeSecurity(new TextEncoder().encode("not a pdf"))).rejects.toThrow();
  });
});

// ===== removeSecurityBatch =====

describe("pdf-security-remover removeSecurityBatch", () => {
  it("processes multiple valid PDFs", async () => {
    const pdf1 = await makeValidPdf();
    const pdf2 = await makeValidPdf();
    const result = await removeSecurityBatch([
      { fileName: "a.pdf", bytes: pdf1 },
      { fileName: "b.pdf", bytes: pdf2 },
    ]);
    expect(result.outputs.length).toBe(2);
    expect(result.outputs[0]!.bytes).not.toBeNull();
    expect(result.outputs[1]!.bytes).not.toBeNull();
  });
  it("reports errors for invalid PDFs", async () => {
    const result = await removeSecurityBatch([
      { fileName: "bad.pdf", bytes: new Uint8Array(0) },
    ]);
    expect(result.outputs[0]!.error).not.toBeNull();
    expect(result.outputs[0]!.bytes).toBeNull();
  });
  it("computes total sizes for valid PDFs", async () => {
    const pdf = await makeValidPdf();
    const result = await removeSecurityBatch([
      { fileName: "a.pdf", bytes: pdf },
    ]);
    expect(result.totalOriginal).toBe(pdf.length);
    expect(result.totalRemoved).toBeGreaterThan(0);
  });
});

// ===== formatBytes / toHex =====

describe("pdf-security-remover formatBytes/toHex", () => {
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

describe("pdf-security-remover history", () => {
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
      fileCount: 2, totalOriginal: 1000, totalRemoved: 950,
      removedAt: new Date().toISOString(),
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory({
        fileCount: 1, totalOriginal: 100, totalRemoved: 95,
        removedAt: new Date().toISOString(),
      });
    }
    expect(loadHistory()).toHaveLength(10);
  });
  it("clears history", () => {
    saveToHistory({
      fileCount: 1, totalOriginal: 100, totalRemoved: 95,
      removedAt: new Date().toISOString(),
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== Share URL =====

describe("pdf-security-remover share URL", () => {
  beforeEach(() => {
    (globalThis as unknown as { window: typeof globalThis & { location: { origin: string; pathname: string } } }).window = globalThis as unknown as typeof globalThis & { location: { origin: string; pathname: string } };
    (globalThis as { location?: { origin: string; pathname: string } }).location = {
      origin: "https://example.com",
      pathname: "/tools/pdf-security-remover",
    };
  });

  it("builds share URL", () => {
    const url = buildShareUrl();
    expect(url).toContain("https://example.com");
  });
  it("parses '#auto' as true", () => {
    expect(parseShareUrl("#auto")).toBe(true);
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
});
