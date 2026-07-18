/**
 * Audio Metadata Editor — pure logic.
 *
 * Pure helpers only — no DOM, no AudioContext. The actual file reading and
 * writing happens in ui.tsx via FileReader / Blob. This module contains:
 * format detector (magic bytes), ID3v2 parser/writer (MP3), RIFF INFO
 * parser/writer (WAV), Vorbis comment parser (OGG/FLAC, read-only),
 * case-insensitive field normalizer, field validator, 126 ID3v1 genre
 * presets, text + CSV report renderers, filename generator, history
 * (localStorage), shareable URL, and summary stats.
 */

// ---- Types ----

export type AudioFormat = "mp3" | "ogg" | "wav" | "flac" | "unknown";

export type FieldName =
  | "title"
  | "artist"
  | "album"
  | "year"
  | "track"
  | "genre"
  | "comment"
  | "copyright";

export const FIELD_NAMES: FieldName[] = [
  "title", "artist", "album", "year", "track", "genre", "comment", "copyright",
];

export const FIELD_LABELS: Record<FieldName, string> = {
  title: "Title",
  artist: "Artist",
  album: "Album",
  year: "Year",
  track: "Track",
  genre: "Genre",
  comment: "Comment",
  copyright: "Copyright",
};

/** Mapping of normalized field name → ID3v2 frame ID. */
export const FIELD_TO_ID3V2_FRAME: Record<FieldName, string> = {
  title: "TIT2",
  artist: "TPE1",
  album: "TALB",
  year: "TYER",
  track: "TRCK",
  genre: "TCON",
  comment: "COMM",
  copyright: "TCOP",
};

/** Mapping of normalized field name → RIFF INFO chunk ID. */
export const FIELD_TO_RIFF_INFO: Record<FieldName, string> = {
  title: "INAM",
  artist: "IART",
  album: "IPRD",
  year: "ICRD",
  track: "ITRK",
  genre: "IGNR",
  comment: "ICMT",
  copyright: "ICOP",
};

/** Mapping of normalized field name → Vorbis comment field name. */
export const FIELD_TO_VORBIS: Record<FieldName, string> = {
  title: "TITLE",
  artist: "ARTIST",
  album: "ALBUM",
  year: "DATE",
  track: "TRACKNUMBER",
  genre: "GENRE",
  comment: "COMMENT",
  copyright: "COPYRIGHT",
};

/** Reverse mapping for Vorbis comment field name → normalized. */
export const VORBIS_TO_FIELD: Record<string, FieldName> = {
  TITLE: "title",
  ARTIST: "artist",
  ALBUM: "album",
  DATE: "year",
  YEAR: "year",
  TRACKNUMBER: "track",
  TRACK: "track",
  GENRE: "genre",
  COMMENT: "comment",
  DESCRIPTION: "comment",
  COPYRIGHT: "copyright",
};

export type Fields = Record<FieldName, string>;

export interface AudioMetadata {
  format: AudioFormat;
  fields: Fields;
  readOnly: boolean;
  originalSizeBytes: number;
}

// ---- Format detector (magic bytes) ----

/**
 * Detect the audio format from the first few bytes of a file.
 *   MP3:  "ID3" (ID3v2 header) or 0xFF 0xFB / 0xFF 0xF3 / 0xFF 0xF2 (MPEG frame)
 *   OGG:  "OggS"
 *   WAV:  "RIFF" .... "WAVE"
 *   FLAC: "fLaC"
 */
export function detectFormat(bytes: Uint8Array): AudioFormat {
  if (bytes.length < 4) return "unknown";
  // ID3v2
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return "mp3";
  // MPEG frame sync (0xFF Ex/Fx)
  if (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) return "mp3";
  // OggS
  if (
    bytes[0] === 0x4F && bytes[1] === 0x67 &&
    bytes[2] === 0x67 && bytes[3] === 0x53
  ) return "ogg";
  // RIFF ... WAVE
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 &&
    bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 && bytes[9] === 0x41 &&
    bytes[10] === 0x56 && bytes[11] === 0x45
  ) return "wav";
  // fLaC
  if (
    bytes[0] === 0x66 && bytes[1] === 0x4C &&
    bytes[2] === 0x61 && bytes[3] === 0x43
  ) return "flac";
  return "unknown";
}

// ---- Field name normalizer (case-insensitive) ----

/**
 * Normalize a field name to one of the canonical FieldName values.
 * Handles case-insensitive matching: "Title" == "TITLE" == "title".
 * Returns null if the name doesn't map to any known field.
 */
export function normalizeFieldName(input: string): FieldName | null {
  if (typeof input !== "string") return null;
  const upper = input.trim().toUpperCase();
  // Direct canonical match
  for (const f of FIELD_NAMES) {
    if (f.toUpperCase() === upper) return f;
  }
  // Vorbis comment alias
  if (upper in VORBIS_TO_FIELD) return VORBIS_TO_FIELD[upper];
  // Common aliases
  const aliases: Record<string, FieldName> = {
    NAME: "title",
    SONG: "title",
    BAND: "artist",
    PERFORMER: "artist",
    CREATOR: "artist",
    ALBUMARTIST: "artist",
    DATE: "year",
    YEAR: "year",
    RELEASEYEAR: "year",
    TRACKNO: "track",
    TRACKNUMBER: "track",
    COMMENT: "comment",
    DESCRIPTION: "comment",
    COPYRIGHT: "copyright",
    RIGHTS: "copyright",
  };
  if (upper in aliases) return aliases[upper];
  return null;
}

