import { describe, it, expect, beforeEach } from "vitest";
import {
  MAGIC_BYTES,
  FORMAT_MIME_TYPES,
  FORMAT_EXTENSIONS,
  FORMAT_CONTAINER_INFO,
  BIT_DEPTHS,
  CHANNEL_LAYOUTS,
  matchRule,
  detectFormat,
  closestMatches,
  getMimeType,
  getExtension,
  getContainerInfo,
  getBitDepthInfo,
  getChannelLayout,
  getComparisonTable,
  parseWavHeader,
  parseFlacHeader,
  parseAiffHeader,
  parseMp3Header,
  parseOggHeader,
  parseTtaHeader,
  parseWavPackHeader,
  toHex,
  toAsciiPreview,
  renderTextReport,
  renderCsvReport,
  renderJsonReport,
  computeSummaryStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type AudioFormatId,
  type BitDepthId,
  type ChannelLayoutId,
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

// ---- Helpers to build fake file headers ----

function pad(arr: number[], total = 64): Uint8Array {
  const out = new Uint8Array(total);
  for (let i = 0; i < arr.length && i < total; i++) out[i] = arr[i];
  return out;
}

function makeWav(): Uint8Array {
  // RIFF....WAVEfmt .... (16) 01 00 (PCM) 02 00 (2ch) 44ac 00 00 (44100) 10b1 02 00 (byte rate) 04 00 (block align) 10 00 (16 bits)
  const bytes = [
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, // RIFF + size
    0x57, 0x41, 0x56, 0x45,                           // WAVE
    0x66, 0x6d, 0x74, 0x20, 0x10, 0x00, 0x00, 0x00, // "fmt " + 16
    0x01, 0x00,                                       // PCM
    0x02, 0x00,                                       // 2 channels
    0x44, 0xac, 0x00, 0x00,                           // 44100 Hz
    0x10, 0xb1, 0x02, 0x00,                           // byte rate
    0x04, 0x00,                                       // block align
    0x10, 0x00,                                       // 16 bits per sample
  ];
  return pad(bytes);
}

function makeFlac(): Uint8Array {
  // fLaC + metadata block header (STREAMINFO type 0, last=0, length=34)
  // STREAMINFO: minBlock(2) maxBlock(2) minFrame(3) maxFrame(3) sampleRate(20bits) channels(3bits) bitsPerSample(5bits) totalSamples(36bits) md5(16)
  // 44100 Hz → 0xAC44, encoded across bytes 18..20 (20-bit, big-endian top)
  // 44100 = 0xAC44 → as 20-bit: 0x0AC44 → high byte = 0x0A, mid = 0xC4, low nibble = 0x40 (shifted left 4)
  // Actually: sampleRate is 20 bits at bit 0 of STREAMINFO offset 10.
  // STREAMINFO starts at absolute offset 8 (after fLaC + 4-byte header).
  // sampleRate is at STREAMINFO offset 10 → absolute 18, 20 bits big-endian.
  // 44100 = 0xAC44 = binary 10101100 01000100 → as 20-bit: 0000 10101100 01000100
  // So byte[18] = 0x0A, byte[19] = 0xC4, byte[20] high 4 bits = 0x4 → byte[20] = 0x40 + (channels-1)<<1 + bitsHigh
  // channels=2 → (2-1)=1 → <<1 = 0x02; bitsPerSample=16 → (16-1)=15 = 0xF → split: top 5 bits in byte[20] low nibble, bottom 4 in byte[21] top
  // byte[20] = 0x40 | (channelBits << 1) | (bpsTopBit) = 0x40 | 0x02 | (15 >> 4 = 0) = 0x42
  // byte[21] = (bpsLow4 << 4) | (totalSamples top 4 bits) — totalSamples=0 → 0xF0
  const bytes = [
    0x66, 0x4c, 0x61, 0x43, // "fLaC"
    0x00, 0x00, 0x00, 0x22, // STREAMINFO block (type 0, length 34)
    0x12, 0x10,             // min block size
    0x12, 0x10,             // max block size
    0x00, 0x00, 0x00,       // min frame size
    0x00, 0x00, 0x00,       // max frame size
    // sampleRate 20 bits, channels 3 bits, bitsPerSample 5 bits, totalSamples 36 bits → 8 bytes
    0x0A, 0xC4, 0x42, 0xF0, 0x00, 0x00, 0x00, 0x00,
    // md5 (16 bytes) — leave 0
  ];
  return pad(bytes);
}

function makeMp3(): Uint8Array {
  // MPEG-1 Layer III, 44100 Hz, stereo, 128 kbps
  // Frame header: FF FB 90 00 (90 = 10010000 → bitrate index 9=128k for MPEG1 L3, samplerate 00=44100, padding 0)
  // 00 = 00000000 → channel mode 00=stereo
  const bytes = [0xff, 0xfb, 0x90, 0x00];
  return pad(bytes);
}

function makeMp3WithId3(): Uint8Array {
  // ID3v2 header (10 bytes) with size 0, then frame sync at offset 10
  const bytes = [
    0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // "ID3" + size 0
    0xff, 0xfb, 0x90, 0x00, // frame sync at offset 10
  ];
  return pad(bytes);
}

function makeAiff(): Uint8Array {
  // FORM....AIFFCOMM.... numChannels=2, numSampleFrames=44100, sampleSize=16, sampleRate=44100 (extended 80-bit)
  // IEEE 80-bit for 44100: sign=0, exponent=16383+15=16398=0x400E, mantissa=44100<<47 = ...
  // 44100 = 0xAC44. As extended (1.xxx form), we want 1.010110001000100 × 2^15 → mantissa bits 010110001000100...000
  // Simpler: bytes for 44100 extended = 40 0E AC 44 00 00 00 00 00 00
  const bytes = [
    0x46, 0x4f, 0x52, 0x4d, 0x00, 0x00, 0x00, 0x00, // FORM + size
    0x41, 0x49, 0x46, 0x46,                           // AIFF
    0x43, 0x4f, 0x4d, 0x4d, 0x00, 0x00, 0x00, 0x12, // COMM + 18
    0x00, 0x02,                                       // 2 channels
    0x00, 0x00, 0xac, 0x44,                           // 44100 sample frames
    0x00, 0x10,                                       // 16 bits
    0x40, 0x0e, 0xac, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // sampleRate extended
  ];
  return pad(bytes);
}

function makeOgg(): Uint8Array {
  // "OggS" + version 0 + flags + granule + serial + seq + checksum + segments + segtable
  const bytes = [
    0x4f, 0x67, 0x67, 0x53, // OggS
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // version + flags + granule
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // serial + seq
    0x00, 0x00, 0x00, 0x00, // checksum
    0x01,                   // 1 segment
    0x1e,                   // segment size 30
    // Vorbis ID header starts here at offset 27: "\x01vorbis" + version + ...
    0x01, 0x76, 0x6f, 0x72, 0x62, 0x69, 0x73,
  ];
  return pad(bytes);
}

function makeOpus(): Uint8Array {
  // OggS header + OpusHead signature near offset 28
  const bytes = new Array(64).fill(0);
  bytes[0] = 0x4f; bytes[1] = 0x67; bytes[2] = 0x67; bytes[3] = 0x53;
  // OpusHead at offset 28
  bytes[28] = 0x4f; bytes[29] = 0x70; bytes[30] = 0x75; bytes[31] = 0x73;
  bytes[32] = 0x48; bytes[33] = 0x65; bytes[34] = 0x61; bytes[35] = 0x64;
  return new Uint8Array(bytes);
}

function makeAmr(): Uint8Array {
  const bytes = [0x23, 0x21, 0x41, 0x4d, 0x52, 0x0a]; // "#!AMR\n"
  return pad(bytes);
}

function makeTta(): Uint8Array {
  // TTA1 + format(2) + channels(2) + bitsPerSample(2) + sampleRate(4)
  const bytes = [
    0x54, 0x54, 0x41, 0x31, // TTA1
    0x00, 0x01,             // format
    0x00, 0x02,             // 2 channels
    0x00, 0x10,             // 16 bits
    0x00, 0x00, 0xac, 0x44, // 44100 Hz big-endian
  ];
  return pad(bytes);
}

function makeApe(): Uint8Array {
  const bytes = [0x4d, 0x41, 0x43, 0x20, 0x96, 0x0f, 0x00, 0x00]; // "MAC "
  return pad(bytes);
}

function makeWavpack(): Uint8Array {
  // wvpk (4) + blockSize (4) + version (2) + trackNo(1) + idxNo(1) + totalSamples(4) + blockIdx(4) + flags (4) + crc (4)
  // flags field (LE uint32 at offset 20):
  //   bits 0-1: bps (0=16-bit)
  //   bit 2: stereo (1 = stereo)
  //   bits 23-26: 4-bit sample rate index (10 = 44100 Hz)
  // For 44100 (rateIdx=10 = 0b1010) at bits 23-26:
  //   bit 23 = 0 (byte22 bit 7), bit 24 = 1 (byte23 bit 0), bit 25 = 0, bit 26 = 1
  // So byte20 = 0x04 (stereo bit, bps=0), byte22 = 0x00, byte23 = 0x05
  const bytes = [
    0x77, 0x76, 0x70, 0x6b, // wvpk
    0x00, 0x00, 0x00, 0x00, // block size
    0x04, 0x10,             // version
    0x00, 0x00,             // track/idx
    0x00, 0x00, 0x00, 0x00, // total samples
    0x00, 0x00, 0x00, 0x00, // block index
    0x04, 0x00, 0x00, 0x05, // flags: stereo bit set (byte20=0x04), rateIdx=10 (byte23=0x05)
    0x00, 0x00, 0x00, 0x00, // crc
  ];
  return pad(bytes);
}

// ---- Constants tests ----

describe("audio-format-detector constants", () => {
  it("has 15+ magic byte rules", () => {
    expect(MAGIC_BYTES.length).toBeGreaterThanOrEqual(15);
  });

  it("has MIME types for every format", () => {
    for (const rule of MAGIC_BYTES) {
      expect(FORMAT_MIME_TYPES[rule.format]).toBeTruthy();
    }
  });

  it("has extensions for every format", () => {
    for (const rule of MAGIC_BYTES) {
      expect(FORMAT_EXTENSIONS[rule.format]).toBeTruthy();
    }
  });

  it("has container info for every format", () => {
    for (const rule of MAGIC_BYTES) {
      const info = FORMAT_CONTAINER_INFO[rule.format];
      expect(info).toBeTruthy();
      expect(info.codec).toBeTruthy();
      expect(info.compression === "lossless" || info.compression === "lossy").toBe(true);
    }
  });

  it("has 5 bit depths", () => {
    expect(BIT_DEPTHS).toHaveLength(5);
  });

  it("has 4 channel layouts", () => {
    expect(CHANNEL_LAYOUTS).toHaveLength(4);
  });

  it("comparison table covers all formats", () => {
    const table = getComparisonTable();
    expect(table.length).toBe(MAGIC_BYTES.length);
  });
});

// ---- Lookup functions ----

describe("audio-format-detector lookups", () => {
  it("getMimeType returns known MIME", () => {
    expect(getMimeType("mp3")).toBe("audio/mpeg");
    expect(getMimeType("wav")).toBe("audio/wav");
    expect(getMimeType("flac")).toBe("audio/flac");
  });

  it("getExtension returns known extension", () => {
    expect(getExtension("mp3")).toBe("mp3");
    expect(getExtension("wavpack")).toBe("wv");
    expect(getExtension("m4a")).toBe("m4a");
  });

  it("getContainerInfo returns full info", () => {
    const info = getContainerInfo("flac");
    expect(info.codec).toContain("Free Lossless");
    expect(info.compression).toBe("lossless");
  });

  it("getBitDepthInfo returns info by id", () => {
    expect(getBitDepthInfo("16").bits).toBe(16);
    expect(getBitDepthInfo("32-float").format).toBe("float");
  });

  it("getBitDepthInfo falls back to 16-bit for unknown", () => {
    expect(getBitDepthInfo("99" as BitDepthId).bits).toBe(16);
  });

  it("getChannelLayout returns info by id", () => {
    expect(getChannelLayout("stereo").channels).toBe(2);
    expect(getChannelLayout("5.1").channels).toBe(6);
    expect(getChannelLayout("7.1").channels).toBe(8);
  });

  it("getChannelLayout falls back to stereo for unknown", () => {
    expect(getChannelLayout("3.1" as ChannelLayoutId).channels).toBe(2);
  });
});

// ---- matchRule ----

describe("audio-format-detector matchRule", () => {
  it("matches WAV primary + and-clause", () => {
    const rule = MAGIC_BYTES.find((r) => r.format === "wav")!;
    expect(matchRule(rule, makeWav())).toBe(100);
  });

  it("matches FLAC primary", () => {
    const rule = MAGIC_BYTES.find((r) => r.format === "flac")!;
    expect(matchRule(rule, makeFlac())).toBe(100);
  });

  it("matches MP3 by ID3 tag", () => {
    const rule = MAGIC_BYTES.find((r) => r.format === "mp3")!;
    expect(matchRule(rule, makeMp3WithId3())).toBeGreaterThanOrEqual(90);
  });

  it("matches MP3 by frame sync (alt)", () => {
    const rule = MAGIC_BYTES.find((r) => r.format === "mp3")!;
    expect(matchRule(rule, makeMp3())).toBeGreaterThanOrEqual(75);
  });

  it("matches AIFF primary + and-clause", () => {
    const rule = MAGIC_BYTES.find((r) => r.format === "aiff")!;
    expect(matchRule(rule, makeAiff())).toBe(100);
  });

  it("matches AMR primary", () => {
    const rule = MAGIC_BYTES.find((r) => r.format === "amr")!;
    expect(matchRule(rule, makeAmr())).toBe(100);
  });

  it("returns 0 for unrelated bytes", () => {
    const rule = MAGIC_BYTES.find((r) => r.format === "wav")!;
    expect(matchRule(rule, new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]))).toBe(0);
  });
});

