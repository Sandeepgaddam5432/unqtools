import { describe, it, expect } from "vitest";
import { normalizePlus, decodePercent, urlDecode, validateOptions } from "./logic";

describe("normalizePlus", () => {
  it("replaces + with space when enabled", () => {
    expect(normalizePlus("a+b+c", true)).toBe("a b c");
  });
  it("preserves + when disabled", () => {
    expect(normalizePlus("a+b+c", false)).toBe("a+b+c");
  });
});

describe("decodePercent", () => {
  it("decodes simple %XX sequences", () => {
    expect(decodePercent("%41%42%43").output).toBe("ABC");
  });
  it("leaves invalid sequences intact and counts them", () => {
    const r = decodePercent("%ZZ");
    expect(r.invalid).toBe(1);
  });
  it("decodes UTF-8 multibyte", () => {
    // © = U+00A9 = %C2%A9
    expect(decodePercent("%C2%A9").output).toBe("©");
  });
  it("passes through non-percent chars", () => {
    expect(decodePercent("hello").output).toBe("hello");
  });
});

describe("urlDecode", () => {
  it("decodes standard URL components", () => {
    const r = urlDecode("hello%20world", { component: true, plusToSpace: false });
    expect(r.output).toBe("hello world");
  });
  it("converts + to space when enabled", () => {
    const r = urlDecode("hello+world", { component: true, plusToSpace: true });
    expect(r.output).toBe("hello world");
  });
  it("handles empty input", () => {
    const r = urlDecode("", { component: true, plusToSpace: false });
    expect(r.output).toBe("");
  });
  it("counts invalid sequences", () => {
    const r = urlDecode("%ZZ", { component: false, plusToSpace: false });
    expect(r.invalidSequences).toBe(1);
  });
  it("decodes Unicode correctly via component mode", () => {
    const r = urlDecode("%E2%82%AC", { component: true, plusToSpace: false });
    expect(r.output).toBe("€");
  });
});

describe("validateOptions", () => {
  it("accepts valid options", () => {
    expect(validateOptions({ component: true, plusToSpace: false })).toEqual({ ok: true });
  });
  it("rejects non-boolean component", () => {
    expect(validateOptions({ component: "yes" as unknown as boolean, plusToSpace: false })).toHaveProperty("error");
  });
});
