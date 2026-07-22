import { describe, it, expect, beforeEach } from "vitest";
import {
  RESOLVERS,
  RESOLVER_LABELS,
  RECORD_TYPES,
  RECORD_TYPE_CODES,
  RECORD_CODE_TO_NAME,
  RCODES,
  validateDnsName,
  validateDomain,
  normalizeDnsName,
  validateRecordType,
  normalizeRecordType,
  base64UrlEncode,
  base64UrlDecode,
  base64UrlEncodeStr,
  base64UrlDecodeStr,
  buildDnsHeader,
  encodeDnsName,
  encodeOptRecord,
  encodeDnsMessage,
  buildDnsQueryMessage,
  encodeDnsQueryBase64Url,
  decodeDnsHeader,
  decodeDnsName,
  getJsonEndpoint,
  getWireEndpoint,
  buildDohJsonUrl,
  buildDohWireUrl,
  buildDohUrl,
  randomPadding,
  curlJsonCommand,
  curlWireGetCommand,
  curlWirePostCommand,
  wgetJsonCommand,
  wgetWireCommand,
  httpieJsonCommand,
  httpieWireCommand,
  fetchJsonCommand,
  fetchWireCommand,
  generateCommands,
  generateComparisonCommands,
  buildPtrName,
  expandIpv6,
  parseDohJsonResponse,
  recordTypeName,
  renderMarkdown,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ResolverId,
  type DoHMode,
  type HttpMethod,
  type DnsRecordType,
  type HistoryEntry,
} from "./logic";

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

describe("doh constants", () => {
  it("has 4 resolvers", () => {
    expect(RESOLVERS).toHaveLength(4);
  });
  it("has resolver labels for all ids", () => {
    expect(Object.keys(RESOLVER_LABELS)).toHaveLength(4);
    expect(RESOLVER_LABELS.cloudflare).toContain("Cloudflare");
  });
  it("has many record types", () => {
    expect(RECORD_TYPES.length).toBeGreaterThan(30);
    expect(RECORD_TYPES).toContain("A");
    expect(RECORD_TYPES).toContain("AAAA");
    expect(RECORD_TYPES).toContain("MX");
    expect(RECORD_TYPES).toContain("TXT");
    expect(RECORD_TYPES).toContain("DNSKEY");
  });
  it("maps record-type codes", () => {
    expect(RECORD_TYPE_CODES.A).toBe(1);
    expect(RECORD_TYPE_CODES.AAAA).toBe(28);
    expect(RECORD_TYPE_CODES.MX).toBe(15);
    expect(RECORD_TYPE_CODES.TXT).toBe(16);
    expect(RECORD_TYPE_CODES.OPT).toBe(41);
    expect(RECORD_TYPE_CODES.CAA).toBe(257);
  });
  it("reverse-maps codes to names", () => {
    expect(RECORD_CODE_TO_NAME[1]).toBe("A");
    expect(RECORD_CODE_TO_NAME[28]).toBe("AAAA");
    expect(RECORD_CODE_TO_NAME[257]).toBe("CAA");
  });
  it("has RCODE labels", () => {
    expect(RCODES[0]).toBe("NOERROR");
    expect(RCODES[3]).toBe("NXDOMAIN");
    expect(RCODES[5]).toBe("REFUSED");
  });
});

describe("doh validation", () => {
  it("validates DNS names", () => {
    expect(validateDnsName("example.com")).toBe(true);
    expect(validateDnsName("example.com.")).toBe(true);
    expect(validateDnsName("_dmarc.example.com")).toBe(true);
    expect(validateDnsName("sub.domain.example.co.uk")).toBe(true);
    expect(validateDnsName("")).toBe(false);
    expect(validateDnsName("not valid")).toBe(false);
  });
  it("validates domains (strict)", () => {
    expect(validateDomain("example.com")).toBe(true);
    expect(validateDomain("not_a_domain")).toBe(false);
  });
  it("normalizes DNS names (lowercase)", () => {
    expect(normalizeDnsName("EXAMPLE.com")).toBe("example.com");
    expect(normalizeDnsName("  example.com  ")).toBe("example.com");
  });
  it("validates record types", () => {
    expect(validateRecordType("A")).toBe(true);
    expect(validateRecordType("a")).toBe(true);
    expect(validateRecordType("MX")).toBe(true);
    expect(validateRecordType("INVALID")).toBe(false);
  });
  it("normalizes record types", () => {
    expect(normalizeRecordType("mx")).toBe("MX");
    expect(normalizeRecordType("")).toBe("");
    expect(normalizeRecordType("invalid")).toBe("");
  });
});

