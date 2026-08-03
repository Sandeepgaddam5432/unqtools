import { describe, it, expect } from "vitest";
import { identifyImageType, sizeStr } from "./logic";

describe("PDF Background Image Tool", () => {
  it("identifies PNG", () => {
    const buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;
    expect(identifyImageType(buf)).toBe("png");
  });

  it("identifies JPG", () => {
    const buf = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer;
    expect(identifyImageType(buf)).toBe("jpg");
  });

  it("returns null for unknown", () => {
    const buf = new Uint8Array([0x00, 0x01]).buffer;
    expect(identifyImageType(buf)).toBeNull();
  });

  it("formats sizes", () => {
    expect(sizeStr(500)).toBe("500 B");
    expect(sizeStr(1024)).toBe("1.0 KB");
    expect(sizeStr(1048576)).toBe("1.0 MB");
  });
});
