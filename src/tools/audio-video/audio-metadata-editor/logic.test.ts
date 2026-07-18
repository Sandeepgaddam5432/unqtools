import { describe, it, expect, beforeEach } from "vitest";
import {
  FIELD_NAMES,
  FIELD_LABELS,
  FIELD_TO_ID3V2_FRAME,
  FIELD_TO_RIFF_INFO,
  FIELD_TO_VORBIS,
  VORBIS_TO_FIELD,
  ID3V1_GENRES,
  ID3V1_GENRE_COUNT,
  detectFormat,
  normalizeFieldName,
  emptyFields,
  validateField,
  validateAllFields,
  genreByIndex,
  genreIndex,
  readSynchsafe,
  writeSynchsafe,
  parseID3v2Header,
  parseID3v2,
  buildID3v2Tag,
  writeID3v2,
  parseRiffInfo,
  buildRiffInfoChunk,
  writeRiffInfo,
  parseVorbisComment,
  parseFlacVorbisComment,
  parseOggVorbisComment,
  parseAudioMetadata,
  writeAudioMetadata,
  formatLabel,
  renderTextReport,
  renderCsv,
  csvEscape,
  computeSummaryStats,
  generateFilename,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type AudioFormat,
  type FieldName,
  type Fields,
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

// ---- Test data builders ----

/** Build a minimal ID3v2.3 tag with the given fields, using UTF-8 encoding. */
function buildTestID3v2(fields: Partial<Fields>): Uint8Array {
  const frames: Uint8Array[] = [];
  for (const name of FIELD_NAMES) {
    const value = fields[name];
    if (!value) continue;
    const frameId = FIELD_TO_ID3V2_FRAME[name];
    if (name === "comment") {
      // COMM frame: encoding(1) + lang(3) + desc(null) + text
      const textBytes = new TextEncoder().encode(value);
      const body = new Uint8Array(1 + 3 + 1 + textBytes.length);
      body[0] = 3;
      body[1] = 0x65; body[2] = 0x6e; body[3] = 0x67;
      body[4] = 0;
      body.set(textBytes, 5);
      const frame = new Uint8Array(10 + body.length);
      frame[0] = 0x43; frame[1] = 0x4f; frame[2] = 0x4d; frame[3] = 0x4d; // "COMM"
      const view = new DataView(frame.buffer);
      view.setUint32(4, body.length, false);
      view.setUint16(8, 0, false);
      frame.set(body, 10);
      frames.push(frame);
    } else {
      const textBytes = new TextEncoder().encode(value);
      const body = new Uint8Array(1 + textBytes.length);
      body[0] = 3; // UTF-8
      body.set(textBytes, 1);
      const frame = new Uint8Array(10 + body.length);
      for (let i = 0; i < 4; i++) frame[i] = frameId.charCodeAt(i);
      const view = new DataView(frame.buffer);
      view.setUint32(4, body.length, false);
      view.setUint16(8, 0, false);
      frame.set(body, 10);
      frames.push(frame);
    }
  }
  let framesTotal = 0;
  for (const f of frames) framesTotal += f.length;
  const tag = new Uint8Array(10 + framesTotal);
  tag[0] = 0x49; tag[1] = 0x44; tag[2] = 0x33; // "ID3"
  tag[3] = 3; tag[4] = 0; tag[5] = 0;
  const v = framesTotal;
  tag[6] = (v >> 21) & 0x7f;
  tag[7] = (v >> 14) & 0x7f;
  tag[8] = (v >> 7) & 0x7f;
  tag[9] = v & 0x7f;
  let offset = 10;
  for (const f of frames) {
    tag.set(f, offset);
    offset += f.length;
  }
  return tag;
}

/** Build a minimal WAV file with a LIST/INFO chunk. */
function buildTestWav(fields: Partial<Fields>, withData = true): Uint8Array {
  // Sub-chunks
  const subChunks: Uint8Array[] = [];
  for (const name of FIELD_NAMES) {
    const value = fields[name];
    if (!value) continue;
    const chunkId = FIELD_TO_RIFF_INFO[name];
    const textBytes: number[] = [];
    for (let i = 0; i < value.length; i++) textBytes.push(value.charCodeAt(i) & 0xff);
    textBytes.push(0);
    if (textBytes.length % 2 !== 0) textBytes.push(0);
    const sub = new Uint8Array(8 + textBytes.length);
    for (let i = 0; i < 4; i++) sub[i] = chunkId.charCodeAt(i);
    const view = new DataView(sub.buffer);
    view.setUint32(4, textBytes.length, true);
    for (let i = 0; i < textBytes.length; i++) sub[8 + i] = textBytes[i];
    subChunks.push(sub);
  }
  let subsTotal = 0;
  for (const s of subChunks) subsTotal += s.length;
  // LIST chunk: "LIST" + size + "INFO" + sub-chunks
  const listBody = 4 + subsTotal;
  const listChunk = new Uint8Array(8 + listBody);
  listChunk[0] = 0x4c; listChunk[1] = 0x49; listChunk[2] = 0x53; listChunk[3] = 0x54; // "LIST"
  const listView = new DataView(listChunk.buffer);
  listView.setUint32(4, listBody, true);
  listChunk[8] = 0x49; listChunk[9] = 0x4e; listChunk[10] = 0x46; listChunk[11] = 0x4f; // "INFO"
  let subOffset = 12;
  for (const s of subChunks) {
    listChunk.set(s, subOffset);
    subOffset += s.length;
  }
  // fmt chunk (16 bytes body, minimal PCM header)
  const fmtChunk = new Uint8Array(24);
  fmtChunk[0] = 0x66; fmtChunk[1] = 0x6d; fmtChunk[2] = 0x74; fmtChunk[3] = 0x20; // "fmt "
  const fmtView = new DataView(fmtChunk.buffer);
  fmtView.setUint32(4, 16, true);
  fmtView.setUint16(8, 1, true); // PCM
  fmtView.setUint16(10, 1, true); // mono
  fmtView.setUint32(12, 44100, true);
  fmtView.setUint32(16, 88200, true);
  fmtView.setUint16(20, 2, true);
  fmtView.setUint16(22, 16, true);
  // data chunk (empty body)
  const dataChunk = new Uint8Array(8);
  dataChunk[0] = 0x64; dataChunk[1] = 0x61; dataChunk[2] = 0x74; dataChunk[3] = 0x61; // "data"
  // data size = 0
  // Assemble: RIFF header (12) + fmt (24) + LIST (8 + body) + data (8)
  const totalSize = 12 + 24 + listChunk.length + (withData ? 8 : 0);
  const out = new Uint8Array(totalSize);
  out[0] = 0x52; out[1] = 0x49; out[2] = 0x46; out[3] = 0x46; // "RIFF"
  const outView = new DataView(out.buffer);
  outView.setUint32(4, totalSize - 8, true);
  out[8] = 0x57; out[9] = 0x41; out[10] = 0x56; out[11] = 0x45; // "WAVE"
  out.set(fmtChunk, 12);
  out.set(listChunk, 36);
  if (withData) out.set(dataChunk, 36 + listChunk.length);
  return out;
}

/** Build a minimal FLAC file with a Vorbis comment metadata block. */
function buildTestFlac(fields: Partial<Fields>): Uint8Array {
  // Build Vorbis comment data
  const comments: Uint8Array[] = [];
  for (const name of FIELD_NAMES) {
    const value = fields[name];
    if (!value) continue;
    const key = FIELD_TO_VORBIS[name];
    const text = `${key}=${value}`;
    const textBytes = new TextEncoder().encode(text);
    const comment = new Uint8Array(4 + textBytes.length);
    const view = new DataView(comment.buffer);
    view.setUint32(0, textBytes.length, true);
    comment.set(textBytes, 4);
    comments.push(comment);
  }
  const vendorBytes = new TextEncoder().encode("test");
  const vendor = new Uint8Array(4 + vendorBytes.length);
  new DataView(vendor.buffer).setUint32(0, vendorBytes.length, true);
  vendor.set(vendorBytes, 4);
  const count = new Uint8Array(4);
  new DataView(count.buffer).setUint32(0, comments.length, true);
  let commentTotal = vendor.length + count.length;
  for (const c of comments) commentTotal += c.length;
  // FLAC metadata block header: 1 byte (type+last) + 3 bytes (size, big-endian)
  // Type 4 = VORBIS_COMMENT, mark as last (0x80 | 4 = 0x84)
  const blockHeader = new Uint8Array(4);
  blockHeader[0] = 0x84;
  blockHeader[1] = (commentTotal >> 16) & 0xff;
  blockHeader[2] = (commentTotal >> 8) & 0xff;
  blockHeader[3] = commentTotal & 0xff;
  // Assemble: "fLaC" (4) + block header (4) + vendor + count + comments
  const total = 4 + blockHeader.length + commentTotal;
  const out = new Uint8Array(total);
  out[0] = 0x66; out[1] = 0x4c; out[2] = 0x61; out[3] = 0x43; // "fLaC"
  out.set(blockHeader, 4);
  let offset = 8;
  out.set(vendor, offset); offset += vendor.length;
  out.set(count, offset); offset += count.length;
  for (const c of comments) { out.set(c, offset); offset += c.length; }
  return out;
}

/** Build a minimal OGG file with a Vorbis comment block. */
function buildTestOgg(fields: Partial<Fields>): Uint8Array {
  // Build Vorbis comment data (without the 0x03vorbis prefix)
  const comments: Uint8Array[] = [];
  for (const name of FIELD_NAMES) {
    const value = fields[name];
    if (!value) continue;
    const key = FIELD_TO_VORBIS[name];
    const text = `${key}=${value}`;
    const textBytes = new TextEncoder().encode(text);
    const comment = new Uint8Array(4 + textBytes.length);
    new DataView(comment.buffer).setUint32(0, textBytes.length, true);
    comment.set(textBytes, 4);
    comments.push(comment);
  }
  const vendorBytes = new TextEncoder().encode("test");
  const vendor = new Uint8Array(4 + vendorBytes.length);
  new DataView(vendor.buffer).setUint32(0, vendorBytes.length, true);
  vendor.set(vendorBytes, 4);
  const count = new Uint8Array(4);
  new DataView(count.buffer).setUint32(0, comments.length, true);
  // Signature: 0x03 + "vorbis"
  const sig = new Uint8Array([0x03, 0x76, 0x6f, 0x72, 0x62, 0x69, 0x73]);
  // OggS capture pattern (4 bytes) + minimal page header padding (20 bytes of zeros)
  const oggCapture = new Uint8Array([0x4f, 0x67, 0x67, 0x53]);
  const headerPadding = new Uint8Array(20);
  let payloadSize = sig.length + vendor.length + count.length;
  for (const c of comments) payloadSize += c.length;
  const out = new Uint8Array(oggCapture.length + headerPadding.length + payloadSize);
  out.set(oggCapture, 0);
  out.set(headerPadding, oggCapture.length);
  let offset = oggCapture.length + headerPadding.length;
  out.set(sig, offset); offset += sig.length;
  out.set(vendor, offset); offset += vendor.length;
  out.set(count, offset); offset += count.length;
  for (const c of comments) { out.set(c, offset); offset += c.length; }
  return out;
}

// ---- Tests ----

describe("audio-metadata-editor field constants", () => {
  it("has 8 field names", () => {
    expect(FIELD_NAMES).toHaveLength(8);
    expect(FIELD_NAMES).toContain("title");
    expect(FIELD_NAMES).toContain("copyright");
  });
  it("has 8 field labels", () => {
    expect(Object.keys(FIELD_LABELS)).toHaveLength(8);
    expect(FIELD_LABELS.title).toBe("Title");
    expect(FIELD_LABELS.copyright).toBe("Copyright");
  });
  it("maps each field to an ID3v2 frame ID", () => {
    expect(FIELD_TO_ID3V2_FRAME.title).toBe("TIT2");
    expect(FIELD_TO_ID3V2_FRAME.artist).toBe("TPE1");
    expect(FIELD_TO_ID3V2_FRAME.album).toBe("TALB");
    expect(FIELD_TO_ID3V2_FRAME.year).toBe("TYER");
    expect(FIELD_TO_ID3V2_FRAME.track).toBe("TRCK");
    expect(FIELD_TO_ID3V2_FRAME.genre).toBe("TCON");
    expect(FIELD_TO_ID3V2_FRAME.comment).toBe("COMM");
    expect(FIELD_TO_ID3V2_FRAME.copyright).toBe("TCOP");
  });
  it("maps each field to a RIFF INFO chunk ID", () => {
    expect(FIELD_TO_RIFF_INFO.title).toBe("INAM");
    expect(FIELD_TO_RIFF_INFO.artist).toBe("IART");
    expect(FIELD_TO_RIFF_INFO.album).toBe("IPRD");
    expect(FIELD_TO_RIFF_INFO.year).toBe("ICRD");
    expect(FIELD_TO_RIFF_INFO.track).toBe("ITRK");
    expect(FIELD_TO_RIFF_INFO.genre).toBe("IGNR");
    expect(FIELD_TO_RIFF_INFO.comment).toBe("ICMT");
    expect(FIELD_TO_RIFF_INFO.copyright).toBe("ICOP");
  });
  it("maps each field to a Vorbis comment name", () => {
    expect(FIELD_TO_VORBIS.title).toBe("TITLE");
    expect(FIELD_TO_VORBIS.artist).toBe("ARTIST");
    expect(FIELD_TO_VORBIS.year).toBe("DATE");
    expect(FIELD_TO_VORBIS.track).toBe("TRACKNUMBER");
  });
  it("VORBIS_TO_FIELD has reverse mappings", () => {
    expect(VORBIS_TO_FIELD.TITLE).toBe("title");
    expect(VORBIS_TO_FIELD.ARTIST).toBe("artist");
    expect(VORBIS_TO_FIELD.YEAR).toBe("year");
    expect(VORBIS_TO_FIELD.TRACK).toBe("track");
    expect(VORBIS_TO_FIELD.DESCRIPTION).toBe("comment");
  });
});

describe("audio-metadata-editor emptyFields", () => {
  it("returns an object with all 8 fields empty", () => {
    const f = emptyFields();
    expect(Object.keys(f)).toHaveLength(8);
    for (const name of FIELD_NAMES) {
      expect(f[name]).toBe("");
    }
  });
});

describe("audio-metadata-editor detectFormat (magic bytes)", () => {
  it("detects MP3 from ID3v2 header", () => {
    const bytes = new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0]);
    expect(detectFormat(bytes)).toBe("mp3");
  });
  it("detects MP3 from MPEG frame sync", () => {
    const bytes = new Uint8Array([0xFF, 0xFB, 0x90, 0x00]);
    expect(detectFormat(bytes)).toBe("mp3");
  });
  it("detects OGG from OggS marker", () => {
    const bytes = new Uint8Array([0x4F, 0x67, 0x67, 0x53, 0, 0, 0, 0]);
    expect(detectFormat(bytes)).toBe("ogg");
  });
  it("detects WAV from RIFF....WAVE", () => {
    const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
    expect(detectFormat(bytes)).toBe("wav");
  });
  it("detects FLAC from fLaC marker", () => {
    const bytes = new Uint8Array([0x66, 0x4C, 0x61, 0x43, 0, 0, 0, 0]);
    expect(detectFormat(bytes)).toBe("flac");
  });
  it("returns unknown for unrecognized bytes", () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    expect(detectFormat(bytes)).toBe("unknown");
  });
  it("returns unknown for too-short buffer", () => {
    expect(detectFormat(new Uint8Array(2))).toBe("unknown");
  });
  it("does not detect WAV without WAVE marker", () => {
    const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x00, 0x00, 0x00, 0x00]);
    expect(detectFormat(bytes)).toBe("unknown");
  });
});

