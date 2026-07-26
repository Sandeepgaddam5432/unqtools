import { describe, it, expect } from "vitest";
import {
  computeFinalSize,
  averageDelay,
  fpsFromDelay,
  estimateTotalSize,
  qualityScore,
  reorderFrames,
  frameFileName,
  loopLabel,
  validateInput,
  computeGif,
  batchComputeGif,
  statsToCsv,
  aspectRatio,
  type GifInput,
  type GifFrameInput,
} from "./logic";

function makeFrame(w = 100, h = 100, delayMs = 100, bytes = 5000): GifFrameInput {
  return { width: w, height: h, delayMs, estimatedBytes: bytes };
}

const BASE: GifInput = {
  frames: [makeFrame(), makeFrame(), makeFrame()],
  defaultDelayMs: 100,
  loopCount: 0,
  maxWidth: 0,
  maxHeight: 0,
  preserveAspect: true,
  paletteSize: 256,
  order: "forward",
};

describe("computeFinalSize", () => {
  it("returns original size when no constraints", () => {
    const r = computeFinalSize(500, 400, 0, 0, true);
    expect(r).toEqual({ width: 500, height: 400 });
  });
  it("scales down within max width", () => {
    const r = computeFinalSize(1000, 1000, 500, 500, true);
    expect(r.width).toBe(500);
    expect(r.height).toBe(500);
  });
  it("preserves aspect ratio when scaling", () => {
    const r = computeFinalSize(2000, 1000, 500, 500, true);
    expect(r.width).toBe(500);
    expect(r.height).toBe(250);
  });
  it("returns 0 for zero input", () => {
    expect(computeFinalSize(0, 0, 100, 100, true)).toEqual({ width: 0, height: 0 });
  });
  it("does not preserve aspect when false", () => {
    const r = computeFinalSize(2000, 1000, 500, 500, false);
    expect(r.width).toBe(500);
    expect(r.height).toBe(500);
  });
});

describe("averageDelay", () => {
  it("computes average of delays", () => {
    expect(averageDelay([100, 200, 300])).toBeCloseTo(200, 5);
  });
  it("returns 0 for empty list", () => {
    expect(averageDelay([])).toBe(0);
  });
});

describe("fpsFromDelay", () => {
  it("computes FPS from delay", () => {
    expect(fpsFromDelay(100)).toBeCloseTo(10, 5);
    expect(fpsFromDelay(40)).toBeCloseTo(25, 5);
  });
  it("returns 0 for zero delay", () => {
    expect(fpsFromDelay(0)).toBe(0);
  });
});

describe("estimateTotalSize", () => {
  it("sums frame bytes plus overhead", () => {
    const frames = [makeFrame(10, 10, 100, 1000), makeFrame(10, 10, 100, 2000)];
    const total = estimateTotalSize(frames, 256);
    expect(total).toBeGreaterThan(3000);
    expect(total).toBeLessThan(5000);
  });
  it("includes palette bytes", () => {
    const frames = [makeFrame(10, 10, 100, 0)];
    const small = estimateTotalSize(frames, 2);
    const large = estimateTotalSize(frames, 256);
    expect(large).toBeGreaterThan(small);
  });
});

describe("qualityScore", () => {
  it("returns higher score for larger palette", () => {
    const small = qualityScore(8, 10, 100_000);
    const large = qualityScore(256, 10, 100_000);
    expect(large).toBeGreaterThan(small);
  });
  it("penalizes large files", () => {
    const small = qualityScore(256, 10, 100_000);
    const large = qualityScore(256, 10, 20_000_000);
    expect(small).toBeGreaterThan(large);
  });
  it("clamps to 0-100", () => {
    expect(qualityScore(256, 100, 1000)).toBeLessThanOrEqual(100);
    expect(qualityScore(2, 0, 100_000_000)).toBeGreaterThanOrEqual(0);
  });
});

