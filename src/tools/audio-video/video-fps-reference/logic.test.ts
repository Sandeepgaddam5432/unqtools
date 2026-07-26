import { describe, it, expect } from "vitest";
import {
  getAllFps,
  getFpsById,
  getFpsByType,
  convertFrameCount,
  slowMoRatio,
  estimateFileSize,
  motionBlurMs,
  recommendFpsForUseCase,
  ntscDriftMs,
  formatFpsCard,
  exportFpsAsCSV,
  validateFps,
  detectPulldown,
  cinematicShutterSpeed,
  FPS_TABLE,
} from "./logic";

describe("video-fps-reference getAllFps", () => {
  it("returns at least 9 entries", () => {
    expect(getAllFps().length).toBeGreaterThanOrEqual(9);
  });
});

describe("video-fps-reference getFpsById", () => {
  it("finds 24 fps entry", () => {
    const f = getFpsById("24");
    expect(f).not.toBeNull();
    expect(f!.fps).toBe(24);
  });

  it("returns null for unknown", () => {
    expect(getFpsById("999")).toBeNull();
  });
});

describe("video-fps-reference getFpsByType", () => {
  it("returns cinema entries", () => {
    const c = getFpsByType("cinema");
    expect(c.length).toBeGreaterThanOrEqual(2);
  });

  it("returns broadcast entries with PAL/NTSC", () => {
    const b = getFpsByType("broadcast");
    expect(b.some((x) => x.id === "25")).toBe(true);
    expect(b.some((x) => x.id === "29.97")).toBe(true);
  });
});

describe("video-fps-reference convertFrameCount", () => {
  it("preserves duration when fps is the same", () => {
    expect(convertFrameCount(10, 30, 30)).toBe(10);
  });

  it("scales duration when going from 30 to 60", () => {
    // 10 sec @ 30fps = 300 frames; at 60fps those frames last 5 sec
    expect(convertFrameCount(10, 30, 60)).toBe(5);
  });

  it("returns 0 for zero fps", () => {
    expect(convertFrameCount(10, 0, 30)).toBe(0);
  });
});

describe("video-fps-reference slowMoRatio", () => {
  it("120 to 24 = 5x slow-mo", () => {
    expect(slowMoRatio(120, 24)).toBe(5);
  });

  it("240 to 24 = 10x slow-mo", () => {
    expect(slowMoRatio(240, 24)).toBe(10);
  });
});

describe("video-fps-reference estimateFileSize", () => {
  it("computes MB from Mbps and duration", () => {
    // 60 sec at 8 Mbps = 60 MB
    expect(estimateFileSize(60, 8)).toBe(60);
  });

  it("returns 0 for zero duration", () => {
    expect(estimateFileSize(0, 8)).toBe(0);
  });
});

describe("video-fps-reference motionBlurMs", () => {
  it("180-degree shutter at 24fps ≈ 20.83 ms", () => {
    expect(motionBlurMs(24, 180)).toBeCloseTo(20.83, 1);
  });

  it("returns 0 for zero fps", () => {
    expect(motionBlurMs(0, 180)).toBe(0);
  });
});

describe("video-fps-reference recommendFpsForUseCase", () => {
  it("finds cinema fps for 'film'", () => {
    const r = recommendFpsForUseCase("film");
    expect(r.some((x) => x.id === "24")).toBe(true);
  });

  it("finds sports fps for 'sports'", () => {
    const r = recommendFpsForUseCase("sports");
    expect(r.length).toBeGreaterThanOrEqual(1);
  });
});

describe("video-fps-reference ntscDriftMs", () => {
  it("returns ~1 ms per second of footage", () => {
    expect(ntscDriftMs(60)).toBeCloseTo(60, 0);
  });
});

describe("video-fps-reference formatFpsCard", () => {
  it("includes name and notes", () => {
    const card = formatFpsCard(getFpsById("24")!);
    expect(card).toContain("24 fps (Film)");
    expect(card).toContain("Notes");
  });
});

describe("video-fps-reference exportFpsAsCSV", () => {
  it("has header + all rows", () => {
    const csv = exportFpsAsCSV();
    const lines = csv.split("\n");
    expect(lines.length).toBe(FPS_TABLE.length + 1);
    expect(lines[0]).toContain("id,fps,name");
  });
});

describe("video-fps-reference validateFps", () => {
  it("warns on zero fps", () => {
    const w = validateFps(0);
    expect(w.some((x) => x.includes("positive"))).toBe(true);
  });

  it("warns on very high fps", () => {
    const w = validateFps(2000);
    expect(w.some((x) => x.includes("1000"))).toBe(true);
  });

  it("no warning for standard 24", () => {
    expect(validateFps(24)).toEqual([]);
  });
});

describe("video-fps-reference detectPulldown", () => {
  it("detects 3:2 pulldown for 24 to 30", () => {
    expect(detectPulldown(24, 30)).toContain("3:2 pulldown");
  });

  it("detects PAL speedup for 24 to 25", () => {
    expect(detectPulldown(24, 25)).toContain("PAL speedup");
  });

  it("returns no-standard for unusual conversion", () => {
    expect(detectPulldown(30, 50)).toContain("No standard");
  });
});

describe("video-fps-reference cinematicShutterSpeed", () => {
  it("returns 1/48-ish for 24 fps", () => {
    const s = cinematicShutterSpeed(24);
    expect(s).toContain("180°");
  });

  it("returns 1/120-ish for 60 fps", () => {
    const s = cinematicShutterSpeed(60);
    expect(s).toContain("180°");
  });
});