describe("audio-metadata-editor normalizeFieldName", () => {
  it("normalizes canonical names case-insensitively", () => {
    expect(normalizeFieldName("title")).toBe("title");
    expect(normalizeFieldName("Title")).toBe("title");
    expect(normalizeFieldName("TITLE")).toBe("title");
    expect(normalizeFieldName("COPYRIGHT")).toBe("copyright");
  });
  it("normalizes Vorbis comment field names", () => {
    expect(normalizeFieldName("ARTIST")).toBe("artist");
    expect(normalizeFieldName("TRACKNUMBER")).toBe("track");
    expect(normalizeFieldName("DATE")).toBe("year");
  });
  it("normalizes common aliases", () => {
    expect(normalizeFieldName("BAND")).toBe("artist");
    expect(normalizeFieldName("PERFORMER")).toBe("artist");
    expect(normalizeFieldName("YEAR")).toBe("year");
    expect(normalizeFieldName("TRACKNO")).toBe("track");
  });
  it("returns null for unknown names", () => {
    expect(normalizeFieldName("FOOBAR")).toBeNull();
    expect(normalizeFieldName("")).toBeNull();
  });
  it("handles non-string input", () => {
    expect(normalizeFieldName(null as unknown as string)).toBeNull();
    expect(normalizeFieldName(undefined as unknown as string)).toBeNull();
  });
  it("trims whitespace", () => {
    expect(normalizeFieldName("  title  ")).toBe("title");
  });
});

