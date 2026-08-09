import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { exportFormData, fieldsToCsv, fieldsToFdf } from "./logic";

async function makeFormPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 400]);
  const form = doc.getForm();
  const name = form.createTextField("fullname");
  name.addToPage(page, { x: 50, y: 300, width: 150, height: 20 });
  name.setText("Sandeep Gaddam");
  const cb = form.createCheckBox("agree");
  cb.addToPage(page, { x: 50, y: 260, width: 16, height: 16 });
  cb.check();
  const dd = form.createDropdown("country");
  dd.addToPage(page, { x: 50, y: 220, width: 150, height: 20 });
  dd.setOptions(["IN", "US"]);
  dd.select("IN");
  return doc.save();
}

describe("fieldsToCsv", () => {
  it("builds a CSV with header + rows", () => {
    const csv = fieldsToCsv([
      { name: "fullname", type: "TextField", value: 'Sa"nd' },
      { name: "agree", type: "CheckBox", value: "true" },
    ]);
    expect(csv).toContain('"name","type","value"');
    expect(csv).toContain('"fullname","TextField","Sa""nd"');
  });
});

describe("fieldsToFdf", () => {
  it("builds FDF with field values", () => {
    const fdf = fieldsToFdf([{ name: "country", type: "Dropdown", value: "IN" }]);
    expect(fdf).toContain("%FDF-1.2");
    expect(fdf).toContain('<field name="country">');
    expect(fdf).toContain("<value>IN</value>");
  });
});

describe("exportFormData", () => {
  it("exports all field values", async () => {
    const r = await exportFormData(await makeFormPdf());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.fields.length).toBe(3);
      const name = r.output.fields.find((f) => f.name === "fullname");
      expect(name?.value).toBe("Sandeep Gaddam");
      const agree = r.output.fields.find((f) => f.name === "agree");
      expect(agree?.value).toBe("true");
      const country = r.output.fields.find((f) => f.name === "country");
      expect(country?.value).toBe("IN");
      expect(r.output.csv).toContain("fullname");
      expect(r.output.json).toContain("Sandeep Gaddam");
      expect(r.output.fdf).toContain("%FDF-1.2");
    }
  });

  it("reports when there are no fields", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 300]);
    page.drawText("no fields", { x: 5, y: 5, size: 8 });
    const r = await exportFormData(await doc.save());
    expect(r.ok).toBe(false);
  });

  it("rejects corrupt PDFs", async () => {
    const r = await exportFormData(new Uint8Array([1, 2]));
    expect(r.ok).toBe(false);
  });
});
