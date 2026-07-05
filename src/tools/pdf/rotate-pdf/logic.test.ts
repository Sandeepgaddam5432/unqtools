import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { rotatePdf } from "./logic";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 200]);
  return doc.save();
}

async function getRotations(bytes: Uint8Array): Promise<number[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((p) => p.getRotation().angle);
}

describe("rotatePdf", () => {
  it("rotates all pages", async () => {
    const pdf = await makePdf(3);
    const res = await rotatePdf(pdf, { rotation: 90, target: "all" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(await getRotations(res.output)).toEqual([90, 90, 90]);
  });

  it("rotates only odd pages (1-indexed: 1,3,...)", async () => {
    const pdf = await makePdf(4);
    const res = await rotatePdf(pdf, { rotation: 90, target: "odd" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(await getRotations(res.output)).toEqual([90, 0, 90, 0]);
  });

  it("rotates only even pages (1-indexed: 2,4,...)", async () => {
    const pdf = await makePdf(4);
    const res = await rotatePdf(pdf, { rotation: 180, target: "even" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(await getRotations(res.output)).toEqual([0, 180, 0, 180]);
  });

  it("rotates custom pages by range spec", async () => {
    const pdf = await makePdf(5);
    const res = await rotatePdf(pdf, { rotation: 270, target: "custom", customPages: "1, 4-5" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(await getRotations(res.output)).toEqual([270, 0, 0, 270, 270]);
  });

  it("accumulates rotation on already-rotated pages", async () => {
    const pdf = await makePdf(1);
    const step1 = await rotatePdf(pdf, { rotation: 90, target: "all" });
    expect(step1.ok).toBe(true);
    if (!step1.ok) return;
    const step2 = await rotatePdf(step1.output, { rotation: 90, target: "all" });
    expect(step2.ok).toBe(true);
    if (step2.ok) expect(await getRotations(step2.output)).toEqual([180]);
  });

  it("rotates 270 degrees", async () => {
    const pdf = await makePdf(1);
    const res = await rotatePdf(pdf, { rotation: 270, target: "all" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(await getRotations(res.output)).toEqual([270]);
  });

  it("errors on empty custom spec", async () => {
    const pdf = await makePdf(3);
    const res = await rotatePdf(pdf, { rotation: 90, target: "custom", customPages: "" });
    expect(res.ok).toBe(false);
  });

  it("errors on out-of-bounds custom pages", async () => {
    const pdf = await makePdf(2);
    const res = await rotatePdf(pdf, { rotation: 90, target: "custom", customPages: "9" });
    expect(res.ok).toBe(false);
  });

  it("errors on invalid PDF bytes", async () => {
    const res = await rotatePdf(new Uint8Array([1, 2, 3]), { rotation: 90, target: "all" });
    expect(res.ok).toBe(false);
  });
});