/** Build an empty Fields object with all 8 fields set to "". */
export function emptyFields(): Fields {
  return {
    title: "", artist: "", album: "", year: "",
    track: "", genre: "", comment: "", copyright: "",
  };
}

// ---- Field validator ----

export interface FieldValidation {
  ok: boolean;
  error?: string;
}

/** Maximum byte length for a single field value (conservative). */
export const MAX_FIELD_LENGTH = 4096;

/**
 * Validate a field value. Returns ok=false if the value is too long or
 * contains characters that can't be safely encoded (lone surrogates).
 */
export function validateField(name: FieldName, value: string): FieldValidation {
  if (typeof value !== "string") return { ok: false, error: "Value must be a string." };
  // Length check (UTF-8 byte length)
  let byteLen: number;
  try {
    byteLen = new TextEncoder().encode(value).length;
  } catch {
    return { ok: false, error: "Value contains invalid characters." };
  }
  if (byteLen > MAX_FIELD_LENGTH) {
    return { ok: false, error: `Field "${FIELD_LABELS[name]}" exceeds max length of ${MAX_FIELD_LENGTH} bytes (got ${byteLen}).` };
  }
  // Year must be numeric if non-empty
  if (name === "year" && value !== "" && !/^\d{4}$/.test(value)) {
    return { ok: false, error: `Year must be a 4-digit number (got "${value}").` };
  }
  // Track must be numeric or "n/total" if non-empty
  if (name === "track" && value !== "" && !/^\d{1,3}(?:\/\d{1,3})?$/.test(value)) {
    return { ok: false, error: `Track must be a number or "n/total" (got "${value}").` };
  }
  return { ok: true };
}

/** Validate all fields at once. Returns the first error or null. */
export function validateAllFields(fields: Fields): string | null {
  for (const name of FIELD_NAMES) {
    const v = validateField(name, fields[name]);
    if (!v.ok) return v.error ?? "Invalid field";
  }
  return null;
}

// ---- ID3v1 genre presets (126 standard genres) ----

/**
 * The 126 standard ID3v1 predefined genres (index 0–125). Stored as a
 * tuple to preserve order. The first genre is "Blues", the last is "Dance Hall".
 * This matches the ID3v1.1 / Winamp extension list of exactly 126 genres.
 */
export const ID3V1_GENRES: readonly string[] = [
  "Blues", "Classic Rock", "Country", "Dance", "Disco", "Funk", "Grunge",
  "Hip-Hop", "Jazz", "Metal", "New Age", "Oldies", "Other", "Pop", "R&B",
  "Rap", "Reggae", "Rock", "Techno", "Industrial", "Alternative", "Ska",
  "Death Metal", "Pranks", "Soundtrack", "Euro-Techno", "Ambient",
  "Trip-Hop", "Vocal", "Jazz+Funk", "Fusion", "Trance", "Classical",
  "Instrumental", "Acid", "House", "Game", "Sound Clip", "Gospel",
  "Noise", "AlternRock", "Bass", "Soul", "Punk", "Space", "Meditative",
  "Instrumental Pop", "Instrumental Rock", "Ethnic", "Gothic", "Darkwave",
  "Techno-Industrial", "Electronic", "Pop-Folk", "Eurodance", "Dream",
  "Southern Rock", "Comedy", "Cult", "Gangsta", "Top 40", "Christian Rap",
  "Pop/Funk", "Jungle", "Native American", "Cabaret", "New Wave",
  "Psychadelic", "Rave", "Showtunes", "Trailer", "Lo-Fi", "Tribal",
  "Acid Punk", "Acid Jazz", "Polka", "Retro", "Musical", "Rock & Roll",
  "Hard Rock", "Folk", "Folk-Rock", "National Folk", "Swing",
  "Fast Fusion", "Bebob", "Latin", "Revival", "Celtic", "Bluegrass",
  "Avantgarde", "Gothic Rock", "Progressive Rock", "Psychedelic Rock",
  "Symphonic Rock", "Slow Rock", "Big Band", "Chorus", "Easy Listening",
  "Acoustic", "Humour", "Speech", "Chanson", "Opera", "Chamber Music",
  "Sonata", "Symphony", "Booty Bass", "Primus", "Porn Groove", "Satire",
  "Slow Jam", "Club", "Tango", "Samba", "Folklore", "Ballad",
  "Power Ballad", "Rhythmic Soul", "Freestyle", "Duet", "Punk Rock",
  "Drum Solo", "A Capella", "Euro-House", "Dance Hall",
];

/** Count of standard ID3v1 genres. */
export const ID3V1_GENRE_COUNT = ID3V1_GENRES.length;

/**
 * Look up a genre by index. Returns null for out-of-range.
 */
export function genreByIndex(index: number): string | null {
  if (!Number.isInteger(index) || index < 0 || index >= ID3V1_GENRES.length) return null;
  return ID3V1_GENRES[index];
}

