/**
 * CSR Generator Reference — unit tests.
 */
import { describe, it, expect } from "vitest";
import { parseCSR, CSR_REFERENCE } from "./logic";

// A real-ish (truncated) PEM CSR for testing — body is mostly valid base64.
const SAMPLE_PEM = `-----BEGIN CERTIFICATE REQUEST-----
MIICVDCCATwCAQAwDzENMAsGA1UEAwwEdGVzdDCCASIwDQYJKoZIhvcNAQEBBQAD
ggEPADCCAQoCggEBAOn4F9G+IiCt/Zy7H3pwIozm1O8w9v8sL5YQk1p0lYQ5UnJ
yZqG6o3u3H9S5t3+WnJr2tI2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
-----END CERTIFICATE REQUEST-----`;

describe("csr parseCSR", () => {
  it("detects PEM header", () => {
    const r = parseCSR(SAMPLE_PEM);
    expect(r.hasPemHeader).toBe(true);
    expect(r.hasPemFooter).toBe(true);
  });
  it("extracts base64 body without PEM markers", () => {
    const r = parseCSR(SAMPLE_PEM);
    expect(r.base64Body).not.toContain("-----BEGIN");
    expect(r.base64Body).not.toContain("-----END");
  });
  it("parses outer DER tag (SEQUENCE = 0x30)", () => {
    const r = parseCSR(SAMPLE_PEM);
    expect(r.outerTag).toBe(0x30);
  });
  it("returns non-zero derByteLength for valid body", () => {
    const r = parseCSR(SAMPLE_PEM);
    expect(r.derByteLength).toBeGreaterThan(0);
  });
  it("reports errors for empty input", () => {
    const r = parseCSR("");
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.derByteLength).toBe(0);
  });
  it("reports missing PEM header", () => {
    const r = parseCSR("MIICVDCCATwCAQAwDzEN");
    expect(r.hasPemHeader).toBe(false);
    expect(r.errors.some((e) => e.includes("Missing PEM header"))).toBe(true);
  });
  it("reports missing PEM footer", () => {
    const r = parseCSR("-----BEGIN CERTIFICATE REQUEST-----\nMIICVDCCATwCAQAw");
    expect(r.hasPemFooter).toBe(false);
    expect(r.errors.some((e) => e.includes("Missing PEM footer"))).toBe(true);
  });
  it("handles malformed base64 gracefully", () => {
    const r = parseCSR("-----BEGIN CERTIFICATE REQUEST-----\n!!!notbase64!!!\n-----END CERTIFICATE REQUEST-----");
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe("csr CSR_REFERENCE", () => {
  it("includes an openssl command", () => {
    expect(CSR_REFERENCE.opensslCommand).toContain("openssl req");
  });
  it("lists common subject fields", () => {
    const codes = CSR_REFERENCE.fields.map((f) => f.code);
    expect(codes).toContain("CN");
    expect(codes).toContain("C");
    expect(codes).toContain("O");
  });
});