describe("doh base64url", () => {
  it("encodes and decodes bytes round-trip", () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 255, 128, 64, 32]);
    const encoded = base64UrlEncode(bytes);
    const decoded = base64UrlDecode(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });
  it("uses URL-safe alphabet (- and _)", () => {
    // [0xfb, 0x00, 0xff] base64-encodes to "+wD/"; URL-safe form is "-wD_"
    // which contains both - and _ (verifies the alphabet swap from +/ to -_).
    const bytes = new Uint8Array([0xfb, 0x00, 0xff]);
    const encoded = base64UrlEncode(bytes);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
    expect(encoded).toContain("_");
    expect(encoded).toContain("-");
    expect(encoded).toBe("-wD_");
  });
  it("decodes standard base64 too", () => {
    const decoded = base64UrlDecode("////");
    expect(Array.from(decoded)).toEqual([255, 255, 255]);
  });
  it("encodes and decodes strings round-trip", () => {
    const s = "Hello, DoH!";
    const encoded = base64UrlEncodeStr(s);
    const decoded = base64UrlDecodeStr(encoded);
    expect(decoded).toBe(s);
  });
  it("handles empty input", () => {
    expect(base64UrlEncode(new Uint8Array(0))).toBe("");
    expect(Array.from(base64UrlDecode(""))).toEqual([]);
  });
});

describe("doh DNS message encoding", () => {
  it("builds a header with RD set", () => {
    const header = buildDnsHeader(0x1234, true, false);
    // ID in high 16 bits, RD bit (0x0100) in flags
    expect((header >> 16) & 0xffff).toBe(0x1234);
    expect(header & 0xffff).toBe(0x0100);
  });
  it("sets CD bit when cd=true", () => {
    const header = buildDnsHeader(0, true, true);
    expect(header & 0x0010).toBe(0x0010);
  });
  it("encodes a DNS name into wire format", () => {
    const bytes = encodeDnsName("example.com");
    // 7 example 3 com 0
    expect(Array.from(bytes)).toEqual([7, ..."example".split("").map(c => c.charCodeAt(0)), 3, ..."com".split("").map(c => c.charCodeAt(0)), 0]);
  });
  it("encodes root as [0]", () => {
    expect(Array.from(encodeDnsName("."))).toEqual([0]);
    expect(Array.from(encodeDnsName(""))).toEqual([0]);
  });
  it("encodes an OPT record", () => {
    const opt = {
      name: ".", type: 41, udpPayloadSize: 4096,
      extendedRcode: 0, version: 0, flags: 0x8000, data: new Uint8Array(0),
    };
    const bytes = encodeOptRecord(opt);
    // 1 (root) + 2 (type) + 2 (class) + 1 (ext-rcode) + 1 (version) + 2 (flags) + 2 (rdlen) = 11
    expect(bytes.length).toBe(11);
    // TYPE = 41 in bytes 1-2
    expect(bytes[1]).toBe(0);
    expect(bytes[2]).toBe(41);
    // DO flag in bytes 7-8 (0x80, 0x00)
    expect(bytes[7]).toBe(0x80);
    expect(bytes[8]).toBe(0x00);
  });
  it("builds a query message for A record", () => {
    const msg = buildDnsQueryMessage("example.com", "A", { id: 0x1234 });
    expect(msg.id).toBe(0x1234);
    expect(msg.questions).toHaveLength(1);
    expect(msg.questions[0].name).toBe("example.com");
    expect(msg.questions[0].type).toBe(1); // A
    expect(msg.questions[0].klass).toBe(1); // IN
    expect(msg.opt).toBeUndefined();
  });
  it("adds OPT record when doFlag=true", () => {
    const msg = buildDnsQueryMessage("example.com", "A", { doFlag: true });
    expect(msg.opt).toBeDefined();
    expect(msg.opt!.flags & 0x8000).toBe(0x8000);
  });
  it("encodes a complete message to bytes", () => {
    const msg = buildDnsQueryMessage("example.com", "A", { id: 0xabcd });
    const bytes = encodeDnsMessage(msg);
    expect(bytes.length).toBeGreaterThan(12);
    // ID in bytes 0-1
    expect(bytes[0]).toBe(0xab);
    expect(bytes[1]).toBe(0xcd);
    // QDCOUNT in bytes 4-5 = 1
    expect(bytes[4]).toBe(0);
    expect(bytes[5]).toBe(1);
  });
  it("adds OPT record bytes when doFlag=true", () => {
    const msgNoOpt = buildDnsQueryMessage("example.com", "A", { id: 0 });
    const msgWithOpt = buildDnsQueryMessage("example.com", "A", { id: 0, doFlag: true });
    const noOpt = encodeDnsMessage(msgNoOpt);
    const withOpt = encodeDnsMessage(msgWithOpt);
    expect(withOpt.length).toBeGreaterThan(noOpt.length);
    // ARCOUNT in bytes 10-11 = 1
    expect(withOpt[10]).toBe(0);
    expect(withOpt[11]).toBe(1);
  });
  it("encodes query to base64url (non-empty, URL-safe)", () => {
    const b64 = encodeDnsQueryBase64Url("example.com", "A", { id: 0 });
    expect(b64.length).toBeGreaterThan(0);
    expect(b64).not.toContain("+");
    expect(b64).not.toContain("/");
    expect(b64).not.toContain("=");
  });
});

