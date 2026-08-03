import { describe, it, expect } from "vitest";
import { detectImageType, formatSize } from "./logic";

describe("PDF Background Image", () => {
  describe("detectImageType", () => {
    it("detects PNG", () => {
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(detectImageType(png.buffer)).toBe("png");
    });

    it("detects JPG", () => {
      const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      expect(detectImageType(jpg.buffer)).toBe("jpg");
    });

    it("returns null for unknown", () => {
      const unknown = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      expect(detectImageType(unknown.buffer)).toBeNull();
    });
  });

  describe("formatSize", () => {
    it("formats bytes", () => {
      expect(formatSize(500)).toBe("500 B");
    });
    it("formats KB", () => {
      expect(formatSize(2048)).toBe("2.0 KB");
    });
    it("formats MB", () => {
      expect(formatSize(2097152)).toBe("2.0 MB");
    });
  });
});