describe("reorderFrames", () => {
  it("reverses frames for reverse order", () => {
    const r = reorderFrames([1, 2, 3], "reverse");
    expect(r).toEqual([3, 2, 1]);
  });
  it("keeps order for forward", () => {
    const r = reorderFrames([1, 2, 3], "forward");
    expect(r).toEqual([1, 2, 3]);
  });
  it("shuffles deterministically for shuffle", () => {
    const r1 = reorderFrames([1, 2, 3, 4, 5], "shuffle");
    const r2 = reorderFrames([1, 2, 3, 4, 5], "shuffle");
    expect(r1).toEqual(r2); // deterministic
    expect(r1.sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("frameFileName", () => {
  it("generates filename with padded index", () => {
    expect(frameFileName("frame", 0, 9)).toBe("frame_1.gif");
    expect(frameFileName("frame", 5, 27)).toBe("frame_06.gif");
  });
});

describe("loopLabel", () => {
  it("returns Infinite for 0", () => {
    expect(loopLabel(0)).toBe("Infinite");
  });
  it("returns Nx for N > 0", () => {
    expect(loopLabel(3)).toBe("3×");
  });
});

describe("validateInput", () => {
  it("accepts valid input", () => {
    expect(validateInput(BASE)).toEqual({ ok: true });
  });
  it("rejects empty frames", () => {
    expect(validateInput({ ...BASE, frames: [] })).toHaveProperty("error");
  });
  it("rejects too many frames", () => {
    expect(validateInput({ ...BASE, frames: Array(501).fill(makeFrame()) })).toHaveProperty("error");
  });
  it("rejects bad delay", () => {
    expect(validateInput({ ...BASE, defaultDelayMs: -1 })).toHaveProperty("error");
    expect(validateInput({ ...BASE, defaultDelayMs: 99999 })).toHaveProperty("error");
  });
  it("rejects bad palette size", () => {
    expect(validateInput({ ...BASE, paletteSize: 1 })).toHaveProperty("error");
    expect(validateInput({ ...BASE, paletteSize: 999 })).toHaveProperty("error");
  });
  it("rejects unknown order", () => {
    expect(validateInput({ ...BASE, order: "bogus" as never })).toHaveProperty("error");
  });
});

describe("computeGif", () => {
  it("returns result with stats", () => {
    const r = computeGif(BASE);
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.frames.length).toBe(3);
    expect(r.stats.frameCount).toBe(3);
    expect(r.stats.totalDelayMs).toBe(300);
    expect(r.stats.fps).toBeCloseTo(10, 1);
  });
  it("errors on bad input", () => {
    expect("error" in computeGif({ ...BASE, frames: [] })).toBe(true);
  });
  it("scales frames within max dimensions", () => {
    const r = computeGif({ ...BASE, frames: [makeFrame(1000, 1000)], maxWidth: 500, maxHeight: 500, preserveAspect: true });
    if ("error" in r) throw new Error("unexpected");
    expect(r.stats.finalWidth).toBe(500);
    expect(r.stats.finalHeight).toBe(500);
  });
  it("uses default delay when frame delay is 0", () => {
    const r = computeGif({ ...BASE, frames: [makeFrame(100, 100, 0, 1000)], defaultDelayMs: 200 });
    if ("error" in r) throw new Error("unexpected");
    expect(r.frames[0]!.delayMs).toBe(200);
  });
  it("reverse order reverses frames", () => {
    const r = computeGif({ ...BASE, frames: [makeFrame(100, 100, 100, 1000), makeFrame(100, 100, 200, 2000)], order: "reverse" });
    if ("error" in r) throw new Error("unexpected");
    expect(r.frames[0]!.estimatedBytes).toBe(2000);
  });
  it("warns on small palette", () => {
    const r = computeGif({ ...BASE, paletteSize: 16 });
    if ("error" in r) throw new Error("unexpected");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("returns quality score 0-100", () => {
    const r = computeGif(BASE);
    if ("error" in r) throw new Error("unexpected");
    expect(r.qualityScore).toBeGreaterThanOrEqual(0);
    expect(r.qualityScore).toBeLessThanOrEqual(100);
  });
  it("generates manifest CSV", () => {
    const r = computeGif(BASE);
    if ("error" in r) throw new Error("unexpected");
    expect(r.manifest.startsWith("Index,FileName")).toBe(true);
  });
});

describe("batchComputeGif", () => {
  it("runs over multiple inputs", () => {
    const r = batchComputeGif([BASE, BASE]);
    expect(r.length).toBe(2);
  });
});

describe("statsToCsv", () => {
  it("produces CSV with header", () => {
    const r = computeGif(BASE);
    if ("error" in r) throw new Error("unexpected");
    const csv = statsToCsv(r.stats);
    expect(csv.startsWith("Field,Value")).toBe(true);
    expect(csv).toContain("FrameCount");
    expect(csv).toContain("FPS");
  });
});

describe("aspectRatio", () => {
  it("computes aspect ratio", () => {
    expect(aspectRatio(16, 9)).toBeCloseTo(16 / 9, 5);
  });
  it("returns 0 for zero height", () => {
    expect(aspectRatio(100, 0)).toBe(0);
  });
});
