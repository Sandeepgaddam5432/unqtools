import { describe, it, expect } from "vitest";
import {
  securityInfoFor, paddingToAlgorithm, paddingToHash, maxPlaintextBytes,
  keyAlgorithm, toBytes, planJwkShape, planFingerprint, bytesToHex, hexToBytes,
  bytesToBase64Url, planEncrypt, planBatch, renderBatchCsv, renderReport,
  keySizeComparisonTable, PADDING_MODES, KEY_SIZES,
  type KeyGenParams, type EncryptJob,
} from "./logic";

describe("rsa-encryption-tool securityInfoFor", () => {
  it("marks 1024 as deprecated", () => {
    const s = securityInfoFor(1024);
    expect(s.level).toBe("deprecated");
    expect(s.symmetricBits).toBe(80);
  });
  it("marks 2048 as acceptable", () => {
    const s = securityInfoFor(2048);
    expect(s.level).toBe("acceptable");
    expect(s.symmetricBits).toBe(112);
  });
  it("marks 4096 as very-strong", () => {
    const s = securityInfoFor(4096);
    expect(s.level).toBe("very-strong");
    expect(s.symmetricBits).toBe(152);
  });
});

describe("rsa-encryption-tool padding helpers", () => {
  it("maps OAEP modes to RSA-OAEP", () => {
    expect(paddingToAlgorithm("OAEP-SHA256")).toBe("RSA-OAEP");
    expect(paddingToAlgorithm("PKCS1-v1.5")).toBe("RSASSA-PKCS1-v1_5");
  });
  it("maps hash names", () => {
    expect(paddingToHash("OAEP-SHA256")).toBe("SHA-256");
    expect(paddingToHash("OAEP-SHA512")).toBe("SHA-512");
    expect(paddingToHash("PKCS1-v1.5")).toBe("SHA-256");
  });
});

describe("rsa-encryption-tool maxPlaintextBytes", () => {
  it("computes OAEP plaintext max", () => {
    const m = maxPlaintextBytes(2048, "OAEP-SHA256");
    // 256 - 2*32 - 2 = 190
    expect(m).toBe(190);
  });
  it("computes PKCS1 plaintext max", () => {
    const m = maxPlaintextBytes(2048, "PKCS1-v1.5");
    expect(m).toBe(245);
  });
});

describe("rsa-encryption-tool toBytes", () => {
  it("converts integers to big-endian bytes", () => {
    expect(toBytes(0)).toEqual([0]);
    expect(toBytes(1)).toEqual([1]);
    expect(toBytes(256)).toEqual([1, 0]);
    expect(toBytes(65537)).toEqual([1, 0, 1]);
  });
});

describe("rsa-encryption-tool keyAlgorithm", () => {
  it("builds a WebCrypto algorithm identifier", () => {
    const params: KeyGenParams = { keySize: 2048, publicExponent: 65537, extractable: true };
    const alg = keyAlgorithm(params);
    expect(alg.name).toBe("RSA-OAEP");
    expect(alg.modulusLength).toBe(2048);
    expect(alg.hash).toBe("SHA-256");
    expect(Array.from(alg.publicExponent)).toEqual([1, 0, 1]);
  });
});

describe("rsa-encryption-tool planJwkShape", () => {
  it("plans a public JWK with encrypt op", () => {
    const params: KeyGenParams = { keySize: 2048, publicExponent: 65537, extractable: true };
    const jwk = planJwkShape(params, "OAEP-SHA256", true);
    expect(jwk.kty).toBe("RSA");
    expect(jwk.key_ops).toEqual(["encrypt"]);
    expect(jwk.alg).toContain("RSA-OAEP");
  });
  it("plans a private JWK with decrypt op", () => {
    const params: KeyGenParams = { keySize: 2048, publicExponent: 65537, extractable: true };
    const jwk = planJwkShape(params, "OAEP-SHA256", false);
    expect(jwk.key_ops).toEqual(["decrypt"]);
    expect(jwk.d).toBe("");
  });
});

