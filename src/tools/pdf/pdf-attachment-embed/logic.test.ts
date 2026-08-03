import { describe, it, expect } from "vitest";
import { detectMimeType, formatBytes } from "./logic";

describe("PDF Attachment Embed", () => {
  it("detects PDF MIME type", () => {
    expect(detectMimeType("file.pdf")).toBe("application/pdf");
  });
  it("detects image MIME types", () => {
    expect(detectMimeType("photo.png")).toBe("image/png");
    expect(detectMimeType("photo.jpg")).toBe("image/jpeg");
  });
  it("returns octet-stream for unknown", () => {
    expect(detectMimeType("file.unknown")).toBe("application/octet-stream");
  });
  it("formats bytes correctly", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5242880)).toBe("5.0 MB");
  });
});
