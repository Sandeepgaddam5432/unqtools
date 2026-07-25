import { describe, it, expect } from "vitest";
import { detectPemType, getLabelForType, extractPemBody, base64ToBytes, parsePemSync } from "./logic";

const RSA_PRIVATE = `-----BEGIN RSA PRIVATE KEY-----
MIIBOgIBAAJBAKjQ4Z2sI3j2nPE3rXxJ+0FZ4r2qXr3XzP1vX2J7kL3oZ2sI3j2
nPE3rXxJ+0FZ4r2qXr3XzP1vX2J7kL3oZ2sI3j2nPE3rXxJ+0FZ4r2qXr3XzP1
AgMBAAECQQDZ8h8vE2hJ9nGn5QwT4W2pM3oZ2sI3j2nPE3rXxJ+0FZ4r2qXr3X
-----END RSA PRIVATE KEY-----`;

const CERT = `-----BEGIN CERTIFICATE-----
MIIDBzCCAnCgAwIBAgICEAAwDQYJKoZIhvcNAQELBQAwMzELMAkGA1UEBhMCVVMx
CzAJBgNVBAMMAkNBMB4XDTI0MDEwMTAwMDAwMFoXDTI1MDEwMTAwMDAwMFowMzEL
-----END CERTIFICATE-----`;

const PKCS8 = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDW
-----END PRIVATE KEY-----`;

const WITH_HEADERS = `-----BEGIN ENCRYPTED PRIVATE KEY-----
Proc-Type: 4,ENCRYPTED
DEK-Info: AES-256-CBC,ABCDEF0123456789

MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDW
-----END ENCRYPTED PRIVATE KEY-----`;

describe("pem-key-parser detectPemType", () => {
  it("detects RSA private key", () => {
    expect(detectPemType(RSA_PRIVATE)).toBe("rsa-private");
  });

  it("detects certificate", () => {
    expect(detectPemType(CERT)).toBe("certificate");
  });

  it("detects PKCS#8 private key", () => {
    expect(detectPemType(PKCS8)).toBe("private-key");
  });

  it("returns unknown for non-PEM", () => {
    expect(detectPemType("hello world")).toBe("unknown");
  });
});

describe("pem-key-parser getLabelForType", () => {
  it("returns human label", () => {
    expect(getLabelForType("rsa-private")).toBe("RSA Private Key");
    expect(getLabelForType("certificate")).toBe("X.509 Certificate");
    expect(getLabelForType("unknown")).toBe("Unknown");
  });
});

describe("pem-key-parser extractPemBody", () => {
  it("extracts body without whitespace", () => {
    const body = extractPemBody(RSA_PRIVATE);
    expect(body).not.toBeNull();
    expect(body!.body).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(body!.body.length).toBeGreaterThan(0);
  });

  it("parses headers like DEK-Info", () => {
    const body = extractPemBody(WITH_HEADERS);
    expect(body).not.toBeNull();
    expect(body!.headers["DEK-Info"]).toContain("AES-256-CBC");
    expect(body!.headers["Proc-Type"]).toBe("4,ENCRYPTED");
  });

  it("returns null for malformed input", () => {
    expect(extractPemBody("not a pem")).toBeNull();
  });
});

describe("pem-key-parser base64ToBytes", () => {
  it("decodes valid base64", () => {
    const bytes = base64ToBytes("aGVsbG8=");
    expect(bytes).not.toBeNull();
    expect(bytes!.length).toBe(5);
    expect(Array.from(bytes!)).toEqual([104, 101, 108, 108, 111]);
  });

  it("rejects empty input", () => {
    expect(base64ToBytes("")).toBeNull();
  });

  it("rejects invalid length", () => {
    expect(base64ToBytes("abc")).toBeNull();
  });
});

describe("pem-key-parser parsePemSync", () => {
  it("parses a valid RSA private key", () => {
    const info = parsePemSync(RSA_PRIVATE);
    expect(info.isValid).toBe(true);
    expect(info.type).toBe("rsa-private");
    expect(info.algorithm).toBe("RSA");
    expect(info.derByteLength).toBeGreaterThan(0);
  });

  it("rejects empty input", () => {
    const info = parsePemSync("");
    expect(info.isValid).toBe(false);
    expect(info.error).toMatch(/empty/i);
  });

  it("rejects non-PEM input", () => {
    const info = parsePemSync("just some text");
    expect(info.isValid).toBe(false);
    expect(info.error).toMatch(/PEM/i);
  });

  it("parses certificate with correct type", () => {
    const info = parsePemSync(CERT);
    expect(info.isValid).toBe(true);
    expect(info.type).toBe("certificate");
    expect(info.algorithm).toBe("X.509");
  });
});
