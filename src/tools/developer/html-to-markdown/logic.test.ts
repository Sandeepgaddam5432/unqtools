import { describe, it, expect } from "vitest";
import {
  validate, process, formatBytes, formatDuration, randomId,
  detectFileType, getFileExtension, getMimeType, getStats, bulkProcess,
} from "./logic";

describe("HTML to Markdown Converter", () => {
  it("validates empty input", () => {
    const issues = validate("");
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].severity).toBe("error");
  });

  it("validates non-empty input", () => {
    const issues = validate("test input");
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("warns on very large input", () => {
    const large = "a".repeat(11 * 1024 * 1024);
    const issues = validate(large);
    expect(issues.some((i) => i.severity === "warning")).toBe(true);
  });

  it("processes valid input", () => {
    const result = process("test");
    expect(result.error).toBeUndefined();
    expect(result.output).toBeTruthy();
  });

  it("returns error for invalid input", () => {
    const result = process("");
    expect(result.error).toBeDefined();
  });

  it("includes metadata in result", () => {
    const result = process("test");
    expect(result.metadata).toBeDefined();
  });

  it("formats bytes correctly", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1048576)).toBe("1.00 MB");
    expect(formatBytes(1073741824)).toBe("1.00 GB");
  });

  it("formats duration correctly", () => {
    expect(formatDuration(500)).toBe("500ms");
    expect(formatDuration(1500)).toBe("1.5s");
    expect(formatDuration(90000)).toBe("1.5m");
  });

  it("generates random ID", () => {
    const id = randomId(8);
    expect(id).toHaveLength(8);
  });

  it("generates unique random IDs", () => {
    const id1 = randomId();
    const id2 = randomId();
    expect(id1).not.toBe(id2);
  });

  it("detects PDF file type", () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    expect(detectFileType(pdfBytes)).toBe("pdf");
  });

  it("detects PNG file type", () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    expect(detectFileType(pngBytes)).toBe("png");
  });

  it("returns null for unknown file type", () => {
    const unknown = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    expect(detectFileType(unknown)).toBeNull();
  });

  it("extracts file extension", () => {
    expect(getFileExtension("test.pdf")).toBe("pdf");
    expect(getFileExtension("image.PNG")).toBe("png");
    expect(getFileExtension("noext")).toBe("");
  });

  it("gets MIME type", () => {
    expect(getMimeType("pdf")).toBe("application/pdf");
    expect(getMimeType("png")).toBe("image/png");
    expect(getMimeType("json")).toBe("application/json");
  });

  it("calculates stats", () => {
    const stats = getStats("hello", "hi");
    expect(stats.inputSize).toBe(5);
    expect(stats.outputSize).toBe(2);
    expect(stats.ratio).toBeLessThan(1);
    expect(stats.savings).toBe(3);
  });

  it("bulk processes multiple inputs", () => {
    const results = bulkProcess(["a", "b", "c"]);
    expect(results).toHaveLength(3);
  });

  it("handles unicode input", () => {
    const result = process("héllo wörld");
    expect(result.error).toBeUndefined();
  });

  it("handles special characters", () => {
    const result = process("!@#$%^&*()");
    expect(result.error).toBeUndefined();
  });
});
