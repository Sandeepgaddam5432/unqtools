import { describe, it, expect } from "vitest";
import {
  frameHash, hammingDistance, estimateGifBytes, buildFrameInfo, recommendMaxColors,
  findDuplicateFrames, findSimilarFrames, findShortFrames, totalDuration, averageFps,
  analyzeGif, applyOptimizations, formatBytes, savingsPct, DEFAULT_OPTIONS,
} from "./logic";

function fakePixels(w: number, h: number, color: [number, number, number] = [255, 0, 0]): Uint8ClampedArray {
  const arr = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    arr[i * 4] = color[0];
    arr[i * 4 + 1] = color[1];
    arr[i * 4 + 2] = color[2];
    arr[i * 4 + 3] = 255;
  }
  return arr;
}

describe("frameHash", () => {
  it("returns 64-character binary string", () => {
    const px = fakePixels(16, 16);
    const h = frameHash(px, 16, 16);
    expect(h.length).toBe(64);
    expect(h).toMatch(/^[01]+$/);
  });
  it("same image → same hash", () => {
    const px = fakePixels(16, 16);
    expect(frameHash(px, 16, 16)).toBe(frameHash(px, 16, 16));
  });
});

describe("hammingDistance", () => {
  it("returns 0 for identical", () => {
    expect(hammingDistance("1010", "1010")).toBe(0);
  });
  it("counts differing bits", () => {
    expect(hammingDistance("1010", "0101")).toBe(4);
  });
  it("returns max for unequal lengths", () => {
    expect(hammingDistance("101", "10")).toBe(3);
  });
});

describe("estimateGifBytes", () => {
  it("scales with frame count", () => {
    expect(estimateGifBytes(100, 100, 5, 64, false)).toBeGreaterThan(estimateGifBytes(100, 100, 2, 64, false));
  });
  it("scales with dimensions", () => {
    expect(estimateGifBytes(200, 200, 2, 64, false)).toBeGreaterThan(estimateGifBytes(100, 100, 2, 64, false));
  });
});

describe("buildFrameInfo", () => {
  it("counts colors", () => {
    const px = new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
      255, 255, 0, 255,
    ]);
    const info = buildFrameInfo(0, 2, 2, px, 100);
    expect(info.colorCount).toBe(4);
    expect(info.transparentPixels).toBe(0);
  });
  it("counts transparent pixels", () => {
    const px = new Uint8ClampedArray([
      255, 0, 0, 0,
      0, 255, 0, 255,
    ]);
    const info = buildFrameInfo(0, 1, 2, px, 100, 0, null, 128);
    expect(info.transparentPixels).toBe(1);
  });
});

describe("recommendMaxColors", () => {
  it("picks next power of 2 above max color count", () => {
    const frames = [{ colorCount: 50, hash: "0".repeat(64) } as any];
    expect(recommendMaxColors(frames)).toBe(64);
  });
  it("caps at 256", () => {
    const frames = [{ colorCount: 500, hash: "0".repeat(64) } as any];
    expect(recommendMaxColors(frames)).toBe(256);
  });
});

describe("findDuplicateFrames", () => {
  it("detects consecutive duplicate hashes", () => {
    const frames = [
      { index: 0, hash: "abc" },
      { index: 1, hash: "abc" },
      { index: 2, hash: "def" },
      { index: 3, hash: "def" },
    ] as any;
    expect(findDuplicateFrames(frames)).toEqual([1, 3]);
  });
});

describe("findSimilarFrames", () => {
  it("detects near-duplicate hashes", () => {
    const frames = [
      { index: 0, hash: "0000" },
      { index: 1, hash: "0001" },
      { index: 2, hash: "1111" },
    ] as any;
    expect(findSimilarFrames(frames, 1)).toEqual([1]);
  });
});

describe("findShortFrames", () => {
  it("finds frames with low delay", () => {
    const frames = [
      { index: 0, delayMs: 50 },
      { index: 1, delayMs: 10 },
      { index: 2, delayMs: 100 },
    ] as any;
    expect(findShortFrames(frames, 20)).toEqual([1]);
  });
});

describe("totalDuration & averageFps", () => {
  it("sums durations", () => {
    const frames = [{ delayMs: 100 }, { delayMs: 200 }] as any;
    expect(totalDuration(frames)).toBe(300);
  });
  it("computes fps", () => {
    const frames = [{ delayMs: 100 }, { delayMs: 100 }, { delayMs: 100 }] as any;
    expect(averageFps(frames)).toBe(10);
  });
  it("fps 0 if no duration", () => {
    expect(averageFps([])).toBe(0);
  });
});

describe("analyzeGif", () => {
  it("combines metrics", () => {
    const frames = [
      { index: 0, width: 16, height: 16, delayMs: 100, colorCount: 32, transparentPixels: 0, hash: "0".repeat(64), disposal: 0, transparentIndex: null },
      { index: 1, width: 16, height: 16, delayMs: 100, colorCount: 32, transparentPixels: 0, hash: "0".repeat(64), disposal: 0, transparentIndex: null },
    ] as any;
    const a = analyzeGif(16, 16, frames, 0, false);
    expect(a.frameCount).toBe(2);
    expect(a.avgFps).toBe(10);
    expect(a.recommendations.length).toBeGreaterThan(0);
  });
});

describe("applyOptimizations", () => {
  it("removes duplicates when option set", () => {
    const frames = [
      { index: 0, width: 16, height: 16, delayMs: 100, colorCount: 32, transparentPixels: 0, hash: "0".repeat(64), disposal: 0, transparentIndex: null },
      { index: 1, width: 16, height: 16, delayMs: 100, colorCount: 32, transparentPixels: 0, hash: "0".repeat(64), disposal: 0, transparentIndex: null },
    ] as any;
    const a = analyzeGif(16, 16, frames, 0, false);
    const res = applyOptimizations(a, { ...DEFAULT_OPTIONS, removeDuplicates: true });
    expect(res.frames.length).toBe(1);
    expect(res.removedCount).toBe(1);
  });
  it("keeps all frames when dedup off", () => {
    const frames = [
      { index: 0, width: 16, height: 16, delayMs: 100, colorCount: 32, transparentPixels: 0, hash: "0".repeat(64), disposal: 0, transparentIndex: null },
      { index: 1, width: 16, height: 16, delayMs: 100, colorCount: 32, transparentPixels: 0, hash: "0".repeat(64), disposal: 0, transparentIndex: null },
    ] as any;
    const a = analyzeGif(16, 16, frames, 0, false);
    const res = applyOptimizations(a, { ...DEFAULT_OPTIONS, removeDuplicates: false });
    expect(res.frames.length).toBe(2);
  });
});

describe("formatBytes & savingsPct", () => {
  it("formats", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
  });
  it("computes savings", () => {
    expect(savingsPct(1000, 250)).toBe(75);
    expect(savingsPct(0, 0)).toBe(0);
  });
});
