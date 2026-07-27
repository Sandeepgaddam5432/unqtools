import { describe, it, expect } from "vitest";
import { validateOptions, getKeyTypes, jwkToPem } from "./logic";

describe("Cryptographic Key Generator", () => {
  it("validates AES options", () => {
    expect(validateOptions("aes", 256)).toHaveLength(0);
    expect(validateOptions("aes", 100).length).toBeGreaterThan(0);
  });
  it("validates RSA options", () => {
    expect(validateOptions("rsa", 2048)).toHaveLength(0);
    expect(validateOptions("rsa", 1024).length).toBeGreaterThan(0);
  });
  it("lists key types", () => {
    expect(getKeyTypes().length).toBe(3);
  });
  it("converts JWK to PEM format", () => {
    const pem = jwkToPem({ kty: "RSA" }, true);
    expect(pem).toContain("PUBLIC KEY");
  });
});
