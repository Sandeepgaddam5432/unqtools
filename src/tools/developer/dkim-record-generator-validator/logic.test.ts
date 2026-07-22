import { describe, it, expect, beforeEach } from "vitest";
import {
  COMMON_SELECTORS,
  VALID_FLAGS,
  VALID_HASHES,
  VALID_SERVICES,
  VALID_KEY_TYPES,
  TXT_MAX_PER_STRING,
  explainTag,
  explainAllTags,
  explainFlag,
  explainAllFlags,
  isValidDomain,
  isValidSelector,
  isValidBase64,
  isValidHash,
  isValidFlag,
  isValidService,
  isValidKeyType,
  estimateKeyBits,
  buildRecord,
  buildSelectorName,
  parseRecord,
  validateRecord,
  detectMultipleDkimRecords,
  splitTxtForBind,
  generateDigCommands,
  generateKeygenCommands,
  generateCommonSelectorCommands,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type DkimInput,
  type KeyType,
  type HistoryEntry,
} from "./logic";

// Sample base64 strings of approximately the right length for each RSA size.
// These are NOT real public keys — just length-correct base64 for the
// bit-length estimator. Length buckets per logic.ts:
//   1024-bit → 180-279 chars
//   2048-bit → 280-599 chars
//   4096-bit → 600+ chars
const B64_1024 = "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQD" + "A".repeat(176); // ~216 chars
const B64_2048 = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA" + "B".repeat(348); // ~392 chars
const B64_4096 = "MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAQEA" + "C".repeat(700); // ~744 chars
const B64_ED25519 = "D" + "E".repeat(43); // 44 chars → 32 bytes decoded

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

// ---------------------------------------------------------------------------
describe("dkim constants", () => {
  it("has 12 common selectors", () => {
    expect(COMMON_SELECTORS).toHaveLength(12);
    expect(COMMON_SELECTORS).toContain("default");
    expect(COMMON_SELECTORS).toContain("google");
    expect(COMMON_SELECTORS).toContain("selector1");
    expect(COMMON_SELECTORS).toContain("k1");
    expect(COMMON_SELECTORS).toContain("mandrill");
  });
  it("has 3 valid t= flags", () => {
    expect(VALID_FLAGS.size).toBe(3);
    for (const f of ["y", "s", "i"]) {
      expect(VALID_FLAGS.has(f as never)).toBe(true);
    }
  });
  it("has 3 valid hash algorithms", () => {
    expect(VALID_HASHES.size).toBe(3);
  });
  it("has 2 valid service types", () => {
    expect(VALID_SERVICES.size).toBe(2);
  });
  it("has 2 valid key types", () => {
    expect(VALID_KEY_TYPES.size).toBe(2);
  });
  it("TXT_MAX_PER_STRING is 255", () => {
    expect(TXT_MAX_PER_STRING).toBe(255);
  });
});