describe("audio-metadata-editor validateField", () => {
  it("returns ok for empty value", () => {
    expect(validateField("title", "").ok).toBe(true);
  });
  it("returns ok for short string", () => {
    expect(validateField("title", "Hello").ok).toBe(true);
  });
  it("returns ok for 4-digit year", () => {
    expect(validateField("year", "2024").ok).toBe(true);
  });
  it("fails for non-4-digit year", () => {
    const r = validateField("year", "20");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("4-digit");
  });
  it("returns ok for empty year", () => {
    expect(validateField("year", "").ok).toBe(true);
  });
  it("returns ok for track as number", () => {
    expect(validateField("track", "5").ok).toBe(true);
  });
  it("returns ok for track as n/total", () => {
    expect(validateField("track", "5/12").ok).toBe(true);
  });
  it("fails for non-numeric track", () => {
    const r = validateField("track", "abc");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Track");
  });
  it("fails for value exceeding max length", () => {
    const long = "a".repeat(5000);
    const r = validateField("comment", long);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("max length");
  });
  it("handles non-string value", () => {
    const r = validateField("title", 123 as unknown as string);
    expect(r.ok).toBe(false);
  });
});

describe("audio-metadata-editor validateAllFields", () => {
  it("returns null for valid fields", () => {
    const f = emptyFields();
    f.title = "Hello";
    f.year = "2024";
    expect(validateAllFields(f)).toBeNull();
  });
  it("returns error for invalid year", () => {
    const f = emptyFields();
    f.year = "invalid";
    expect(validateAllFields(f)).toContain("4-digit");
  });
  it("returns error for invalid track", () => {
    const f = emptyFields();
    f.track = "abc";
    expect(validateAllFields(f)).toContain("Track");
  });
});