/** Find the index of a genre by name (case-insensitive). Returns -1 if not found. */
export function genreIndex(name: string): number {
  if (typeof name !== "string") return -1;
  const lower = name.trim().toLowerCase();
  for (let i = 0; i < ID3V1_GENRES.length; i++) {
    if (ID3V1_GENRES[i].toLowerCase() === lower) return i;
  }
  return -1;
}

// ---- Synchsafe integer helpers (ID3v2) ----

/**
 * Read a 4-byte synchsafe integer from a DataView at the given offset.
 * Each byte uses only 7 bits (MSB is always 0).
 */
export function readSynchsafe(view: DataView, offset: number): number {
  return (
    ((view.getUint8(offset) & 0x7f) << 21) |
    ((view.getUint8(offset + 1) & 0x7f) << 14) |
    ((view.getUint8(offset + 2) & 0x7f) << 7) |
    (view.getUint8(offset + 3) & 0x7f)
  );
}

/** Encode a non-negative integer as a 4-byte synchsafe integer. */
export function writeSynchsafe(value: number): [number, number, number, number] {
  const v = Math.max(0, Math.min(0x0fffffff, Math.floor(value)));
  return [
    (v >> 21) & 0x7f,
    (v >> 14) & 0x7f,
    (v >> 7) & 0x7f,
    v & 0x7f,
  ];
}

// ---- ID3v2 parser ----

export interface ID3v2Header {
  version: string;       // e.g. "2.3.0"
  majorVersion: number;  // 3 or 4
  flags: number;
  size: number;          // size of tag (excluding 10-byte header)
  headerSize: number;    // always 10
}

/**
 * Parse the ID3v2 header (first 10 bytes of an MP3 file).
 * Returns null if the buffer doesn't start with "ID3".
 */
export function parseID3v2Header(bytes: Uint8Array): ID3v2Header | null {
  if (bytes.length < 10) return null;
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const major = view.getUint8(3);
  const revision = view.getUint8(4);
  const flags = view.getUint8(5);
  const size = readSynchsafe(view, 6);
  return {
    version: `2.${major}.${revision}`,
    majorVersion: major,
    flags,
    size,
    headerSize: 10,
  };
}

/** Decode a text frame's payload to a JS string, given the encoding byte. */
function decodeTextFrame(data: Uint8Array): string {
  if (data.length === 0) return "";
  const encoding = data[0];
  const body = data.subarray(1);
  try {
    if (encoding === 0) {
      // ISO-8859-1
      let s = "";
      for (let i = 0; i < body.length; i++) s += String.fromCharCode(body[i]);
      return s.replace(/\0+$/, "");
    }
    if (encoding === 1) {
      // UTF-16 with BOM
      if (body.length < 2) return "";
      const bom = (body[0] << 8) | body[1];
      const littleEndian = bom === 0xfffe;
      const text = body.subarray(2); // skip BOM
      const view = new DataView(text.buffer, text.byteOffset, text.byteLength);
      let s = "";
      for (let i = 0; i + 1 < text.length; i += 2) {
        const code = view.getUint16(i, littleEndian);
        if (code === 0) break;
        s += String.fromCharCode(code);
      }
      return s;
    }
    if (encoding === 2) {
      // UTF-16BE (no BOM)
      const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
      let s = "";
      for (let i = 0; i + 1 < body.length; i += 2) {
        const code = view.getUint16(i, false);
        if (code === 0) break;
        s += String.fromCharCode(code);
      }
      return s;
    }
    if (encoding === 3) {
      // UTF-8
      return new TextDecoder("utf-8").decode(body).replace(/\0+$/, "");
    }
  } catch {
    return "";
  }
  return "";
}

/** Encode a JS string to ISO-8859-1 bytes (encoding byte 0). */
function encodeTextFrameISO(value: string): Uint8Array {
  const out = new Uint8Array(value.length + 1);
  out[0] = 0; // ISO-8859-1
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    out[i + 1] = c & 0xff;
  }
  return out;
}

/**
 * Parse the COMM (comment) frame.
 * COMM frame layout: encoding (1) + language (3) + short description (null-term) + text.
 */
function parseCommFrame(data: Uint8Array): string {
  if (data.length === 0) return "";
  const encoding = data[0];
  // Language is 3 bytes (skip)
  if (data.length < 4) return "";
  // Find end of short description (null terminator)
  let descEnd = 4;
  if (encoding === 0 || encoding === 3) {
    // 1-byte null
    while (descEnd < data.length && data[descEnd] !== 0) descEnd++;
    descEnd++; // skip null
  } else {
    // 2-byte null
    while (descEnd + 1 < data.length && !(data[descEnd] === 0 && data[descEnd + 1] === 0)) descEnd += 2;
    descEnd += 2;
  }
  if (descEnd >= data.length) return "";
  const textData = data.subarray(descEnd);
  return decodeTextFrameTextOnly(textData, encoding);
}

