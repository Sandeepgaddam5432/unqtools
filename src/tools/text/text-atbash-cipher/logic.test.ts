import { describe, it, expect } from "vitest";
import { atbash, atbashChar, encrypt, decrypt, atbashTable } from "./logic";

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
});

describe("atbash", () => {
  it("applies to entire strings", () => {
    expect(atbash("Hello, World!")).toBe("Svool, Dliow!");
  });

  it("is its own inverse", () => {
    const s = "The quick brown fox";
    expect(atbash(atbash(s))).toBe(s);
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