describe("audio-metadata-editor ID3v1 genre presets", () => {
  it("has 126 genres", () => {
    expect(ID3V1_GENRE_COUNT).toBe(126);
    expect(ID3V1_GENRES).toHaveLength(126);
  });
  it("includes Blues at index 0", () => {
    expect(ID3V1_GENRES[0]).toBe("Blues");
  });
  it("includes Classic Rock at index 1", () => {
    expect(ID3V1_GENRES[1]).toBe("Classic Rock");
  });
  it("includes Dance Hall at the last index", () => {
    expect(ID3V1_GENRES[125]).toBe("Dance Hall");
  });
  it("genreByIndex returns the genre at the given index", () => {
    expect(genreByIndex(0)).toBe("Blues");
    expect(genreByIndex(125)).toBe("Dance Hall");
  });
  it("genreByIndex returns null for out-of-range", () => {
    expect(genreByIndex(-1)).toBeNull();
    expect(genreByIndex(126)).toBeNull();
    expect(genreByIndex(1.5)).toBeNull();
  });
  it("genreIndex finds genre by name (case-insensitive)", () => {
    expect(genreIndex("Blues")).toBe(0);
    expect(genreIndex("blues")).toBe(0);
    expect(genreIndex("BLUES")).toBe(0);
    expect(genreIndex("Jazz")).toBe(8);
  });
  it("genreIndex returns -1 for unknown genre", () => {
    expect(genreIndex("Nonexistent")).toBe(-1);
  });
});

describe("audio-metadata-editor synchsafe integers", () => {
  it("readSynchsafe reads 4-byte synchsafe int", () => {
    const bytes = new Uint8Array([0x00, 0x00, 0x08, 0x00]);
    const view = new DataView(bytes.buffer);
    // (0 << 21) | (0 << 14) | (8 << 7) | 0 = 1024
    expect(readSynchsafe(view, 0)).toBe(1024);
  });
  it("writeSynchsafe encodes a value as 4 bytes", () => {
    const result = writeSynchsafe(1024);
    expect(result).toEqual([0, 0, 8, 0]);
  });
  it("round-trips synchsafe encoding", () => {
    for (const v of [0, 1, 100, 1024, 65536, 0x0fffffff]) {
      const bytes = writeSynchsafe(v);
      const arr = new Uint8Array(bytes);
      const view = new DataView(arr.buffer);
      expect(readSynchsafe(view, 0)).toBe(v);
    }
  });
  it("writeSynchsafe clamps to 28-bit max", () => {
    const bytes = writeSynchsafe(0x7fffffff);
    // Should clamp to 0x0fffffff
    expect(bytes[0]).toBe(0x7f);
    expect(bytes[1]).toBe(0x7f);
    expect(bytes[2]).toBe(0x7f);
    expect(bytes[3]).toBe(0x7f);
  });
});

describe("audio-metadata-editor ID3v2 header parser", () => {
  it("parses a valid ID3v2.3 header", () => {
    const bytes = new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0x08, 0x00]);
    const header = parseID3v2Header(bytes);
    expect(header).not.toBeNull();
    expect(header?.version).toBe("2.3.0");
    expect(header?.majorVersion).toBe(3);
    expect(header?.size).toBe(1024);
    expect(header?.headerSize).toBe(10);
  });
  it("returns null for non-ID3 buffer", () => {
    const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0, 0, 0, 0, 0, 0]);
    expect(parseID3v2Header(bytes)).toBeNull();
  });
  it("returns null for too-short buffer", () => {
    expect(parseID3v2Header(new Uint8Array(5))).toBeNull();
  });
});

describe("audio-metadata-editor ID3v2 parser", () => {
  it("parses a tag with title field", () => {
    const tag = buildTestID3v2({ title: "Hello World" });
    const { fields, header } = parseID3v2(tag);
    expect(fields.title).toBe("Hello World");
    expect(header?.majorVersion).toBe(3);
  });
  it("parses multiple fields", () => {
    const tag = buildTestID3v2({
      title: "Song",
      artist: "Singer",
      album: "Album",
      year: "2024",
      track: "5/12",
      genre: "Rock",
      comment: "A comment",
      copyright: "© 2024",
    });
    const { fields } = parseID3v2(tag);
    expect(fields.title).toBe("Song");
    expect(fields.artist).toBe("Singer");
    expect(fields.album).toBe("Album");
    expect(fields.year).toBe("2024");
    expect(fields.track).toBe("5/12");
    expect(fields.genre).toBe("Rock");
    expect(fields.comment).toBe("A comment");
    expect(fields.copyright).toBe("© 2024");
  });
  it("returns empty fields for buffer without ID3", () => {
    const bytes = new Uint8Array([0xFF, 0xFB, 0x90, 0x00, 0, 0, 0, 0]);
    const { fields, header, audioStartOffset } = parseID3v2(bytes);
    expect(header).toBeNull();
    expect(audioStartOffset).toBe(0);
    expect(fields.title).toBe("");
  });
  it("returns audioStartOffset past the ID3 tag", () => {
    const tag = buildTestID3v2({ title: "Test" });
    // Append fake audio data after the tag
    const audio = new Uint8Array([0xFF, 0xFB, 0x90, 0x00]);
    const full = new Uint8Array(tag.length + audio.length);
    full.set(tag, 0);
    full.set(audio, tag.length);
    const { audioStartOffset } = parseID3v2(full);
    expect(audioStartOffset).toBe(tag.length);
  });
});

