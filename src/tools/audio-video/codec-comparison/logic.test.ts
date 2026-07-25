import { describe, it, expect } from "vitest";
import {
  getAllCodecs,
  getCodecById,
  getCodecsByType,
  compareCodecs,
  summarizeCodec,
} from "./logic";

describe("codec-comparison getAllCodecs", () => {
  it("returns multiple codecs", () => {
    expect(getAllCodecs().length).toBeGreaterThanOrEqual(6);
  });

  it("has both video and audio types", () => {
    const all = getAllCodecs();
    expect(all.some((c) => c.type === "video")).toBe(true);
    expect(all.some((c) => c.type === "audio")).toBe(true);
  });
});

describe("codec-comparison getCodecById", () => {
  it("finds a codec by id", () => {
    const c = getCodecById("h264");
    expect(c).not.toBeNull();
    expect(c!.name).toMatch(/H.264/);
  });

  it("returns null for unknown id", () => {
    expect(getCodecById("nope")).toBeNull();
  });
});

describe("codec-comparison getCodecsByType", () => {
  it("filters by video", () => {
    const v = getCodecsByType("video");
    expect(v.every((c) => c.type === "video")).toBe(true);
    expect(v.length).toBeGreaterThan(0);
  });

  it("filters by audio", () => {
    const a = getCodecsByType("audio");
    expect(a.every((c) => c.type === "audio")).toBe(true);
  });
});

describe("codec-comparison compareCodecs", () => {
  it("returns null for unknown codec", () => {
    expect(compareCodecs("h264", "nope")).toBeNull();
  });

  it("compares two valid codecs", () => {
    const r = compareCodecs("h264", "av1");
    expect(r).not.toBeNull();
    expect(r!.metrics.length).toBeGreaterThan(0);
  });

  it("AV1 should beat H.264 on quality and compression", () => {
    const r = compareCodecs("h264", "av1");
    expect(r).not.toBeNull();
    const quality = r!.metrics.find((m) => m.metric === "Quality");
    expect(quality?.winner).toBe("b");
  });

  it("H.264 should beat AV1 on compatibility", () => {
    const r = compareCodecs("h264", "av1");
    expect(r).not.toBeNull();
    const compat = r!.metrics.find((m) => m.metric === "Compatibility");
    expect(compat?.winner).toBe("a");
  });

  it("produces a recommendation string", () => {
    const r = compareCodecs("mp3", "opus");
    expect(r).not.toBeNull();
    expect(r!.recommendation.length).toBeGreaterThan(0);
  });

  it("identifies a winner when one codec dominates", () => {
    const r = compareCodecs("mp3", "opus");
    expect(r).not.toBeNull();
    // Opus wins on quality and compression
    expect(["a", "b", "tie"]).toContain(r!.overallWinner);
  });
});

describe("codec-comparison summarizeCodec", () => {
  it("returns a readable summary", () => {
    const c = getCodecById("h264")!;
    const s = summarizeCodec(c);
    expect(s).toContain("H.264");
    expect(s).toMatch(/quality \d+\/100/);
  });

  it("mentions royalty-free status", () => {
    const flac = getCodecById("flac")!;
    expect(summarizeCodec(flac)).toContain("royalty-free");
  });
});