// ---- detectFormat ----

describe("audio-format-detector detectFormat", () => {
  it("detects WAV with sample rate, channels, bit depth", () => {
    const r = detectFormat(makeWav());
    expect(r.format).toBe("wav");
    expect(r.confidence).toBe(100);
    expect(r.mimeType).toBe("audio/wav");
    expect(r.extension).toBe("wav");
    expect(r.technical.sampleRate).toBe(44100);
    expect(r.technical.channels).toBe(2);
    expect(r.technical.bitDepth).toBe(16);
  });

  it("detects FLAC with sample rate, channels, bit depth", () => {
    const r = detectFormat(makeFlac());
    expect(r.format).toBe("flac");
    expect(r.confidence).toBe(100);
    expect(r.technical.sampleRate).toBe(44100);
    expect(r.technical.channels).toBe(2);
    expect(r.technical.bitDepth).toBe(16);
  });

  it("detects MP3 (ID3)", () => {
    const r = detectFormat(makeMp3WithId3());
    expect(r.format).toBe("mp3");
    expect(r.confidence).toBeGreaterThanOrEqual(90);
    expect(r.mimeType).toBe("audio/mpeg");
  });

  it("detects MP3 frame sync (no ID3)", () => {
    const r = detectFormat(makeMp3());
    expect(r.format).toBe("mp3");
    expect(r.technical.channels).toBe(2);
    expect(r.technical.sampleRate).toBe(44100);
  });

  it("detects AIFF with sample rate, channels, bit depth", () => {
    const r = detectFormat(makeAiff());
    expect(r.format).toBe("aiff");
    expect(r.technical.sampleRate).toBe(44100);
    expect(r.technical.channels).toBe(2);
    expect(r.technical.bitDepth).toBe(16);
  });

  it("detects OGG/Vorbis", () => {
    const r = detectFormat(makeOgg());
    expect(r.format).toBe("ogg");
    expect(r.mimeType).toBe("audio/ogg");
  });

  it("detects Opus inside OGG (prefers Opus over generic OGG)", () => {
    const r = detectFormat(makeOpus());
    expect(r.format).toBe("opus");
    expect(r.label).toContain("Opus");
  });

  it("detects AMR with fixed sample rate", () => {
    const r = detectFormat(makeAmr());
    expect(r.format).toBe("amr");
    expect(r.technical.sampleRate).toBe(8000);
    expect(r.technical.channels).toBe(1);
  });

  it("detects APE", () => {
    const r = detectFormat(makeApe());
    expect(r.format).toBe("ape");
  });

  it("detects TTA with header details", () => {
    const r = detectFormat(makeTta());
    expect(r.format).toBe("tta");
    expect(r.technical.channels).toBe(2);
    expect(r.technical.bitDepth).toBe(16);
    expect(r.technical.sampleRate).toBe(44100);
  });

  it("detects WavPack with header details", () => {
    const r = detectFormat(makeWavpack());
    expect(r.format).toBe("wavpack");
    expect(r.technical.channels).toBe(2);
    expect(r.technical.bitDepth).toBe(16);
    expect(r.technical.sampleRate).toBe(44100);
  });

  it("returns unknown for unrelated bytes", () => {
    const r = detectFormat(new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0, 0, 0, 0]));
    expect(r.format).toBe("unknown");
    expect(r.confidence).toBe(0);
    expect(r.mimeType).toBeNull();
  });

  it("includes hex of first bytes", () => {
    const r = detectFormat(makeWav());
    expect(r.magicBytesHex).toContain("52");
    expect(r.magicBytesHex).toContain("49");
    expect(r.magicBytesHex).toContain("46");
  });
});