describe("audio-metadata-editor ID3v2 writer", () => {
  it("builds a valid ID3v2 tag with header", () => {
    const tag = buildID3v2Tag({ ...emptyFields(), title: "Hello" }, 100);
    expect(tag[0]).toBe(0x49); // "I"
    expect(tag[1]).toBe(0x44); // "D"
    expect(tag[2]).toBe(0x33); // "3"
    expect(tag[3]).toBe(3);     // version 2.3
  });
  it("builds a tag with padding", () => {
    const tag = buildID3v2Tag({ ...emptyFields(), title: "Hi" }, 500);
    const header = parseID3v2Header(tag);
    expect(header).not.toBeNull();
    // Header(10) + tag body should equal tag.length
    expect(10 + (header?.size ?? 0)).toBe(tag.length);
  });
  it("writes and re-reads fields round-trip", () => {
    const original = buildTestID3v2({ title: "Original" });
    const newFields: Fields = {
      ...emptyFields(),
      title: "New Title",
      artist: "New Artist",
      year: "2024",
    };
    const written = writeID3v2(original, newFields);
    const { fields } = parseID3v2(written);
    expect(fields.title).toBe("New Title");
    expect(fields.artist).toBe("New Artist");
    expect(fields.year).toBe("2024");
  });
  it("writeID3v2 prepends a fresh tag and removes old one", () => {
    const original = buildTestID3v2({ title: "Old" });
    const audioData = new Uint8Array([0xFF, 0xFB, 0x90, 0x00]);
    const full = new Uint8Array(original.length + audioData.length);
    full.set(original, 0);
    full.set(audioData, original.length);
    const newFields: Fields = { ...emptyFields(), title: "New" };
    const written = writeID3v2(full, newFields);
    // The audio data should appear at the end
    expect(written[written.length - 4]).toBe(0xFF);
    expect(written[written.length - 3]).toBe(0xFB);
    // Re-parsing should give us only the new title
    const { fields } = parseID3v2(written);
    expect(fields.title).toBe("New");
  });
  it("writes empty tag for empty fields", () => {
    const tag = buildID3v2Tag(emptyFields(), 100);
    const header = parseID3v2Header(tag);
    expect(header).not.toBeNull();
    // Tag size should be just padding
    expect(header?.size).toBe(100);
  });
});

describe("audio-metadata-editor RIFF INFO parser", () => {
  it("parses a WAV with title field", () => {
    const wav = buildTestWav({ title: "Test Title" });
    const r = parseRiffInfo(wav);
    expect(r.hasList).toBe(true);
    expect(r.fields.title).toBe("Test Title");
  });
  it("parses multiple fields", () => {
    const wav = buildTestWav({
      title: "Song",
      artist: "Singer",
      album: "Album",
      year: "2024",
      track: "5",
      genre: "Rock",
      comment: "Note",
      copyright: "© 2024",
    });
    const r = parseRiffInfo(wav);
    expect(r.fields.title).toBe("Song");
    expect(r.fields.artist).toBe("Singer");
    expect(r.fields.album).toBe("Album");
    expect(r.fields.year).toBe("2024");
    expect(r.fields.track).toBe("5");
    expect(r.fields.genre).toBe("Rock");
    expect(r.fields.comment).toBe("Note");
    expect(r.fields.copyright).toBe("© 2024");
  });
  it("returns empty fields for WAV without LIST/INFO", () => {
    // Build a WAV with just fmt and data chunks
    const fmtChunk = new Uint8Array(24);
    fmtChunk[0] = 0x66; fmtChunk[1] = 0x6d; fmtChunk[2] = 0x74; fmtChunk[3] = 0x20;
    new DataView(fmtChunk.buffer).setUint32(4, 16, true);
    const wav = new Uint8Array(12 + 24 + 8);
    wav[0] = 0x52; wav[1] = 0x49; wav[2] = 0x46; wav[3] = 0x46;
    wav[8] = 0x57; wav[9] = 0x41; wav[10] = 0x56; wav[11] = 0x45;
    wav.set(fmtChunk, 12);
    const r = parseRiffInfo(wav);
    expect(r.hasList).toBe(false);
    expect(r.fields.title).toBe("");
  });
  it("returns empty fields for too-short buffer", () => {
    const r = parseRiffInfo(new Uint8Array(4));
    expect(r.hasList).toBe(false);
    expect(r.fields.title).toBe("");
  });
});

describe("audio-metadata-editor RIFF INFO writer", () => {
  it("builds a LIST/INFO chunk with fields", () => {
    const chunk = buildRiffInfoChunk({ ...emptyFields(), title: "Test", artist: "Singer" });
    // Should start with "LIST"
    expect(chunk[0]).toBe(0x4c); // L
    expect(chunk[1]).toBe(0x49); // I
    expect(chunk[2]).toBe(0x53); // S
    expect(chunk[3]).toBe(0x54); // T
    // Then "INFO"
    expect(chunk[8]).toBe(0x49); // I
    expect(chunk[9]).toBe(0x4e); // N
    expect(chunk[10]).toBe(0x46); // F
    expect(chunk[11]).toBe(0x4f); // O
  });
  it("writes and re-reads fields round-trip", () => {
    const original = buildTestWav({ title: "Old" });
    const newFields: Fields = {
      ...emptyFields(),
      title: "New Title",
      artist: "New Artist",
    };
    const written = writeRiffInfo(original, newFields);
    const r = parseRiffInfo(written);
    expect(r.fields.title).toBe("New Title");
    expect(r.fields.artist).toBe("New Artist");
  });
  it("inserts LIST chunk before data chunk when none exists", () => {
    // Build WAV without LIST chunk
    const fmtChunk = new Uint8Array(24);
    fmtChunk[0] = 0x66; fmtChunk[1] = 0x6d; fmtChunk[2] = 0x74; fmtChunk[3] = 0x20;
    new DataView(fmtChunk.buffer).setUint32(4, 16, true);
    const dataChunk = new Uint8Array(8);
    dataChunk[0] = 0x64; dataChunk[1] = 0x61; dataChunk[2] = 0x74; dataChunk[3] = 0x61;
    const wav = new Uint8Array(12 + 24 + 8);
    wav[0] = 0x52; wav[1] = 0x49; wav[2] = 0x46; wav[3] = 0x46;
    wav[8] = 0x57; wav[9] = 0x41; wav[10] = 0x56; wav[11] = 0x45;
    wav.set(fmtChunk, 12);
    wav.set(dataChunk, 36);
    const newFields: Fields = { ...emptyFields(), title: "Inserted" };
    const written = writeRiffInfo(wav, newFields);
    const r = parseRiffInfo(written);
    expect(r.hasList).toBe(true);
    expect(r.fields.title).toBe("Inserted");
  });
  it("builds empty INFO chunk for empty fields", () => {
    const chunk = buildRiffInfoChunk(emptyFields());
    // LIST + size(4) + "INFO" only
    expect(chunk.length).toBe(12);
  });
});

