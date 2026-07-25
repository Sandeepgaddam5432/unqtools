/**
 * GIF Frame Extractor — pure logic. No DOM/canvas access.
 * Parse frame metadata and timing from a GIF's binary structure.
 */

export interface GifFrame {
  index: number;
  left: number;
  top: number;
  width: number;
  height: number;
  delayMs: number;
  disposal: number;
  transparentIndex: number;
  hasLocalTable: boolean;
}

export interface GifMetadata {
  width: number;
  height: number;
  frames: GifFrame[];
  loopCount: number;
  totalDurationMs: number;
}

interface Reader {
  data: Uint8Array;
  pos: number;
}

function readByte(r: Reader): number {
  if (r.pos >= r.data.length) return -1;
  return r.data[r.pos++];
}

function readUint16(r: Reader): number {
  const lo = readByte(r);
  const hi = readByte(r);
  if (lo < 0 || hi < 0) return 0;
  return lo | (hi << 8);
}

function skipSubBlocks(r: Reader): boolean {
  let len = readByte(r);
  while (len > 0) {
    if (r.pos + len > r.data.length) return false;
    r.pos += len;
    len = readByte(r);
  }
  return len === 0;
}

const EXTENSION_INTRODUCER = 0x21;
const IMAGE_DESCRIPTOR = 0x2c;
const GRAPHIC_CONTROL_LABEL = 0xf9;
const NETSCAPE_LABEL = 0xff;
const TRAILER = 0x3b;

/** Parse a GIF byte array into frame metadata. */
export function parseGif(bytes: Uint8Array): GifMetadata | { error: string } {
  if (bytes.length < 13) return { error: "Not a valid GIF (too short)" };
  const sig = String.fromCharCode(bytes[0], bytes[1], bytes[2]);
  const ver = String.fromCharCode(bytes[3], bytes[4], bytes[5]);
  if (sig !== "GIF" || (ver !== "87a" && ver !== "89a")) {
    return { error: "Not a valid GIF signature" };
  }
  const r: Reader = { data: bytes, pos: 6 };
  const width = readUint16(r);
  const height = readUint16(r);
  const packed = readByte(r);
  const globalTableFlag = (packed & 0x80) !== 0;
  const globalTableSize = 1 << ((packed & 0x07) + 1);
  r.pos += 2; // background color + aspect ratio
  if (globalTableFlag) r.pos += globalTableSize * 3;

  const frames: GifFrame[] = [];
  let loopCount = 0;
  let index = 0;
  let totalDurationMs = 0;
  let pendingGc: Partial<GifFrame> | null = null;

  while (r.pos < r.data.length) {
    const marker = readByte(r);
    if (marker === TRAILER) break;
    if (marker === EXTENSION_INTRODUCER) {
      const label = readByte(r);
      if (label === GRAPHIC_CONTROL_LABEL) {
        readByte(r); // block size (4)
        const gcPacked = readByte(r);
        const delay = readUint16(r);
        const transparentIndex = readByte(r);
        readByte(r); // terminator
        pendingGc = {
          delayMs: delay * 10,
          disposal: (gcPacked >> 2) & 0x07,
          transparentIndex: (gcPacked & 0x01) !== 0 ? transparentIndex : -1,
        };
      } else if (label === NETSCAPE_LABEL) {
        readByte(r); // block size (11)
        r.pos += 11; // "NETSCAPE2.0"
        const subSize = readByte(r);
        if (subSize === 3) {
          r.pos += 1; // sub-block id
          loopCount = readUint16(r);
        }
        readByte(r); // terminator
      } else {
        skipSubBlocks(r);
      }
      continue;
    }
    if (marker === IMAGE_DESCRIPTOR) {
      const left = readUint16(r);
      const top = readUint16(r);
      const w = readUint16(r);
      const h = readUint16(r);
      const ip = readByte(r);
      const hasLocalTable = (ip & 0x80) !== 0;
      const localSize = 1 << ((ip & 0x07) + 1);
      if (hasLocalTable) r.pos += localSize * 3;
      readByte(r); // LZW min code size
      skipSubBlocks(r); // image data
      const frame: GifFrame = {
        index,
        left,
        top,
        width: w,
        height: h,
        delayMs: pendingGc?.delayMs ?? 0,
        disposal: pendingGc?.disposal ?? 0,
        transparentIndex: pendingGc?.transparentIndex ?? -1,
        hasLocalTable,
      };
      frames.push(frame);
      totalDurationMs += frame.delayMs;
      index++;
      pendingGc = null;
      continue;
    }
    // Unknown marker — bail to avoid infinite loops.
    break;
  }

  if (frames.length === 0) return { error: "No image frames found" };
  return { width, height, frames, loopCount, totalDurationMs };
}

/** Average frames per second across all frames. */
export function averageFps(meta: GifMetadata): number {
  if (meta.frames.length === 0 || meta.totalDurationMs === 0) return 0;
  return (meta.frames.length / meta.totalDurationMs) * 1000;
}

/** Total frame count. */
export function frameCount(meta: GifMetadata): number {
  return meta.frames.length;
}

/** Format a duration in ms as a readable string. */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
