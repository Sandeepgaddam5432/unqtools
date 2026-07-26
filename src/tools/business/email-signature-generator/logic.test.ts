/**
 * Email Signature Generator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { generateSignature, socialLabel, supportedSocialTypes, type SignatureInput } from "./logic";

const base: SignatureInput = {
  name: "Jane Doe",
  title: "Engineer",
  company: "Acme Inc",
  email: "jane@acme.com",
  phone: "+1 555 0100",
  website: "https://acme.com",
};

describe("generateSignature — validation", () => {
  it("errors when name is missing", () => {
    expect("error" in generateSignature({ ...base, name: "" })).toBe(true);
  });
});

describe("generateSignature — HTML output", () => {
  it("includes the name in HTML", () => {
    const r = generateSignature(base);
    if ("error" in r) throw new Error("should not error");
    expect(r.html).toContain("Jane Doe");
  });
  it("renders a mailto link", () => {
    const r = generateSignature(base);
    if ("error" in r) throw new Error("should not error");
    expect(r.html).toContain('mailto:jane@acme.com');
  });
  it("renders a tel link", () => {
    const r = generateSignature(base);
    if ("error" in r) throw new Error("should not error");
    expect(r.html).toContain('tel:+15550100');
  });
  it("includes photo when provided", () => {
    const r = generateSignature({ ...base, photoUrl: "https://example.com/me.png" });
    if ("error" in r) throw new Error("should not error");
    expect(r.html).toContain('<img');
    expect(r.html).toContain('https://example.com/me.png');
  });
  it("escapes HTML special chars in name", () => {
    const r = generateSignature({ ...base, name: "Jane <script>" });
    if ("error" in r) throw new Error("should not error");
    expect(r.html).not.toContain('<script>');
    expect(r.html).toContain('&lt;script&gt;');
  });
  it("renders social links", () => {
    const r = generateSignature({ ...base, social: [{ type: "linkedin", url: "https://linkedin.com/in/jane" }] });
    if ("error" in r) throw new Error("should not error");
    expect(r.html).toContain('LinkedIn');
    expect(r.html).toContain('linkedin.com/in/jane');
  });
  it("applies accent colour", () => {
    const r = generateSignature({ ...base, accentColor: "#ff0000" });
    if ("error" in r) throw new Error("should not error");
    expect(r.html).toContain("#ff0000");
  });
});

describe("generateSignature — text & inline variants", () => {
  it("produces plain-text signature", () => {
    const r = generateSignature(base);
    if ("error" in r) throw new Error("should not error");
    expect(r.text).toContain("Jane Doe");
    expect(r.text).toContain("Engineer");
    expect(r.text).toContain("jane@acme.com");
  });
  it("produces inline-CSS variant", () => {
    const r = generateSignature(base);
    if ("error" in r) throw new Error("should not error");
    expect(r.htmlInline).toContain("Jane Doe");
    expect(r.htmlInline).toContain("style=");
  });
});

describe("generateSignature — warnings", () => {
  it("warns on invalid email", () => {
    const r = generateSignature({ ...base, email: "not-an-email" });
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("Email"))).toBe(true);
  });
  it("warns on invalid website", () => {
    const r = generateSignature({ ...base, website: "not a url" });
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("Website"))).toBe(true);
  });
  it("warns on invalid social URL", () => {
    const r = generateSignature({ ...base, social: [{ type: "github", url: "nope" }] });
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("GitHub"))).toBe(true);
  });
});

describe("helpers", () => {
  it("socialLabel returns friendly name", () => {
    expect(socialLabel("linkedin")).toBe("LinkedIn");
    expect(socialLabel("github")).toBe("GitHub");
  });
  it("supportedSocialTypes returns all 7 types", () => {
    expect(supportedSocialTypes().length).toBe(7);
  });
});
