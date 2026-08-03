import { describe, it, expect } from "vitest";
import { getMimeFromName, humanSize, getFileIcon } from "./logic";

describe("PDF Attachment Embed Tool", () => {
  it("detects MIME from filename", () => {
    expect(getMimeFromName("test.pdf")).toBe("application/pdf");
    expect(getMimeFromName("data.csv")).toBe("text/csv");
    expect(getMimeFromName("unknown.xyz")).toBe("application/octet-stream");
  });

  it("formats sizes correctly", () => {
    expect(humanSize(100)).toBe("100 B");
    expect(humanSize(1024)).toBe("1.0 KB");
    expect(humanSize(1048576)).toBe("1.0 MB");
  });

  it("returns file icons", () => {
    expect(getFileIcon("image.png")).toBe("image");
    expect(getFileIcon("doc.pdf")).toBe("file-text");
    expect(getFileIcon("data.zip")).toBe("archive");
  });
});
