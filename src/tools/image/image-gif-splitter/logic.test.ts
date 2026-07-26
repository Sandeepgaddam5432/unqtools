import { describe, it, expect } from "vitest";
import {
  colorTableByteSize, readUint16LE, parseHeader, buildExportPlans, batchPlans,
  computeAvgFps, findBackgroundRestoreFrames, findFastFrames, estimateTotalPngBytes,
  formatBytes, formatDuration, isGifSignature, buildMetadata, framesToCsv,
  buildMontageJson,
} from "./logic";

const fakeFrame = (i: number, delay = 100, w = 16, h = 16, disposal: 0 | 1 | 2 | 3 = 0): any => ({
  index: i, delayMs: delay, left: 0, top: 0, width: w, height: h, disposal,
  transparentIndex: null, interlaced: false, colorTableSize: 256,
});

describe("colorTableByteSize", () => {
  it("returns power-of-two * 3", () => {
    expect(colorTableByteSize(64)).toBe(64 * 3);
    expect(colorTableByteSize(50)).toBe(64 * 3);
  });
  it("minimum is 2*3 = 6", () => {
    expect(colorTableByteSize(1)).toBe(6);
  });
});

describe("readUint16LE", () => {
  it("reads little-endian", () => {
    const bytes = new Uint8Array([0x34, 0x12]);
    expect(readUint16LE(bytes, 0)).toBe(0x1234);
  });
  it("returns 0 for out-of-range", () => {
    expect(readUint16LE(new Uint8Array(0), 0)).toBe(0);
  });
});

describe("parseHeader", () => {
  it("reads width and height", () => {
    // GIF89a header, width=0x0100 (256), height=0x00c8 (200)
    const bytes = new Uint8Array([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // "GIF89a"
      0x00, 0x01, 0xc8, 0x00, // width=256, height=200
      0x00, 0x00, 0x00, // packed, bg, aspect
    ]);
    const h = parseHeader(bytes);
    expect(h.width).toBe(256);
    expect(h.height).toBe(200);
  });
  it("returns zeros for short input", () => {
    expect(parseHeader(new Uint8Array(5))).toEqual({ width: 0, height: 0, globalColorCount: 0, backgroundColorIndex: 0 });
  });
});

describe("buildExportPlans", () => {
  it("builds padded filenames", () => {
    const plans = buildExportPlans([fakeFrame(0), fakeFrame(1)]);
    expect(plans[0].filename).toBe("frame-0001.png");
    expect(plans[1].filename).toBe("frame-0002.png");
  });
  it("estimates PNG bytes", () => {
    const plans = buildExportPlans([fakeFrame(0, 100, 100, 100)]);
    expect(plans[0].estimatedPngBytes).toBeGreaterThan(0);
  });
});

describe("batchPlans", () => {
  it("splits into batches", () => {
    const plans = buildExportPlans([fakeFrame(0), fakeFrame(1), fakeFrame(2)]);
    const batches = batchPlans(plans, 2);
    expect(batches.length).toBe(2);
    expect(batches[0].length).toBe(2);
  });
});

describe("computeAvgFps", () => {
  it("computes fps", () => {
    const frames = [fakeFrame(0, 100), fakeFrame(1, 100), fakeFrame(2, 100)];
    expect(computeAvgFps(frames)).toBe(10);
  });
  it("0 fps for empty", () => {
    expect(computeAvgFps([])).toBe(0);
  });
});

describe("findBackgroundRestoreFrames", () => {
  it("finds disposal=2 frames", () => {
    const frames = [fakeFrame(0, 100, 16, 16, 0), fakeFrame(1, 100, 16, 16, 2), fakeFrame(2, 100, 16, 16, 2)];
    expect(findBackgroundRestoreFrames(frames)).toEqual([1, 2]);
  });
});

describe("findFastFrames", () => {
  it("finds fast frames", () => {
    const frames = [fakeFrame(0, 100), fakeFrame(1, 30), fakeFrame(2, 20)];
    expect(findFastFrames(frames, 50)).toEqual([1, 2]);
  });
});

describe("estimateTotalPngBytes", () => {
  it("sums frame PNG sizes", () => {
    const frames = [fakeFrame(0, 100, 100, 100), fakeFrame(1, 100, 100, 100)];
    expect(estimateTotalPngBytes(frames)).toBeGreaterThan(0);
  });
});

describe("formatBytes & formatDuration", () => {
  it("formats bytes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
  });
  it("formats durations", () => {
    expect(formatDuration(50)).toBe("50ms");
    expect(formatDuration(1500)).toBe("1.50s");
    expect(formatDuration(90000)).toBe("1m 30s");
  });
});

describe("isGifSignature", () => {
  it("accepts GIF89a", () => {
    const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(isGifSignature(bytes)).toBe(true);
  });
  it("accepts GIF87a", () => {
    const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]);
    expect(isGifSignature(bytes)).toBe(true);
  });
  it("rejects non-GIF", () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    expect(isGifSignature(bytes)).toBe(false);
  });
});

describe("buildMetadata", () => {
  it("builds metadata object", () => {
    const frames = [fakeFrame(0, 100), fakeFrame(1, 100)];
    const m = buildMetadata(100, 100, 128, 0, 0, frames, 5000);
    expect(m.totalDurationMs).toBe(200);
    expect(m.avgFps).toBe(10);
    expect(m.hasTransparency).toBe(false);
  });
});

describe("framesToCsv & buildMontageJson", () => {
  it("CSV has header row", () => {
    const csv = framesToCsv([fakeFrame(0, 100)]);
    expect(csv.startsWith("index,delay_ms")).toBe(true);
  });
  it("montage JSON parses", () => {
    const json = buildMontageJson([fakeFrame(0, 100), fakeFrame(1, 200)]);
    const parsed = JSON.parse(json);
    expect(parsed.frames.length).toBe(2);
    expect(parsed.frames[0].file).toBe("frame-0001.png");
  });
});
