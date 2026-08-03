import { describe, it, expect } from "vitest";
import { formatFileSize } from "./logic";

describe("Add Attachment to PDF", () => {
  describe("formatFileSize", () => {
    it("formats bytes", () => {
      expect(formatFileSize(500)).toBe("500 B");
    });
    it("formats kilobytes", () => {
      expect(formatFileSize(1024)).toBe("1.0 KB");
    });
    it("formats megabytes", () => {
      expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    });
  });
});
