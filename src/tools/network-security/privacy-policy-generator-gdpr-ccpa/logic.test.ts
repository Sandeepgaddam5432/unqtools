import { describe, it, expect } from "vitest";
import { generatePolicy, defaultOptions, validate, getDataTypes } from "./logic";

describe("Privacy Policy Generator", () => {
  it("generates GDPR policy", () => {
    const opts = { ...defaultOptions(), jurisdiction: "gdpr" as const };
    const policy = generatePolicy(opts);
    expect(policy).toContain("GDPR");
    expect(policy).toContain("Your Company Name");
  });
  it("generates CCPA policy", () => {
    const opts = { ...defaultOptions(), jurisdiction: "ccpa" as const };
    expect(generatePolicy(opts)).toContain("CCPA");
  });
  it("includes cookie section when enabled", () => {
    const opts = { ...defaultOptions(), cookieUsage: true };
    expect(generatePolicy(opts)).toContain("Cookies");
  });
  it("includes third-party services", () => {
    const opts = { ...defaultOptions(), thirdPartyServices: ["Google Analytics"] };
    expect(generatePolicy(opts)).toContain("Google Analytics");
  });
  it("validates options", () => {
    const errors = validate({ ...defaultOptions(), companyName: "" });
    expect(errors.length).toBeGreaterThan(0);
  });
  it("lists data types", () => {
    expect(getDataTypes()).toContain("Email address");
  });
});
