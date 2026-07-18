import { describe, it, expect, beforeEach } from "vitest";
import {
  CONTAINERS,
  CODEC_LOOKUP,
  RESOLUTION_PRESETS,
  FRAME_RATE_PRESETS,
  COMPATIBILITY_MATRIX,
  COMPATIBILITY_LABELS,
  detectContainer,
  getMimeType,
  getContainerByExtension,
  lookupCodec,
  formatFileSize,
  formatDuration,
  formatDurationHMS,
  calculateBitrate,
  formatBitrate,
  computeAspectRatio,
  labelResolution,
  matchFrameRate,
  formatFrameRate,
  checkCompatibility,
  buildReport,
  computeSummaryStats,
  renderTextReport,
  renderCsvReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  getFileExtension,
  type VideoContainer,
  type HistoryEntry,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

// ---- Constants ----

describe("video-metadata-viewer constants", () => {
  it("defines 7 containers (excluding unknown)", () => {
    expect(Object.keys(CONTAINERS)).toHaveLength(7);
    expect(CONTAINERS.mp4).toBeDefined();
    expect(CONTAINERS.flv).toBeDefined();
  });
  it("has at least 9 codecs in CODEC_LOOKUP", () => {
    expect(Object.keys(CODEC_LOOKUP).length).toBeGreaterThanOrEqual(9);
  });
  it("has 8 resolution presets", () => {
    expect(RESOLUTION_PRESETS).toHaveLength(8);
  });
  it("has 10 frame rate presets", () => {
    expect(FRAME_RATE_PRESETS).toHaveLength(10);
  });
  it("has compatibility matrix for all 7 containers", () => {
    for (const c of ["mp4", "webm", "ogg", "mov", "avi", "mkv", "flv"] as VideoContainer[]) {
      expect(COMPATIBILITY_MATRIX[c]).toBeDefined();
    }
  });
  it("has 4 compatibility labels", () => {
    expect(Object.keys(COMPATIBILITY_LABELS)).toHaveLength(4);
  });
});

// ---- File type detection ----

describe("video-metadata-viewer detectContainer (magic bytes)", () => {
  it("detects MP4 from ftyp magic bytes", () => {
    const bytes = new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6F, 0x6D]);
    expect(detectContainer(bytes)).toBe("mp4");
  });
  it("detects MOV from qt  brand", () => {
    const bytes = new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20]);
    expect(detectContainer(bytes)).toBe("mov");
  });
  it("detects WebM from EBML + 'webm' doctype", () => {
    const bytes = new Uint8Array([
      0x1A, 0x45, 0xDF, 0xA3, 0x01, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x10, 0x42, 0x82, 0x88, 0x77,
      0x65, 0x62, 0x6D, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    expect(detectContainer(bytes)).toBe("webm");
  });
  it("detects MKV from EBML + 'matroska' doctype", () => {
    const bytes = new Uint8Array([
      0x1A, 0x45, 0xDF, 0xA3, 0x01, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x20, 0x42, 0x82, 0x88, 0x6D,
      0x61, 0x74, 0x72, 0x6F, 0x73, 0x6B, 0x61, 0x00,
    ]);
    expect(detectContainer(bytes)).toBe("mkv");
  });
  it("detects AVI from RIFF magic bytes", () => {
    const bytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
      0x41, 0x56, 0x49, 0x20, 0x00, 0x00, 0x00, 0x00,
    ]);
    expect(detectContainer(bytes)).toBe("avi");
  });
  it("detects FLV from FLV magic bytes", () => {
    const bytes = new Uint8Array([0x46, 0x4C, 0x56, 0x01, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    expect(detectContainer(bytes)).toBe("flv");
  });
  it("detects OGG from OggS magic bytes", () => {
    const bytes = new Uint8Array([0x4F, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    expect(detectContainer(bytes)).toBe("ogg");
  });
  it("falls back to extension when bytes are inconclusive", () => {
    const bytes = new Uint8Array(8);
    expect(detectContainer(bytes, "mp4")).toBe("mp4");
    expect(detectContainer(bytes, "mkv")).toBe("mkv");
  });
  it("returns unknown for unrecognized bytes and no extension", () => {
    const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    expect(detectContainer(bytes)).toBe("unknown");
  });
  it("accepts ArrayBuffer as input", () => {
    const buf = new ArrayBuffer(12);
    const view = new Uint8Array(buf);
    view[4] = 0x66; view[5] = 0x74; view[6] = 0x79; view[7] = 0x70;
    view[8] = 0x69; view[9] = 0x73; view[10] = 0x6F; view[11] = 0x6D;
    expect(detectContainer(buf)).toBe("mp4");
  });
});

describe("video-metadata-viewer MIME + extension helpers", () => {
  it("getMimeType returns MIME for known container", () => {
    expect(getMimeType("mp4")).toBe("video/mp4");
    expect(getMimeType("webm")).toBe("video/webm");
    expect(getMimeType("mkv")).toBe("video/x-matroska");
  });
  it("getMimeType returns octet-stream for unknown", () => {
    expect(getMimeType("unknown")).toBe("application/octet-stream");
  });
  it("getContainerByExtension recognizes extensions", () => {
    expect(getContainerByExtension("mp4")).toBe("mp4");
    expect(getContainerByExtension(".MP4")).toBe("mp4");
    expect(getContainerByExtension("webm")).toBe("webm");
    expect(getContainerByExtension("m4v")).toBe("mp4");
    expect(getContainerByExtension("ogv")).toBe("ogg");
    expect(getContainerByExtension("xyz")).toBe("unknown");
  });
});

// ---- Codec lookup ----

describe("video-metadata-viewer lookupCodec", () => {
  it("looks up avc1 → H.264 / AVC", () => {
    const info = lookupCodec("avc1");
    expect(info).not.toBeNull();
    expect(info!.name).toBe("H.264 / AVC");
    expect(info!.kind).toBe("video");
  });
  it("looks up full codec string with prefix match", () => {
    const info = lookupCodec("avc1.42E01E");
    expect(info).not.toBeNull();
    expect(info!.name).toBe("H.264 / AVC");
  });
  it("looks up mp4a.40.2 by two-level match", () => {
    const info = lookupCodec("mp4a.40.2");
    expect(info).not.toBeNull();
    expect(info!.name).toBe("AAC-LC");
  });
  it("looks up vp09 and av01", () => {
    expect(lookupCodec("vp09")!.name).toBe("VP9");
    expect(lookupCodec("av01")!.name).toBe("AV1");
    expect(lookupCodec("opus")!.name).toBe("Opus");
    expect(lookupCodec("vorbis")!.name).toBe("Vorbis");
  });
  it("returns null for unknown codec", () => {
    expect(lookupCodec("xyz123")).toBeNull();
    expect(lookupCodec("")).toBeNull();
  });
  it("case-insensitive lookup", () => {
    expect(lookupCodec("AVC1")).not.toBeNull();
    expect(lookupCodec("OPUS")).not.toBeNull();
  });
});

// ---- Formatters ----

describe("video-metadata-viewer formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });
  it("formats KB", () => {
    expect(formatFileSize(1024)).toBe("1.00 KB");
    expect(formatFileSize(2048)).toBe("2.00 KB");
  });
  it("formats MB", () => {
    expect(formatFileSize(1048576)).toBe("1.00 MB");
    expect(formatFileSize(10 * 1048576)).toBe("10.00 MB");
  });
  it("formats GB", () => {
    expect(formatFileSize(1073741824)).toBe("1.00 GB");
  });
  it("handles 0 and negative", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(-100)).toBe("0 B");
  });
});

