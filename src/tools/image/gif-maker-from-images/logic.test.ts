import { describe, it, expect } from "vitest";
import { calculateTotalDuration, calculateFps, formatDuration, estimateFileSize, getFramePresets } from "./logic";

describe("GIF Maker", () => {
  it("calculates total duration", () => {
    expect(calculateTotalDuration([{ delay: 100 }, { delay: 200 }])).toBe(300);
  });
  it("calculates FPS", () => {
    expect(calculateFps([{ delay: 100 }, { delay: 100 }])).toBe(10);
  });
  it("formats duration", () => {
    expect(formatDuration(500)).toBe("500ms");
    expect(formatDuration(1500)).toBe("1.50s");
  });
  it("estimates file size", () => {
    const size = estimateFileSize(200, 200, 10);
    expect(size).toBeGreaterThan(0);
  });
  it("lists frame presets", () => {
    expect(getFramePresets().length).toBeGreaterThan(0);
  });
});
