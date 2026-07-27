import { describe, it, expect } from "vitest";
import { parseGifHeader, parseLogicalScreenDescriptor, calculateFps, formatDuration } from "./logic";

describe("GIF Splitter", () => {
  it("parses valid GIF header", () => {
    const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(parseGifHeader(bytes).valid).toBe(true);
  });
  it("rejects invalid header", () => {
    expect(parseGifHeader(new Uint8Array([0, 0, 0, 0, 0, 0])).valid).toBe(false);
  });
  it("parses logical screen descriptor", () => {
    const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00]);
    const screen = parseLogicalScreenDescriptor(bytes);
    expect(screen.width).toBe(256);
    expect(screen.height).toBe(256);
  });
  it("calculates FPS", () => {
    expect(calculateFps([{ delay: 100 } as any])).toBe(10);
  });
  it("formats duration", () => {
    expect(formatDuration(500)).toBe("500ms");
  });
});