describe("video-metadata-viewer formatDuration", () => {
  it("formats HH:MM:SS.ms", () => {
    expect(formatDuration(3661.5)).toBe("01:01:01.500");
  });
  it("handles zero and negative", () => {
    expect(formatDuration(0)).toBe("00:00:00.000");
    expect(formatDuration(-5)).toBe("00:00:00.000");
  });
  it("rounds milliseconds", () => {
    expect(formatDuration(1.2345)).toBe("00:00:01.235");
  });
});

describe("video-metadata-viewer formatDurationHMS", () => {
  it("formats HH:MM:SS", () => {
    expect(formatDurationHMS(3661)).toBe("01:01:01");
  });
  it("handles zero", () => {
    expect(formatDurationHMS(0)).toBe("00:00:00");
  });
});

// ---- Bitrate ----

describe("video-metadata-viewer bitrate", () => {
  it("calculates bitrate from size and duration", () => {
    // 1 MB file, 10 sec → 1_048_576 × 8 / 10 = 838_860.8 bps
    expect(calculateBitrate(1048576, 10)).toBeCloseTo(838860.8, 1);
  });
  it("returns 0 for invalid input", () => {
    expect(calculateBitrate(1024, 0)).toBe(0);
    expect(calculateBitrate(1024, -1)).toBe(0);
    expect(calculateBitrate(NaN, 10)).toBe(0);
  });
  it("formats bps", () => {
    expect(formatBitrate(500)).toBe("500 bps");
  });
  it("formats kbps", () => {
    expect(formatBitrate(1500)).toBe("1.50 kbps");
    expect(formatBitrate(1000)).toBe("1.00 kbps");
  });
  it("formats Mbps", () => {
    expect(formatBitrate(1_000_000)).toBe("1.00 Mbps");
    expect(formatBitrate(5_500_000)).toBe("5.50 Mbps");
  });
  it("formats Gbps", () => {
    expect(formatBitrate(1_000_000_000)).toBe("1.00 Gbps");
  });
  it("handles 0 and negative", () => {
    expect(formatBitrate(0)).toBe("0 bps");
    expect(formatBitrate(-100)).toBe("0 bps");
  });
});

