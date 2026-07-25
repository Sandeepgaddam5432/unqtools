import { describe, it, expect } from "vitest";
import { parseGif, averageFps, frameCount, formatDuration, type GifMetadata } from "./logic";

/** Build a minimal in-memory GIF with N frames for testing. */
function buildGif(frameCount: number, delayCs = 10): Uint8Array {
  const bytes: number[] = [];
  // Header GIF89a
  bytes.push(...[0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  // Logical screen descriptor: 4×4, no global color table.
  bytes.push(0x04, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00);

  // Netscape application extension for looping.
  bytes.push(0x21, 0xff, 0x0b);
  bytes.push(...Array.from("NETSCAPE2.0").map((c) => c.charCodeAt(0)));
  bytes.push(0x03, 0x01, 0x00, 0x00, 0x00); // loop forever

  for (let i = 0; i < frameCount; i++) {
    // Graphic control extension
    bytes.push(0x21, 0xf9, 0x04, 0x00, delayCs & 0xff, (delayCs >> 8) & 0xff, 0x00, 0x00);
    // Image descriptor: full 4×4, local color table of size 2.
    bytes.push(0x2c, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0x04, 0x00, 0x80);
    // Local color table: 2 entries (6 bytes).
    bytes.push(0, 0, 0, 0xff, 0xff, 0xff);
    // LZW min code size = 2.
    bytes.push(0x02);
    // Sub-block: 2 bytes of data + terminator.
    bytes.push(0x02, 0x44, 0x01, 0x00);
  }
  // Trailer.
  bytes.push(0x3b);
  return new Uint8Array(bytes);
}

describe("parseGif", () => {
  it("parses a single-frame GIF", () => {
    const meta = parseGif(buildGif(1));
    if ("error" in meta) throw new Error("err");
    expect(meta.width).toBe(4);
    expect(meta.height).toBe(4);
    expect(meta.frames.length).toBe(1);
  });

  it("parses multiple frames", () => {
    const meta = parseGif(buildGif(5));
    if ("error" in meta) throw new Error("err");
    expect(meta.frames.length).toBe(5);
    expect(meta.frames[0].index).toBe(0);
    expect(meta.frames[4].index).toBe(4);
  });

  it("parses frame delays in milliseconds", () => {
    const meta = parseGif(buildGif(3, 10));
    if ("error" in meta) throw new Error("err");
    expect(meta.frames[0].delayMs).toBe(100);
    expect(meta.totalDurationMs).toBe(300);
  });

  it("errors on too-short input", () => {
    expect("error" in parseGif(new Uint8Array([1, 2, 3]))).toBe(true);
  });

  it("errors on bad signature", () => {
    const bad = new Uint8Array([0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0]);
    expect("error" in parseGif(bad)).toBe(true);
  });

  it("reads loop count from Netscape extension", () => {
    const meta = parseGif(buildGif(2));
    if ("error" in meta) throw new Error("err");
    expect(meta.loopCount).toBe(0);
  });
});

describe("averageFps", () => {
  it("computes average FPS from metadata", () => {
    const meta: GifMetadata = {
      width: 4,
      height: 4,
      frames: [
        { index: 0, left: 0, top: 0, width: 4, height: 4, delayMs: 100, disposal: 0, transparentIndex: -1, hasLocalTable: true },
        { index: 1, left: 0, top: 0, width: 4, height: 4, delayMs: 100, disposal: 0, transparentIndex: -1, hasLocalTable: true },
      ],
      loopCount: 0,
      totalDurationMs: 200,
    };
    expect(averageFps(meta)).toBeCloseTo(10, 5);
  });

  it("returns 0 when no frames", () => {
    const meta: GifMetadata = {
      width: 1,
      height: 1,
      frames: [],
      loopCount: 0,
      totalDurationMs: 0,
    };
    expect(averageFps(meta)).toBe(0);
  });
});

describe("frameCount", () => {
  it("returns the frame count", () => {
    const meta: GifMetadata = {
      width: 1,
      height: 1,
      frames: [
        { index: 0, left: 0, top: 0, width: 1, height: 1, delayMs: 0, disposal: 0, transparentIndex: -1, hasLocalTable: false },
      ],
      loopCount: 0,
      totalDurationMs: 0,
    };
    expect(frameCount(meta)).toBe(1);
  });
});

describe("formatDuration", () => {
  it("formats ms below 1000", () => {
    expect(formatDuration(500)).toBe("500ms");
  });

  it("formats seconds above 1000", () => {
    expect(formatDuration(2500)).toBe("2.50s");
  });
});
