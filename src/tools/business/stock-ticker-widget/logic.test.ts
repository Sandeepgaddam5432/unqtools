/**
 * Stock Ticker Widget — unit tests.
 */
import { describe, it, expect } from "vitest";
import { generateWidget, buildPreviewPage, listPopularSymbols, describeConfig } from "./logic";

describe("generateWidget — validation", () => {
  it("errors on empty symbols", () => {
    expect("error" in generateWidget({ symbols: [] })).toBe(true);
  });
  it("errors on too many symbols", () => {
    expect("error" in generateWidget({ symbols: Array(11).fill("AAPL") })).toBe(true);
  });
  it("errors on invalid symbol", () => {
    expect("error" in generateWidget({ symbols: ["bad-symbol!"] })).toBe(true);
  });
  it("errors on refresh interval out of range", () => {
    expect("error" in generateWidget({ symbols: ["AAPL"], refreshSeconds: 10 })).toBe(true);
    expect("error" in generateWidget({ symbols: ["AAPL"], refreshSeconds: 9999 })).toBe(true);
  });
  it("accepts symbols with dot/dash suffix", () => {
    const r = generateWidget({ symbols: ["BRK.A", "BF-B"] });
    expect("error" in r).toBe(false);
  });
});

describe("generateWidget — output", () => {
  it("produces HTML containing the symbols", () => {
    const r = generateWidget({ symbols: ["AAPL", "MSFT"] });
    if ("error" in r) throw new Error("should not error");
    expect(r.html).toContain("AAPL");
    expect(r.html).toContain("MSFT");
  });
  it("embeds the refresh interval", () => {
    const r = generateWidget({ symbols: ["AAPL"], refreshSeconds: 90 });
    if ("error" in r) throw new Error("should not error");
    expect(r.html).toContain("90000");
  });
  it("embeds theme + accent into CSS", () => {
    const dark = generateWidget({ symbols: ["AAPL"], theme: "dark", accentColor: "#abc123" });
    if ("error" in dark) throw new Error("should not error");
    expect(dark.cssInline).toContain("#0f172a");
    expect(dark.cssInline).toContain("#abc123");
  });
  it("warns on aggressive refresh", () => {
    const r = generateWidget({ symbols: ["AAPL"], refreshSeconds: 45 });
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("rate-limited"))).toBe(true);
  });
  it("warns on many symbols", () => {
    const r = generateWidget({ symbols: ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META"] });
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("load time"))).toBe(true);
  });
  it("reports estimated byte size", () => {
    const r = generateWidget({ symbols: ["AAPL"] });
    if ("error" in r) throw new Error("should not error");
    expect(r.estimatedBytes).toBeGreaterThan(500);
    expect(r.estimatedBytes).toBe(r.html.length + r.cssInline.length);
  });
  it("scoped CSS uses .stw-root prefix", () => {
    const r = generateWidget({ symbols: ["AAPL"] });
    if ("error" in r) throw new Error("should not error");
    expect(r.cssInline).toContain(".stw-root");
  });
});

describe("buildPreviewPage", () => {
  it("produces a full HTML document", () => {
    const r = generateWidget({ symbols: ["AAPL"] });
    if ("error" in r) throw new Error("should not error");
    const page = buildPreviewPage(r);
    expect(page).toContain("<!doctype html>");
    expect(page).toContain("<body");
    expect(page).toContain("<style>");
  });
});

describe("listPopularSymbols", () => {
  it("returns a non-empty list of uppercase tickers", () => {
    const list = listPopularSymbols();
    expect(list.length).toBeGreaterThan(5);
    expect(list.every((s) => /^[A-Z]+$/.test(s))).toBe(true);
  });
  it("includes AAPL and MSFT", () => {
    const list = listPopularSymbols();
    expect(list).toContain("AAPL");
    expect(list).toContain("MSFT");
  });
});

describe("describeConfig", () => {
  it("produces a readable summary", () => {
    const text = describeConfig({ symbols: ["AAPL"], refreshSeconds: 60, theme: "dark", accentColor: "#fff", showChange: false });
    expect(text).toContain("AAPL");
    expect(text).toContain("Refresh");
    expect(text).toContain("dark");
  });
});