// ---- Aspect ratio ----

describe("video-metadata-viewer computeAspectRatio", () => {
  it("computes 16:9 for 1920×1080", () => {
    const ar = computeAspectRatio(1920, 1080);
    expect(ar.ratio).toBe("16:9");
    expect(ar.label).toContain("16:9");
    expect(ar.decimal).toBeCloseTo(16 / 9, 3);
  });
  it("computes 4:3 for 640×480", () => {
    const ar = computeAspectRatio(640, 480);
    expect(ar.ratio).toBe("4:3");
  });
  it("computes 1:1 for 1080×1080", () => {
    const ar = computeAspectRatio(1080, 1080);
    expect(ar.ratio).toBe("1:1");
    expect(ar.label).toContain("Square");
  });
  it("computes 9:16 for vertical", () => {
    const ar = computeAspectRatio(1080, 1920);
    expect(ar.ratio).toBe("9:16");
    expect(ar.label).toContain("Vertical");
  });
  it("computes 21:9 for ultrawide", () => {
    const ar = computeAspectRatio(2560, 1080);
    expect(ar.ratio).toBe("21:9");
  });
  it("returns custom ratio for unusual dimensions", () => {
    const ar = computeAspectRatio(1234, 567);
    expect(ar.label).toContain("Custom");
  });
  it("returns unknown for invalid dimensions", () => {
    const ar = computeAspectRatio(0, 0);
    expect(ar.ratio).toBe("unknown");
  });
});

// ---- Resolution labeler ----

describe("video-metadata-viewer labelResolution", () => {
  it("labels 1920×1080 as Full HD 1080p", () => {
    const r = labelResolution(1920, 1080);
    expect(r.label).toBe("Full HD");
    expect(r.alias).toBe("1080p");
  });
  it("labels 1280×720 as HD 720p", () => {
    const r = labelResolution(1280, 720);
    expect(r.label).toBe("HD");
    expect(r.alias).toBe("720p");
  });
  it("labels 3840×2160 as 4K UHD", () => {
    const r = labelResolution(3840, 2160);
    expect(r.label).toBe("4K UHD");
    expect(r.alias).toBe("4K");
  });
  it("labels 7680×4320 as 8K UHD", () => {
    const r = labelResolution(7680, 4320);
    expect(r.label).toBe("8K UHD");
    expect(r.alias).toBe("8K");
  });
  it("labels 2560×1440 as QHD 1440p", () => {
    const r = labelResolution(2560, 1440);
    expect(r.label).toBe("QHD");
    expect(r.alias).toBe("1440p");
  });
  it("labels custom resolution", () => {
    const r = labelResolution(1100, 700);
    expect(r.label).toContain("Custom");
  });
  it("returns unknown for invalid dimensions", () => {
    const r = labelResolution(0, 0);
    expect(r.label).toBe("Unknown");
  });
});

// ---- Frame rate ----

