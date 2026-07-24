import { describe, it, expect } from "vitest";
import { parse, summarize } from "./logic";

// A minimal valid DER structure: SEQUENCE { INTEGER 1 }
// DER bytes: 30 03 02 01 01 → base64 "MAMCAQE="
const MINIMAL_PEM = `-----BEGIN TEST-----
MAMCAQE=
-----END TEST-----`;

// A larger fake PEM (real-looking header but body is just padding bytes)
const SAMPLE_PEM = `-----BEGIN CERTIFICATE-----
MIIBcDCCARagAwIBAgICHQAwCgYIKoZIzj0EAwIwGjEYMBYGA1UEAwwPdW5xdG9v
bHMtdGVzdC1jYTAeFw0yNDAxMDEwMDAwMDBaFw0yNTAxMDEwMDAwMDBaMBsxGTAX
BgNVBAMMEHVucXRvb2xzLXRlc3QtY2EwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNC
AATT6+Uz5QXVD6cJjozKcGaA7v8eRPhQpYXmhJpK9IHUjJwQ9xnZ/aZZDl5XK2lI
u3RBqQIwCgYIKoZIzj0EAwIDSAAwRQIhAP+Q6s0Gz8FpZ3o5o2l3Vp2yGx5b5w9u
M5nQpJWqAibrAiB1n8Yp5wL5eM6p5p5w5p5p5p5p5p5p5p5p5p5p5p5p5p5p5p5p
-----END CERTIFICATE-----`;

describe("parse — valid", () => {
  it("parses PEM type", () => {
    const r = parse(SAMPLE_PEM);
    expect(r.valid).toBe(true);
    expect(r.type).toBe("CERTIFICATE");
  });
  it("decodes base64 to DER bytes", () => {
    const r = parse(SAMPLE_PEM);
    expect(r.der.length).toBeGreaterThan(0);
    expect(r.derHex.length).toBe(r.der.length * 2);
  });
  it("extracts base64 body without whitespace", () => {
    const r = parse(SAMPLE_PEM);
    expect(r.base64).not.toContain("\n");
    expect(r.base64.length).toBeGreaterThan(0);
  });
  it("parses ASN.1 top-level node from minimal PEM", () => {
    const r = parse(MINIMAL_PEM);
    expect(r.valid).toBe(true);
    expect(r.asn1TopLevel).toBeDefined();
    if (r.asn1TopLevel) {
      expect(r.asn1TopLevel.tagClass).toBe(0);
      expect(r.asn1TopLevel.constructed).toBe(true);
      expect(r.asn1TopLevel.children).toBeDefined();
      expect(r.asn1TopLevel.children!.length).toBe(1);
    }
  });
});

describe("parse — invalid", () => {
  it("errors on missing PEM block", () => {
    const r = parse("just plain text");
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it("errors on wrong length", () => {
    const r = parse("f47ac10b-58cc-4372");
    expect(r.valid).toBe(false);
  });
});

describe("parse — private key", () => {
  it("parses private key PEM type", () => {
    const pem = "-----BEGIN PRIVATE KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE\n-----END PRIVATE KEY-----";
    const r = parse(pem);
    expect(r.type).toBe("PRIVATE KEY");
  });
});

describe("summarize", () => {
  it("summarizes the parse result", () => {
    const r = parse(SAMPLE_PEM);
    const s = summarize(r);
    expect(s).toContain("Type: CERTIFICATE");
    expect(s).toContain("DER length:");
  });
});
