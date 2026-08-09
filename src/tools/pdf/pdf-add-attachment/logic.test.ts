import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { addAttachments, listAttachments } from "./logic";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([200, 300]);
    page.drawText(`p${i}`, { x: 5, y: 5, size: 6 });
  }
  return doc.save();
}

describe("addAttachments", () => {
  it("attaches a file and keeps page count", async () => {
    const pdf = await makePdf(2);
    const r = await addAttachments(pdf, [
      { name: "notes.txt", bytes: new TextEncoder().encode("hello world"), mime: "text/plain", description: "My notes" },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.attached.length).toBe(1);
      expect(r.output.attached[0]!.name).toBe("notes.txt");
      const doc = await PDFDocument.load(r.output.bytes);
      expect(doc.getPageCount()).toBe(2);
    }
  });

  it("attaches multiple files", async () => {
    const pdf = await makePdf(1);
    const r = await addAttachments(pdf, [
      { name: "a.txt", bytes: new TextEncoder().encode("a") },
      { name: "b.csv", bytes: new TextEncoder().encode("1,2,3") },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.attached.length).toBe(2);
  });

  it("listAttachments sees what was attached", async () => {
    const pdf = await makePdf(1);
    const r = await addAttachments(pdf, [
      { name: "report.pdf", bytes: new TextEncoder().encode("data"), mime: "application/pdf" },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const doc = await PDFDocument.load(r.output.bytes);
      const list = listAttachments(doc);
      expect(list.some((a) => a.name === "report.pdf")).toBe(true);
    }
  });

  it("errors without files", async () => {
    const pdf = await makePdf(1);
    const r = await addAttachments(pdf, []);
    expect(r.ok).toBe(false);
  });

  it("rejects corrupt PDFs", async () => {
    const r = await addAttachments(new Uint8Array([1, 2]), [{ name: "x", bytes: new TextEncoder().encode("x") }]);
    expect(r.ok).toBe(false);
  });
});