describe("doh DNS message decoding", () => {
  it("decodes a header from a query message", () => {
    const msg = buildDnsQueryMessage("example.com", "A", { id: 0x1234, cdFlag: true });
    const bytes = encodeDnsMessage(msg);
    const header = decodeDnsHeader(bytes);
    expect(header).not.toBeNull();
    expect(header!.id).toBe(0x1234);
    expect(header!.qdCount).toBe(1);
    expect(header!.anCount).toBe(0);
    expect(header!.rd).toBe(true);
    expect(header!.cd).toBe(true);
    expect(header!.rcode).toBe(0);
    expect(header!.rcodeText).toBe("NOERROR");
  });
  it("returns null for too-short input", () => {
    expect(decodeDnsHeader(new Uint8Array([1, 2, 3]))).toBeNull();
  });
  it("decodes a DNS name from a query message", () => {
    const msg = buildDnsQueryMessage("example.com", "A", { id: 0 });
    const bytes = encodeDnsMessage(msg);
    // Skip 12-byte header, then read the name at offset 12.
    // "example.com" wire form: 7 'example' 3 'com' 0 = 13 bytes.
    const { name, nextOffset } = decodeDnsName(bytes, 12);
    expect(name).toBe("example.com.");
    // Next offset points to the type field (after the 0 terminator).
    expect(nextOffset).toBe(12 + 13);
  });
  it("follows compression pointers", () => {
    // Build a synthetic message with a pointer back to offset 12
    const msg = buildDnsQueryMessage("example.com", "A", { id: 0 });
    const bytes = encodeDnsMessage(msg);
    // Append a name pointer to offset 12 (0xc0 0x0c)
    const withPointer = new Uint8Array([...bytes, 0xc0, 0x0c]);
    const { name } = decodeDnsName(withPointer, bytes.length);
    expect(name).toBe("example.com.");
  });
});

