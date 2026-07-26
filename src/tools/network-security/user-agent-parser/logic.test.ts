import { describe, it, expect } from "vitest";
import { parseUserAgent, buildUserAgent, isLikelySpoofed, getConfidenceLabel, bulkParse } from "./logic";

describe("User Agent Parser", () => {
  it("parses Chrome on Windows", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const result = parseUserAgent(ua);
    expect(result.browser.name).toBe("Chrome");
    expect(result.os.name).toBe("Windows");
    expect(result.bot.isBot).toBe(false);
  });

  it("parses Firefox on macOS", () => {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0";
    const result = parseUserAgent(ua);
    expect(result.browser.name).toBe("Firefox");
    expect(result.os.name).toBe("macOS");
    expect(result.engine.name).toBe("Gecko");
  });

  it("parses Safari on iPhone", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";
    const result = parseUserAgent(ua);
    expect(result.browser.name).toBe("Safari");
    expect(result.os.name).toBe("iOS");
    expect(result.device.type).toBe("mobile");
  });

  it("detects Googlebot", () => {
    const ua = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
    const result = parseUserAgent(ua);
    expect(result.bot.isBot).toBe(true);
    expect(result.bot.name).toBe("Googlebot");
    expect(result.bot.category).toBe("Search");
  });

  it("detects GPTBot AI crawler", () => {
    const ua = "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)";
    const result = parseUserAgent(ua);
    expect(result.bot.isBot).toBe(true);
    expect(result.bot.category).toBe("AI");
  });

  it("detects Edge browser", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
    const result = parseUserAgent(ua);
    expect(result.browser.name).toBe("Edge");
  });

  it("detects Samsung Internet browser", () => {
    const ua = "Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/22.0 Chrome/120.0.0.0 Mobile Safari/537.36";
    const result = parseUserAgent(ua);
    expect(result.browser.name).toBe("Samsung Internet");
    expect(result.device.vendor).toBe("Samsung");
  });

  it("detects Linux OS", () => {
    const ua = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
    const result = parseUserAgent(ua);
    expect(result.os.name).toBe("Linux");
    expect(result.cpu.architecture).toBe("amd64");
  });

  it("handles empty UA string", () => {
    const result = parseUserAgent("");
    expect(result.browser.name).toBe("Unknown");
    expect(result.confidence).toBe(0);
  });

  it("uses Client Hints when available", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
    const hints = {
      brands: [{ brand: "Chromium", version: "120" }, { brand: "Not_A Brand", version: "8" }],
      mobile: false,
      platform: "Windows",
    };
    const result = parseUserAgent(ua, hints);
    expect(result.browser.name).toBe("Chromium");
    expect(result.os.name).toBe("Windows");
  });

  it("detects spoofed UA with multiple browsers", () => {
    const ua = "Mozilla/5.0 Chrome/120.0.0.0 Firefox/120.0 Safari/537.36";
    expect(isLikelySpoofed(ua)).toBe(true);
  });

  it("does not flag normal Chrome UA as spoofed", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
    expect(isLikelySpoofed(ua)).toBe(false);
  });

  it("builds a Chrome UA", () => {
    const ua = buildUserAgent({
      browser: { name: "Chrome", version: "120.0.0.0" },
      os: { name: "Windows", version: "10.0" },
    });
    expect(ua).toContain("Chrome/120.0.0.0");
    expect(ua).toContain("Windows NT 10.0");
  });

  it("builds a Safari UA", () => {
    const ua = buildUserAgent({
      browser: { name: "Safari", version: "17.0" },
      os: { name: "macOS", version: "13.0" },
    });
    expect(ua).toContain("Safari");
    expect(ua).toContain("Mac OS X");
  });

  it("parses multiple UAs in bulk mode", () => {
    const uas = [
      "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Version/17.0 Safari/604.1",
      "",
      "Mozilla/5.0 (compatible; Googlebot/2.1)",
    ].join("\n");
    const results = bulkParse(uas);
    expect(results).toHaveLength(3); // empty filtered out
    expect(results[0].browser.name).toBe("Chrome");
    expect(results[2].bot.isBot).toBe(true);
  });

  it("labels confidence correctly", () => {
    expect(getConfidenceLabel(0.95)).toBe("High");
    expect(getConfidenceLabel(0.75)).toBe("Medium");
    expect(getConfidenceLabel(0.55)).toBe("Low");
    expect(getConfidenceLabel(0.3)).toBe("Very Low");
  });

  it("extracts major version", () => {
    const ua = "Mozilla/5.0 Chrome/120.0.6099.71 Safari/537.36";
    const result = parseUserAgent(ua);
    expect(result.browser.major).toBe("120");
  });
});
