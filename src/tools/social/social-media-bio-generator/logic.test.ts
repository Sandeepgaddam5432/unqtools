import { describe, it, expect, beforeEach } from "vitest";
import {
  TONES,
  PLATFORMS,
  TONE_LABELS,
  PLATFORM_LABELS,
  PLATFORM_CONFIGS,
  TONE_PRESETS,
  normalizeText,
  capitalize,
  parseInterests,
  formatBullets,
  formatInterests,
  formatName,
  nameFormatForPlatform,
  applyTone,
  generateCTA,
  applyEmojis,
  insertLink,
  insertKeywords,
  insertPronouns,
  countEmojis,
  validateBioLength,
  getCharLimitStatus,
  truncateToLimit,
  generateBio,
  generateVariations,
  generateAll,
  computeStats,
  renderText,
  renderCsv,
  splitCsvRow,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Tone,
  type Platform,
  type NameFormat,
  type BioInput,
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

describe("bio-generator constants", () => {
  it("has 5 tones", () => {
    expect(TONES).toHaveLength(5);
    expect(TONES).toContain("professional");
    expect(TONES).toContain("humorous");
  });
  it("has 5 platforms", () => {
    expect(PLATFORMS).toHaveLength(5);
    expect(PLATFORMS).toContain("twitter");
    expect(PLATFORMS).toContain("youtube");
  });
  it("has 5 tone labels", () => {
    expect(Object.keys(TONE_LABELS)).toHaveLength(5);
  });
  it("has 5 platform labels", () => {
    expect(Object.keys(PLATFORM_LABELS)).toHaveLength(5);
  });
  it("has 5 platform configs with correct char limits", () => {
    expect(Object.keys(PLATFORM_CONFIGS)).toHaveLength(5);
    expect(PLATFORM_CONFIGS.twitter.maxChars).toBe(160);
    expect(PLATFORM_CONFIGS.instagram.maxChars).toBe(150);
    expect(PLATFORM_CONFIGS.linkedin.maxChars).toBe(220);
    expect(PLATFORM_CONFIGS.tiktok.maxChars).toBe(80);
    expect(PLATFORM_CONFIGS.youtube.maxChars).toBe(1000);
  });
  it("has 5 tone presets", () => {
    expect(Object.keys(TONE_PRESETS)).toHaveLength(5);
    for (const t of TONES) {
      expect(TONE_PRESETS[t].emoji.length).toBeGreaterThan(0);
    }
  });
});

describe("bio-generator normalizeText", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeText("  hello   world  ")).toBe("hello world");
  });
  it("handles empty", () => {
    expect(normalizeText("")).toBe("");
  });
});

describe("bio-generator capitalize", () => {
  it("capitalizes first letter", () => {
    expect(capitalize("hello")).toBe("Hello");
  });
  it("handles empty", () => {
    expect(capitalize("")).toBe("");
  });
});

describe("bio-generator parseInterests", () => {
  it("parses comma-separated", () => {
    expect(parseInterests("coding, coffee, photography")).toEqual(["coding", "coffee", "photography"]);
  });
  it("parses semicolon-separated", () => {
    expect(parseInterests("coding; coffee; photography")).toEqual(["coding", "coffee", "photography"]);
  });
  it("parses newline-separated", () => {
    expect(parseInterests("coding\ncoffee\nphotography")).toEqual(["coding", "coffee", "photography"]);
  });
  it("skips blank entries", () => {
    expect(parseInterests("coding, , coffee")).toEqual(["coding", "coffee"]);
  });
  it("returns empty for empty input", () => {
    expect(parseInterests("")).toEqual([]);
  });
});

describe("bio-generator formatBullets", () => {
  it("formats as bullet list", () => {
    expect(formatBullets(["a", "b", "c"])).toBe("• a\n• b\n• c");
  });
  it("returns empty for empty input", () => {
    expect(formatBullets([])).toBe("");
  });
});

describe("bio-generator formatInterests", () => {
  it("joins with commas", () => {
    expect(formatInterests(["coding", "coffee"])).toBe("coding, coffee");
  });
  it("returns empty for empty input", () => {
    expect(formatInterests([])).toBe("");
  });
});