describe("doh URL building", () => {
  it("returns cloudflare JSON endpoint", () => {
    expect(getJsonEndpoint("cloudflare")).toBe("https://cloudflare-dns.com/dns-query");
  });
  it("returns cloudflare wire endpoint", () => {
    expect(getWireEndpoint("cloudflare")).toBe("https://cloudflare-dns.com/dns-query");
  });
  it("returns google JSON endpoint", () => {
    expect(getJsonEndpoint("google")).toBe("https://dns.google/resolve");
  });
  it("returns custom URL when set", () => {
    expect(getJsonEndpoint("custom", "https://example.com/doh")).toBe("https://example.com/doh");
  });
  it("returns empty for custom with no URL", () => {
    expect(getJsonEndpoint("custom")).toBe("");
  });
  it("builds JSON URL with name + type", () => {
    const url = buildDohJsonUrl("example.com", "A", { resolver: "cloudflare" });
    expect(url).toContain("https://cloudflare-dns.com/dns-query");
    expect(url).toContain("name=example.com");
    expect(url).toContain("type=A");
  });
  it("builds JSON URL with do=1 when doFlag=true", () => {
    const url = buildDohJsonUrl("example.com", "A", { resolver: "cloudflare", doFlag: true });
    expect(url).toContain("do=1");
  });
  it("builds JSON URL with cd=1 when cdFlag=true", () => {
    const url = buildDohJsonUrl("example.com", "A", { resolver: "google", cdFlag: true });
    expect(url).toContain("cd=1");
  });
  it("builds wire URL with dns= parameter", () => {
    const url = buildDohWireUrl("example.com", "A", { resolver: "cloudflare" });
    expect(url).toContain("https://cloudflare-dns.com/dns-query");
    expect(url).toContain("dns=");
    expect(url).not.toContain("dns=&");
  });
  it("buildDohUrl picks the right mode", () => {
    const jsonUrl = buildDohUrl("example.com", "A", {
      resolver: "cloudflare", customUrl: "", mode: "json", method: "GET", doFlag: false, cdFlag: false,
    });
    expect(jsonUrl).toContain("name=example.com");
    const wireUrl = buildDohUrl("example.com", "A", {
      resolver: "cloudflare", customUrl: "", mode: "wire", method: "GET", doFlag: false, cdFlag: false,
    });
    expect(wireUrl).toContain("dns=");
  });
  it("adds random_padding when pad=true", () => {
    const url = buildDohJsonUrl("example.com", "A", { resolver: "cloudflare", pad: true });
    expect(url).toContain("random_padding=");
  });
  it("randomPadding produces 80 chars", () => {
    const p = randomPadding();
    expect(p).toHaveLength(80);
  });
});

describe("doh command snippets", () => {
  it("curl JSON command includes Accept header", () => {
    const c = curlJsonCommand("https://example.com/doh?name=x");
    expect(c).toContain("curl");
    expect(c).toContain("Accept: application/dns-json");
    expect(c).toContain("https://example.com/doh?name=x");
  });
  it("curl wire GET includes Accept and output", () => {
    const c = curlWireGetCommand("https://example.com/doh?dns=abc");
    expect(c).toContain("Accept: application/dns-message");
    expect(c).toContain("--output response.dns");
  });
  it("curl wire POST includes Content-Type and data-binary", () => {
    const c = curlWirePostCommand("https://example.com/doh", "AAAA");
    expect(c).toContain("Content-Type: application/dns-message");
    expect(c).toContain("--data-binary @query.dns");
    expect(c).toContain("AAAA");
  });
  it("wget JSON command uses --header", () => {
    expect(wgetJsonCommand("https://x")).toContain("--header='Accept: application/dns-json'");
  });
  it("wget wire command saves to file", () => {
    expect(wgetWireCommand("https://x")).toContain("response.dns");
  });
  it("httpie JSON command includes Accept", () => {
    expect(httpieJsonCommand("https://x")).toContain("Accept:application/dns-json");
  });
  it("httpie wire command downloads to file", () => {
    expect(httpieWireCommand("https://x")).toContain("response.dns");
  });
  it("fetch JSON command uses fetch()", () => {
    const c = fetchJsonCommand("https://x");
    expect(c).toContain("fetch('https://x'");
    expect(c).toContain("application/dns-json");
  });
  it("fetch wire command uses arrayBuffer()", () => {
    const c = fetchWireCommand("https://x");
    expect(c).toContain("application/dns-message");
    expect(c).toContain("arrayBuffer()");
  });
});

