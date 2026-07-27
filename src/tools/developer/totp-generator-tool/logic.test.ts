import { describe, it, expect } from "vitest";
import { base32Decode, base32Encode, getRemainingSeconds, generateSecret, buildOtpAuthUri } from "./logic";

describe("TOTP Generator", () => {
  it("decodes base32", () => {
    const bytes = base32Decode("JBSWY3DPEHPK3PXP");
    expect(bytes.length).toBeGreaterThan(0);
  });
  it("encodes base32", () => {
    const encoded = base32Encode(new Uint8Array([1, 2, 3]));
    expect(encoded.length).toBeGreaterThan(0);
  });
  it("gets remaining seconds", () => {
    const remaining = getRemainingSeconds(30);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(30);
  });
  it("generates secret", () => {
    const secret = generateSecret();
    expect(secret.length).toBeGreaterThan(10);
  });
  it("builds otpauth URI", () => {
    const uri = buildOtpAuthUri("JBSWY3DPEHPK3PXP", "user@example.com", "Test");
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
  });
});