describe("video-metadata-viewer frame rate", () => {
  it("matches 24 fps preset", () => {
    const p = matchFrameRate(24);
    expect(p).not.toBeNull();
    expect(p!.label).toBe("24 fps");
    expect(p!.description).toBe("Cinema");
  });
  it("matches 23.976 within tolerance", () => {
    const p = matchFrameRate(23.9765);
    expect(p).not.toBeNull();
    expect(p!.description).toBe("Film (NTSC)");
  });
  it("matches 60 fps", () => {
    const p = matchFrameRate(60);
    expect(p!.description).toBe("Web / Gaming");
  });
  it("matches 240 fps", () => {
    const p = matchFrameRate(240);
    expect(p!.label).toBe("240 fps");
  });
  it("returns null for non-preset rate", () => {
    expect(matchFrameRate(45)).toBeNull();
    expect(matchFrameRate(0)).toBeNull();
  });
  it("formats frame rate with stripped trailing zeros", () => {
    expect(formatFrameRate(24)).toBe("24");
    expect(formatFrameRate(23.976)).toBe("23.976");
    expect(formatFrameRate(30.5)).toBe("30.5");
    expect(formatFrameRate(0)).toBe("unknown");
  });
});

// ---- Compatibility ----

describe("video-metadata-viewer checkCompatibility", () => {
  it("avc1 in mp4 is supported", () => {
    expect(checkCompatibility("mp4", "avc1")).toBe("supported");
  });
  it("opus in webm is supported", () => {
    expect(checkCompatibility("webm", "opus")).toBe("supported");
  });
  it("vorbis in mp4 is unsupported", () => {
    expect(checkCompatibility("mp4", "vorbis")).toBe("unsupported");
  });
  it("av01 in mkv is supported", () => {
    expect(checkCompatibility("mkv", "av01")).toBe("supported");
  });
  it("works with full codec string prefix", () => {
    expect(checkCompatibility("mp4", "avc1.42E01E")).toBe("supported");
  });
  it("returns unsupported for unknown container", () => {
    expect(checkCompatibility("unknown", "avc1")).toBe("unsupported");
  });
  it("returns unsupported for unknown codec", () => {
    expect(checkCompatibility("mp4", "xyz123")).toBe("unsupported");
  });
});

// ---- buildReport + summary stats ----

describe("video-metadata-viewer buildReport", () => {
  const sample = {
    fileName: "movie.mp4",
    fileSizeBytes: 50_000_000,
    container: "mp4" as VideoContainer,
    mimeType: "video/mp4",
    videoWidth: 1920,
    videoHeight: 1080,
    durationSeconds: 100,
    videoCodec: "avc1.42E01E",
    audioCodec: "mp4a.40.2",
    frameRate: 24,
  };
  it("builds a report with all fields populated", () => {
    const r = buildReport(sample);
    expect(r.bitrate).toBeGreaterThan(0);
    expect(r.aspectRatio.ratio).toBe("16:9");
    expect(r.resolutionLabel.label).toBe("Full HD");
    expect(r.frameRatePreset?.description).toBe("Cinema");
    expect(r.videoCodecInfo?.name).toBe("H.264 / AVC");
    expect(r.audioCodecInfo?.name).toBe("AAC-LC");
    expect(r.containerInfo?.container).toBe("mp4");
    expect(r.videoCompatibility).toBe("supported");
    expect(r.audioCompatibility).toBe("supported");
  });
  it("handles missing optional fields", () => {
    const r = buildReport({
      fileName: "x.mp4", fileSizeBytes: 1000, container: "mp4" as VideoContainer,
      mimeType: "video/mp4", videoWidth: 0, videoHeight: 0, durationSeconds: 0,
    });
    expect(r.bitrate).toBe(0);
    expect(r.aspectRatio.ratio).toBe("unknown");
    expect(r.resolutionLabel.label).toBe("Unknown");
    expect(r.frameRatePreset).toBeNull();
    expect(r.videoCodecInfo).toBeNull();
    expect(r.audioCodecInfo).toBeNull();
    expect(r.containerInfo).not.toBeNull(); // container is known
  });
  it("computeSummaryStats returns expected fields", () => {
    const r = buildReport(sample);
    const s = computeSummaryStats(r);
    expect(s.fileSize).toBe(50_000_000);
    expect(s.duration).toBe(100);
    expect(s.bitrate).toBeGreaterThan(0);
    expect(s.width).toBe(1920);
    expect(s.height).toBe(1080);
    expect(s.codecCount).toBe(2);
  });
});

// ---- Text + CSV renderers ----