describe("doh command generation", () => {
  const jsonOpts = {
    resolver: "cloudflare" as ResolverId,
    customUrl: "",
    mode: "json" as DoHMode,
    method: "GET" as HttpMethod,
    doFlag: false,
    cdFlag: false,
  };
  const wireGetOpts = {
    resolver: "cloudflare" as ResolverId,
    customUrl: "",
    mode: "wire" as DoHMode,
    method: "GET" as HttpMethod,
    doFlag: false,
    cdFlag: false,
  };
  const wirePostOpts = {
    resolver: "cloudflare" as ResolverId,
    customUrl: "",
    mode: "wire" as DoHMode,
    method: "POST" as HttpMethod,
    doFlag: false,
    cdFlag: false,
  };

  it("generates JSON commands (4 snippets)", () => {
    const cmds = generateCommands("example.com", "A", jsonOpts);
    expect(cmds.length).toBeGreaterThanOrEqual(4);
    expect(cmds.some((c) => c.tool === "curl")).toBe(true);
    expect(cmds.some((c) => c.tool === "wget")).toBe(true);
    expect(cmds.some((c) => c.tool === "httpie")).toBe(true);
    expect(cmds.some((c) => c.tool === "fetch")).toBe(true);
  });
  it("generates wire GET commands with base64url query note", () => {
    const cmds = generateCommands("example.com", "A", wireGetOpts);
    expect(cmds.some((c) => c.label.includes("Wire-format query"))).toBe(true);
  });
  it("generates wire POST commands with bash decode snippet", () => {
    const cmds = generateCommands("example.com", "A", wirePostOpts);
    expect(cmds.some((c) => c.command.includes("base64 -d"))).toBe(true);
    expect(cmds.some((c) => c.command.includes("method: 'POST'"))).toBe(true);
  });
  it("returns missing-endpoint note for custom resolver with no URL", () => {
    const cmds = generateCommands("example.com", "A", { ...jsonOpts, resolver: "custom" });
    expect(cmds).toHaveLength(1);
    expect(cmds[0].label).toContain("Missing endpoint");
  });
  it("generates comparison commands across presets", () => {
    const cmds = generateComparisonCommands("example.com", "A", "json");
    expect(cmds.length).toBe(3); // cloudflare, google, quad9
    expect(cmds.some((c) => c.label.includes("Cloudflare"))).toBe(true);
    expect(cmds.some((c) => c.label.includes("Google"))).toBe(true);
    expect(cmds.some((c) => c.label.includes("Quad9"))).toBe(true);
  });
});

describe("doh PTR helpers", () => {
  it("builds in-addr.arpa for IPv4", () => {
    expect(buildPtrName("8.8.8.8")).toBe("8.8.8.8.in-addr.arpa.");
  });
  it("builds ip6.arpa for IPv6", () => {
    expect(buildPtrName("2606:4700:4700::1111")).toContain(".ip6.arpa.");
    expect(buildPtrName("2606:4700:4700::1111")).toContain("1.1.1.1");
  });
  it("returns empty for invalid IP", () => {
    expect(buildPtrName("not-an-ip")).toBe("");
  });
  it("expands IPv6 to full form", () => {
    expect(expandIpv6("::1")).toBe("0000:0000:0000:0000:0000:0000:0000:0001");
    expect(expandIpv6("2606:4700:4700::1111")).toBe("2606:4700:4700:0000:0000:0000:0000:1111");
    expect(expandIpv6("invalid")).toBe("");
  });
});