/** Decode text given an explicit encoding (no encoding byte prefix). */
function decodeTextFrameTextOnly(data: Uint8Array, encoding: number): string {
  if (data.length === 0) return "";
  try {
    if (encoding === 0) {
      let s = "";
      for (let i = 0; i < data.length; i++) s += String.fromCharCode(data[i]);
      return s.replace(/\0+$/, "");
    }
    if (encoding === 1) {
      if (data.length < 2) return "";
      const bom = (data[0] << 8) | data[1];
      const littleEndian = bom === 0xfffe;
      const text = data.subarray(2);
      const view = new DataView(text.buffer, text.byteOffset, text.byteLength);
      let s = "";
      for (let i = 0; i + 1 < text.length; i += 2) {
        const code = view.getUint16(i, littleEndian);
        if (code === 0) break;
        s += String.fromCharCode(code);
      }
      return s;
    }
    if (encoding === 2) {
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      let s = "";
      for (let i = 0; i + 1 < data.length; i += 2) {
        const code = view.getUint16(i, false);
        if (code === 0) break;
        s += String.fromCharCode(code);
      }
      return s;
    }
    if (encoding === 3) {
      return new TextDecoder("utf-8").decode(data).replace(/\0+$/, "");
    }
  } catch {
    return "";
  }
  return "";
}

/** Reverse-lookup: ID3v2 frame ID → normalized field name. */
export function id3v2FrameToField(frameId: string): FieldName | null {
  for (const f of FIELD_NAMES) {
    if (FIELD_TO_ID3V2_FRAME[f] === frameId) return f;
  }
  return null;
}

/**
 * Parse all known ID3v2 frames from an MP3 file's bytes.
 * Returns the parsed fields and the offset where the audio data starts
 * (after the ID3v2 tag, if any).
 */
