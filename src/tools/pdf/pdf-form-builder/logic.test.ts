import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildForm, fieldHeight } from "./logic";

describe("fieldHeight", () => {
  it("scales with font size and kind", () => {
    expect(fieldHeight({ kind: "text", label: "x" }, 12)).toBeGreaterThan(0);
    expect(fieldHeight({ kind: "checkbox", label: "x" }, 12)).toBeLessThan(fieldHeight({ kind: "dropdown", label: "x" }, 12));
  });
});

describe("buildForm", () => {
  it("creates a PDF with text fields", async () => {
    const r = await buildForm({
      fields: [
        { kind: "text", label: "Full name" },
        { kind: "text", label: "Email" },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.fieldsCreated).toBe(2);
      const doc = await PDFDocument.load(r.output.bytes);
      expect(doc.getForm().getFields().length).toBe(2);
    }
  });

  it("creates checkboxes, radios and dropdowns", async () => {
    const r = await buildForm({
      fields: [
        { kind: "checkbox", label: "Agree" },
        { kind: "radio", label: "Plan", options: ["Free", "Pro"] },
        { kind: "dropdown", label: "Country", options: ["IN", "US"] },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const doc = await PDFDocument.load(r.output.bytes);
      expect(doc.getForm().getFields().length).toBe(3);
    }
  });

  it("uses multiple pages for many fields", async () => {
    const fields = Array.from({ length: 40 }, (_, i) => ({ kind: "text" as const, label: `Field ${i}` }));
    const r = await buildForm({ fields, margin: 30, fontSize: 12 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.pagesUsed).toBeGreaterThan(1);
      expect(r.output.fieldsCreated).toBe(40);
    }
  });

  it("rejects an empty field list", async () => {
    const r = await buildForm({ fields: [] });
    expect(r.ok).toBe(false);
  });
});
