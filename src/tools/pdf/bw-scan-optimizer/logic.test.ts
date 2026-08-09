import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { toBinary, floydSteinberg, medianDespeckle, luminance, canProcessImages, findEmbeddedImages } from "./logic";

/** Build a small RGBA buffer (w×h) with a helper. */
function makeRgba(width: number, height: number, fill: (x: number, y: number) => [number, number, number]): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fill(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return data;
}

describe("luminance", () => {
  it("computes Rec.601 luminance", () => {
    expect(luminance(255, 255, 255)).toBeCloseTo(255, 1);
    expect(luminance(0, 0, 0)).toBe(0);
    expect(luminance(255, 0, 0)).toBeCloseTo(76.2, 1);
  });
});

describe("toBinary", () => {
  it("turns dark pixels black and bright pixels white", () => {
    const rgba = makeRgba(2, 1, (x) => (x === 0 ? [10, 10, 10] : [240, 240, 240]));
    const out = toBinary(rgba, 128);
    expect(out[0]).toBe(0); // black
    expect(out[4]).toBe(255); // white
  });

  it("preserves alpha and length", () => {
    const rgba = makeRgba(3, 3, () => [100, 100, 100]);
    const out = toBinary(rgba, 128);
    expect(out.length).toBe(rgba.length);
    expect(out[3]).toBe(255);
  });

  it("respects a custom threshold", () => {
    const rgba = makeRgba(1, 1, () => [200, 200, 200]);
    expect(toBinary(rgba, 250)[0]).toBe(0); // 200 < 250 → black
    expect(toBinary(rgba, 100)[0]).toBe(255); // 200 ≥ 100 → white
  });
});

describe("floydSteinberg", () => {
  it("produces binary output with same dimensions", () => {
    const rgba = makeRgba(8, 8, (x, y) => [x * 30 + y * 10, 100, 100]);
    const out = floydSteinberg(rgba, 8, 128);
    expect(out.length).toBe(rgba.length);
    for (let i = 0; i < out.length; i += 4) {
      expect(out[i] === 0 || out[i] === 255).toBe(true);
    }
  });
});

describe("medianDespeckle", () => {
  it("removes a single noisy pixel", () => {
    // 3×3 with a lone bright pixel in a dark field.
    const rgba = makeRgba(3, 3, (x, y) => (x === 1 && y === 1 ? [250, 250, 250] : [10, 10, 10]));
    const out = medianDespeckle(rgba, 3, 1);
    const i = (1 * 3 + 1) * 4;
    expect(out[i]).toBeLessThan(50); // median of neighborhood is dark
  });

  it("returns a copy for radius 0", () => {
    const rgba = makeRgba(2, 2, () => [1, 2, 3]);
    const out = medianDespeckle(rgba, 2, 0);
    expect(out).not.toBe(rgba);
    expect(out[0]).toBe(1);
  });
});

describe("environment helpers", () => {
  it("canProcessImages is false in Node", () => {
    expect(canProcessImages()).toBe(false);
  });

  it("findEmbeddedImages returns nothing for a text PDF", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 300]);
    page.drawText("hello", { x: 5, y: 5, size: 8 });
    const bytes = await doc.save();
    const reloaded = await PDFDocument.load(bytes);
    expect(findEmbeddedImages(reloaded)).toEqual([]);
  });
});