export function parseID3v2(bytes: Uint8Array): {
  fields: Fields;
  header: ID3v2Header | null;
  audioStartOffset: number;
} {
  const fields = emptyFields();
  const header = parseID3v2Header(bytes);
  if (!header) {
    return { fields, header: null, audioStartOffset: 0 };
  }
  const tagSize = header.size;
  const tagEnd = header.headerSize + tagSize;
  if (tagEnd > bytes.length) {
    return { fields, header, audioStartOffset: bytes.length };
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // Walk frames starting at offset 10
  let offset = header.headerSize;
  while (offset + 10 <= tagEnd) {
    // Read frame ID (4 bytes)
    const id0 = view.getUint8(offset);
    const id1 = view.getUint8(offset + 1);
    const id2 = view.getUint8(offset + 2);
    const id3 = view.getUint8(offset + 3);
    // Stop on padding (all zeros)
    if (id0 === 0 && id1 === 0 && id2 === 0 && id3 === 0) break;
    const frameId = String.fromCharCode(id0, id1, id2, id3);
    // Frame size: 4 bytes. In ID3v2.3, it's a regular 32-bit int.
    // In ID3v2.4, it's synchsafe.
    let frameSize: number;
    if (header.majorVersion >= 4) {
      frameSize = readSynchsafe(view, offset + 4);
    } else {
      frameSize = view.getUint32(offset + 4, false);
    }
    // frame flags (2 bytes) — ignored
    if (frameSize <= 0 || offset + 10 + frameSize > tagEnd) break;
    const frameData = bytes.subarray(offset + 10, offset + 10 + frameSize);
    // Map frame ID to field
    const fieldName = id3v2FrameToField(frameId);
    if (fieldName) {
      if (frameId === "COMM") {
        const text = parseCommFrame(frameData);
        if (text) fields[fieldName] = text;
      } else {
        const text = decodeTextFrame(frameData);
        if (text) fields[fieldName] = text;
      }
    }
    offset += 10 + frameSize;
  }
  return { fields, header, audioStartOffset: tagEnd };
}

// ---- ID3v2 writer ----

/** Encode a JS string to UTF-8 bytes with encoding byte prefix (encoding = 3). */
function encodeTextFrameUTF8(value: string): Uint8Array {
  const body = new TextEncoder().encode(value);
  const out = new Uint8Array(body.length + 1);
  out[0] = 3; // UTF-8
  out.set(body, 1);
  return out;
}

/**
 * Build a single ID3v2 frame for a text field.
 * Layout: frameId (4) + size (4) + flags (2) + frameData.
 * Uses UTF-8 encoding (encoding byte = 3).
 */
function buildTextFrame(frameId: string, value: string): Uint8Array {
  const body = encodeTextFrameUTF8(value);
  const frame = new Uint8Array(10 + body.length);
  // Frame ID
  for (let i = 0; i < 4; i++) frame[i] = frameId.charCodeAt(i);
  // Frame size (regular 32-bit, big-endian)
  const view = new DataView(frame.buffer);
  view.setUint32(4, body.length, false);
  // Flags = 0
  view.setUint16(8, 0, false);
  // Body
  frame.set(body, 10);
  return frame;
}

/**
 * Build a COMM (comment) frame.
 * Layout: "COMM" + size + flags + encoding(1) + language(3) + description(null-term) + text.
 */
function buildCommFrame(value: string): Uint8Array {
  const textBytes = new TextEncoder().encode(value);
  // encoding(1) + language(3) + description(1, just null) + text
  const body = new Uint8Array(1 + 3 + 1 + textBytes.length);
  body[0] = 3; // UTF-8
  body[1] = 0x65; body[2] = 0x6e; body[3] = 0x67; // "eng"
  body[4] = 0; // empty description (null terminator)
  body.set(textBytes, 5);
  const frame = new Uint8Array(10 + body.length);
  // "COMM"
  frame[0] = 0x43; frame[1] = 0x4f; frame[2] = 0x4d; frame[3] = 0x4d;
  const view = new DataView(frame.buffer);
  view.setUint32(4, body.length, false);
  view.setUint16(8, 0, false);
  frame.set(body, 10);
  return frame;
}

/**
 * Build a complete ID3v2.3 tag (header + frames + padding) for the given fields.
 * Padding: 2 KB of zero bytes after the frames (recommended practice).
 * Uses ID3v2.3 (major=3) so frame sizes are regular 32-bit ints (most compatible).
 */
export function buildID3v2Tag(fields: Fields, paddingBytes = 2048): Uint8Array {
  // Build frames
  const frames: Uint8Array[] = [];
  for (const name of FIELD_NAMES) {
    const value = fields[name];
    if (!value) continue;
    const frameId = FIELD_TO_ID3V2_FRAME[name];
    if (name === "comment") {
      frames.push(buildCommFrame(value));
    } else {
      frames.push(buildTextFrame(frameId, value));
    }
  }
  // Sum frame sizes
  let framesTotal = 0;
  for (const f of frames) framesTotal += f.length;
  const pad = Math.max(0, Math.floor(paddingBytes));
  const tagSize = framesTotal + pad;
  // Build header (10 bytes)
  const header = new Uint8Array(10);
  header[0] = 0x49; header[1] = 0x44; header[2] = 0x33; // "ID3"
  header[3] = 3;   // major version 2.3 (frame sizes = regular 32-bit int)
  header[4] = 0;   // revision
  header[5] = 0;   // flags
  const synch = writeSynchsafe(tagSize);
  header[6] = synch[0]; header[7] = synch[1]; header[8] = synch[2]; header[9] = synch[3];
  // Assemble
  const out = new Uint8Array(10 + tagSize);
  out.set(header, 0);
  let offset = 10;
  for (const f of frames) {
    out.set(f, offset);
    offset += f.length;
  }
  // Padding is already zero-initialized
  return out;
}

/**
 * Write ID3v2 metadata into an MP3 file's bytes.
 * Removes any existing ID3v2 tag (and trailing ID3v1 if present at end),
 * then prepends a fresh ID3v2.4 tag built from `fields`.
 * Returns a new Uint8Array (does not mutate the input).
 */
export function writeID3v2(bytes: Uint8Array, fields: Fields): Uint8Array {
  // Find where the audio data starts (skip existing ID3v2 if present)
  const { audioStartOffset } = parseID3v2(bytes);
  const audioData = bytes.subarray(audioStartOffset);
  // Build new tag
  const tag = buildID3v2Tag(fields);
  // Concatenate tag + audio data
  const out = new Uint8Array(tag.length + audioData.length);
  out.set(tag, 0);
  out.set(audioData, tag.length);
  return out;
}

// ---- RIFF INFO parser (WAV) ----

/** Reverse-lookup: RIFF INFO chunk ID → normalized field name. */
export function riffInfoToField(chunkId: string): FieldName | null {
  for (const f of FIELD_NAMES) {
    if (FIELD_TO_RIFF_INFO[f] === chunkId) return f;
  }
  return null;
}

export interface RiffInfoParseResult {
  fields: Fields;
  listOffset: number;   // byte offset of the LIST chunk (8 = start of chunk header)
  listSize: number;     // size of the LIST chunk's body (excluding 8-byte chunk header)
  hasList: boolean;
}

/**
 * Parse the RIFF LIST/INFO chunk from a WAV file's bytes.
 * Returns the parsed fields and the offset/size of the LIST chunk (so it
 * can be replaced on write).
 */
export function parseRiffInfo(bytes: Uint8Array): RiffInfoParseResult {
  const fields = emptyFields();
  const result: RiffInfoParseResult = {
    fields,
    listOffset: -1,
    listSize: 0,
    hasList: false,
  };
  if (bytes.length < 12) return result;
  // Skip RIFF header (12 bytes): "RIFF" + size + "WAVE"
  let offset = 12;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  while (offset + 8 <= bytes.length) {
    const chunkId = String.fromCharCode(
      bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3],
    );
    const chunkSize = view.getUint32(offset + 4, true);
    if (chunkId === "LIST") {
      // Check sub-type: should be "INFO"
      if (offset + 12 <= bytes.length) {
        const subType = String.fromCharCode(
          bytes[offset + 8], bytes[offset + 9], bytes[offset + 10], bytes[offset + 11],
        );
        if (subType === "INFO") {
          result.hasList = true;
          result.listOffset = offset;
          result.listSize = chunkSize;
          // Walk sub-chunks
          let subOffset = offset + 12;
          const subEnd = offset + 8 + chunkSize;
          while (subOffset + 8 <= subEnd) {
            const subId = String.fromCharCode(
              bytes[subOffset], bytes[subOffset + 1], bytes[subOffset + 2], bytes[subOffset + 3],
            );
            const subSize = view.getUint32(subOffset + 4, true);
            if (subSize <= 0) break;
            const dataStart = subOffset + 8;
            const dataEnd = Math.min(dataStart + subSize, bytes.length);
            // Trim trailing nulls
            let text = "";
            try {
              const slice = bytes.subarray(dataStart, dataEnd);
              let s = "";
              for (let i = 0; i < slice.length; i++) {
                if (slice[i] === 0) break;
                s += String.fromCharCode(slice[i]);
              }
              text = s;
            } catch {
              text = "";
            }
            const fieldName = riffInfoToField(subId);
            if (fieldName && text) fields[fieldName] = text;
            // Sub-chunks are padded to even length
            subOffset += 8 + subSize + (subSize % 2);
          }
        }
      }
      break; // Only process the first LIST chunk
    }
    // Skip to next chunk (chunks are padded to even length)
    const next = chunkSize + (chunkSize % 2);
    offset += 8 + next;
  }
  return result;
}

