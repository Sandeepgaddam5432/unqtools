import { describe, it, expect } from "vitest";
import {
  atbash,
  atbashChar,
  encrypt,
  decrypt,
  atbashTable,
  validateAlphabet,
  atbashBatch,
  computeStats,
  hasMirrors,
  historyToCsv,
  formatHistoryEntry,
  DEFAULT_ALPHABET,
} from "./logic";

describe("atbashChar", () => {
  it("mirrors uppercase A to Z", () => {
    expect(atbashChar("A")).toBe("Z");
  });
  it("mirrors uppercase Z to A", () => {
    expect(atbashChar("Z")).toBe("A");
  });
  it("mirrors lowercase a to z", () => {
    expect(atbashChar("a")).toBe("z");
  });
  it("mirrors lowercase m to n", () => {
    expect(atbashChar("m")).toBe("n");
  });
  it("leaves non-letters untouched", () => {
    expect(atbashChar("5")).toBe("5");
    expect(atbashChar("!")).toBe("!");
    expect(atbashChar(" ")).toBe(" ");
  });
  it("removes non-letters when preserveNonAlpha=false", () => {
    expect(atbashChar("!", { preserveNonAlpha: false })).toBe("");
  });
});

describe("atbash", () => {
  it("applies to entire strings", () => {
    expect(atbash("Hello, World!")).toBe("Svool, Dliow!");
  });
  it("is its own inverse", () => {
    const s = "The quick brown fox";
    expect(atbash(atbash(s))).toBe(s);
  });
  it("returns empty for empty input", () => {
    expect(atbash("")).toBe("");
  });
});

describe("encrypt/decrypt", () => {
  it("encrypt matches atbash", () => {
    expect(encrypt("ABC")).toBe("ZYX");
  });
  it("decrypt matches atbash", () => {
    expect(decrypt("ZYX")).toBe("ABC");
  });
  it("round-trips via encrypt/decrypt", () => {
    const s = "Round trip 42";
    expect(decrypt(encrypt(s))).toBe(s);
  });
});

describe("atbashTable", () => {
  it("returns 26 entries", () => {
    expect(atbashTable().length).toBe(26);
  });
  it("first entry is A->Z", () => {
    const t = atbashTable();
    expect(t[0]).toEqual({ from: "A", to: "Z" });
  });
  it("middle entry is M->N", () => {
    const t = atbashTable();
    expect(t[12]).toEqual({ from: "M", to: "N" });
  });
});

describe("validateAlphabet", () => {
  it("accepts default when undefined", () => {
    expect(validateAlphabet(undefined)).toEqual({ ok: true, alphabet: DEFAULT_ALPHABET });
  });
  it("rejects too-short alphabet", () => {
    expect("error" in validateAlphabet("ABC")).toBe(true);
  });
  it("rejects alphabet with duplicates", () => {
    expect("error" in validateAlphabet("AABCDEFGHIJKLMNOPQRSTUVWXYZ")).toBe(true);
  });
  it("rejects alphabet with non-letters", () => {
    expect("error" in validateAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXY!")).toBe(true);
  });
});

describe("custom alphabet", () => {
  it("mirrors according to custom alphabet", () => {
    const rev = "ZYXWVUTSRQPONMLKJIHGFEDCBA";
    expect(atbash("A", { alphabet: rev })).toBe("Z");
    expect(atbash("ABC", { alphabet: rev })).toBe("ZYX");
  });
});

describe("atbashBatch", () => {
  it("processes multiple inputs", () => {
    expect(atbashBatch(["ABC", "XYZ"])).toEqual(["ZYX", "CBA"]);
  });
});

describe("computeStats", () => {
  it("counts mirrored letters", () => {
    const s = computeStats("Hello, World!");
    expect(s.chars).toBe(13);
    expect(s.lettersMirrored).toBe(10);
    expect(s.preserved).toBe(3);
  });
});

describe("hasMirrors", () => {
  it("returns true when letters present", () => {
    expect(hasMirrors("abc")).toBe(true);
  });
  it("returns false when no letters", () => {
    expect(hasMirrors("123!@#")).toBe(false);
  });
});

describe("historyToCsv", () => {
  it("generates CSV with header", () => {
    const csv = historyToCsv([{ ts: 1700000000000, input: "ABC", output: "ZYX" }]);
    expect(csv.split("\n")[0]).toBe("Timestamp,Input,Output");
    expect(csv).toContain("ABC");
  });
});

describe("formatHistoryEntry", () => {
  it("formats entry for display", () => {
    const s = formatHistoryEntry({ ts: 1700000000000, input: "ABC", output: "ZYX" });
    expect(s).toContain("ZYX");
  });
});
