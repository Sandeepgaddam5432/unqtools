import { describe, it, expect } from "vitest";
import {
  calculateVideoBitrate,
  calculateAudioBitrate,
  estimateFileSizeMB,
  suggestCompressionFactor,
  formatBitrate,
  chromaMultiplier,
  validateVideoInput,
  validateAudioInput,
} from "./logic";

describe("bitrate-calc chromaMultiplier", () => {
  it("4:4:4 = 1.0", () => {
    expect(chromaMultiplier("4:4:4")).toBeCloseTo(1.0);
  });
  it("4:2:2 = 2/3", () => {
    expect(chromaMultiplier("4:2:2")).toBeCloseTo(2 / 3);
  });
  it("4:2:0 = 0.5", () => {
    expect(chromaMultiplier("4:2:0")).toBeCloseTo(0.5);
  });
});

describe("bitrate-calc calculateVideoBitrate", () => {
  it("computes non-zero bitrate for 1080p60", () => {
    const r = calculateVideoBitrate({ width: 1920, height: 1080, fps: 60, colorDepth: 8, chromaSubsampling: "4:2:0" });
    expect(r.rawBitrateBps).toBeGreaterThan(0);
    expect(r.rawBitrateMbps).toBeGreaterThan(0);
  });

  it("returns zeros for invalid resolution", () => {
    const r = calculateVideoBitrate({ width: 0, height: 0, fps: 30, colorDepth: 8, chromaSubsampling: "4:2:0" });
    expect(r.rawBitrateBps).toBe(0);
  });

  it("compression reduces bitrate", () => {
    const r = calculateVideoBitrate({ width: 1920, height: 1080, fps: 30, colorDepth: 8, chromaSubsampling: "4:2:0" }, 0.01);
    expect(r.compressedBitrateKbps).toBeLessThan(r.rawBitrateKbps);
  });

  it("4:2:0 produces lower bitrate than 4:4:4", () => {
    const r444 = calculateVideoBitrate({ width: 1280, height: 720, fps: 30, colorDepth: 8, chromaSubsampling: "4:4:4" });
    const r420 = calculateVideoBitrate({ width: 1280, height: 720, fps: 30, colorDepth: 8, chromaSubsampling: "4:2:0" });
    expect(r420.rawBitrateBps).toBeLessThan(r444.rawBitrateBps);
  });
});

describe("bitrate-calc calculateAudioBitrate", () => {
  it("computes CD-quality bitrate (~1411 kbps)", () => {
    const r = calculateAudioBitrate({ sampleRate: 44100, bitDepth: 16, channels: 2 });
    expect(Math.round(r.rawBitrateKbps)).toBe(1411);
  });

  it("mono halves bitrate vs stereo", () => {
    const mono = calculateAudioBitrate({ sampleRate: 48000, bitDepth: 24, channels: 1 });
    const stereo = calculateAudioBitrate({ sampleRate: 48000, bitDepth: 24, channels: 2 });
    expect(mono.rawBitrateKbps).toBeCloseTo(stereo.rawBitrateKbps / 2);
  });

  it("returns zeros for invalid input", () => {
    const r = calculateAudioBitrate({ sampleRate: 0, bitDepth: 16, channels: 2 });
    expect(r.rawBitrateBps).toBe(0);
  });
});

describe("bitrate-calc estimateFileSizeMB", () => {
  it("computes file size in MB", () => {
    // 1000 kbps for 60s = 7500000 bytes = ~7.15 MB
    expect(estimateFileSizeMB(1000, 60)).toBeCloseTo(7500000 / (1024 * 1024), 1);
  });

  it("returns 0 for negative inputs", () => {
    expect(estimateFileSizeMB(-1, 60)).toBe(0);
  });
});

describe("bitrate-calc suggestCompressionFactor", () => {
  it("AV1 has lower factor than H.264", () => {
    expect(suggestCompressionFactor("av1")).toBeLessThan(suggestCompressionFactor("h264"));
  });

  it("FLAC has high factor (lossless)", () => {
    expect(suggestCompressionFactor("flac")).toBeGreaterThan(0.4);
  });
});

describe("bitrate-calc formatBitrate", () => {
  it("formats kbps below 1000", () => {
    expect(formatBitrate(500)).toBe("500 kbps");
  });

  it("formats Mbps at 1000+", () => {
    expect(formatBitrate(1500)).toBe("1.50 Mbps");
  });
});

describe("bitrate-calc validators", () => {
  it("validates video input", () => {
    expect(validateVideoInput({ width: 1920, height: 1080, fps: 30, colorDepth: 8, chromaSubsampling: "4:2:0" })).toBeNull();
    expect(validateVideoInput({ width: 0, height: 1080, fps: 30, colorDepth: 8, chromaSubsampling: "4:2:0" })).not.toBeNull();
    expect(validateVideoInput({ width: 1920, height: 1080, fps: 300, colorDepth: 8, chromaSubsampling: "4:2:0" })).not.toBeNull();
  });

  it("validates audio input", () => {
    expect(validateAudioInput({ sampleRate: 48000, bitDepth: 16, channels: 2 })).toBeNull();
    expect(validateAudioInput({ sampleRate: 48000, bitDepth: 5, channels: 2 })).not.toBeNull();
  });
});
