/**
 * Business Card Maker — unit tests.
 */
import { describe, it, expect } from "vitest";
import { computeLayout, validateInput, toVCard, toPlainText, DEFAULT_INPUT } from "./logic";

describe("business-card computeLayout", () => {
  it("uses 90×50 mm dimensions for all layouts", () => {
    for (const l of ["modern", "classic", "minimal"] as const) {
      const r = computeLayout(l);
      expect(r.widthMm).toBe(90);
      expect(r.heightMm).toBe(50);
    }
  });
  it("places name in safe area for modern layout", () => {
    const r = computeLayout("modern");
    const name = r.fieldPositions.name;
    expect(name.x).toBeGreaterThanOrEqual(r.safeMarginMm);
    expect(name.y).toBeGreaterThanOrEqual(r.safeMarginMm);
  });
});

describe("business-card validateInput", () => {
  it("accepts default input", () => {
    expect(validateInput(DEFAULT_INPUT).ok).toBe(true);
  });
  it("rejects empty name", () => {
    const r = validateInput({ ...DEFAULT_INPUT, name: "" });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("Name"))).toBe(true);
  });
  it("rejects invalid email", () => {
    const r = validateInput({ ...DEFAULT_INPUT, email: "not-an-email" });
    expect(r.ok).toBe(false);
  });
  it("rejects invalid website", () => {
    const r = validateInput({ ...DEFAULT_INPUT, website: "not a domain" });
    expect(r.ok).toBe(false);
  });
  it("rejects invalid accent color", () => {
    const r = validateInput({ ...DEFAULT_INPUT, accent: "red" });
    expect(r.ok).toBe(false);
  });
  it("accepts valid input with empty optional fields", () => {
    const r = validateInput({ ...DEFAULT_INPUT, email: "", phone: "", website: "", address: "" });
    expect(r.ok).toBe(true);
  });
});

describe("business-card toVCard", () => {
  it("produces well-formed vCard 3.0", () => {
    const v = toVCard(DEFAULT_INPUT);
    expect(v).toContain("BEGIN:VCARD");
    expect(v).toContain("VERSION:3.0");
    expect(v).toContain("FN:Jane Doe");
    expect(v).toContain("END:VCARD");
  });
  it("includes email and phone lines", () => {
    const v = toVCard(DEFAULT_INPUT);
    expect(v).toContain("EMAIL");
    expect(v).toContain("TEL");
  });
});

describe("business-card toPlainText", () => {
  it("includes name, title, and company", () => {
    const t = toPlainText(DEFAULT_INPUT);
    expect(t).toContain("Jane Doe");
    expect(t).toContain("Product Manager");
    expect(t).toContain("Acme Inc.");
  });
  it("omits empty fields", () => {
    const t = toPlainText({ ...DEFAULT_INPUT, phone: "", website: "" });
    expect(t).not.toContain("+1");
  });
});
