import { describe, expect, it } from "vitest";
import { toGrayscale } from "./logic";

function makeRgba(): Uint8Array {
  const data = new Uint8Array(4);
  data[0] = 255;
  data[1] = 0;
  data[2] = 0;
  data[3] = 255;
  return data;
}

describe("toGrayscale", () => {
  it("converts a red pixel to its luminance gray", () => {
    const out = toGrayscale(makeRgba());
    const g = Math.round(0.299 * 255);
    expect(out[0]).toBe(g);
    expect(out[1]).toBe(g);
    expect(out[2]).toBe(g);
    expect(out[3]).toBe(255);
  });

  it("keeps gray pixels gray", () => {
    const data = new Uint8Array([128, 128, 128, 255]);
    const out = toGrayscale(data);
    expect(out[0]).toBe(128);
  });

  it("does not mutate input", () => {
    const data = makeRgba();
    toGrayscale(data);
    expect(data[0]).toBe(255);
  });
});