describe("bio-generator formatName", () => {
  it("formats full name", () => {
    expect(formatName("Jane Doe", "full")).toBe("Jane Doe");
  });
  it("formats first name only", () => {
    expect(formatName("Jane Doe", "first")).toBe("Jane");
  });
  it("formats initials", () => {
    expect(formatName("Jane Marie Doe", "initials")).toBe("JMD");
  });
  it("handles empty", () => {
    expect(formatName("", "full")).toBe("");
  });
});

describe("bio-generator nameFormatForPlatform", () => {
  it("returns 'full' for all platforms", () => {
    for (const p of PLATFORMS) {
      expect(nameFormatForPlatform(p)).toBe("full");
    }
  });
});

describe("bio-generator applyTone", () => {
  it("returns text unchanged for minimalist", () => {
    expect(applyTone("minimalist", "engineer")).toBe("engineer");
  });
  it("prepends adjective for professional", () => {
    expect(applyTone("professional", "engineer")).toBe("Experienced engineer");
  });
  it("prepends opening for casual", () => {
    expect(applyTone("casual", "engineer")).toBe("Hey! engineer");
  });
  it("prepends adjective for humorous", () => {
    expect(applyTone("humorous", "engineer")).toBe("Allegedly engineer");
  });
  it("handles empty text", () => {
    expect(applyTone("professional", "")).toBe("");
  });
});

describe("bio-generator generateCTA", () => {
  it("returns platform CTA when enabled", () => {
    expect(generateCTA("youtube", true)).toContain("Subscribe");
  });
  it("returns empty when disabled", () => {
    expect(generateCTA("youtube", false)).toBe("");
  });
  it("returns different CTAs per platform", () => {
    expect(generateCTA("twitter", true)).not.toBe(generateCTA("linkedin", true));
  });
});

describe("bio-generator applyEmojis", () => {
  it("returns emoji when enabled", () => {
    expect(applyEmojis("professional", true).length).toBeGreaterThan(0);
  });
  it("returns empty when disabled", () => {
    expect(applyEmojis("professional", false)).toBe("");
  });
});

describe("bio-generator insertLink", () => {
  it("appends URL with scheme", () => {
    expect(insertLink("bio", "https://example.com")).toContain("https://example.com");
  });
  it("adds https:// when missing", () => {
    expect(insertLink("bio", "example.com")).toContain("https://example.com");
  });
  it("returns text unchanged when no URL", () => {
    expect(insertLink("bio", "")).toBe("bio");
  });
});

describe("bio-generator insertKeywords", () => {
  it("appends hashtags for interests", () => {
    const out = insertKeywords("bio text", ["coding", "coffee"]);
    expect(out).toContain("#coding");
    expect(out).toContain("#coffee");
  });
  it("returns text unchanged for empty interests", () => {
    expect(insertKeywords("bio", [])).toBe("bio");
  });
});

describe("bio-generator insertPronouns", () => {
  it("appends pronouns in parens", () => {
    expect(insertPronouns("Jane Doe", "she/her")).toBe("Jane Doe (she/her)");
  });
  it("returns text unchanged when no pronouns", () => {
    expect(insertPronouns("Jane Doe", "")).toBe("Jane Doe");
  });
});

describe("bio-generator countEmojis", () => {
  it("counts emojis", () => {
    expect(countEmojis("👋 world 🎉")).toBe(2);
  });
  it("returns 0 for no emojis", () => {
    expect(countEmojis("no emojis")).toBe(0);
  });
});

describe("bio-generator validateBioLength", () => {
  it("returns true when within limit", () => {
    expect(validateBioLength("twitter", "short bio")).toBe(true);
  });
  it("returns false when over limit", () => {
    const long = "a".repeat(200);
    expect(validateBioLength("twitter", long)).toBe(false);
  });
});

describe("bio-generator getCharLimitStatus", () => {
  it("returns green when under optimal", () => {
    expect(getCharLimitStatus("twitter", 50)).toBe("green");
  });
  it("returns yellow when between optimal and max", () => {
    expect(getCharLimitStatus("twitter", 130)).toBe("yellow");
  });
  it("returns red when over max", () => {
    expect(getCharLimitStatus("twitter", 200)).toBe("red");
  });
});

