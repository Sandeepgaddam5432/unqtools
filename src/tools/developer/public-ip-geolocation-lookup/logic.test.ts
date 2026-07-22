import { describe, it, expect, beforeEach } from "vitest";
import {
  PROVIDERS,
  PROVIDER_LABELS,
  PRIVATE_IPV4_PREFIXES,
  detectIpFamily,
  validateIpv4,
  validateIpv6,
  validateDomain,
  detectTargetType,
  normalizeTarget,
  isPrivateIpv4,
  isPrivateIpv6,
  isPrivateTarget,
  buildMyIpUrl,
  buildGeolocateUrl,
  curlCommand,
  wgetCommand,
  httpieCommand,
  fetchCommand,
  reverseDnsCommands,
  buildPtrName,
  expandIpv6,
  generateMyIpCommands,
  generateGeolocateCommands,
  generateProviderComparison,
  detectProviderFromResponse,
  parseGeolocationResponse,
  extractAsnFromOrg,
  extractIspFromOrg,
  formatGoogleMapsUrl,
  formatOsmUrl,
  renderMarkdown,
  renderCsv,
  accuracyCaveat,
  parseBulk,
  generateBulkCurl,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ProviderId,
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

describe("public-ip-geolocation constants", () => {
  it("has 6 providers", () => {
    expect(PROVIDERS).toHaveLength(6);
  });
  it("has provider labels for all ids", () => {
    expect(Object.keys(PROVIDER_LABELS)).toHaveLength(6);
    expect(PROVIDER_LABELS.ipinfo).toBe("ipinfo.io");
  });
  it("has private IPv4 prefixes", () => {
    expect(PRIVATE_IPV4_PREFIXES.length).toBeGreaterThan(10);
    expect(PRIVATE_IPV4_PREFIXES).toContain("10.");
    expect(PRIVATE_IPV4_PREFIXES).toContain("192.168.");
  });
});

describe("public-ip-geolocation validation", () => {
  it("validates IPv4 addresses", () => {
    expect(validateIpv4("8.8.8.8")).toBe(true);
    expect(validateIpv4("192.168.1.1")).toBe(true);
    expect(validateIpv4("256.1.1.1")).toBe(false);
    expect(validateIpv4("1.2.3")).toBe(false);
    expect(validateIpv4("")).toBe(false);
  });
  it("validates IPv6 addresses", () => {
    expect(validateIpv6("2606:4700:4700::1111")).toBe(true);
    expect(validateIpv6("::1")).toBe(true);
    expect(validateIpv6("fe80::1")).toBe(true);
    expect(validateIpv6("2001:db8::1")).toBe(true);
    expect(validateIpv6("not-an-ip")).toBe(false);
    expect(validateIpv6("")).toBe(false);
    expect(validateIpv6("gggg::1")).toBe(false);
  });
  it("validates domains", () => {
    expect(validateDomain("example.com")).toBe(true);
    expect(validateDomain("cloudflare.com")).toBe(true);
    expect(validateDomain("sub.example.co.uk")).toBe(true);
    expect(validateDomain("not_a_domain")).toBe(false);
    expect(validateDomain("")).toBe(false);
  });
  it("detects IP family", () => {
    expect(detectIpFamily("8.8.8.8")).toBe("ipv4");
    expect(detectIpFamily("2606:4700:4700::1111")).toBe("ipv6");
    expect(detectIpFamily("example.com")).toBe("invalid");
    expect(detectIpFamily("")).toBe("invalid");
  });
  it("detects target type", () => {
    expect(detectTargetType("8.8.8.8")).toBe("ipv4");
    expect(detectTargetType("2606:4700:4700::1111")).toBe("ipv6");
    expect(detectTargetType("example.com")).toBe("domain");
    expect(detectTargetType("192.168.1.1")).toBe("private");
    expect(detectTargetType("127.0.0.1")).toBe("private");
    expect(detectTargetType("::1")).toBe("private");
    expect(detectTargetType("not-valid")).toBe("invalid");
  });
});

describe("public-ip-geolocation private detection", () => {
  it("detects private IPv4 ranges", () => {
    expect(isPrivateIpv4("10.0.0.1")).toBe(true);
    expect(isPrivateIpv4("192.168.1.1")).toBe(true);
    expect(isPrivateIpv4("172.16.0.1")).toBe(true);
    expect(isPrivateIpv4("172.31.255.255")).toBe(true);
    expect(isPrivateIpv4("172.32.0.1")).toBe(false); // outside the range
    expect(isPrivateIpv4("127.0.0.1")).toBe(true);
    expect(isPrivateIpv4("169.254.1.1")).toBe(true);
    expect(isPrivateIpv4("8.8.8.8")).toBe(false);
    expect(isPrivateIpv4("1.1.1.1")).toBe(false);
  });
  it("detects private IPv6 ranges", () => {
    expect(isPrivateIpv6("::1")).toBe(true);
    expect(isPrivateIpv6("fc00::1")).toBe(true);
    expect(isPrivateIpv6("fd00::1")).toBe(true);
    expect(isPrivateIpv6("fe80::1")).toBe(true);
    expect(isPrivateIpv6("ff00::1")).toBe(true);
    expect(isPrivateIpv6("2001:db8::1")).toBe(true);
    expect(isPrivateIpv6("2606:4700:4700::1111")).toBe(false);
  });
  it("isPrivateTarget works for both families", () => {
    expect(isPrivateTarget("192.168.1.1")).toBe(true);
    expect(isPrivateTarget("::1")).toBe(true);
    expect(isPrivateTarget("8.8.8.8")).toBe(false);
  });
});

describe("public-ip-geolocation normalizeTarget", () => {
  it("trims whitespace", () => {
    expect(normalizeTarget("  8.8.8.8  ")).toBe("8.8.8.8");
  });
  it("lowercases domains", () => {
    expect(normalizeTarget("EXAMPLE.com")).toBe("example.com");
  });
  it("leaves IPv4 case alone (no case anyway)", () => {
    expect(normalizeTarget("8.8.8.8")).toBe("8.8.8.8");
  });
  it("lowercases IPv6", () => {
    expect(normalizeTarget("2606:4700:4700::ABCD")).toBe("2606:4700:4700::abcd");
  });
  it("empty input", () => {
    expect(normalizeTarget("")).toBe("");
  });
});

describe("public-ip-geolocation URL building", () => {
  it("builds my-ip URL for ipinfo", () => {
    expect(buildMyIpUrl("ipinfo")).toBe("https://ipinfo.io/json");
  });
  it("builds my-ip URL with token for ipinfo", () => {
    expect(buildMyIpUrl("ipinfo", "MYTOKEN")).toContain("token=MYTOKEN");
  });
  it("builds my-ip URL for ip-api (http)", () => {
    expect(buildMyIpUrl("ip-api")).toBe("http://ip-api.com/json/");
  });
  it("builds geolocate URL for ipinfo", () => {
    expect(buildGeolocateUrl("8.8.8.8", "ipinfo")).toBe("https://ipinfo.io/8.8.8.8/json");
  });
  it("builds geolocate URL for ip-api", () => {
    expect(buildGeolocateUrl("8.8.8.8", "ip-api")).toBe("http://ip-api.com/json/8.8.8.8");
  });
  it("returns empty for domain on a provider that needs IP", () => {
    expect(buildGeolocateUrl("example.com", "ipapi")).toBe("");
  });
  it("builds geolocate URL for ipgeolocation with API key", () => {
    const url = buildGeolocateUrl("8.8.8.8", "ipgeolocation", "KEY");
    expect(url).toContain("ip=8.8.8.8");
    expect(url).toContain("apiKey=KEY");
  });
});

describe("public-ip-geolocation command snippets", () => {
  it("curl command includes Accept header", () => {
    const c = curlCommand("https://example.com", { includeHeaders: true });
    expect(c).toContain("curl");
    expect(c).toContain("Accept: application/json");
    expect(c).toContain("https://example.com");
  });
  it("wget command uses -qO-", () => {
    expect(wgetCommand("https://example.com")).toBe("wget -qO- 'https://example.com'");
  });
  it("httpie command includes Accept header", () => {
    expect(httpieCommand("https://example.com")).toContain("Accept:application/json");
  });
  it("fetch command uses fetch()", () => {
    const c = fetchCommand("https://example.com");
    expect(c).toContain("fetch('https://example.com'");
    expect(c).toContain(".then(r => r.json())");
  });
});

describe("public-ip-geolocation reverse DNS", () => {
  it("builds in-addr.arpa for IPv4", () => {
    expect(buildPtrName("8.8.8.8")).toBe("8.8.8.8.in-addr.arpa");
  });
  it("builds ip6.arpa for IPv6", () => {
    expect(buildPtrName("2606:4700:4700::1111")).toContain(".ip6.arpa");
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
  it("generates reverse DNS commands", () => {
    const cmds = reverseDnsCommands("8.8.8.8");
    expect(cmds.length).toBe(3);
    expect(cmds[0].command).toContain("dig");
    expect(cmds[0].command).toContain("8.8.8.8");
  });
  it("returns empty for invalid target", () => {
    expect(reverseDnsCommands("not-valid")).toEqual([]);
  });
});

describe("public-ip-geolocation command generation", () => {
  it("generates my-ip commands for ipinfo", () => {
    const cmds = generateMyIpCommands("ipinfo");
    expect(cmds).toHaveLength(4);
    expect(cmds.some((c) => c.tool === "curl")).toBe(true);
    expect(cmds.some((c) => c.tool === "wget")).toBe(true);
    expect(cmds.some((c) => c.tool === "httpie")).toBe(true);
    expect(cmds.some((c) => c.tool === "fetch")).toBe(true);
  });
  it("generates geolocate commands for 8.8.8.8", () => {
    const cmds = generateGeolocateCommands("8.8.8.8", "ipinfo");
    expect(cmds.length).toBeGreaterThan(0);
    expect(cmds[0].command).toContain("ipinfo.io/8.8.8.8");
  });
  it("returns private-IP note for 192.168.1.1", () => {
    const cmds = generateGeolocateCommands("192.168.1.1", "ipinfo");
    expect(cmds).toHaveLength(1);
    expect(cmds[0].command).toContain("private");
  });
  it("returns invalid note for non-IP", () => {
    const cmds = generateGeolocateCommands("not-valid", "ipinfo");
    expect(cmds).toHaveLength(1);
    expect(cmds[0].label).toContain("Invalid");
  });
  it("returns resolve-domain note for ipapi + domain", () => {
    const cmds = generateGeolocateCommands("example.com", "ipapi");
    expect(cmds).toHaveLength(1);
    expect(cmds[0].command).toContain("dig +short");
  });
  it("generates provider comparison", () => {
    const cmds = generateProviderComparison("8.8.8.8");
    expect(cmds.length).toBeGreaterThanOrEqual(5);
    expect(cmds.some((c) => c.label === "ipinfo.io")).toBe(true);
    expect(cmds.some((c) => c.label === "ip-api.com")).toBe(true);
  });
});

describe("public-ip-geolocation response parsing", () => {
  it("detects ipinfo response shape", () => {
    const json = JSON.parse('{"ip":"8.8.8.8","hostname":"dns.google","city":"Mountain View","region":"California","country":"US","loc":"37.4056,-122.0775","org":"AS15169 Google LLC","postal":"94043","timezone":"America/Los_Angeles"}');
    expect(detectProviderFromResponse(json)).toBe("ipinfo");
  });
  it("detects ip-api response shape", () => {
    const json = JSON.parse('{"query":"8.8.8.8","status":"success","country":"United States","countryCode":"US","region":"VA","regionName":"Virginia","city":"Ashburn","zip":"","lat":39.03,"lon":-77.5,"timezone":"America/New_York","isp":"Google LLC","org":"Google Public DNS","as":"AS15169 Google LLC"}');
    expect(detectProviderFromResponse(json)).toBe("ip-api");
  });
  it("parses ipinfo response", () => {
    const raw = JSON.stringify({
      ip: "8.8.8.8",
      hostname: "dns.google",
      city: "Mountain View",
      region: "California",
      country: "US",
      loc: "37.4056,-122.0775",
      org: "AS15169 Google LLC",
      postal: "94043",
      timezone: "America/Los_Angeles",
    });
    const g = parseGeolocationResponse(raw, "ipinfo");
    expect(g.ip).toBe("8.8.8.8");
    expect(g.hostname).toBe("dns.google");
    expect(g.city).toBe("Mountain View");
    expect(g.lat).toBeCloseTo(37.4056);
    expect(g.lon).toBeCloseTo(-122.0775);
    expect(g.asn).toBe("AS15169");
    expect(g.isp).toBe("Google LLC");
  });
  it("parses ip-api response", () => {
    const raw = JSON.stringify({
      query: "8.8.8.8",
      status: "success",
      country: "United States",
      countryCode: "US",
      city: "Ashburn",
      lat: 39.03,
      lon: -77.5,
      timezone: "America/New_York",
      isp: "Google LLC",
      as: "AS15169 Google LLC",
    });
    const g = parseGeolocationResponse(raw, "ip-api");
    expect(g.ip).toBe("8.8.8.8");
    expect(g.country).toBe("United States");
    expect(g.countryCode).toBe("US");
    expect(g.lat).toBeCloseTo(39.03);
    expect(g.asn).toBe("AS15169");
  });
  it("parses ipgeolocation response", () => {
    const raw = JSON.stringify({
      ip: "8.8.8.8",
      country_code2: "US",
      country_name: "United States",
      state_prov: "Virginia",
      city: "Ashburn",
      latitude: 39.03,
      longitude: -77.5,
      radius: 50,
      time_zone: "America/New_York",
      isp: "Google LLC",
      asn: "AS15169",
    });
    const g = parseGeolocationResponse(raw, "ipgeolocation");
    expect(g.ip).toBe("8.8.8.8");
    expect(g.country).toBe("United States");
    expect(g.accuracyRadiusKm).toBe(50);
    expect(g.asn).toBe("AS15169");
  });
  it("parses ipapi.co response", () => {
    const raw = JSON.stringify({
      ip: "8.8.8.8",
      city: "Ashburn",
      region: "Virginia",
      country_name: "United States",
      country_code: "US",
      postal: "20149",
      latitude: 39.03,
      longitude: -77.5,
      timezone: "America/New_York",
      asn: "AS15169",
      org: "Google LLC",
    });
    const g = parseGeolocationResponse(raw, "ipapi");
    expect(g.ip).toBe("8.8.8.8");
    expect(g.countryCode).toBe("US");
    expect(g.lat).toBeCloseTo(39.03);
  });
  it("returns error note for invalid JSON", () => {
    const g = parseGeolocationResponse("not json at all", "ipinfo");
    expect(g.notes.length).toBeGreaterThan(0);
    expect(g.notes[0]).toContain("Invalid JSON");
  });
  it("extracts ASN from org string", () => {
    expect(extractAsnFromOrg("AS15169 Google LLC")).toBe("AS15169");
    expect(extractAsnFromOrg("Google LLC")).toBeUndefined();
    expect(extractAsnFromOrg(undefined)).toBeUndefined();
  });
  it("extracts ISP from org string", () => {
    expect(extractIspFromOrg("AS15169 Google LLC")).toBe("Google LLC");
    expect(extractIspFromOrg("Google LLC")).toBe("Google LLC");
  });
});

describe("public-ip-geolocation formatting", () => {
  it("formats Google Maps URL", () => {
    expect(formatGoogleMapsUrl(37.4, -122.0)).toBe("https://www.google.com/maps?q=37.4,-122");
  });
  it("formats OSM URL", () => {
    expect(formatOsmUrl(37.4, -122.0)).toContain("openstreetmap.org");
    expect(formatOsmUrl(37.4, -122.0)).toContain("37.4");
  });
  it("returns empty for missing coords", () => {
    expect(formatGoogleMapsUrl(undefined, undefined)).toBe("");
    expect(formatOsmUrl(undefined, undefined)).toBe("");
  });
  it("renders markdown table", () => {
    const g = parseGeolocationResponse(
      JSON.stringify({ ip: "8.8.8.8", city: "Ashburn", country: "US" }),
      "ipinfo",
    );
    const md = renderMarkdown(g);
    expect(md).toContain("| Field | Value |");
    expect(md).toContain("| IP | 8.8.8.8 |");
  });
  it("renders CSV with header", () => {
    const g = parseGeolocationResponse(
      JSON.stringify({ ip: "8.8.8.8", city: "Ashburn" }),
      "ipinfo",
    );
    const csv = renderCsv(g);
    expect(csv).toContain("ip,hostname,country,country_code");
    expect(csv).toContain("8.8.8.8");
  });
  it("accuracy caveat mentions approximate", () => {
    const g: { accuracyRadiusKm?: number } = { accuracyRadiusKm: 50 } as never;
    expect(accuracyCaveat(g as never)).toContain("50 km");
    const g2 = {} as never;
    expect(accuracyCaveat(g2 as never)).toContain("approximate");
  });
});

describe("public-ip-geolocation bulk lookup", () => {
  it("parses bulk input", () => {
    expect(parseBulk("8.8.8.8\n1.1.1.1,9.9.9.9")).toEqual(["8.8.8.8", "1.1.1.1", "9.9.9.9"]);
  });
  it("skips blanks", () => {
    expect(parseBulk("8.8.8.8\n\n  \n1.1.1.1")).toEqual(["8.8.8.8", "1.1.1.1"]);
  });
  it("generates bulk curl script", () => {
    const script = generateBulkCurl(["8.8.8.8", "1.1.1.1"], "ipinfo");
    expect(script).toContain("#!/usr/bin/env bash");
    expect(script).toContain("ipinfo.io/8.8.8.8");
    expect(script).toContain("ipinfo.io/1.1.1.1");
  });
});

describe("public-ip-geolocation history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    const entry: HistoryEntry = { ts: 1, target: "8.8.8.8", type: "ipv4", action: "generate", provider: "ipinfo" };
    saveHistory(entry);
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].target).toBe("8.8.8.8");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, target: String(i), type: "ipv4", action: "generate", provider: "ipinfo" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, target: "8.8.8.8", type: "ipv4", action: "generate", provider: "ipinfo" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("public-ip-geolocation shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("8.8.8.8", "ipinfo", "commands", "");
    expect(url).toContain("target=8.8.8.8");
    expect(url).toContain("provider=ipinfo");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("target=8.8.8.8&provider=ip-api&tab=parse");
    expect(p.target).toBe("8.8.8.8");
    expect(p.provider).toBe("ip-api");
    expect(p.tab).toBe("parse");
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.target).toBe("");
    expect(p.provider).toBe("ipinfo");
  });
  it("filters unknown provider to default", () => {
    const p = parseShareUrl("target=x&provider=unknown-provider");
    expect(p.provider).toBe("ipinfo");
  });
  it("filters unknown tab to default", () => {
    const p = parseShareUrl("tab=invalid");
    expect(p.tab).toBe("commands");
  });
});

// Suppress unused-import lint
export type _Unused = ProviderId;