/**
 * Build a RIFF LIST/INFO chunk from the given fields.
 * Layout: "LIST" + size(4) + "INFO" + sub-chunks.
 * Each sub-chunk: id(4) + size(4) + data(null-terminated text, padded to even).
 */
export function buildRiffInfoChunk(fields: Fields): Uint8Array {
  // Build sub-chunks
  const subChunks: Uint8Array[] = [];
  for (const name of FIELD_NAMES) {
    const value = fields[name];
    if (!value) continue;
    const chunkId = FIELD_TO_RIFF_INFO[name];
    // Encode value as ISO-8859-1 bytes + null terminator
    const textBytes: number[] = [];
    for (let i = 0; i < value.length; i++) textBytes.push(value.charCodeAt(i) & 0xff);
    textBytes.push(0); // null terminator
    // Pad to even length
    if (textBytes.length % 2 !== 0) textBytes.push(0);
    const sub = new Uint8Array(8 + textBytes.length);
    for (let i = 0; i < 4; i++) sub[i] = chunkId.charCodeAt(i);
    const view = new DataView(sub.buffer);
    view.setUint32(4, textBytes.length, true);
    for (let i = 0; i < textBytes.length; i++) sub[8 + i] = textBytes[i];
    subChunks.push(sub);
  }
  // Sum sub-chunk sizes
  let subsTotal = 0;
  for (const s of subChunks) subsTotal += s.length;
  // LIST body = "INFO" (4) + sub-chunks
  const listBodySize = 4 + subsTotal;
  const out = new Uint8Array(8 + listBodySize);
  // "LIST"
  out[0] = 0x4c; out[1] = 0x49; out[2] = 0x53; out[3] = 0x54;
  const view = new DataView(out.buffer);
  view.setUint32(4, listBodySize, true);
  // "INFO"
  out[8] = 0x49; out[9] = 0x4e; out[10] = 0x46; out[11] = 0x4f;
  let offset = 12;
  for (const s of subChunks) {
    out.set(s, offset);
    offset += s.length;
  }
  return out;
}

/**
 * Write RIFF INFO metadata into a WAV file's bytes.
 * Replaces the existing LIST/INFO chunk if present, otherwise inserts a
 * new LIST chunk before the data chunk.
 * Returns a new Uint8Array (does not mutate the input).
 */
export function writeRiffInfo(bytes: Uint8Array, fields: Fields): Uint8Array {
  if (bytes.length < 12) return bytes.slice();
  const parsed = parseRiffInfo(bytes);
  const newChunk = buildRiffInfoChunk(fields);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (parsed.hasList && parsed.listOffset >= 0) {
    // Replace the existing LIST chunk
    const listChunkTotal = 8 + parsed.listSize + (parsed.listSize % 2);
    const before = bytes.subarray(0, parsed.listOffset);
    const after = bytes.subarray(parsed.listOffset + listChunkTotal);
    const out = new Uint8Array(before.length + newChunk.length + after.length);
    out.set(before, 0);
    out.set(newChunk, before.length);
    out.set(after, before.length + newChunk.length);
    return out;
  }
  // Insert before the data chunk (or at the end if no data chunk)
  let insertOffset = bytes.length;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkId = String.fromCharCode(
      bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3],
    );
    if (chunkId === "data") {
      insertOffset = offset;
      break;
    }
    const chunkSize = view.getUint32(offset + 4, true);
    const next = chunkSize + (chunkSize % 2);
    offset += 8 + next;
    if (next === 0) break;
  }
  const before = bytes.subarray(0, insertOffset);
  const after = bytes.subarray(insertOffset);
  const out = new Uint8Array(before.length + newChunk.length + after.length);
  out.set(before, 0);
  out.set(newChunk, before.length);
  out.set(after, before.length + newChunk.length);
  return out;
}

// ---- Vorbis comment parser (OGG / FLAC, read-only) ----

/**
 * Parse a Vorbis comment block from the given byte range.
 * The data should start at the vendor_length field (i.e., after any
 * "vorbis" marker or FLAC block header).
 *
 * Layout (all little-endian):
 *   vendor_length (4)
 *   vendor_string (vendor_length bytes)
 *   comment_count (4)
 *   for each comment:
 *     comment_length (4)
 *     comment_string (comment_length bytes) — "FIELD=value"
 */