// ---------------------------------------------------------------------------
describe("dkim explainTag / explainAllTags / explainFlag / explainAllFlags", () => {
  it("explains v tag as required", () => {
    const e = explainTag("v");
    expect(e.tag).toBe("v");
    expect(e.required).toBe(true);
    expect(e.short.toLowerCase()).toContain("version");
  });
  it("explains p tag as required", () => {
    const e = explainTag("p");
    expect(e.required).toBe(true);
    expect(e.long.toLowerCase()).toContain("public key");
  });
  it("explains k tag as optional", () => {
    const e = explainTag("k");
    expect(e.required).toBe(false);
  });
  it("explainAllTags returns 7 tags in order", () => {
    const all = explainAllTags();
    expect(all).toHaveLength(7);
    expect(all.map((t) => t.tag)).toEqual(["v", "k", "p", "h", "s", "t", "n"]);
  });
  it("explains y flag as test mode", () => {
    const e = explainFlag("y");
    expect(e.short.toLowerCase()).toContain("test");
  });
  it("explains i flag as obsolete", () => {
    const e = explainFlag("i");
    expect(e.short.toLowerCase()).toContain("obsolete");
  });
  it("explainAllFlags returns 3 flags", () => {
    expect(explainAllFlags()).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
describe("dkim validators", () => {
  it("validates domain", () => {
    expect(isValidDomain("example.com")).toBe(true);
    expect(isValidDomain("mail.example.com")).toBe(true);
    expect(isValidDomain("not valid")).toBe(false);
    expect(isValidDomain("")).toBe(false);
  });
  it("validates selector", () => {
    expect(isValidSelector("default")).toBe(true);
    expect(isValidSelector("google")).toBe(true);
    expect(isValidSelector("s1")).toBe(true);
    expect(isValidSelector("selector-1")).toBe(true);
    expect(isValidSelector("1bad")).toBe(true); // starts with digit is allowed
    expect(isValidSelector("has space")).toBe(false);
    expect(isValidSelector("")).toBe(false);
    expect(isValidSelector("a".repeat(64))).toBe(false); // > 63 chars
  });
  it("validates base64", () => {
    expect(isValidBase64("MIGfMA0GCSqGSIb3D")).toBe(true);
    expect(isValidBase64("ABCD==")).toBe(true);
    expect(isValidBase64("not base64!")).toBe(false);
    expect(isValidBase64("")).toBe(false);
  });
  it("validates hash", () => {
    expect(isValidHash("sha256")).toBe(true);
    expect(isValidHash("sha1")).toBe(true);
    expect(isValidHash("md5")).toBe(false);
  });
  it("validates flag", () => {
    expect(isValidFlag("y")).toBe(true);
    expect(isValidFlag("s")).toBe(true);
    expect(isValidFlag("z")).toBe(false);
  });
  it("validates service", () => {
    expect(isValidService("email")).toBe(true);
    expect(isValidService("*")).toBe(true);
    expect(isValidService("smtp")).toBe(false);
  });
  it("validates key type", () => {
    expect(isValidKeyType("rsa")).toBe(true);
    expect(isValidKeyType("ed25519")).toBe(true);
    expect(isValidKeyType("ecdsa")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("dkim estimateKeyBits", () => {
  it("estimates 1024-bit RSA from short key", () => {
    expect(estimateKeyBits(B64_1024, "rsa")).toBe(1024);
  });
  it("estimates 2048-bit RSA from medium key", () => {
    expect(estimateKeyBits(B64_2048, "rsa")).toBe(2048);
  });
  it("estimates 4096-bit RSA from long key", () => {
    expect(estimateKeyBits(B64_4096, "rsa")).toBe(4096);
  });
  it("estimates 256-bit Ed25519 from 32-byte key", () => {
    expect(estimateKeyBits(B64_ED25519, "ed25519")).toBe(256);
  });
  it("returns null for empty input", () => {
    expect(estimateKeyBits("", "rsa")).toBeNull();
  });
  it("returns null for too-short RSA key", () => {
    expect(estimateKeyBits("ABCDE", "rsa")).toBeNull();
  });
  it("returns null for ed25519 key with wrong byte count", () => {
    expect(estimateKeyBits(B64_2048, "ed25519")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe("dkim buildRecord", () => {
  it("builds a minimal RSA record", () => {
    const input: DkimInput = {
      selector: "default",
      domain: "example.com",
      keyType: "rsa",
      publicKey: B64_2048,
      hashes: [],
      flags: [],
    };
    const r = buildRecord(input);
    expect(r.startsWith("v=DKIM1; k=rsa; p=")).toBe(true);
    expect(r).toContain(`p=${B64_2048}`);
  });
  it("builds with hashes, service, flags, notes", () => {
    const input: DkimInput = {
      selector: "default",
      domain: "example.com",
      keyType: "rsa",
      publicKey: B64_2048,
      hashes: ["sha256", "sha512"],
      service: "email",
      flags: ["s"],
      notes: "production key",
    };
    const r = buildRecord(input);
    expect(r).toContain("h=sha256:sha512");
    expect(r).toContain("s=email");
    expect(r).toContain("t=s");
    expect(r).toContain("n=production key");
  });
  it("builds revoked record (empty p=)", () => {
    const input: DkimInput = {
      selector: "default",
      domain: "example.com",
      keyType: "rsa",
      publicKey: "",
      hashes: [],
      flags: [],
    };
    expect(buildRecord(input)).toBe("v=DKIM1; k=rsa; p=");
  });
  it("builds Ed25519 record", () => {
    const input: DkimInput = {
      selector: "ed25519",
      domain: "example.com",
      keyType: "ed25519",
      publicKey: B64_ED25519,
      hashes: [],
      flags: [],
    };
    const r = buildRecord(input);
    expect(r.startsWith("v=DKIM1; k=ed25519; p=")).toBe(true);
  });
  it("deduplicates hashes and flags", () => {
    const input: DkimInput = {
      selector: "default",
      domain: "example.com",
      keyType: "rsa",
      publicKey: B64_2048,
      hashes: ["sha256", "sha256", "sha512"],
      flags: ["s", "s"],
    };
    const r = buildRecord(input);
    expect(r).toContain("h=sha256:sha512");
    expect(r).not.toContain("h=sha256:sha256:sha512");
    expect(r).toContain("t=s");
    expect(r).not.toContain("t=s:s");
  });
  it("whitespace in publicKey is stripped", () => {
    const input: DkimInput = {
      selector: "default",
      domain: "example.com",
      keyType: "rsa",
      publicKey: "AB\nCD\tEF GH",
      hashes: [],
      flags: [],
    };
    expect(buildRecord(input)).toContain("p=ABCDEFGH");
  });
});

// ---------------------------------------------------------------------------
describe("dkim buildSelectorName", () => {
  it("builds selector name", () => {
    expect(buildSelectorName("default", "example.com")).toBe("default._domainkey.example.com");
  });
  it("lowercases", () => {
    expect(buildSelectorName("Default", "EXAMPLE.com")).toBe("default._domainkey.example.com");
  });
  it("returns empty for missing input", () => {
    expect(buildSelectorName("", "example.com")).toBe("");
    expect(buildSelectorName("default", "")).toBe("");
  });
});

// ---------------------------------------------------------------------------
describe("dkim parseRecord", () => {
  it("parses semicolon-separated record", () => {
    const r = parseRecord(`v=DKIM1; k=rsa; p=${B64_2048}; t=s`);
    expect(r.tags.v).toBe("DKIM1");
    expect(r.tags.k).toBe("rsa");
    expect(r.tags.p).toBe(B64_2048);
    expect(r.tags.t).toBe("s");
    expect(r.issues).toHaveLength(0);
  });
  it("parses record wrapped in dig double quotes", () => {
    const r = parseRecord(`"v=DKIM1; k=rsa; p=${B64_2048}"`);
    expect(r.tags.v).toBe("DKIM1");
  });
  it("parses whitespace-separated record", () => {
    const r = parseRecord(`v=DKIM1 k=rsa p=${B64_2048}`);
    expect(r.tags.v).toBe("DKIM1");
    expect(r.tags.k).toBe("rsa");
  });
  it("flags duplicate tags", () => {
    const r = parseRecord("v=DKIM1; k=rsa; k=ed25519; p=ABC");
    expect(r.issues.some((i) => i.code === "duplicate-tag")).toBe(true);
    expect(r.tags.k).toBe("ed25519"); // last wins
  });
  it("flags tokens that are not tag=value pairs", () => {
    const r = parseRecord("v=DKIM1; notatag; p=ABC");
    expect(r.issues.some((i) => i.code === "not-a-tag")).toBe(true);
  });
  it("returns error for empty input", () => {
    const r = parseRecord("");
    expect(r.issues.some((i) => i.code === "empty")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("dkim validateRecord", () => {
  it("validates a clean RSA 2048 record", () => {
    const v = validateRecord(`v=DKIM1; k=rsa; p=${B64_2048}; t=s`);
    expect(v.valid).toBe(true);
    expect(v.keyType).toBe("rsa");
    expect(v.estimatedBits).toBe(2048);
    expect(v.isRevoked).toBe(false);
    expect(v.tags.t).toBe("s");
  });
  it("errors when v= is missing", () => {
    const v = validateRecord(`k=rsa; p=${B64_2048}`);
    expect(v.issues.some((i) => i.code === "no-version")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("errors when v= has wrong value", () => {
    const v = validateRecord(`v=DKIM2; k=rsa; p=${B64_2048}`);
    expect(v.issues.some((i) => i.code === "bad-version")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("errors when v= is not first", () => {
    const v = validateRecord(`k=rsa; v=DKIM1; p=${B64_2048}`);
    expect(v.issues.some((i) => i.code === "v-not-first")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("errors when p= is missing", () => {
    const v = validateRecord("v=DKIM1; k=rsa");
    expect(v.issues.some((i) => i.code === "no-public-key")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("errors when p= is not valid base64", () => {
    const v = validateRecord("v=DKIM1; k=rsa; p=not!base64");
    expect(v.issues.some((i) => i.code === "bad-base64")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("flags empty p= as revoked (info, not error)", () => {
    const v = validateRecord("v=DKIM1; k=rsa; p=");
    expect(v.issues.some((i) => i.code === "revoked-key" && i.level === "info")).toBe(true);
    expect(v.isRevoked).toBe(true);
    expect(v.valid).toBe(true); // revoked is not an error
  });
  it("errors on bad key type", () => {
    const v = validateRecord(`v=DKIM1; k=ecdsa; p=${B64_2048}`);
    expect(v.issues.some((i) => i.code === "bad-key-type")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("errors on bad hash algorithm", () => {
    const v = validateRecord(`v=DKIM1; k=rsa; p=${B64_2048}; h=md5`);
    expect(v.issues.some((i) => i.code === "bad-hash")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("warns on weak sha1 hash", () => {
    const v = validateRecord(`v=DKIM1; k=rsa; p=${B64_2048}; h=sha1`);
    expect(v.issues.some((i) => i.code === "weak-hash" && i.level === "warning")).toBe(true);
  });
  it("errors on bad service type", () => {
    const v = validateRecord(`v=DKIM1; k=rsa; p=${B64_2048}; s=smtp`);
    expect(v.issues.some((i) => i.code === "bad-service")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("errors on bad t= flag", () => {
    const v = validateRecord(`v=DKIM1; k=rsa; p=${B64_2048}; t=z`);
    expect(v.issues.some((i) => i.code === "bad-flag")).toBe(true);
    expect(v.valid).toBe(false);
  });
  it("warns on t=y test mode", () => {
    const v = validateRecord(`v=DKIM1; k=rsa; p=${B64_2048}; t=y`);
    expect(v.issues.some((i) => i.code === "test-mode" && i.level === "warning")).toBe(true);
  });
  it("warns on t=i obsolete flag", () => {
    const v = validateRecord(`v=DKIM1; k=rsa; p=${B64_2048}; t=i`);
    expect(v.issues.some((i) => i.code === "obsolete-flag" && i.level === "warning")).toBe(true);
  });
  it("warns on 1024-bit RSA weak key", () => {
    const v = validateRecord(`v=DKIM1; k=rsa; p=${B64_1024}`);
    expect(v.issues.some((i) => i.code === "weak-key-size" && i.level === "warning")).toBe(true);
    expect(v.estimatedBits).toBe(1024);
  });
  it("estimates Ed25519 as 256-bit", () => {
    const v = validateRecord(`v=DKIM1; k=ed25519; p=${B64_ED25519}`);
    expect(v.estimatedBits).toBe(256);
    expect(v.keyType).toBe("ed25519");
  });
  it("defaults k= to rsa with info when missing", () => {
    const v = validateRecord(`v=DKIM1; p=${B64_2048}`);
    expect(v.issues.some((i) => i.code === "no-key-type" && i.level === "info")).toBe(true);
    expect(v.keyType).toBe("rsa");
  });
  it("reports txtSplitNeeded for long 4096-bit records", () => {
    const v = validateRecord(`v=DKIM1; k=rsa; p=${B64_4096}`);
    expect(v.txtSplitNeeded).toBe(true);
    expect(v.recordLength).toBeGreaterThan(255);
  });
});

// ---------------------------------------------------------------------------
describe("dkim detectMultipleDkimRecords", () => {
  it("returns null for a single DKIM record", () => {
    const txts = [`"v=DKIM1; k=rsa; p=ABC"`, `"google-site-verification=abc"`];
    expect(detectMultipleDkimRecords(txts)).toBeNull();
  });
  it("returns an issue for 2 DKIM records", () => {
    const txts = [`"v=DKIM1; k=rsa; p=ABC"`, `"v=DKIM1; k=rsa; p=DEF"`];
    const issue = detectMultipleDkimRecords(txts);
    expect(issue).not.toBeNull();
    expect(issue?.code).toBe("multiple-dkim");
    expect(issue?.level).toBe("error");
  });
  it("returns null for empty list", () => {
    expect(detectMultipleDkimRecords([])).toBeNull();
  });
  it("ignores non-DKIM TXT records", () => {
    const txts = [`"google-site-verification=abc"`, `"spf2.0/pra ..."`, `"v=spf1 -all"`];
    expect(detectMultipleDkimRecords(txts)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe("dkim splitTxtForBind", () => {
  it("returns single quoted string for short record", () => {
    expect(splitTxtForBind("v=DKIM1; k=rsa; p=ABC")).toBe('"v=DKIM1; k=rsa; p=ABC"');
  });
  it("splits long record into multiple quoted chunks", () => {
    const long = "A".repeat(600);
    const split = splitTxtForBind(long, 255);
    expect(split.startsWith('"')).toBe(true);
    // Should contain at least one `" "` separator (i.e. 2+ chunks).
    const chunks = split.match(/"[^"]*"/g) ?? [];
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    // Re-assembling the chunks should give back the original.
    const reassembled = chunks.map((c) => c.slice(1, -1)).join("");
    expect(reassembled).toBe(long);
  });
  it("respects custom maxLen", () => {
    const split = splitTxtForBind("ABCDEF", 2);
    expect(split).toBe('"AB" "CD" "EF"');
  });
});

// ---------------------------------------------------------------------------
describe("dkim generateDigCommands", () => {
  it("generates commands for selector+domain", () => {
    const cmds = generateDigCommands("default", "example.com");
    expect(cmds.length).toBeGreaterThanOrEqual(5);
    expect(cmds.some((c) => c.tool === "dig" && c.command.includes("default._domainkey.example.com"))).toBe(true);
    expect(cmds.some((c) => c.tool === "kdig")).toBe(true);
    expect(cmds.some((c) => c.tool === "curl" && c.command.includes("dns-query"))).toBe(true);
    expect(cmds.some((c) => c.tool === "host")).toBe(true);
  });
  it("returns empty for missing selector", () => {
    expect(generateDigCommands("", "example.com")).toEqual([]);
  });
  it("returns empty for missing domain", () => {
    expect(generateDigCommands("default", "")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("dkim generateKeygenCommands", () => {
  it("generates RSA keygen commands with opendkim-genkey", () => {
    const cmds = generateKeygenCommands("default", "example.com", "rsa", 2048);
    expect(cmds.length).toBeGreaterThanOrEqual(3);
    expect(cmds.some((c) => c.tool === "opendkim-genkey" && c.command.includes("-b 2048"))).toBe(true);
    expect(cmds.some((c) => c.tool === "openssl" && c.command.includes("genrsa"))).toBe(true);
    expect(cmds.some((c) => c.tool === "openssl" && c.command.includes("openssl base64 -A"))).toBe(true);
  });
  it("generates Ed25519 keygen commands", () => {
    const cmds = generateKeygenCommands("ed25519", "example.com", "ed25519");
    expect(cmds.length).toBeGreaterThanOrEqual(2);
    expect(cmds.some((c) => c.tool === "openssl" && c.command.includes("Ed25519"))).toBe(true);
    expect(cmds.some((c) => c.tool === "openssl" && c.command.includes("tail -c 32"))).toBe(true);
  });
  it("returns empty for missing inputs", () => {
    expect(generateKeygenCommands("", "example.com", "rsa")).toEqual([]);
    expect(generateKeygenCommands("default", "", "rsa")).toEqual([]);
  });
  it("uses requested RSA bit size in opendkim-genkey", () => {
    const cmds = generateKeygenCommands("default", "example.com", "rsa", 4096);
    expect(cmds.some((c) => c.command.includes("-b 4096"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("dkim generateCommonSelectorCommands", () => {
  it("generates one command per common selector", () => {
    const cmds = generateCommonSelectorCommands("example.com");
    expect(cmds).toHaveLength(COMMON_SELECTORS.length);
    expect(cmds.every((c) => c.command.includes("._domainkey.example.com"))).toBe(true);
  });
  it("returns empty for empty domain", () => {
    expect(generateCommonSelectorCommands("")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("dkim history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, action: "generate", keyType: "rsa", estimatedBits: 2048 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, action: "validate", keyType: "rsa", estimatedBits: 2048 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, action: "generate", keyType: "rsa", estimatedBits: 2048 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("does not store the public key (privacy)", () => {
    const entry: HistoryEntry = { ts: 1, action: "generate", keyType: "rsa", estimatedBits: 2048 };
    saveHistory(entry);
    const loaded = loadHistory();
    expect(loaded[0]).toEqual(entry);
    expect(Object.keys(loaded[0])).toEqual(["ts", "action", "keyType", "estimatedBits"]);
  });
});

// ---------------------------------------------------------------------------
describe("dkim shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ tab: "validate", record: "v=DKIM1; k=rsa; p=ABC" });
    expect(url).toContain("tab=validate");
    expect(url).toContain("r=v%3DDKIM1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("tab=validate&r=v%3DDKIM1%3B%20k%3Drsa");
    expect(p.tab).toBe("validate");
    expect(p.record).toBe("v=DKIM1; k=rsa");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("ignores unknown tab values", () => {
    const p = parseShareUrl("tab=unknown");
    expect(p.tab).toBeUndefined();
  });
});

// Suppress unused-import lint for type-only imports.
export type _Unused = KeyType;
