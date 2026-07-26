/**
 * User-Agent Generator — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  generateUa,
  generateBotUa,
  generateCustomUa,
  generateBatch,
  batchToText,
  listBrowsers,
  listDevices,
  listBrowserVersions,
  BOTS,
} from "./logic";

describe("list functions", () => {
  it("returns 5 browsers", () => {
    expect(listBrowsers().length).toBe(5);
  });
  it("returns 6 devices", () => {
    expect(listDevices().length).toBe(6);
  });
  it("returns multiple versions per browser", () => {
    expect(listBrowserVersions("chrome").length).toBeGreaterThan(3);
  });
});

describe("generateUa — validation", () => {
  it("errors on unknown browser", () => {
    expect("error" in generateUa({ browser: "ie" as never, device: "windows", version: "1" })).toBe(true);
  });
  it("errors on unknown device", () => {
    expect("error" in generateUa({ browser: "chrome", device: "freebsd" as never, version: "1" })).toBe(true);
  });
  it("errors on non-numeric version", () => {
    expect("error" in generateUa({ browser: "chrome", device: "windows", version: "abc" })).toBe(true);
  });
});

describe("generateUa — Chrome", () => {
  it("produces Windows Chrome UA", () => {
    const r = generateUa({ browser: "chrome", device: "windows", version: "120" });
    if ("error" in r) throw new Error("should not error");
    expect(r.ua).toContain("Windows NT 10.0");
    expect(r.ua).toContain("Chrome/120");
    expect(r.ua).toContain("Safari/537.36");
  });
  it("produces macOS Chrome UA", () => {
    const r = generateUa({ browser: "chrome", device: "macos", version: "121" });
    if ("error" in r) throw new Error("should not error");
    expect(r.ua).toContain("Macintosh");
    expect(r.ua).toContain("Chrome/121");
  });
  it("produces Android Chrome UA", () => {
    const r = generateUa({ browser: "chrome", device: "android", version: "122" });
    if ("error" in r) throw new Error("should not error");
    expect(r.ua).toContain("Android");
    expect(r.ua).toContain("Mobile");
  });
  it("produces iPhone Chrome UA", () => {
    const r = generateUa({ browser: "chrome", device: "iphone", version: "120" });
    if ("error" in r) throw new Error("should not error");
    expect(r.ua).toContain("iPhone");
    expect(r.ua).toContain("CriOS/120");
  });
});

describe("generateUa — Firefox", () => {
  it("produces Linux Firefox UA", () => {
    const r = generateUa({ browser: "firefox", device: "linux", version: "123" });
    if ("error" in r) throw new Error("should not error");
    expect(r.ua).toContain("Linux");
    expect(r.ua).toContain("Firefox/123");
  });
  it("produces Windows Firefox UA", () => {
    const r = generateUa({ browser: "firefox", device: "windows", version: "123" });
    if ("error" in r) throw new Error("should not error");
    expect(r.ua).toContain("Windows NT 10.0");
    expect(r.ua).toContain("rv:123");
  });
});

describe("generateUa — Safari", () => {
  it("produces macOS Safari UA", () => {
    const r = generateUa({ browser: "safari", device: "macos", version: "17" });
    if ("error" in r) throw new Error("should not error");
    expect(r.ua).toContain("Macintosh");
    expect(r.ua).toContain("Version/17");
    expect(r.ua).toContain("Safari/605");
  });
  it("warns on Safari/Linux (unsupported)", () => {
    const r = generateUa({ browser: "safari", device: "linux", version: "17" });
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("Linux"))).toBe(true);
  });
});

describe("generateUa — Edge & Opera", () => {
  it("Edge appends Edg/ token", () => {
    const r = generateUa({ browser: "edge", device: "windows", version: "120" });
    if ("error" in r) throw new Error("should not error");
    expect(r.ua).toContain("Edg/120");
    expect(r.ua).toContain("Chrome/120");
  });
  it("Opera appends OPR/ token", () => {
    const r = generateUa({ browser: "opera", device: "windows", version: "106" });
    if ("error" in r) throw new Error("should not error");
    expect(r.ua).toContain("OPR/106");
  });
});

describe("generateBotUa", () => {
  it("produces a Googlebot UA", () => {
    const r = generateBotUa("Googlebot", "https://www.google.com/bot.html");
    expect(r.isBot).toBe(true);
    expect(r.ua).toContain("Googlebot");
    expect(r.ua).toContain("compatible");
  });
  it("includes the bot URL", () => {
    const r = generateBotUa("TestBot", "https://example.com");
    expect(r.ua).toContain("https://example.com");
  });
});

describe("BOTS list", () => {
  it("contains at least 8 known bots", () => {
    expect(BOTS.length).toBeGreaterThanOrEqual(8);
  });
  it("includes Googlebot and Bingbot", () => {
    expect(BOTS.find((b) => b.name === "Googlebot")).toBeDefined();
    expect(BOTS.find((b) => b.name === "Bingbot")).toBeDefined();
  });
});

describe("generateCustomUa", () => {
  it("produces a UA from custom tokens", () => {
    const r = generateCustomUa({ os: "X11; Linux x86_64", engine: "AppleWebKit/537.36", browser: "Chrome/120.0.0.0 Safari/537.36" });
    expect(r.ua).toContain("Linux");
    expect(r.ua).toContain("Chrome/120");
  });
});

describe("generateBatch", () => {
  it("produces a non-empty batch", () => {
    const batch = generateBatch();
    expect(batch.length).toBeGreaterThan(10);
  });
  it("batchToText joins with newlines", () => {
    const text = batchToText(generateBatch());
    const lines = text.split("\n");
    expect(lines.length).toBeGreaterThan(10);
    expect(lines[0]).toContain("Mozilla/5.0");
  });
  it("batch skips Linux + Safari", () => {
    const batch = generateBatch();
    const safariLinux = batch.find((r) => r.profile.browser === "safari" && r.profile.device === "linux");
    expect(safariLinux).toBeUndefined();
  });
});
