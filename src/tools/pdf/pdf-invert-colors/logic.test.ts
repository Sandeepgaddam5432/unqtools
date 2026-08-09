import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { invertPixels, canInvertImages, findEmbeddedImages } from "./logic";

function makeRgba(w: number, h: number): Uint8Array {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 10;
    data[i + 1] = 20;
    data[i + 2] = 30;
    data[i + 3] = 255;
  }
  return data;
}

describe("invertPixels", () => {
  it("inverts RGB and keeps alpha", () => {
    const out = invertPixels(makeRgba(2, 2));
    expect(out[0]).toBe(245); // 255 - 10
    expect(out[1]).toBe(235); // 255 - 20
    expect(out[2]).toBe(225); // 255 - 30
    expect(out[3]).toBe(255);
  });

  it("is its own inverse", () => {
    const original = makeRgba(3, 3);
    const double = invertPixels(invertPixels(original));
    expect(double).toEqual(original);
  });

  it("does not mutate the input", () => {
    const original = makeRgba(2, 2);
    invertPixels(original);
    expect(original[0]).toBe(10);
  });
});

describe("environment", () => {
  it("canInvertImages is false in Node", () => {
    expect(canInvertImages()).toBe(false);
  });

  it("findEmbeddedImages returns nothing for a text PDF", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 300]);
    page.drawText("hi", { x: 5, y: 5, size: 8 });
    expect(findEmbeddedImages(doc)).toEqual([]);
  });
});
