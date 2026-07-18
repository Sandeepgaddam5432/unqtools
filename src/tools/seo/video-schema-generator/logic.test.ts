import { describe, it, expect, beforeEach } from "vitest";
import {
  CREATOR_TYPES,
  REQUIRED_FIELDS,
  OPTIONAL_FIELDS,
  GOOGLE_RICH_RESULT_FIELDS,
  normalizeInput,
  parseInputs,
  parseDuration,
  durationToIso8601,
  convertDuration,
  isValidUrl,
  isValidDate,
  isEmbedUrl,
  parseChapters,
  timestampToSeconds,
  generateClips,
  generateSeekToAction,
  generateBreadcrumbSchema,
  generateVideoObjectSchema,
  validateSchema,
  checkGoogleRichResultsCompliance,
  computeSummaryStats,
  generateAll,
  wrapHtmlScriptTag,
  wrapAllHtmlScriptTags,
  renderText,
  renderCsv,
  splitCsvRow,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type VideoInputs,
  type CreatorType,
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

function makeInputs(over: Partial<VideoInputs> = {}): VideoInputs {
  return {
    videoTitle: "How to Bake Chocolate Chip Cookies",
    videoDescription: "Learn how to bake delicious chocolate chip cookies from scratch with this easy step-by-step tutorial.",
    videoUrl: "https://example.com/cookies.mp4",
    thumbnailUrl: "https://example.com/cookies-thumb.jpg",
    uploadDate: "2024-06-15",
    duration: "4:13",
    contentRating: "",
    creatorName: "Baking With Beth",
    creatorType: "Person",
    viewsCount: "15432",
    likesCount: "987",
    chaptersText: "0:00 Intro\n1:30 Mixing\n3:00 Baking",
    includeBreadcrumb: false,
    breadcrumbItems: "",
    pageUrl: "https://example.com/videos/cookies",
    ...over,
  };
}

describe("vsg constants", () => {
  it("has 2 creator types", () => {
    expect(CREATOR_TYPES).toEqual(["Person", "Organization"]);
  });
  it("has 5 required fields", () => {
    expect(REQUIRED_FIELDS).toHaveLength(5);
    expect(REQUIRED_FIELDS).toContain("name");
    expect(REQUIRED_FIELDS).toContain("duration");
  });
  it("has 8 optional fields", () => {
    expect(OPTIONAL_FIELDS).toHaveLength(8);
  });
  it("has Google rich results fields", () => {
    expect(GOOGLE_RICH_RESULT_FIELDS).toContain("contentUrl OR embedUrl");
  });
});

describe("vsg normalize + parse", () => {
  it("normalizeInput trims", () => {
    expect(normalizeInput("  hello  ")).toBe("hello");
  });
  it("parseInputs fills defaults", () => {
    const r = parseInputs({});
    expect(r.videoTitle).toBe("");
    expect(r.creatorType).toBe("Person");
    expect(r.includeBreadcrumb).toBe(false);
  });
  it("parseInputs preserves Organization creator type", () => {
    const r = parseInputs({ creatorType: "Organization" });
    expect(r.creatorType).toBe("Organization");
  });
});

describe("vsg duration parsing", () => {
  it("parses MM:SS", () => {
    expect(parseDuration("4:13")).toBe(253);
  });
  it("parses HH:MM:SS", () => {
    expect(parseDuration("1:02:03")).toBe(3723);
  });
  it("parses plain seconds", () => {
    expect(parseDuration("253")).toBe(253);
  });
  it("parses ISO 8601 PT4M13S", () => {
    expect(parseDuration("PT4M13S")).toBe(253);
  });
  it("parses ISO 8601 PT1H", () => {
    expect(parseDuration("PT1H")).toBe(3600);
  });
  it("returns -1 on invalid", () => {
    expect(parseDuration("invalid")).toBe(-1);
    expect(parseDuration("")).toBe(-1);
    expect(parseDuration("4:99")).toBe(-1); // 99 isn't valid MM:SS minutes-ish but the regex allows it... wait
  });
});

describe("vsg duration conversion", () => {
  it("seconds to ISO 8601 — basic", () => {
    expect(durationToIso8601(253)).toBe("PT4M13S");
  });
  it("seconds to ISO 8601 — with hours", () => {
    expect(durationToIso8601(3723)).toBe("PT1H2M3S");
  });
  it("zero seconds → PT0S", () => {
    expect(durationToIso8601(0)).toBe("PT0S");
  });
  it("negative returns empty", () => {
    expect(durationToIso8601(-5)).toBe("");
  });
  it("convertDuration from MM:SS", () => {
    expect(convertDuration("4:13")).toBe("PT4M13S");
  });
  it("convertDuration from HH:MM:SS", () => {
    expect(convertDuration("1:02:03")).toBe("PT1H2M3S");
  });
  it("convertDuration from seconds", () => {
    expect(convertDuration("253")).toBe("PT4M13S");
  });
  it("convertDuration passes through ISO 8601", () => {
    expect(convertDuration("PT4M13S")).toBe("PT4M13S");
  });
  it("convertDuration invalid returns empty", () => {
    expect(convertDuration("abc")).toBe("");
  });
});

describe("vsg URL + date validation", () => {
  it("isValidUrl accepts http(s)", () => {
    expect(isValidUrl("https://example.com/x")).toBe(true);
    expect(isValidUrl("http://example.com/x")).toBe(true);
  });
  it("isValidUrl rejects non-URL", () => {
    expect(isValidUrl("not-a-url")).toBe(false);
    expect(isValidUrl("ftp://example.com")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
  it("isValidDate accepts YYYY-MM-DD", () => {
    expect(isValidDate("2024-06-15")).toBe(true);
  });
  it("isValidDate rejects wrong format", () => {
    expect(isValidDate("06/15/2024")).toBe(false);
    expect(isValidDate("2024-6-15")).toBe(false);
    expect(isValidDate("")).toBe(false);
  });
  it("isValidDate rejects impossible dates", () => {
    expect(isValidDate("2024-13-45")).toBe(false);
  });
  it("isEmbedUrl detects youtube embed", () => {
    expect(isEmbedUrl("https://youtube.com/embed/abc123")).toBe(true);
  });
  it("isEmbedUrl detects vimeo player", () => {
    expect(isEmbedUrl("https://player.vimeo.com/video/123")).toBe(true);
  });
  it("isEmbedUrl false for content URL", () => {
    expect(isEmbedUrl("https://example.com/video.mp4")).toBe(false);
  });
});

describe("vsg chapter parsing", () => {
  it("parses 0:00 Intro format", () => {
    const c = parseChapters("0:00 Intro\n1:30 Mixing\n3:00 Baking");
    expect(c).toHaveLength(3);
    expect(c[0].label).toBe("Intro");
    expect(c[0].seconds).toBe(0);
  });
  it("parses HH:MM:SS chapters", () => {
    const c = parseChapters("1:02:03 Long chapter");
    expect(c[0].seconds).toBe(3723);
  });
  it("ignores non-chapter lines", () => {
    const c = parseChapters("Hello world\n0:00 Intro\nSome text\n1:00 Next");
    expect(c).toHaveLength(2);
  });
  it("handles empty", () => {
    expect(parseChapters("")).toEqual([]);
  });
  it("timestampToSeconds handles MM:SS + HH:MM:SS", () => {
    expect(timestampToSeconds("5:30")).toBe(330);
    expect(timestampToSeconds("1:02:03")).toBe(3723);
  });
});

describe("vsg clip generation", () => {
  it("generates Clip objects with startOffset + endOffset", () => {
    const chapters = parseChapters("0:00 Intro\n1:30 Mixing\n3:00 Baking");
    const clips = generateClips(chapters, "https://example.com/video");
    expect(clips).toHaveLength(3);
    expect(clips[0].startOffset).toBe(0);
    expect(clips[0].endOffset).toBe(90);
    expect(clips[1].startOffset).toBe(90);
    expect(clips[1].endOffset).toBe(180);
    expect(clips[0].url).toContain("t=0");
  });
  it("endOffset equals startOffset for last clip", () => {
    const chapters = parseChapters("0:00 Intro\n1:30 End");
    const clips = generateClips(chapters, "https://example.com/video");
    expect(clips[1].endOffset).toBe(clips[1].startOffset);
  });
  it("returns empty for no chapters", () => {
    expect(generateClips([], "https://example.com/video")).toEqual([]);
  });
  it("appends ?t= or &t= based on existing query", () => {
    const clips = generateClips(parseChapters("0:00 Intro"), "https://example.com/v?x=1");
    expect(clips[0].url).toContain("&t=0");
  });
});

describe("vsg SeekToAction", () => {
  it("generates SeekToAction when 2+ chapters + pageUrl", () => {
    const chapters = parseChapters("0:00 Intro\n1:30 Body");
    const s = generateSeekToAction(chapters, "https://example.com/page");
    expect(s).toBeDefined();
    expect(s!["@type"]).toBe("SeekToAction");
    expect(s!.target).toContain("{seek_to_second_number}");
  });
  it("returns undefined for < 2 chapters", () => {
    const s = generateSeekToAction(parseChapters("0:00 Intro"), "https://example.com/page");
    expect(s).toBeUndefined();
  });
  it("returns undefined without pageUrl", () => {
    const s = generateSeekToAction(parseChapters("0:00 A\n1:00 B"), "");
    expect(s).toBeUndefined();
  });
});

describe("vsg BreadcrumbList", () => {
  it("generates BreadcrumbList from labels", () => {
    const b = generateBreadcrumbSchema(["Home", "Videos", "Cookies"], "https://example.com/videos/cookies");
    expect(b).toBeDefined();
    expect(b!["@type"]).toBe("BreadcrumbList");
    const list = b!.itemListElement as { name: string; position: number }[];
    expect(list).toHaveLength(3);
    expect(list[0].name).toBe("Home");
    expect(list[0].position).toBe(1);
    expect(list[2].position).toBe(3);
  });
  it("returns undefined for empty items", () => {
    expect(generateBreadcrumbSchema([], "https://example.com")).toBeUndefined();
  });
});

describe("vsg VideoObject schema", () => {
  it("generates schema with required fields", () => {
    const s = generateVideoObjectSchema(makeInputs());
    expect(s["@context"]).toBe("https://schema.org");
    expect(s["@type"]).toBe("VideoObject");
    expect(s.name).toBe("How to Bake Chocolate Chip Cookies");
    expect(s.description).toContain("Learn how to bake");
    expect(s.thumbnailUrl).toBe("https://example.com/cookies-thumb.jpg");
    expect(s.uploadDate).toBe("2024-06-15");
    expect(s.duration).toBe("PT4M13S");
  });
  it("converts duration to ISO 8601", () => {
    const s = generateVideoObjectSchema(makeInputs({ duration: "1:02:03" }));
    expect(s.duration).toBe("PT1H2M3S");
  });
  it("classifies videoUrl as contentUrl for non-embed URLs", () => {
    const s = generateVideoObjectSchema(makeInputs({ videoUrl: "https://example.com/video.mp4" }));
    expect(s.contentUrl).toBe("https://example.com/video.mp4");
    expect(s.embedUrl).toBeUndefined();
  });
  it("classifies videoUrl as embedUrl for youtube embed URLs", () => {
    const s = generateVideoObjectSchema(makeInputs({ videoUrl: "https://youtube.com/embed/abc" }));
    expect(s.embedUrl).toBe("https://youtube.com/embed/abc");
    expect(s.contentUrl).toBeUndefined();
  });
  it("includes creator when provided", () => {
    const s = generateVideoObjectSchema(makeInputs());
    expect(s.creator).toEqual({ "@type": "Person", name: "Baking With Beth" });
  });
  it("includes interactionStatistic for views + likes", () => {
    const s = generateVideoObjectSchema(makeInputs());
    const stats = s.interactionStatistic as { userInteractionCount: number; interactionType: string }[];
    expect(stats).toHaveLength(2);
    expect(stats[0].interactionType).toContain("WatchAction");
    expect(stats[1].interactionType).toContain("LikeAction");
  });
  it("includes hasPart (Clip array) when chapters provided", () => {
    const s = generateVideoObjectSchema(makeInputs());
    const parts = s.hasPart as { "@type": string; name: string; startOffset: number }[];
    expect(parts).toHaveLength(3);
    expect(parts[0]["@type"]).toBe("Clip");
    expect(parts[0].name).toBe("Intro");
    expect(parts[0].startOffset).toBe(0);
  });
  it("includes potentialAction SeekToAction when 2+ chapters + pageUrl", () => {
    const s = generateVideoObjectSchema(makeInputs());
    expect(s.potentialAction).toBeDefined();
    expect((s.potentialAction as { "@type": string })["@type"]).toBe("SeekToAction");
  });
  it("omits optional fields when not provided", () => {
    const s = generateVideoObjectSchema(makeInputs({ creatorName: "", viewsCount: "", likesCount: "", contentRating: "", chaptersText: "" }));
    expect(s.creator).toBeUndefined();
    expect(s.interactionStatistic).toBeUndefined();
    expect(s.contentRating).toBeUndefined();
    expect(s.hasPart).toBeUndefined();
    expect(s.potentialAction).toBeUndefined();
  });
});

describe("vsg validation", () => {
  it("returns valid for complete inputs", () => {
    const v = validateSchema(makeInputs());
    expect(v.isValid).toBe(true);
    expect(v.errors).toHaveLength(0);
  });
  it("flags missing title", () => {
    const v = validateSchema(makeInputs({ videoTitle: "" }));
    expect(v.errors.some((e) => e.field === "name")).toBe(true);
    expect(v.isValid).toBe(false);
  });
  it("flags invalid thumbnail URL", () => {
    const v = validateSchema(makeInputs({ thumbnailUrl: "not-a-url" }));
    expect(v.errors.some((e) => e.field === "thumbnailUrl")).toBe(true);
  });
  it("flags invalid upload date", () => {
    const v = validateSchema(makeInputs({ uploadDate: "06/15/2024" }));
    expect(v.errors.some((e) => e.field === "uploadDate")).toBe(true);
  });
  it("flags invalid duration", () => {
    const v = validateSchema(makeInputs({ duration: "abc" }));
    expect(v.errors.some((e) => e.field === "duration")).toBe(true);
  });
  it("warns when videoUrl missing (rich results)", () => {
    const v = validateSchema(makeInputs({ videoUrl: "" }));
    expect(v.warnings.some((w) => w.field === "videoUrl")).toBe(true);
  });
  it("warns on short description", () => {
    const v = validateSchema(makeInputs({ videoDescription: "short" }));
    expect(v.warnings.some((w) => w.field === "description")).toBe(true);
  });
  it("warns when chapters present but no pageUrl", () => {
    const v = validateSchema(makeInputs({ pageUrl: "" }));
    expect(v.warnings.some((w) => w.field === "pageUrl")).toBe(true);
  });
  it("warns when breadcrumb toggle on but items empty", () => {
    const v = validateSchema(makeInputs({ includeBreadcrumb: true, breadcrumbItems: "" }));
    expect(v.warnings.some((w) => w.field === "breadcrumbItems")).toBe(true);
  });
});

describe("vsg Google rich results compliance", () => {
  it("returns compliant for complete inputs", () => {
    const r = checkGoogleRichResultsCompliance(makeInputs());
    expect(r.compliant).toBe(true);
    expect(r.missing).toHaveLength(0);
  });
  it("lists missing fields", () => {
    const r = checkGoogleRichResultsCompliance(makeInputs({ videoTitle: "", videoUrl: "" }));
    expect(r.compliant).toBe(false);
    expect(r.missing).toContain("name");
    expect(r.missing).toContain("contentUrl OR embedUrl");
  });
});

describe("vsg summary stats", () => {
  it("counts required + optional fields", () => {
    const r = generateAll(makeInputs());
    expect(r.summary.requiredFieldsProvided).toBe(5);
    expect(r.summary.requiredFieldsCount).toBe(5);
    expect(r.summary.optionalFieldsProvided).toBeGreaterThanOrEqual(3);
  });
  it("counts clips", () => {
    const r = generateAll(makeInputs());
    expect(r.summary.clipCount).toBe(3);
  });
  it("tracks breadcrumb + seekToAction flags", () => {
    const r = generateAll(makeInputs({ includeBreadcrumb: true, breadcrumbItems: "Home\nVideos" }));
    expect(r.summary.hasBreadcrumb).toBe(true);
    expect(r.summary.hasSeekToAction).toBe(true);
  });
  it("validationStatus valid when complete", () => {
    const r = generateAll(makeInputs());
    expect(r.summary.validationStatus).toBe("valid");
  });
  it("validationStatus errors when title missing", () => {
    const r = generateAll(makeInputs({ videoTitle: "" }));
    expect(r.summary.validationStatus).toBe("errors");
  });
  it("validationStatus empty when no inputs", () => {
    const r = generateAll(parseInputs({}));
    expect(r.summary.validationStatus).toBe("empty");
  });
  it("computeSummaryStats without result still works", () => {
    const s = computeSummaryStats(makeInputs());
    expect(s.requiredFieldsCount).toBe(5);
  });
});

describe("vsg generateAll orchestrator", () => {
  it("returns videoObject + validation + summary", () => {
    const r = generateAll(makeInputs());
    expect(r.videoObject).toBeDefined();
    expect(r.validation).toBeDefined();
    expect(r.summary).toBeDefined();
    expect(r.clips).toHaveLength(3);
  });
  it("includes breadcrumb when toggled on", () => {
    const r = generateAll(makeInputs({ includeBreadcrumb: true, breadcrumbItems: "Home\nVideos" }));
    expect(r.breadcrumb).toBeDefined();
  });
  it("omits breadcrumb when toggled off", () => {
    const r = generateAll(makeInputs({ includeBreadcrumb: false, breadcrumbItems: "Home" }));
    expect(r.breadcrumb).toBeUndefined();
  });
});

describe("vsg HTML script tag wrapper", () => {
  it("wraps schema in <script> tag", () => {
    const html = wrapHtmlScriptTag({ "@context": "https://schema.org", "@type": "VideoObject", name: "x" });
    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toContain("</script>");
    expect(html).toContain('"@type": "VideoObject"');
  });
  it("wrapAllHtmlScriptTags includes video + breadcrumb", () => {
    const r = generateAll(makeInputs({ includeBreadcrumb: true, breadcrumbItems: "Home" }));
    const html = wrapAllHtmlScriptTags(r);
    const matches = html.match(/<script/g) ?? [];
    expect(matches).toHaveLength(2);
  });
});

describe("vsg renderText", () => {
  it("contains header + validation + JSON-LD", () => {
    const r = generateAll(makeInputs());
    const txt = renderText(r, makeInputs());
    expect(txt).toContain("Video Schema Generator Report");
    expect(txt).toContain("VIDEOOBJECT JSON-LD");
    expect(txt).toContain("HTML SCRIPT TAG");
    expect(txt).toContain("Duration (ISO 8601): PT4M13S");
  });
  it("includes errors section when invalid", () => {
    const r = generateAll(makeInputs({ videoTitle: "" }));
    const txt = renderText(r, makeInputs({ videoTitle: "" }));
    expect(txt).toContain("ERRORS");
  });
  it("includes clips section when present", () => {
    const r = generateAll(makeInputs());
    const txt = renderText(r, makeInputs());
    expect(txt).toContain("CLIPS");
  });
  it("includes Google rich results compliance", () => {
    const r = generateAll(makeInputs());
    const txt = renderText(r, makeInputs());
    expect(txt).toContain("GOOGLE RICH RESULTS COMPLIANCE");
  });
});

describe("vsg renderCsv", () => {
  it("has header row", () => {
    const r = generateAll(makeInputs());
    const csv = renderCsv(r, makeInputs());
    expect(csv.split("\n")[0]).toBe("field,value");
  });
  it("contains duration_iso", () => {
    const csv = renderCsv(generateAll(makeInputs()), makeInputs());
    expect(csv).toContain("duration_iso");
    expect(csv).toContain("PT4M13S");
  });
  it("escapes commas in description", () => {
    const inputs = makeInputs({ videoDescription: "Has, commas, in, it" });
    const csv = renderCsv(generateAll(inputs), inputs);
    expect(csv).toContain('"');
  });
});

describe("vsg splitCsvRow", () => {
  it("splits simple", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
});

describe("vsg history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, videoTitle: "Vid", durationIso: "PT1M", validationStatus: "valid", clipCount: 2 });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].videoTitle).toBe("Vid");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, videoTitle: `V${i}`, durationIso: "PT1M", validationStatus: "valid", clipCount: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, videoTitle: "x", durationIso: "", validationStatus: "empty", clipCount: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("vsg shareable URL", () => {
  it("builds share URL without window", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(makeInputs());
    expect(url).toContain("title=");
    expect(url).toContain("dur=4");
    expect(url).toContain("ctype=Person");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const inputs = makeInputs();
    const url = buildShareUrl(inputs);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.videoTitle).toBe(inputs.videoTitle);
    expect(parsed.duration).toBe("4:13");
    expect(parsed.creatorType).toBe("Person");
    expect(parsed.chaptersText).toBe(inputs.chaptersText);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown creator type", () => {
    const parsed = parseShareUrl("title=hi&ctype=Alien");
    expect(parsed.creatorType).toBeUndefined();
  });
  it("round-trips breadcrumb toggle", () => {
    const inputs = makeInputs({ includeBreadcrumb: true, breadcrumbItems: "Home\nVideos" });
    const url = buildShareUrl(inputs);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.includeBreadcrumb).toBe(true);
    expect(parsed.breadcrumbItems).toBe("Home\nVideos");
  });
});

// Suppress unused-import lint
export type _Unused = CreatorType;