export function parseVorbisComment(data: Uint8Array): Fields {
  const fields = emptyFields();
  if (data.length < 8) return fields;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;
  // vendor_length
  if (offset + 4 > data.length) return fields;
  const vendorLen = view.getUint32(offset, true);
  offset += 4 + vendorLen;
  // comment_count
  if (offset + 4 > data.length) return fields;
  const count = view.getUint32(offset, true);
  offset += 4;
  for (let i = 0; i < count && offset + 4 <= data.length; i++) {
    const commentLen = view.getUint32(offset, true);
    offset += 4;
    if (commentLen <= 0 || offset + commentLen > data.length) break;
    const commentBytes = data.subarray(offset, offset + commentLen);
    offset += commentLen;
    let comment: string;
    try {
      comment = new TextDecoder("utf-8").decode(commentBytes);
    } catch {
      continue;
    }
    const eq = comment.indexOf("=");
    if (eq < 0) continue;
    const key = comment.slice(0, eq).trim().toUpperCase();
    const value = comment.slice(eq + 1);
    const fieldName = VORBIS_TO_FIELD[key] ?? normalizeFieldName(key);
    if (fieldName && !fields[fieldName]) {
      fields[fieldName] = value;
    }
  }
  return fields;
}

/**
 * Find the Vorbis comment block in a FLAC file's bytes.
 * FLAC layout: "fLaC" + metadata blocks (each: 1-byte header + 3-byte size).
 * Block type 4 = VORBIS_COMMENT.
 */
export function parseFlacVorbisComment(bytes: Uint8Array): Fields {
  const fields = emptyFields();
  if (bytes.length < 4) return fields;
  if (
    bytes[0] !== 0x66 || bytes[1] !== 0x4c ||
    bytes[2] !== 0x61 || bytes[3] !== 0x43
  ) return fields;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 4;
  while (offset + 4 <= bytes.length) {
    const header = view.getUint8(offset);
    const isLast = (header & 0x80) !== 0;
    const blockType = header & 0x7f;
    const blockSize = (view.getUint8(offset + 1) << 16) |
                      (view.getUint8(offset + 2) << 8) |
                      view.getUint8(offset + 3);
    offset += 4;
    if (offset + blockSize > bytes.length) break;
    if (blockType === 4) {
      // VORBIS_COMMENT
      const data = bytes.subarray(offset, offset + blockSize);
      return parseVorbisComment(data);
    }
    offset += blockSize;
    if (isLast) break;
  }
  return fields;
}

/**
 * Find the Vorbis comment block in an OGG file's bytes.
 * OGG Vorbis layout: OggS pages. The comment header starts with the
 * 7-byte signature [0x03, 'v', 'o', 'r', 'b', 'i', 's'].
 * After the signature comes the Vorbis comment data.
 */
export function parseOggVorbisComment(bytes: Uint8Array): Fields {
  // Search for [0x03, 'v', 'o', 'r', 'b', 'i', 's'] signature
  const sig = [0x03, 0x76, 0x6f, 0x72, 0x62, 0x69, 0x73]; // \x03vorbis
  if (bytes.length < sig.length) return emptyFields();
  outer: for (let i = 0; i <= bytes.length - sig.length; i++) {
    for (let j = 0; j < sig.length; j++) {
      if (bytes[i + j] !== sig[j]) continue outer;
    }
    // Found signature at offset i
    const data = bytes.subarray(i + sig.length);
    return parseVorbisComment(data);
  }
  return emptyFields();
}

// ---- Top-level parse function ----

/**
 * Parse audio metadata from a file's bytes. Auto-detects the format and
 * dispatches to the appropriate parser. For OGG/FLAC, sets readOnly=true
 * (we only support reading Vorbis comments).
 */
export function parseAudioMetadata(bytes: Uint8Array): AudioMetadata {
  const format = detectFormat(bytes);
  const fields = emptyFields();
  let readOnly = false;
  switch (format) {
    case "mp3": {
      const r = parseID3v2(bytes);
      return {
        format,
        fields: r.fields,
        readOnly: false,
        originalSizeBytes: bytes.length,
      };
    }
    case "wav": {
      const r = parseRiffInfo(bytes);
      return {
        format,
        fields: r.fields,
        readOnly: false,
        originalSizeBytes: bytes.length,
      };
    }
    case "flac": {
      return {
        format,
        fields: parseFlacVorbisComment(bytes),
        readOnly: true,
        originalSizeBytes: bytes.length,
      };
    }
    case "ogg": {
      return {
        format,
        fields: parseOggVorbisComment(bytes),
        readOnly: true,
        originalSizeBytes: bytes.length,
      };
    }
    default:
      return {
        format: "unknown",
        fields,
        readOnly: true,
        originalSizeBytes: bytes.length,
      };
  }
}

/**
 * Write metadata back to a file's bytes. Only MP3 (ID3v2) and WAV (RIFF
 * INFO) are supported for writing. Throws for read-only formats.
 */
export function writeAudioMetadata(
  bytes: Uint8Array,
  format: AudioFormat,
  fields: Fields,
): Uint8Array {
  switch (format) {
    case "mp3": return writeID3v2(bytes, fields);
    case "wav": return writeRiffInfo(bytes, fields);
    default:
      throw new Error(`Writing ${format} metadata is not supported (read-only).`);
  }
}