describe("audio-metadata-editor Vorbis comment parser", () => {
  it("parses Vorbis comment data directly", () => {
    const fields: Partial<Fields> = {
      title: "Test",
      artist: "Singer",
      album: "Album",
      year: "2024",
    };
    // Build raw Vorbis comment data
    const comments: Uint8Array[] = [];
    for (const name of FIELD_NAMES) {
      const value = fields[name];
      if (!value) continue;
      const key = FIELD_TO_VORBIS[name];
      const text = `${key}=${value}`;
      const textBytes = new TextEncoder().encode(text);
      const comment = new Uint8Array(4 + textBytes.length);
      new DataView(comment.buffer).setUint32(0, textBytes.length, true);
      comment.set(textBytes, 4);
      comments.push(comment);
    }
    const vendorBytes = new TextEncoder().encode("test");
    const vendor = new Uint8Array(4 + vendorBytes.length);
    new DataView(vendor.buffer).setUint32(0, vendorBytes.length, true);
    vendor.set(vendorBytes, 4);
    const count = new Uint8Array(4);
    new DataView(count.buffer).setUint32(0, comments.length, true);
    let total = vendor.length + count.length;
    for (const c of comments) total += c.length;
    const data = new Uint8Array(total);
    let offset = 0;
    data.set(vendor, offset); offset += vendor.length;
    data.set(count, offset); offset += count.length;
    for (const c of comments) { data.set(c, offset); offset += c.length; }
    const parsed = parseVorbisComment(data);
    expect(parsed.title).toBe("Test");
    expect(parsed.artist).toBe("Singer");
    expect(parsed.album).toBe("Album");
    expect(parsed.year).toBe("2024");
  });
  it("returns empty fields for too-short data", () => {
    expect(parseVorbisComment(new Uint8Array(4))).toEqual(emptyFields());
  });
  it("parses FLAC Vorbis comment", () => {
    const flac = buildTestFlac({
      title: "Flac Song",
      artist: "Flac Artist",
      album: "Flac Album",
    });
    const fields = parseFlacVorbisComment(flac);
    expect(fields.title).toBe("Flac Song");
    expect(fields.artist).toBe("Flac Artist");
    expect(fields.album).toBe("Flac Album");
  });
  it("returns empty fields for non-FLAC buffer", () => {
    const fields = parseFlacVorbisComment(new Uint8Array([0x00, 0x00, 0x00, 0x00]));
    expect(fields.title).toBe("");
  });
  it("parses OGG Vorbis comment", () => {
    const ogg = buildTestOgg({
      title: "Ogg Song",
      artist: "Ogg Artist",
    });
    const fields = parseOggVorbisComment(ogg);
    expect(fields.title).toBe("Ogg Song");
    expect(fields.artist).toBe("Ogg Artist");
  });
  it("returns empty fields for non-OGG buffer", () => {
    const fields = parseOggVorbisComment(new Uint8Array([0x00, 0x00, 0x00, 0x00]));
    expect(fields.title).toBe("");
  });
});

describe("audio-metadata-editor top-level parseAudioMetadata", () => {
  it("parses MP3 file", () => {
    const tag = buildTestID3v2({ title: "MP3 Title", artist: "MP3 Artist" });
    const meta = parseAudioMetadata(tag);
    expect(meta.format).toBe("mp3");
    expect(meta.readOnly).toBe(false);
    expect(meta.fields.title).toBe("MP3 Title");
    expect(meta.fields.artist).toBe("MP3 Artist");
  });
  it("parses WAV file", () => {
    const wav = buildTestWav({ title: "WAV Title" });
    const meta = parseAudioMetadata(wav);
    expect(meta.format).toBe("wav");
    expect(meta.readOnly).toBe(false);
    expect(meta.fields.title).toBe("WAV Title");
  });
  it("parses FLAC file (read-only)", () => {
    const flac = buildTestFlac({ title: "FLAC Title" });
    const meta = parseAudioMetadata(flac);
    expect(meta.format).toBe("flac");
    expect(meta.readOnly).toBe(true);
    expect(meta.fields.title).toBe("FLAC Title");
  });
  it("parses OGG file (read-only)", () => {
    const ogg = buildTestOgg({ title: "OGG Title" });
    const meta = parseAudioMetadata(ogg);
    expect(meta.format).toBe("ogg");
    expect(meta.readOnly).toBe(true);
    expect(meta.fields.title).toBe("OGG Title");
  });
  it("returns unknown for unrecognized bytes", () => {
    const meta = parseAudioMetadata(new Uint8Array([0, 0, 0, 0]));
    expect(meta.format).toBe("unknown");
    expect(meta.readOnly).toBe(true);
  });
  it("stores original size", () => {
    const tag = buildTestID3v2({ title: "Test" });
    const meta = parseAudioMetadata(tag);
    expect(meta.originalSizeBytes).toBe(tag.length);
  });
});

describe("audio-metadata-editor writeAudioMetadata", () => {
  it("writes MP3 metadata", () => {
    const tag = buildTestID3v2({ title: "Old" });
    const newFields: Fields = { ...emptyFields(), title: "New" };
    const written = writeAudioMetadata(tag, "mp3", newFields);
    const meta = parseAudioMetadata(written);
    expect(meta.fields.title).toBe("New");
  });
  it("writes WAV metadata", () => {
    const wav = buildTestWav({ title: "Old" });
    const newFields: Fields = { ...emptyFields(), title: "New" };
    const written = writeAudioMetadata(wav, "wav", newFields);
    const meta = parseAudioMetadata(written);
    expect(meta.fields.title).toBe("New");
  });
  it("throws for OGG (read-only)", () => {
    const ogg = buildTestOgg({ title: "Old" });
    expect(() => writeAudioMetadata(ogg, "ogg", emptyFields())).toThrow();
  });
  it("throws for FLAC (read-only)", () => {
    const flac = buildTestFlac({ title: "Old" });
    expect(() => writeAudioMetadata(flac, "flac", emptyFields())).toThrow();
  });
  it("throws for unknown format", () => {
    expect(() => writeAudioMetadata(new Uint8Array(10), "unknown", emptyFields())).toThrow();
  });
});

