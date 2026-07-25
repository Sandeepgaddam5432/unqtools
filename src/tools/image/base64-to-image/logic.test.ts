import { describe, it, expect } from "vitest";
import { parseDataUrl, extensionForMime, isLikelyBase64, suggestFilename } from "./logic";

describe("parseDataUrl", () => {
  it("parses a valid base64 data URL", () => {
    const r = parseDataUrl("data:image/png;base64,iVBORw0KGgo=");
    expect(r).toMatchObject({ mime: "image/png", base64: "iVBORw0KGgo=", extension: "png" });
  });

  it("computes sizeBytes", () => {
    const r = parseDataUrl("data:image/png;base64,AAAA") as { sizeBytes: number };
    expect(r.sizeBytes).toBe(3);
  });

  it("suggests extension from mime", () => {
    const r = parseDataUrl("data:image/jpeg;base64,AAAA") as { extension: string };
    expect(r.extension).toBe("jpg");
  });

  it("errors on empty input", () => {
    expect(parseDataUrl("")).toHaveProperty("error");
  });

  it("errors on non-data URL", () => {
    expect(parseDataUrl("https://example.com/foo.png")).toHaveProperty("error");
  });

  it("errors on empty payload", () => {
    expect(parseDataUrl("data:image/png;base64,")).toHaveProperty("error");
  });
});

describe("extensionForMime", () => {
  it("maps known types", () => {
    expect(extensionForMime("image/png")).toBe("png");
    expect(extensionForMime("image/jpeg")).toBe("jpg");
    expect(extensionForMime("image/svg+xml")).toBe("svg");
  });

  it("falls back to bin", () => {
    expect(extensionForMime("application/octet-stream")).toBe("bin");
  });
});

describe("isLikelyBase64", () => {
  it("accepts valid base64", () => {
    expect(isLikelyBase64("iVBORw0KGgo=")).toBe(true);
  });

  it("rejects non-base64 strings", () => {
    expect(isLikelyBase64("hello world!")).toBe(false);
  });

  it("rejects empty", () => {
    expect(isLikelyBase64("")).toBe(false);
  });
});

describe("suggestFilename", () => {
  it("builds a safe filename", () => {
    expect(suggestFilename("photo", "png")).toBe("photo.png");
  });

  it("strips unsafe characters", () => {
    expect(suggestFilename("my photo!!", "jpg")).toBe("myphoto.jpg");
  });

  it("defaults when base is empty", () => {
    expect(suggestFilename("", "png")).toBe("image.png");
  });
});
