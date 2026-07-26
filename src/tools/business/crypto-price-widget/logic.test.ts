/**
 * Crypto Price Widget — unit tests.
 */
import { describe, it, expect } from "vitest";
import { generateWidget, buildPreviewPage, listKnownCoins } from "./logic";

describe("generateWidget — validation", () => {
  it("errors when no coins are provided", () => {
    expect("error" in generateWidget({ coins: [], currency: "usd" })).toBe(true);
  });
  it("errors when too many coins", () => {
    expect("error" in generateWidget({ coins: Array(11).fill("bitcoin"), currency: "usd" })).toBe(true);
  });
  it("errors on invalid currency code", () => {
    expect("error" in generateWidget({ coins: ["bitcoin"], currency: "dollars" })).toBe(true);
  });
  it("errors on refresh interval out of range", () => {
    expect("error" in generateWidget({ coins: ["bitcoin"], currency: "usd", refreshSeconds: 5 })).toBe(true);
    expect("error" in generateWidget({ coins: ["bitcoin"], currency: "usd", refreshSeconds: 9999 })).toBe(true);
  });
});

describe("generateWidget — output", () => {
  it("produces HTML containing the coin IDs", () => {
    const r = generateWidget({ coins: ["bitcoin", "ethereum"], currency: "usd" });
    if ("error" in r) throw new Error("should not error");
    expect(r.html).toContain("bitcoin");
    expect(r.html).toContain("ethereum");
  });
  it("embeds the currency attribute", () => {
    const r = generateWidget({ coins: ["bitcoin"], currency: "eur" });
    if ("error" in r) throw new Error("should not error");
    expect(r.html).toContain('data-currency="eur"');
  });
  it("embeds the refresh interval", () => {
    const r = generateWidget({ coins: ["bitcoin"], currency: "usd", refreshSeconds: 60 });
    if ("error" in r) throw new Error("should not error");
    expect(r.html).toContain("60000");
  });
  it("produces inline CSS scoped under .cpw-root", () => {
    const r = generateWidget({ coins: ["bitcoin"], currency: "usd" });
    if ("error" in r) throw new Error("should not error");
    expect(r.cssInline).toContain(".cpw-root");
    expect(r.cssInline).toContain(".cpw-title");
  });
  it("respects theme dark vs light", () => {
    const dark = generateWidget({ coins: ["bitcoin"], currency: "usd", theme: "dark" });
    const light = generateWidget({ coins: ["bitcoin"], currency: "usd", theme: "light" });
    if ("error" in dark || "error" in light) throw new Error("should not error");
    expect(dark.cssInline).toContain("#0f172a");
    expect(light.cssInline).toContain("#ffffff");
  });
  it("applies custom accent colour", () => {
    const r = generateWidget({ coins: ["bitcoin"], currency: "usd", accentColor: "#ff0000" });
    if ("error" in r) throw new Error("should not error");
    expect(r.cssInline).toContain("#ff0000");
  });
  it("warns for unknown coin slugs", () => {
    const r = generateWidget({ coins: ["fakencoin"], currency: "usd" });
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("fakencoin"))).toBe(true);
  });
  it("warns on aggressive refresh interval", () => {
    const r = generateWidget({ coins: ["bitcoin"], currency: "usd", refreshSeconds: 20 });
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("rate limits"))).toBe(true);
  });
  it("reports estimated byte size", () => {
    const r = generateWidget({ coins: ["bitcoin"], currency: "usd" });
    if ("error" in r) throw new Error("should not error");
    expect(r.estimatedBytes).toBeGreaterThan(500);
    expect(r.estimatedBytes).toBe(r.html.length + r.cssInline.length);
  });
});

describe("buildPreviewPage", () => {
  it("produces a full HTML document", () => {
    const r = generateWidget({ coins: ["bitcoin"], currency: "usd" });
    if ("error" in r) throw new Error("should not error");
    const page = buildPreviewPage(r);
    expect(page).toContain("<!doctype html>");
    expect(page).toContain("<style>");
    expect(page).toContain("<body");
  });
});

describe("listKnownCoins", () => {
  it("returns a non-empty list with id+name+symbol", () => {
    const list = listKnownCoins();
    expect(list.length).toBeGreaterThan(5);
    expect(list[0]).toHaveProperty("id");
    expect(list[0]).toHaveProperty("name");
    expect(list[0]).toHaveProperty("symbol");
  });
  it("includes bitcoin and ethereum", () => {
    const list = listKnownCoins();
    expect(list.find((c) => c.id === "bitcoin")).toBeDefined();
    expect(list.find((c) => c.id === "ethereum")).toBeDefined();
  });
});