describe("audio-metadata-editor formatLabel", () => {
  it("returns label for each format", () => {
    expect(formatLabel("mp3")).toContain("MP3");
    expect(formatLabel("wav")).toContain("WAV");
    expect(formatLabel("ogg")).toContain("OGG");
    expect(formatLabel("flac")).toContain("FLAC");
    expect(formatLabel("unknown")).toBe("Unknown");
  });
  it("indicates read-only for OGG and FLAC", () => {
    expect(formatLabel("ogg")).toContain("read-only");
    expect(formatLabel("flac")).toContain("read-only");
  });
});

describe("audio-metadata-editor renderTextReport", () => {
  it("renders a non-empty report", () => {
    const meta: { format: AudioFormat; fields: Fields; readOnly: boolean; originalSizeBytes: number } = {
      format: "mp3",
      fields: { ...emptyFields(), title: "Song", artist: "Singer" },
      readOnly: false,
      originalSizeBytes: 1000,
    };
    const report = renderTextReport(meta);
    expect(report).toContain("Audio Metadata Report");
    expect(report).toContain("MP3");
    expect(report).toContain("Title");
    expect(report).toContain("Song");
  });
  it("includes total and modified field counts", () => {
    const meta: { format: AudioFormat; fields: Fields; readOnly: boolean; originalSizeBytes: number } = {
      format: "wav",
      fields: { ...emptyFields(), title: "New", artist: "Artist" },
      readOnly: false,
      originalSizeBytes: 2000,
    };
    const original: Fields = { ...emptyFields(), title: "Old", artist: "Artist" };
    const report = renderTextReport(meta, original);
    expect(report).toContain("Total fields: 2");
    expect(report).toContain("Modified fields: 1");
  });
  it("marks modified fields with *", () => {
    const meta: { format: AudioFormat; fields: Fields; readOnly: boolean; originalSizeBytes: number } = {
      format: "mp3",
      fields: { ...emptyFields(), title: "New" },
      readOnly: false,
      originalSizeBytes: 1000,
    };
    const original: Fields = { ...emptyFields(), title: "Old" };
    const report = renderTextReport(meta, original);
    expect(report).toContain("* Title");
  });
});

describe("audio-metadata-editor renderCsv & csvEscape", () => {
  it("csvEscape returns string as-is if no special chars", () => {
    expect(csvEscape("hello")).toBe("hello");
  });
  it("csvEscape quotes strings with commas", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
  });
  it("csvEscape quotes strings with quotes and doubles them", () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });
  it("csvEscape quotes strings with newlines", () => {
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });
  it("csvEscape handles non-string input", () => {
    expect(csvEscape(null as unknown as string)).toBe("");
  });
  it("renders CSV with header row", () => {
    const meta: { format: AudioFormat; fields: Fields; readOnly: boolean; originalSizeBytes: number } = {
      format: "mp3",
      fields: { ...emptyFields(), title: "Song", artist: "Singer" },
      readOnly: false,
      originalSizeBytes: 1000,
    };
    const csv = renderCsv(meta);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("field,value");
    expect(lines[1]).toBe("Title,Song");
    expect(lines[2]).toBe("Artist,Singer");
  });
  it("renders CSV with 9 lines (header + 8 fields)", () => {
    const meta: { format: AudioFormat; fields: Fields; readOnly: boolean; originalSizeBytes: number } = {
      format: "mp3",
      fields: emptyFields(),
      readOnly: false,
      originalSizeBytes: 1000,
    };
    const csv = renderCsv(meta);
    expect(csv.split("\n")).toHaveLength(9);
  });
  it("escapes commas in CSV output", () => {
    const meta: { format: AudioFormat; fields: Fields; readOnly: boolean; originalSizeBytes: number } = {
      format: "mp3",
      fields: { ...emptyFields(), comment: "Hello, world" },
      readOnly: false,
      originalSizeBytes: 1000,
    };
    const csv = renderCsv(meta);
    expect(csv).toContain('"Hello, world"');
  });
});

describe("audio-metadata-editor computeSummaryStats", () => {
  it("computes total fields", () => {
    const meta: { format: AudioFormat; fields: Fields; readOnly: boolean; originalSizeBytes: number } = {
      format: "mp3",
      fields: { ...emptyFields(), title: "T", artist: "A", year: "2024" },
      readOnly: false,
      originalSizeBytes: 1000,
    };
    const stats = computeSummaryStats(meta, null, 2000);
    expect(stats.totalFields).toBe(3);
    expect(stats.modifiedFields).toBe(0); // no original provided
    expect(stats.outputSizeBytes).toBe(2000);
    expect(stats.format).toBe("mp3");
  });
  it("computes modified fields", () => {
    const meta: { format: AudioFormat; fields: Fields; readOnly: boolean; originalSizeBytes: number } = {
      format: "mp3",
      fields: { ...emptyFields(), title: "New", artist: "Same" },
      readOnly: false,
      originalSizeBytes: 1000,
    };
    const original: Fields = { ...emptyFields(), title: "Old", artist: "Same" };
    const stats = computeSummaryStats(meta, original, 2000);
    expect(stats.modifiedFields).toBe(1);
  });
  it("counts added fields as modified", () => {
    const meta: { format: AudioFormat; fields: Fields; readOnly: boolean; originalSizeBytes: number } = {
      format: "mp3",
      fields: { ...emptyFields(), title: "New" },
      readOnly: false,
      originalSizeBytes: 1000,
    };
    const original: Fields = emptyFields();
    const stats = computeSummaryStats(meta, original, 2000);
    expect(stats.modifiedFields).toBe(1);
  });
  it("counts removed fields as modified", () => {
    const meta: { format: AudioFormat; fields: Fields; readOnly: boolean; originalSizeBytes: number } = {
      format: "mp3",
      fields: emptyFields(),
      readOnly: false,
      originalSizeBytes: 1000,
    };
    const original: Fields = { ...emptyFields(), title: "Old" };
    const stats = computeSummaryStats(meta, original, 2000);
    expect(stats.modifiedFields).toBe(1);
  });
  it("preserves readOnly flag", () => {
    const meta: { format: AudioFormat; fields: Fields; readOnly: boolean; originalSizeBytes: number } = {
      format: "flac",
      fields: emptyFields(),
      readOnly: true,
      originalSizeBytes: 1000,
    };
    const stats = computeSummaryStats(meta, null, 1000);
    expect(stats.readOnly).toBe(true);
  });
});

