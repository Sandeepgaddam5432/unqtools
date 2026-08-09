import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { parseFdf, parseJsonInput, parseCsvInput, importFormData } from "./logic";

describe("parseFdf", () => {
  it("extracts field/value pairs", () => {
    const fdf = `%FDF-1.2\n<field name="fullname"><value>John</value></field>\n<field name="age"><value>30</value></field>`;
    const pairs = parseFdf(fdf);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]).toEqual({ name: "fullname", value: "John" });
  });
});

describe("parseJsonInput", () => {
  it("parses arrays and {fields:[]}", () => {
    expect(parseJsonInput('[{"name":"a","value":"1"}]')).toEqual([{ name: "a", value: "1" }]);
    expect(parseJsonInput('{"fields":[{"name":"b","value":"x"}]}')).toEqual([{ name: "b", value: "x" }]);
  });
});

describe("parseCsvInput", () => {
  it("parses name,value rows skipping header", () => {
    const csv = "name,value\nfullname,John Doe\nage,30";
    const pairs = parseCsvInput(csv);
    expect(pairs).toEqual([
      { name: "fullname", value: "John Doe" },
      { name: "age", value: "30" },
    ]);
  });
});

describe("importFormData", () => {
  async function makeFormPdf(): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 400]);
    const form = doc.getForm();
    const name = form.createTextField("fullname");
    name.addToPage(page, { x: 50, y: 300, width: 150, height: 20 });
    const cb = form.createCheckBox("agree");
    cb.addToPage(page, { x: 50, y: 260, width: 16, height: 16 });
    return doc.save();
  }

  it("fills fields from FDF", async () => {
    const r = await importFormData(await makeFormPdf(), [], "fdf", '<field name="fullname"><value>Sandeep</value></field>');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.setCount).toBe(1);
      const doc = await PDFDocument.load(r.output.bytes);
      const f = doc.getForm().getFields().find((x) => x.getName() === "fullname");
      expect((f as { getText: () => string }).getText()).toBe("Sandeep");
    }
  });

  it("fills checkboxes and reports skips", async () => {
    const r = await importFormData(
      await makeFormPdf(),
      [],
      "json",
      JSON.stringify([
        { name: "agree", value: "true" },
        { name: "missing", value: "x" },
      ])
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.setCount).toBe(1);
      expect(r.output.skipped).toContain("missing");
    }
  });

  it("errors on empty input", async () => {
    const r = await importFormData(await makeFormPdf(), [], "json", "[]");
    expect(r.ok).toBe(false);
  });

  it("rejects corrupt PDFs", async () => {
    const r = await importFormData(new Uint8Array([1, 2]), [], "json", '[{"name":"a","value":"b"}]');
    expect(r.ok).toBe(false);
  });
});
