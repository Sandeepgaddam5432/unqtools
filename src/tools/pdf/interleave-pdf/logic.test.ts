import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { interleavePdf } from "./logic";

async function makePdf(pages: number, label: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([200, 200]);
    page.drawText(`${label}${i + 1}`, { x: 50, y: 100, size: 20 });
  }
  return doc.save();
}

async function countPages(bytes: Uint8Array): Promise<number> {
  return (await PDFDocument.load(bytes)).getPageCount();
}

describe("interleavePdf", () => {
  it("interleaves two equal-length PDFs (3 + 3 = 6)", async () => {
    const a = await makePdf(3, "A");
    const b = await makePdf(3, "B");
    const result = await interleavePdf({ bytesA: a, nameA: "a.pdf", bytesB: b, nameB: "b.pdf" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.totalPageCount).toBe(6);
      expect(result.output.pagesFromA).toBe(3);
      expect(result.output.pagesFromB).toBe(3);
    }
  });

  it("interleaves when A is longer (5 + 3 = 8)", async () => {
    const a = await makePdf(5, "A");
    const b = await makePdf(3, "B");
    const result = await interleavePdf({ bytesA: a, nameA: "a.pdf", bytesB: b, nameB: "b.pdf" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.totalPageCount).toBe(8);
      expect(result.output.pagesFromA).toBe(5);
      expect(result.output.pagesFromB).toBe(3);
    }
  });

  it("interleaves when B is longer (2 + 4 = 6)", async () => {
    const a = await makePdf(2, "A");
    const b = await makePdf(4, "B");
    const result = await interleavePdf({ bytesA: a, nameA: "a.pdf", bytesB: b, nameB: "b.pdf" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.totalPageCount).toBe(6);
      expect(result.output.pagesFromA).toBe(2);
      expect(result.output.pagesFromB).toBe(4);
    }
  });

  it("interleaves two single-page PDFs (1 + 1 = 2)", async () => {
    const a = await makePdf(1, "A");
    const b = await makePdf(1, "B");
    const result = await interleavePdf({ bytesA: a, nameA: "a.pdf", bytesB: b, nameB: "b.pdf" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(await countPages(result.output.bytes)).toBe(2);
  });

  it("handles two single-page PDFs (minimum case)", async () => {
    const a = await makePdf(1, "A");
    const b = await makePdf(1, "B");
    const result = await interleavePdf({ bytesA: a, nameA: "a.pdf", bytesB: b, nameB: "b.pdf" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.output.totalPageCount).toBe(2);
  });

  it("errors on invalid PDF A bytes", async () => {
    const b = await makePdf(2, "B");
    const result = await interleavePdf({
      bytesA: new Uint8Array([1, 2, 3]), nameA: "bad.pdf", bytesB: b, nameB: "b.pdf",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("bad.pdf");
  });

  it("errors on invalid PDF B bytes", async () => {
    const a = await makePdf(2, "A");
    const result = await interleavePdf({
      bytesA: a, nameA: "a.pdf", bytesB: new Uint8Array([1, 2, 3]), nameB: "bad.pdf",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("bad.pdf");
  });

  it("sets creator metadata on output", async () => {
    const a = await makePdf(2, "A");
    const b = await makePdf(2, "B");
    const result = await interleavePdf({ bytesA: a, nameA: "a.pdf", bytesB: b, nameB: "b.pdf" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const doc = await PDFDocument.load(result.output.bytes);
      expect(doc.getCreator()).toContain("UnQTools");
    }
  });
});

describe("interleave advanced (cycles + start)", () => {
  it("interleaves 2:2 (two pages at a time)", async () => {
    const { interleavePdf } = await import("./logic");
    const a = await makePdf(4);
    const b = await makePdf(4);
    const res = await interleavePdf({ bytesA: a, nameA: "a.pdf", bytesB: b, nameB: "b.pdf", cycleA: 2, cycleB: 2 });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.output.totalPageCount).toBe(8);
  });

  it("supports startWithB", async () => {
    const { interleavePdf } = await import("./logic");
    const a = await makePdf(2);
    const b = await makePdf(2);
    const res = await interleavePdf({ bytesA: a, nameA: "a.pdf", bytesB: b, nameB: "b.pdf", startWithA: false });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.output.totalPageCount).toBe(4);
  });

  it("handles unequal lengths with cycles", async () => {
    const { interleavePdf } = await import("./logic");
    const a = await makePdf(1);
    const b = await makePdf(5);
    const res = await interleavePdf({ bytesA: a, nameA: "a.pdf", bytesB: b, nameB: "b.pdf", cycleA: 2, cycleB: 3 });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.output.totalPageCount).toBe(6);
  });
});