describe("audio-metadata-editor generateFilename", () => {
  it("generates filename with original base + format ext", () => {
    const date = new Date(2024, 0, 5, 14, 23, 7);
    const name = generateFilename("song.mp3", "mp3", date);
    expect(name).toBe("song-tagged-20240105-142307.mp3");
  });
  it("uses wav extension for wav format", () => {
    const date = new Date(2024, 0, 1, 0, 0, 0);
    const name = generateFilename("audio.wav", "wav", date);
    expect(name).toBe("audio-tagged-20240101-000000.wav");
  });
  it("uses ogg extension for ogg format", () => {
    const date = new Date(2024, 0, 1, 0, 0, 0);
    const name = generateFilename("track.ogg", "ogg", date);
    expect(name).toBe("track-tagged-20240101-000000.ogg");
  });
  it("uses flac extension for flac format", () => {
    const date = new Date(2024, 0, 1, 0, 0, 0);
    const name = generateFilename("music.flac", "flac", date);
    expect(name).toBe("music-tagged-20240101-000000.flac");
  });
  it("handles files with no extension", () => {
    const date = new Date(2024, 0, 1, 0, 0, 0);
    const name = generateFilename("noext", "mp3", date);
    expect(name).toBe("noext-tagged-20240101-000000.mp3");
  });
  it("handles empty original name", () => {
    const date = new Date(2024, 0, 1, 0, 0, 0);
    const name = generateFilename("", "mp3", date);
    expect(name).toBe("audio-tagged-20240101-000000.mp3");
  });
});

describe("audio-metadata-editor history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    const entry: HistoryEntry = {
      ts: 1,
      originalName: "song.mp3",
      format: "mp3",
      fields: { ...emptyFields(), title: "Song" },
      totalFields: 1,
      modifiedFields: 1,
      outputSizeBytes: 5000,
      filename: "song-tagged.mp3",
    };
    saveHistory(entry);
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0]).toEqual(entry);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        originalName: `f-${i}.mp3`,
        format: "mp3",
        fields: emptyFields(),
        totalFields: 0,
        modifiedFields: 0,
        outputSizeBytes: 1000,
        filename: `f-${i}.mp3`,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, originalName: "x", format: "mp3", fields: emptyFields(),
      totalFields: 0, modifiedFields: 0, outputSizeBytes: 1, filename: "x.mp3",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("orders most-recent first", () => {
    saveHistory({
      ts: 1, originalName: "a", format: "mp3", fields: emptyFields(),
      totalFields: 0, modifiedFields: 0, outputSizeBytes: 1, filename: "a.mp3",
    });
    saveHistory({
      ts: 2, originalName: "b", format: "wav", fields: emptyFields(),
      totalFields: 0, modifiedFields: 0, outputSizeBytes: 1, filename: "b.wav",
    });
    const h = loadHistory();
    expect(h[0].ts).toBe(2);
    expect(h[1].ts).toBe(1);
  });
});

describe("audio-metadata-editor shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      format: "mp3",
      title: "Song",
      artist: "Singer",
      album: "Album",
      year: "2024",
      track: "5",
      genre: "Rock",
    });
    expect(url).toContain("format=mp3");
    expect(url).toContain("title=Song");
    expect(url).toContain("artist=Singer");
    expect(url).toContain("year=2024");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("omits empty fields from URL", () => {
    const url = buildShareUrl({
      format: "mp3",
      title: "Song",
      artist: "",
      album: "",
      year: "",
      track: "",
      genre: "",
    });
    expect(url).toContain("title=Song");
    expect(url).not.toContain("artist=");
    expect(url).not.toContain("album=");
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("format=mp3&title=Song&artist=Singer&year=2024");
    expect(p.format).toBe("mp3");
    expect(p.title).toBe("Song");
    expect(p.artist).toBe("Singer");
    expect(p.year).toBe("2024");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("ignores unknown format values", () => {
    const p = parseShareUrl("format=invalid&title=Song");
    expect(p.format).toBeUndefined();
    expect(p.title).toBe("Song");
  });
  it("strips leading # from hash", () => {
    const p = parseShareUrl("#format=wav&title=Test");
    expect(p.format).toBe("wav");
    expect(p.title).toBe("Test");
  });
  it("handles missing fields gracefully", () => {
    const p = parseShareUrl("format=mp3");
    expect(p.format).toBe("mp3");
    expect(p.title).toBeUndefined();
  });
});

describe("audio-metadata-editor integration (end-to-end)", () => {
  it("MP3: write fields, re-parse, get same fields back", () => {
    const original = buildTestID3v2({ title: "Old Title" });
    const newFields: Fields = {
      title: "New Title",
      artist: "New Artist",
      album: "New Album",
      year: "2024",
      track: "3/10",
      genre: "Jazz",
      comment: "Best song ever",
      copyright: "© 2024",
    };
    const written = writeAudioMetadata(original, "mp3", newFields);
    const meta = parseAudioMetadata(written);
    expect(meta.format).toBe("mp3");
    expect(meta.fields).toEqual(newFields);
  });
  it("WAV: write fields, re-parse, get same fields back", () => {
    const original = buildTestWav({ title: "Old Title" });
    const newFields: Fields = {
      title: "New Title",
      artist: "New Artist",
      album: "New Album",
      year: "2024",
      track: "3",
      genre: "Rock",
      comment: "A comment",
      copyright: "© 2024",
    };
    const written = writeAudioMetadata(original, "wav", newFields);
    const meta = parseAudioMetadata(written);
    expect(meta.format).toBe("wav");
    expect(meta.fields).toEqual(newFields);
  });
  it("FLAC: parse only (read-only)", () => {
    const flac = buildTestFlac({
      title: "FLAC Title",
      artist: "FLAC Artist",
      album: "FLAC Album",
    });
    const meta = parseAudioMetadata(flac);
    expect(meta.readOnly).toBe(true);
    expect(meta.fields.title).toBe("FLAC Title");
  });
});

// Suppress unused-import lint
export type _Unused = AudioFormat | FieldName;