describe("rsa-encryption-tool planFingerprint", () => {
  it("plans a fingerprint with short id", () => {
    const f = planFingerprint(2048, "abcdef0123456789");
    expect(f.shortId).toBe("abcdef0123456789");
    expect(f.algorithm).toBe("RSA-2048");
  });
  it("uses key size as fallback short id", () => {
    const f = planFingerprint(2048);
    expect(f.shortId).toBe("2048-bit");
  });
});

describe("rsa-encryption-tool bytesToHex / hexToBytes", () => {
  it("round-trips bytes through hex", () => {
    const bytes = new Uint8Array([0, 255, 128, 1]);
    const hex = bytesToHex(bytes);
    expect(hex).toBe("00ff8001");
    expect(Array.from(hexToBytes(hex))).toEqual([0, 255, 128, 1]);
  });
  it("returns empty array for invalid hex", () => {
    expect(hexToBytes("xyz").length).toBe(0);
    expect(hexToBytes("abc").length).toBe(0);
  });
});

describe("rsa-encryption-tool bytesToBase64Url", () => {
  it("encodes bytes as base64url", () => {
    const b = bytesToBase64Url(new Uint8Array([255, 255]));
    expect(b).toBe("__8");
  });
});

describe("rsa-encryption-tool planEncrypt", () => {
  it("fits within plaintext max", () => {
    const job: EncryptJob = { plaintext: "hello", keySize: 2048, mode: "OAEP-SHA256" };
    const p = planEncrypt(job);
    expect(p.fits).toBe(true);
    expect(p.plaintextBytes).toBe(5);
  });
  it("warns when plaintext too large", () => {
    const long = "a".repeat(300);
    const job: EncryptJob = { plaintext: long, keySize: 1024, mode: "OAEP-SHA256" };
    const p = planEncrypt(job);
    expect(p.fits).toBe(false);
    expect(p.warnings.length).toBeGreaterThan(0);
  });
  it("adds note for PKCS1-v1.5", () => {
    const job: EncryptJob = { plaintext: "x", keySize: 2048, mode: "PKCS1-v1.5" };
    const p = planEncrypt(job);
    expect(p.notes.some((n) => n.includes("PKCS1-v1.5"))).toBe(true);
  });
});

describe("rsa-encryption-tool planBatch / renderBatchCsv", () => {
  it("aggregates batch stats", () => {
    const jobs: EncryptJob[] = [
      { plaintext: "a", keySize: 2048, mode: "OAEP-SHA256" },
      { plaintext: "x".repeat(300), keySize: 1024, mode: "OAEP-SHA256" },
    ];
    const b = planBatch(jobs);
    expect(b.stats.count).toBe(2);
    expect(b.stats.valid).toBe(1);
    expect(b.stats.invalid).toBe(1);
  });
  it("renders CSV header", () => {
    const csv = renderBatchCsv(planBatch([]));
    expect(csv.split("\n")[0]).toContain("index,key_size");
  });
});

describe("rsa-encryption-tool renderReport", () => {
  it("renders a report", () => {
    const job: EncryptJob = { plaintext: "hello", keySize: 2048, mode: "OAEP-SHA256" };
    const p = planEncrypt(job);
    const s = securityInfoFor(2048);
    const r = renderReport(p, s);
    expect(r).toContain("RSA Encryption Plan Report");
    expect(r).toContain("Key size: 2048-bit");
  });
});

describe("rsa-encryption-tool constants / table", () => {
  it("exposes 5 padding modes", () => {
    expect(PADDING_MODES.length).toBe(5);
  });
  it("exposes 3 key sizes", () => {
    expect(KEY_SIZES.length).toBe(3);
  });
  it("builds key size comparison table", () => {
    const csv = keySizeComparisonTable();
    expect(csv.split("\n")[0]).toContain("Key size,Symmetric bits");
    expect(csv.split("\n").length).toBe(4);
  });
});