describe("doh response parsing", () => {
  it("parses a successful DoH JSON response", () => {
    const raw = JSON.stringify({
      Status: 0,
      TC: false,
      RD: true,
      RA: true,
      AD: true,
      CD: false,
      Question: [{ name: "example.com.", type: 1 }],
      Answer: [
        { name: "example.com.", type: 1, TTL: 300, data: "93.184.216.34" },
      ],
    });
    const p = parseDohJsonResponse(raw);
    expect(p.status).toBe(0);
    expect(p.statusText).toBe("NOERROR");
    expect(p.answer).toHaveLength(1);
    expect(p.answer[0].data).toBe("93.184.216.34");
    expect(p.authenticatedData).toBe(true);
  });
  it("parses an NXDOMAIN response", () => {
    const raw = JSON.stringify({
      Status: 3,
      TC: false,
      RD: true,
      RA: true,
      AD: false,
      CD: false,
    });
    const p = parseDohJsonResponse(raw);
    expect(p.status).toBe(3);
    expect(p.statusText).toBe("NXDOMAIN");
    expect(p.notes.some((n) => n.includes("NXDOMAIN"))).toBe(true);
  });
  it("parses a SERVFAIL response with note", () => {
    const raw = JSON.stringify({ Status: 2, TC: false, RD: true, RA: true });
    const p = parseDohJsonResponse(raw);
    expect(p.notes.some((n) => n.includes("SERVFAIL"))).toBe(true);
  });
  it("parses a REFUSED response with note", () => {
    const raw = JSON.stringify({ Status: 5, TC: false, RD: true, RA: true });
    const p = parseDohJsonResponse(raw);
    expect(p.notes.some((n) => n.includes("REFUSED"))).toBe(true);
  });
  it("notes NOERROR + 0 answers", () => {
    const raw = JSON.stringify({ Status: 0, Answer: [] });
    const p = parseDohJsonResponse(raw);
    expect(p.notes.some((n) => n.includes("no records"))).toBe(true);
  });
  it("handles invalid JSON", () => {
    const p = parseDohJsonResponse("not json");
    expect(p.status).toBe(-1);
    expect(p.notes[0]).toContain("Invalid JSON");
  });
  it("handles non-object JSON", () => {
    const p = parseDohJsonResponse("[1,2,3]");
    expect(p.notes[0]).toContain("not a JSON object");
  });
  it("extracts Authority and Additional sections", () => {
    const raw = JSON.stringify({
      Status: 0,
      Answer: [{ name: "x.", type: 1, TTL: 60, data: "1.2.3.4" }],
      Authority: [{ name: "x.", type: 6, TTL: 60, data: "ns1.x. hostmaster.x. 1 7200 3600 1209600 3600" }],
      Additional: [{ name: "ns1.x.", type: 1, TTL: 60, data: "5.6.7.8" }],
    });
    const p = parseDohJsonResponse(raw);
    expect(p.authority).toHaveLength(1);
    expect(p.additional).toHaveLength(1);
    expect(p.authority[0].type).toBe(6);
  });
  it("maps record-type codes to names", () => {
    expect(recordTypeName(1)).toBe("A");
    expect(recordTypeName(28)).toBe("AAAA");
    expect(recordTypeName(15)).toBe("MX");
    expect(recordTypeName(9999)).toBe("TYPE9999");
  });
  it("renders markdown table", () => {
    const raw = JSON.stringify({
      Status: 0,
      Answer: [{ name: "example.com.", type: 1, TTL: 300, data: "93.184.216.34" }],
    });
    const p = parseDohJsonResponse(raw);
    const md = renderMarkdown(p);
    expect(md).toContain("| Status | 0 (NOERROR) |");
    expect(md).toContain("| example.com. | A | 300 | 93.184.216.34 |");
  });
});

describe("doh history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    const entry: HistoryEntry = {
      ts: 1, name: "example.com", type: "A", resolver: "cloudflare", mode: "json",
    };
    saveHistory(entry);
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].name).toBe("example.com");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, name: `host${i}.com`, type: "A", resolver: "cloudflare", mode: "json",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, name: "example.com", type: "A", resolver: "cloudflare", mode: "json",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("doh shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("example.com", "A", {
      resolver: "cloudflare", customUrl: "", mode: "json", method: "GET", doFlag: true, cdFlag: false,
    });
    expect(url).toContain("name=example.com");
    expect(url).toContain("type=A");
    expect(url).toContain("resolver=cloudflare");
    expect(url).toContain("do=1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("name=example.com&type=MX&resolver=google&mode=wire&method=POST&do=1&cd=1");
    expect(p.name).toBe("example.com");
    expect(p.type).toBe("MX");
    expect(p.opts.resolver).toBe("google");
    expect(p.opts.mode).toBe("wire");
    expect(p.opts.method).toBe("POST");
    expect(p.opts.doFlag).toBe(true);
    expect(p.opts.cdFlag).toBe(true);
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.name).toBe("");
    expect(p.type).toBe("A");
    expect(p.opts.resolver).toBe("cloudflare");
  });
  it("filters unknown resolver to default", () => {
    const p = parseShareUrl("name=x&resolver=unknown-resolver");
    expect(p.opts.resolver).toBe("cloudflare");
  });
  it("filters unknown mode to default (json)", () => {
    const p = parseShareUrl("mode=invalid");
    expect(p.opts.mode).toBe("json");
  });
  it("filters unknown method to default (GET)", () => {
    const p = parseShareUrl("method=invalid");
    expect(p.opts.method).toBe("GET");
  });
  it("filters unknown type to default (A)", () => {
    const p = parseShareUrl("type=INVALID");
    expect(p.type).toBe("A");
  });
});

// Suppress unused-import lint
export type _Unused = ResolverId | DoHMode | HttpMethod | DnsRecordType;
