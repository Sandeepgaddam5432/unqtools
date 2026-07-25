import { describe, it, expect } from "vitest";
import { detectMime, parseDataUrl, buildBase64Result, formatSize } from "./logic";

describe("detectMime", () => {
  it("detects PNG", () => expect(detectMime("foo.png")).toBe("image/png"));
  it("detects JPG", () => {
    expect(detectMime("foo.jpg")).toBe("image/jpeg");
    expect(detectMime("foo.JPEG")).toBe("image/jpeg");
  });
  it("detects WebP", () => expect(detectMime("foo.webp")).toBe("image/webp"));
  it("detects SVG", () => expect(detectMime("foo.svg")).toBe("image/svg+xml"));
  it("returns null for unknown", () => expect(detectMime("foo.txt")).toBeNull());
});

describe("parseDataUrl", () => {
  it("parses a base64 data URL", () => {
    const r = parseDataUrl("data:image/png;base64,iVBORw0KGgo=");
    expect(r).toMatchObject({ mime: "image/png", raw: "iVBORw0KGgo=" });
  });

  it("parses a non-base64 data URL", () => {
    const r = parseDataUrl("data:text/plain,hello");
    expect(r).toMatchObject({ mime: "text/plain", raw: "hello" });
  });

  it("computes approximate decoded size", () => {
    const r = parseDataUrl("data:image/png;base64,iVBORw0KGgo=");
    expect((r as { sizeBytes: number }).sizeBytes).toBeGreaterThan(0);
  });

  it("errors on invalid input", () => {
    expect(parseDataUrl("not a url")).toHaveProperty("error");
  });
});

describe("buildBase64Result", () => {
  it("builds a data URL from raw base64", () => {
    const r = buildBase64Result("iVBORw0KGgo=", "image/png");
    expect(r.dataUrl).toBe("data:image/png;base64,iVBORw0KGgo=");
    expect(r.raw).toBe("iVBORw0KGgo=");
    expect(r.mime).toBe("image/png");
  });

  it("computes decoded size", () => {
    const r = buildBase64Result("AAAA", "image/png");
    expect(r.sizeBytes).toBe(3);
  });
});

describe("formatSize", () => {
  it("formats zero", () => expect(formatSize(0)).toBe("0 B"));
  it("formats bytes", () => expect(formatSize(512)).toBe("512 B"));
  it("formats KB", () => expect(formatSize(2048)).toBe("2.0 KB"));
  it("formats MB", () => expect(formatSize(1024 * 1024)).toBe("1.0 MB"));
});