// ---- Render as text report ----

/** Format label for the audio format. */
export function formatLabel(format: AudioFormat): string {
  switch (format) {
    case "mp3": return "MP3 (ID3v2)";
    case "wav": return "WAV (RIFF INFO)";
    case "ogg": return "OGG (Vorbis comments, read-only)";
    case "flac": return "FLAC (Vorbis comments, read-only)";
    default: return "Unknown";
  }
}

/** Render the metadata as a multi-line text report. */
export function renderTextReport(meta: AudioMetadata, originalFields?: Fields): string {
  const lines: string[] = [];
  lines.push("Audio Metadata Report");
  lines.push("====================");
  lines.push("");
  lines.push(`Format: ${formatLabel(meta.format)}`);
  lines.push(`File size: ${meta.originalSizeBytes} bytes`);
  lines.push(`Read-only: ${meta.readOnly ? "yes" : "no"}`);
  lines.push("");
  lines.push("Fields:");
  let totalFields = 0;
  let modifiedFields = 0;
  for (const name of FIELD_NAMES) {
    const value = meta.fields[name];
    if (value) totalFields++;
    const origValue = originalFields?.[name] ?? "";
    const isModified = value !== origValue;
    if (isModified && (value || origValue)) modifiedFields++;
    const marker = isModified ? " *" : "  ";
    const display = value || "(empty)";
    lines.push(`${marker} ${FIELD_LABELS[name].padEnd(12)} ${display}`);
  }
  lines.push("");
  lines.push(`Total fields: ${totalFields}`);
  lines.push(`Modified fields: ${modifiedFields}`);
  return lines.join("\n");
}

// ---- Render as CSV ----

/** Render the metadata as CSV (field, value). Includes a header row. */
export function renderCsv(meta: AudioMetadata): string {
  const rows: string[] = ["field,value"];
  for (const name of FIELD_NAMES) {
    const value = meta.fields[name] ?? "";
    rows.push(`${FIELD_LABELS[name]},${csvEscape(value)}`);
  }
  return rows.join("\n");
}

/** Escape a string for CSV (quote if it contains commas, quotes, or newlines). */
export function csvEscape(s: string): string {
  if (typeof s !== "string") return "";
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ---- Summary stats ----

export interface SummaryStats {
  format: AudioFormat;
  totalFields: number;
  modifiedFields: number;
  outputSizeBytes: number;
  readOnly: boolean;
}

/** Compute summary stats given the new fields and (optionally) the original fields. */
export function computeSummaryStats(
  meta: AudioMetadata,
  originalFields: Fields | null,
  outputSizeBytes: number,
): SummaryStats {
  let totalFields = 0;
  let modifiedFields = 0;
  for (const name of FIELD_NAMES) {
    if (meta.fields[name]) totalFields++;
    if (originalFields) {
      const origValue = originalFields[name] ?? "";
      const newValue = meta.fields[name] ?? "";
      if (newValue !== origValue && (newValue || origValue)) modifiedFields++;
    }
  }
  return {
    format: meta.format,
    totalFields,
    modifiedFields,
    outputSizeBytes,
    readOnly: meta.readOnly,
  };
}

// ---- Filename generator ----

/** Generate output filename based on the original name and format. */
export function generateFilename(
  originalName: string,
  format: AudioFormat,
  date: Date = new Date(),
): string {
  const ext = format === "mp3" ? "mp3" : format === "wav" ? "wav" : format === "ogg" ? "ogg" : format === "flac" ? "flac" : "bin";
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  const base = originalName.replace(/\.[^.]+$/, "") || "audio";
  return `${base}-tagged-${y}${m}${d}-${hh}${mm}${ss}.${ext}`;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:audio-metadata-editor:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  originalName: string;
  format: AudioFormat;
  fields: Fields;
  totalFields: number;
  modifiedFields: number;
  outputSizeBytes: number;
  filename: string;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---- Shareable URL ----

export interface ShareSettings {
  format: AudioFormat;
  title: string;
  artist: string;
  album: string;
  year: string;
  track: string;
  genre: string;
}

export function buildShareUrl(settings: ShareSettings): string {
  const params = new URLSearchParams();
  if (settings.format !== "unknown") params.set("format", settings.format);
  if (settings.title) params.set("title", settings.title);
  if (settings.artist) params.set("artist", settings.artist);
  if (settings.album) params.set("album", settings.album);
  if (settings.year) params.set("year", settings.year);
  if (settings.track) params.set("track", settings.track);
  if (settings.genre) params.set("genre", settings.genre);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareSettings> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareSettings> = {};
  const fmt = params.get("format");
  if (fmt === "mp3" || fmt === "wav" || fmt === "ogg" || fmt === "flac") out.format = fmt;
  const title = params.get("title");
  if (title) out.title = title;
  const artist = params.get("artist");
  if (artist) out.artist = artist;
  const album = params.get("album");
  if (album) out.album = album;
  const year = params.get("year");
  if (year) out.year = year;
  const track = params.get("track");
  if (track) out.track = track;
  const genre = params.get("genre");
  if (genre) out.genre = genre;
  return out;
}

// ---- Helpers ----

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
