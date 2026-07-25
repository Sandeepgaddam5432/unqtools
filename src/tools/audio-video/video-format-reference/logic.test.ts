import { describe, it, expect } from "vitest";
import {
  getAllFormats,
  getFormatById,
  getFormatByExtension,
  getFormatByMime,
  filterStreaming,
  searchFormats,
  estimateSize,
  supportsCodec,
} from "./logic";

describe("video-format-reference getAllFormats", () => {
  it("returns at least 5 formats", () => {
    expect(getAllFormats().length).toBeGreaterThanOrEqual(5);
  });

  it("includes MP4 and WebM", () => {
    const ids = getAllFormats().map((f) => f.id);
    expect(ids).toContain("mp4");
    expect(ids).toContain("webm");
  });
});

describe("video-format-reference getFormatById", () => {
  it("finds mp4 by id", () => {
    const f = getFormatById("mp4");
    expect(f).not.toBeNull();
    expect(f!.name).toMatch(/MP4/);
  });

  it("returns null for unknown id", () => {
    expect(getFormatById("xyz")).toBeNull();
  });
});

describe("video-format-reference getFormatByExtension", () => {
  it("finds by extension", () => {
    expect(getFormatByExtension(".mkv")?.id).toBe("mkv");
    expect(getFormatByExtension("mov")?.id).toBe("mov");
  });

  it("is case-insensitive", () => {
    expect(getFormatByExtension(".WEBM")?.id).toBe("webm");
  });

  it("returns null for unknown extension", () => {
    expect(getFormatByExtension(".xyz")).toBeNull();
  });
});

describe("video-format-reference getFormatByMime", () => {
  it("matches a mime type", () => {
    expect(getFormatByMime("video/mp4")?.id).toBe("mp4");
  });

  it("handles mime with parameters", () => {
    expect(getFormatByMime("video/mp4; codecs=avc1.42E01E")?.id).toBe("mp4");
  });
});

describe("video-format-reference filterStreaming", () => {
  it("returns streaming formats", () => {
    const s = filterStreaming(true);
    expect(s.every((f) => f.streaming)).toBe(true);
    expect(s.some((f) => f.id === "mp4")).toBe(true);
  });

  it("returns non-streaming formats", () => {
    const ns = filterStreaming(false);
    expect(ns.every((f) => !f.streaming)).toBe(true);
    expect(ns.some((f) => f.id === "avi")).toBe(true);
  });
});

describe("video-format-reference searchFormats", () => {
  it("returns all for empty query", () => {
    expect(searchFormats("").length).toBeGreaterThanOrEqual(5);
  });

  it("matches by codec", () => {
    const matches = searchFormats("AV1");
    expect(matches.length).toBeGreaterThan(0);
  });

  it("matches by use case", () => {
    const matches = searchFormats("editing");
    expect(matches.some((f) => f.id === "mov")).toBe(true);
  });
});

describe("video-format-reference estimateSize", () => {
  it("computes file size from bitrate and duration", () => {
    // 5000 kbps for 120 s = 5000 * 1000 * 120 / 8 = 75000000 bytes
    expect(estimateSize(5000, 120)).toBe(75000000);
  });

  it("returns 0 for negative inputs", () => {
    expect(estimateSize(-1, 10)).toBe(0);
  });
});

describe("video-format-reference supportsCodec", () => {
  it("H.264 supported in MP4 on Chrome", () => {
    expect(supportsCodec("mp4", "H.264", "chrome")).toBe(true);
  });

  it("VP9 not supported in Safari", () => {
    expect(supportsCodec("webm", "VP9", "safari")).toBe(false);
  });

  it("H.265 not supported in Firefox", () => {
    expect(supportsCodec("mp4", "H.265", "firefox")).toBe(false);
  });

  it("returns false for unknown format", () => {
    expect(supportsCodec("xyz", "H.264", "chrome")).toBe(false);
  });

  it("returns false for codec not in format's list", () => {
    expect(supportsCodec("avi", "ProRes", "chrome")).toBe(false);
  });
});
