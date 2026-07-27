/**
 * GIF Splitter (to Frames) — pure logic.
 * GIF parsing, frame extraction utilities.
 */

export interface GifFrame {
  index: number;
  delay: number; // milliseconds
  disposal: number;
  width: number;
  height: number;
  left: number;
  top: number;
  dataUrl?: string;
}

export interface GifInfo {
  width: number;
  height: number;
  frameCount: number;
  loopCount: number;
  totalDuration: number;
  frames: GifFrame[];
}

export function parseGifHeader(bytes: Uint8Array): { valid: boolean; version: string } {
  if (bytes.length < 6) return { valid: false, version: "" };
  const sig = String.fromCharCode(bytes[0], bytes[1], bytes[2]);
  const ver = String.fromCharCode(bytes[3], bytes[4], bytes[5]);
  if (sig !== "GIF") return { valid: false, version: "" };
  return { valid: true, version: ver };
}

export function parseLogicalScreenDescriptor(bytes: Uint8Array): { width: number; height: number; hasGlobalColorTable: boolean; colorResolution: number } {
  if (bytes.length < 13) return { width: 0, height: 0, hasGlobalColorTable: false, colorResolution: 0 };
  const width = bytes[6] | (bytes[7] << 8);
  const height = bytes[8] | (bytes[9] << 8);
  const packed = bytes[10];
  return {
    width, height,
    hasGlobalColorTable: (packed & 0x80) !== 0,
    colorResolution: ((packed & 0x70) >> 4) + 1,
  };
}

export function extractFrameInfo(bytes: Uint8Array): GifFrame[] {
  const frames: GifFrame[] = [];
  let i = 13;
  // Skip global color table if present
  const packed = bytes[10];
  if (packed & 0x80) {
    const tableSize = 3 * Math.pow(2, (packed & 0x07) + 1);
    i += tableSize;
  }
  let frameIndex = 0;
  while (i < bytes.length - 1) {
    if (bytes[i] === 0x21 && bytes[i + 1] === 0xF9) {
      // Graphic Control Extension
      const blockSize = bytes[i + 2];
      if (blockSize === 4 && i + 7 < bytes.length) {
        const packed2 = bytes[i + 3];
        const delay = (bytes[i + 4] | (bytes[i + 5] << 8)) * 10;
        const disposal = (packed2 >> 2) & 0x07;
        frames.push({ index: frameIndex++, delay, disposal, width: 0, height: 0, left: 0, top: 0 });
      }
      i += 8;
    } else if (bytes[i] === 0x2C) {
      // Image Descriptor
      if (frames.length > 0) {
        const lastFrame = frames[frames.length - 1];
        lastFrame.left = bytes[i + 1] | (bytes[i + 2] << 8);
        lastFrame.top = bytes[i + 3] | (bytes[i + 4] << 8);
        lastFrame.width = bytes[i + 5] | (bytes[i + 6] << 8);
        lastFrame.height = bytes[i + 7] | (bytes[i + 8] << 8);
      }
      i += 10;
    } else if (bytes[i] === 0x3B) {
      break; // Trailer
    } else {
      i++;
    }
  }
  return frames;
}

export function getGifInfo(bytes: Uint8Array): GifInfo {
  const header = parseGifHeader(bytes);
  if (!header.valid) return { width: 0, height: 0, frameCount: 0, loopCount: 0, totalDuration: 0, frames: [] };
  const screen = parseLogicalScreenDescriptor(bytes);
  const frames = extractFrameInfo(bytes);
  const totalDuration = frames.reduce((sum, f) => sum + f.delay, 0);
  return { width: screen.width, height: screen.height, frameCount: frames.length, loopCount: 0, totalDuration, frames };
}

export function calculateFps(frames: GifFrame[]): number {
  if (frames.length === 0) return 0;
  const avgDelay = frames.reduce((sum, f) => sum + f.delay, 0) / frames.length;
  return avgDelay > 0 ? Math.round(1000 / avgDelay) : 0;
}

export function exportFrameManifest(frames: GifFrame[], gifInfo: GifInfo): string {
  return JSON.stringify({ ...gifInfo, fps: calculateFps(frames) }, null, 2);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