describe("video-metadata-viewer renderTextReport", () => {
  const sample = {
    fileName: "movie.mp4",
    fileSizeBytes: 50_000_000,
    container: "mp4" as VideoContainer,
    mimeType: "video/mp4",
    videoWidth: 1920,
    videoHeight: 1080,
    durationSeconds: 100,
    videoCodec: "avc1.42E01E",
    audioCodec: "mp4a.40.2",
    frameRate: 24,
  };
  it("includes file name and size", () => {
    const txt = renderTextReport(buildReport(sample));
    expect(txt).toContain("movie.mp4");
    expect(txt).toContain("47.68 MB");
  });
  it("includes container, resolution, and codec info", () => {
    const txt = renderTextReport(buildReport(sample));
    expect(txt).toContain("Container      : MP4");
    expect(txt).toContain("Resolution     : 1920×1080");
    expect(txt).toContain("H.264 / AVC");
    expect(txt).toContain("AAC-LC");
  });
  it("includes duration and bitrate", () => {
    const txt = renderTextReport(buildReport(sample));
    expect(txt).toContain("Duration       : 00:01:40.000");
    expect(txt).toContain("Bitrate");
  });
});

describe("video-metadata-viewer renderCsvReport", () => {
  const sample = {
    fileName: "movie.mp4",
    fileSizeBytes: 50_000_000,
    container: "mp4" as VideoContainer,
    mimeType: "video/mp4",
    videoWidth: 1920,
    videoHeight: 1080,
    durationSeconds: 100,
    videoCodec: "avc1.42E01E",
    audioCodec: "mp4a.40.2",
    frameRate: 24,
  };
  it("includes header and key rows", () => {
    const csv = renderCsvReport(buildReport(sample));
    expect(csv).toContain("property,value");
    expect(csv).toContain("file_name,movie.mp4");
    expect(csv).toContain("container,mp4");
    expect(csv).toContain("video_width,1920");
    expect(csv).toContain("video_height,1080");
    expect(csv).toContain("video_codec,avc1.42E01E");
    expect(csv).toContain("audio_codec,mp4a.40.2");
  });
  it("escapes commas in values", () => {
    const csv = renderCsvReport(buildReport({ ...sample, fileName: "my,file.mp4" }));
    expect(csv).toContain('"my,file.mp4"');
  });
});

// ---- History ----

describe("video-metadata-viewer history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, fileName: "a.mp4", fileSizeBytes: 100, container: "mp4",
      durationSeconds: 5, width: 1280, height: 720,
    } as HistoryEntry);
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].fileName).toBe("a.mp4");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, fileName: `f${i}.mp4`, fileSizeBytes: 100, container: "mp4",
        durationSeconds: 5, width: 1280, height: 720,
      } as HistoryEntry);
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, fileName: "a.mp4", fileSizeBytes: 100, container: "mp4",
      durationSeconds: 5, width: 1280, height: 720,
    } as HistoryEntry);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---- Shareable URL ----

describe("video-metadata-viewer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      fileName: "movie.mp4",
      fileSizeBytes: 50_000_000,
      container: "mp4",
      durationSeconds: 100,
      width: 1920,
      height: 1080,
      videoCodec: "avc1",
      audioCodec: "mp4a",
    });
    expect(url).toContain("name=movie.mp4");
    expect(url).toContain("size=50000000");
    expect(url).toContain("c=mp4");
    expect(url).toContain("w=1920");
    expect(url).toContain("h=1080");
    expect(url).toContain("vcodec=avc1");
    expect(url).toContain("acodec=mp4a");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("name=movie.mp4&size=50000000&c=mp4&dur=100&w=1920&h=1080&vcodec=avc1&acodec=mp4a");
    expect(p.fileName).toBe("movie.mp4");
    expect(p.fileSizeBytes).toBe(50_000_000);
    expect(p.container).toBe("mp4");
    expect(p.durationSeconds).toBe(100);
    expect(p.width).toBe(1920);
    expect(p.height).toBe(1080);
    expect(p.videoCodec).toBe("avc1");
    expect(p.audioCodec).toBe("mp4a");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown containers", () => {
    const p = parseShareUrl("c=xyz");
    expect(p.container).toBeUndefined();
  });
});

// ---- File extension helper ----

describe("video-metadata-viewer getFileExtension", () => {
  it("extracts lowercase extension", () => {
    expect(getFileExtension("movie.MP4")).toBe("mp4");
    expect(getFileExtension("a.b.webm")).toBe("webm");
  });
  it("returns empty for no extension", () => {
    expect(getFileExtension("movie")).toBe("");
    expect(getFileExtension("movie.")).toBe("");
  });
  it("returns empty for empty string", () => {
    expect(getFileExtension("")).toBe("");
  });
});

// Suppress unused-import lint
export type _Unused = VideoContainer;