describe("bio-generator truncateToLimit", () => {
  it("returns text unchanged when within limit", () => {
    expect(truncateToLimit("hello", 100)).toBe("hello");
  });
  it("truncates with ellipsis when over limit", () => {
    const out = truncateToLimit("hello world this is a long sentence", 15);
    expect(out.length).toBeLessThanOrEqual(15);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("bio-generator generateBio", () => {
  const input: BioInput = {
    name: "Jane Doe",
    profession: "Software Engineer",
    interests: "coding, coffee, photography",
    location: "San Francisco",
    website: "https://jane.example.com",
    tone: "professional",
    platforms: ["twitter", "instagram", "linkedin"],
    includeEmojis: true,
    includeCTA: true,
    pronouns: "she/her",
  };
  it("generates a bio for twitter", () => {
    const b = generateBio(input, "twitter", 1);
    expect(b.platform).toBe("twitter");
    expect(b.bioText.length).toBeGreaterThan(0);
    expect(b.maxChars).toBe(160);
    expect(b.bioText).toContain("Jane Doe");
  });
  it("generates a bio for linkedin", () => {
    const b = generateBio(input, "linkedin", 1);
    expect(b.platform).toBe("linkedin");
    expect(b.maxChars).toBe(220);
  });
  it("respects includeEmojis=false", () => {
    const b = generateBio({ ...input, includeEmojis: false }, "twitter", 1);
    expect(b.emojiCount).toBe(0);
  });
  it("respects includeCTA=false", () => {
    const b = generateBio({ ...input, includeCTA: false }, "twitter", 1);
    expect(b.hasCTA).toBe(false);
  });
  it("includes pronouns when provided", () => {
    const b = generateBio(input, "twitter", 1);
    expect(b.bioText).toContain("(she/her)");
  });
  it("includes website link when provided", () => {
    const b = generateBio(input, "twitter", 1);
    expect(b.bioText).toContain("https://jane.example.com");
  });
  it("includes hashtags for twitter when interests provided", () => {
    const b = generateBio(input, "twitter", 1);
    expect(b.bioText).toContain("#coding");
  });
  it("variation 2 and 3 produce different bios", () => {
    const v1 = generateBio(input, "twitter", 1);
    const v2 = generateBio(input, "twitter", 2);
    const v3 = generateBio(input, "twitter", 3);
    expect(v1.bioText).not.toBe(v2.bioText);
    expect(v2.bioText).not.toBe(v3.bioText);
  });
  it("handles empty name gracefully", () => {
    const b = generateBio({ ...input, name: "" }, "twitter", 1);
    expect(b.bioText.length).toBeGreaterThan(0);
  });
});

describe("bio-generator generateVariations", () => {
  it("generates 3 variations for a platform", () => {
    const input: BioInput = {
      name: "Jane",
      profession: "Engineer",
      interests: "coding",
      location: "",
      website: "",
      tone: "casual",
      platforms: ["twitter"],
      includeEmojis: false,
      includeCTA: false,
      pronouns: "",
    };
    const vs = generateVariations(input, "twitter");
    expect(vs).toHaveLength(3);
    expect(vs.map((v) => v.variation)).toEqual([1, 2, 3]);
  });
});

describe("bio-generator generateAll", () => {
  it("generates variations for all selected platforms", () => {
    const input: BioInput = {
      name: "Jane",
      profession: "Engineer",
      interests: "coding",
      location: "",
      website: "",
      tone: "casual",
      platforms: ["twitter", "instagram", "tiktok"],
      includeEmojis: false,
      includeCTA: false,
      pronouns: "",
    };
    const bios = generateAll(input);
    expect(bios).toHaveLength(9); // 3 platforms × 3 variations
    const platforms = new Set(bios.map((b) => b.platform));
    expect(platforms.size).toBe(3);
  });
  it("returns empty for no platforms", () => {
    const input: BioInput = {
      name: "Jane",
      profession: "Engineer",
      interests: "",
      location: "",
      website: "",
      tone: "casual",
      platforms: [],
      includeEmojis: false,
      includeCTA: false,
      pronouns: "",
    };
    expect(generateAll(input)).toEqual([]);
  });
});

describe("bio-generator computeStats", () => {
  it("computes stats across bios", () => {
    const input: BioInput = {
      name: "Jane",
      profession: "Engineer",
      interests: "coding, coffee",
      location: "",
      website: "",
      tone: "professional",
      platforms: ["twitter", "instagram"],
      includeEmojis: true,
      includeCTA: true,
      pronouns: "",
    };
    const bios = generateAll(input);
    const stats = computeStats(bios);
    expect(stats.totalPlatforms).toBe(2);
    expect(stats.totalBios).toBe(6);
    expect(stats.avgCharCount).toBeGreaterThan(0);
    expect(stats.totalCTAs).toBe(6);
  });
  it("returns zeros for empty input", () => {
    const stats = computeStats([]);
    expect(stats.totalPlatforms).toBe(0);
    expect(stats.totalBios).toBe(0);
    expect(stats.avgCharCount).toBe(0);
  });
});

describe("bio-generator renderText", () => {
  it("renders a per-platform report", () => {
    const input: BioInput = {
      name: "Jane",
      profession: "Engineer",
      interests: "coding",
      location: "",
      website: "",
      tone: "professional",
      platforms: ["twitter"],
      includeEmojis: false,
      includeCTA: false,
      pronouns: "",
    };
    const text = renderText(generateAll(input));
    expect(text).toContain("=== Twitter/X ===");
    expect(text).toContain("Variation 1");
    expect(text).toContain("Chars:");
  });
  it("returns empty for empty input", () => {
    expect(renderText([])).toBe("");
  });
});

describe("bio-generator renderCsv", () => {
  it("renders header for empty input", () => {
    expect(renderCsv([])).toContain("platform,variation,bio_text");
  });
  it("renders data rows for each bio", () => {
    const input: BioInput = {
      name: "Jane",
      profession: "Engineer",
      interests: "",
      location: "",
      website: "",
      tone: "professional",
      platforms: ["twitter"],
      includeEmojis: false,
      includeCTA: false,
      pronouns: "",
    };
    const csv = renderCsv([generateBio(input, "twitter", 1)]);
    const lines = csv.split("\n");
    // 1 header + 1 data row (single-line bio, no newlines in this case)
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[0]).toBe("platform,variation,bio_text,char_count,max_chars,emoji_count,has_cta,within_limit");
  });
});

describe("bio-generator splitCsvRow", () => {
  it("splits simple", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
});

describe("bio-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      name: "Jane",
      profession: "Engineer",
      platforms: ["twitter"],
      tone: "professional",
      totalBios: 3,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        name: `Jane-${i}`,
        profession: "Engineer",
        platforms: ["twitter"],
        tone: "professional",
        totalBios: 3,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      name: "Jane",
      profession: "Engineer",
      platforms: ["twitter"],
      tone: "professional",
      totalBios: 3,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("bio-generator shareable URL", () => {
  const input: BioInput = {
    name: "Jane Doe",
    profession: "Software Engineer",
    interests: "coding, coffee",
    location: "SF",
    website: "https://example.com",
    tone: "professional",
    platforms: ["twitter", "instagram"],
    includeEmojis: true,
    includeCTA: true,
    pronouns: "she/her",
  };
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(input);
    expect(url).toContain("name=Jane+Doe");
    expect(url).toContain("prof=Software+Engineer");
    expect(url).toContain("tone=professional");
    expect(url).toContain("plat=twitter%2Cinstagram");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const url = buildShareUrl(input);
    const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : url.replace(/^\?/, "");
    const parsed = parseShareUrl(hash);
    expect(parsed.name).toBe("Jane Doe");
    expect(parsed.profession).toBe("Software Engineer");
    expect(parsed.tone).toBe("professional");
    expect(parsed.platforms).toEqual(["twitter", "instagram"]);
    expect(parsed.pronouns).toBe("she/her");
    expect(parsed.includeEmojis).toBe(true);
  });
  it("returns defaults for empty hash", () => {
    const parsed = parseShareUrl("");
    expect(parsed.name).toBe("");
    expect(parsed.tone).toBe("professional");
    expect(parsed.platforms).toEqual([]);
    expect(parsed.includeCTA).toBe(true);
  });
  it("filters unknown platforms", () => {
    const parsed = parseShareUrl("plat=twitter%2Cunknown%2Cfacebook");
    expect(parsed.platforms).toEqual(["twitter"]); // facebook is not supported
  });
});

// Suppress unused-import lint
export type _Unused = Tone | Platform | NameFormat;
