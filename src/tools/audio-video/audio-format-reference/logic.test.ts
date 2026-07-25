import { describe, it, expect } from "vitest";
import {
  getAllFormats,
  getFormatById,
  getFormatByExtension,
  getFormatByMime,
  filterLossless,
  searchFormats,
  estimateSize,
} from "./logic";

describe("audio-format-reference getAllFormats", () => {
  it("returns at least 6 formats", () => {
    expect(getAllFormats().length).toBeGreaterThanOrEqual(6);
  });

  it("includes MP3 and FLAC", () => {
    const ids = getAllFormats().map((f) => f.id);
    expect(ids).toContain("mp3");
    expect(ids).toContain("flac");
  });
});

describe("audio-format-reference getFormatById", () => {
  it("finds mp3 by id", () => {
    const f = getFormatById("mp3");
    expect(f).not.toBeNull();
    expect(f!.name).toMatch(/MP3/);
  });

  it("returns null for unknown id", () => {
    expect(getFormatById("xyz")).toBeNull();
  });
});

describe("audio-format-reference getFormatByExtension", () => {
  it("finds by extension with dot", () => {
    expect(getFormatByExtension(".flac")?.id).toBe("flac");
  });

  it("finds by extension without dot", () => {
    expect(getFormatByExtension("mp3")?.id).toBe("mp3");
  });

  it("is case-insensitive", () => {
    expect(getFormatByExtension(".WAV")?.id).toBe("wav");
  });
});

describe("audio-format-reference getFormatByMime", () => {
  it("matches a mime type", () => {
    expect(getFormatByMime("audio/mpeg")?.id).toBe("mp3");
  });

  it("handles mime with parameters", () => {
    expect(getFormatByMime("audio/ogg; codecs=vorbis")?.id).toBe("ogg");
  });
});

describe("audio-format-reference filterLossless", () => {
  it("returns lossless formats", () => {
    const ll = filterLossless(true);
    expect(ll.every((f) => f.lossless)).toBe(true);
    expect(ll.some((f) => f.id === "flac")).toBe(true);
  });

  it("returns lossy formats", () => {
    const ly = filterLossless(false);
    expect(ly.every((f) => !f.lossless)).toBe(true);
    expect(ly.some((f) => f.id === "mp3")).toBe(true);
  });
});

describe("audio-format-reference searchFormats", () => {
  it("returns all for empty query", () => {
    expect(searchFormats("").length).toBeGreaterThanOrEqual(6);
  });

  it("matches by use case", () => {
    const matches = searchFormats("podcast");
    expect(matches.some((f) => f.id === "mp3")).toBe(true);
  });

  it("matches by name substring", () => {
    const matches = searchFormats("lossless");
    expect(matches.length).toBeGreaterThan(0);
  });
});

describe("audio-format-reference estimateSize", () => {
  it("computes file size from bitrate and duration", () => {
    // 128 kbps for 60 s = 128000 * 60 / 8 = 960000 bytes
    expect(estimateSize(128, 60)).toBe(960000);
  });

  it("returns 0 for negative inputs", () => {
    expect(estimateSize(-1, 10)).toBe(0);
    expect(estimateSize(128, -1)).toBe(0);
  });
});