// ---- closestMatches ----

describe("audio-format-detector closestMatches", () => {
  it("returns empty for totally unknown bytes", () => {
    expect(closestMatches(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]))).toEqual([]);
  });

  it("returns matches for partial signatures", () => {
    // RIFF header without WAVE → primary WAV match (50%)
    const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0, 0, 0, 0]);
    const matches = closestMatches(bytes);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => m.format === "wav")).toBe(true);
  });
});

// ---- Header parsers ----

describe("audio-format-detector parseWavHeader", () => {
  it("parses sample rate, channels, bit depth", () => {
    const r = parseWavHeader(makeWav());
    expect(r.sampleRate).toBe(44100);
    expect(r.channels).toBe(2);
    expect(r.bitDepth).toBe(16);
    expect(r.notes).toBe("PCM integer");
  });

  it("returns notes if fmt chunk not at standard offset", () => {
    const bytes = pad([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
    const r = parseWavHeader(bytes);
    expect(r.notes).toContain("fmt chunk");
  });
});

describe("audio-format-detector parseFlacHeader", () => {
  it("parses sample rate, channels, bit depth", () => {
    const r = parseFlacHeader(makeFlac());
    expect(r.sampleRate).toBe(44100);
    expect(r.channels).toBe(2);
    expect(r.bitDepth).toBe(16);
  });
});

describe("audio-format-detector parseMp3Header", () => {
  it("parses MPEG-1 Layer III stereo", () => {
    const r = parseMp3Header(makeMp3());
    expect(r.channels).toBe(2);
    expect(r.sampleRate).toBe(44100);
    expect(r.notes).toContain("MPEG-1");
    expect(r.notes).toContain("Layer III");
  });

  it("parses after ID3v2", () => {
    const r = parseMp3Header(makeMp3WithId3());
    expect(r.channels).toBe(2);
    expect(r.sampleRate).toBe(44100);
  });
});

describe("audio-format-detector parseAiffHeader", () => {
  it("parses sample rate, channels, bit depth", () => {
    const r = parseAiffHeader(makeAiff());
    expect(r.sampleRate).toBe(44100);
    expect(r.channels).toBe(2);
    expect(r.bitDepth).toBe(16);
  });
});

describe("audio-format-detector parseOggHeader", () => {
  it("detects Vorbis codec", () => {
    const r = parseOggHeader(makeOgg());
    expect(r.notes).toContain("Vorbis");
  });

  it("detects Opus codec", () => {
    const r = parseOggHeader(makeOpus());
    expect(r.notes).toContain("Opus");
  });
});

describe("audio-format-detector parseTtaHeader", () => {
  it("parses TTA header", () => {
    const r = parseTtaHeader(makeTta());
    expect(r.sampleRate).toBe(44100);
    expect(r.channels).toBe(2);
    expect(r.bitDepth).toBe(16);
  });
});

describe("audio-format-detector parseWavPackHeader", () => {
  it("parses WavPack header", () => {
    const r = parseWavPackHeader(makeWavpack());
    expect(r.channels).toBe(2);
    expect(r.bitDepth).toBe(16);
    expect(r.sampleRate).toBe(44100);
  });
});

// ---- Hex helpers ----

describe("audio-format-detector hex helpers", () => {
  it("toHex returns space-separated hex", () => {
    expect(toHex(new Uint8Array([0x52, 0x49, 0x46]))).toBe("52 49 46");
  });

  it("toHex respects maxBytes", () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    expect(toHex(bytes, 3)).toBe("01 02 03");
  });

  it("toAsciiPreview renders printable as char, others as dot", () => {
    expect(toAsciiPreview(new Uint8Array([0x41, 0x42, 0x00, 0x43]))).toBe("AB.C");
  });
});

// ---- Renderers ----

describe("audio-format-detector renderTextReport", () => {
  it("includes format label and confidence", () => {
    const r = renderTextReport(detectFormat(makeWav()));
    expect(r).toContain("WAV");
    expect(r).toContain("100%");
    expect(r).toContain("audio/wav");
  });

  it("includes technical details section", () => {
    const r = renderTextReport(detectFormat(makeWav()));
    expect(r).toContain("Sample rate");
    expect(r).toContain("44100");
  });

  it("includes magic bytes hex", () => {
    const r = renderTextReport(detectFormat(makeWav()));
    expect(r).toContain("Magic bytes");
    expect(r).toContain("52 49 46 46");
  });
});

describe("audio-format-detector renderCsvReport", () => {
  it("renders header row", () => {
    const csv = renderCsvReport(detectFormat(makeWav()));
    expect(csv.startsWith("property,value")).toBe(true);
  });

  it("renders key=value rows", () => {
    const csv = renderCsvReport(detectFormat(makeWav()));
    expect(csv).toContain("format,WAV");
    expect(csv).toContain("mime_type,audio/wav");
    expect(csv).toContain("confidence_pct,100");
  });

  it("escapes commas in values", () => {
    // ALAC's typicalUse contains commas
    const r = detectFormat(makeWav());
    r.containerInfo!.typicalUse = "foo, bar, baz";
    const csv = renderCsvReport(r);
    expect(csv).toContain('"foo, bar, baz"');
  });
});

describe("audio-format-detector renderJsonReport", () => {
  it("renders valid JSON with format field", () => {
    const json = renderJsonReport(detectFormat(makeWav()));
    const parsed = JSON.parse(json);
    expect(parsed.format).toBe("wav");
    expect(parsed.confidence).toBe(100);
    expect(parsed.technical.sampleRate).toBe(44100);
  });
});

// ---- Summary stats ----

describe("audio-format-detector computeSummaryStats", () => {
  it("computes summary from result", () => {
    const s = computeSummaryStats(detectFormat(makeWav()));
    expect(s.format).toBe("WAV");
    expect(s.formatId).toBe("wav");
    expect(s.confidence).toBe(100);
    expect(s.mimeType).toBe("audio/wav");
    expect(s.extension).toBe("wav");
    expect(s.sampleRate).toBe(44100);
    expect(s.channels).toBe(2);
    expect(s.bitDepth).toBe(16);
  });

  it("handles unknown format", () => {
    const s = computeSummaryStats(detectFormat(new Uint8Array([0, 0, 0, 0])));
    expect(s.formatId).toBe("unknown");
    expect(s.confidence).toBe(0);
    expect(s.mimeType).toBeNull();
  });
});

// ---- History ----

describe("audio-format-detector history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("saves and loads", () => {
    const entry: HistoryEntry = {
      ts: 1, fileName: "x.wav", fileSize: 1000,
      format: "wav", label: "WAV", confidence: 100,
      mimeType: "audio/wav", extension: "wav",
    };
    saveHistory(entry);
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0]).toEqual(entry);
  });

  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, fileName: `f-${i}`, fileSize: i,
        format: "mp3", label: "MP3", confidence: 90,
        mimeType: "audio/mpeg", extension: "mp3",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });

  it("clears", () => {
    saveHistory({
      ts: 1, fileName: "x", fileSize: 1,
      format: "wav", label: "WAV", confidence: 100,
      mimeType: "audio/wav", extension: "wav",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---- Shareable URL ----

describe("audio-format-detector shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ format: "WAV", confidence: "100", mime: "audio/wav" });
    expect(url).toContain("format=WAV");
    expect(url).toContain("confidence=100");
    expect(url).toContain("mime=audio%2Fwav");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("parses share URL back", () => {
    const p = parseShareUrl("format=WAV&confidence=100&mime=audio%2Fwav");
    expect(p.format).toBe("WAV");
    expect(p.confidence).toBe("100");
    expect(p.mime).toBe("audio/wav");
  });

  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });

  it("strips leading #", () => {
    const p = parseShareUrl("#format=WAV");
    expect(p.format).toBe("WAV");
  });
});

// Suppress unused-import lint
export type _Unused = AudioFormatId | BitDepthId | ChannelLayoutId;
