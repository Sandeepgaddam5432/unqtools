import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  MAX_ALT_LENGTH,
  MIN_ALT_LENGTH,
  CATEGORY_LABELS,
  ROLE_LABELS,
  ROLE_TEMPLATES,
  LANGUAGE_TEMPLATES,
  SUPPORTED_LANGUAGES,
  COMPLEX_PREFIXES,
  fileNameToSubject,
  guessRoleFromFileName,
  normalizeContext,
  computeAspectRatio,
  formatFileSize,
  normalizeFormat,
  generateAltSuggestions,
  localizePrefix,
  withLanguagePrefix,
  weaveKeyword,
  lintAlt,
  renderImgTag,
  renderAriaHiddenImg,
  renderLongDescription,
  renderBatchCsv,
  renderBatchJson,
  renderBatchHtml,
  splitCsvRow,
  computeBatchStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  describeColor,
  type ImageMeta,
  type ImageRole,
  type ImageCategory,
  type BatchEntry,
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

const SAMPLE_META: ImageMeta = {
  fileName: "screenshot-dashboard.png",
  fileSize: 256000,
  width: 1920,
  height: 1080,
  format: "png",
  dominantColor: "#3b82f6",
  aspectRatio: "16:9",
  hasAlpha: false,
  megapixels: 2.1,
};

describe("ai-alt-text constants", () => {
  it("has history key", () => {
    expect(HISTORY_KEY).toBe("unqtools:ai-alt-text:history");
  });
  it("has MAX_ALT_LENGTH 125", () => {
    expect(MAX_ALT_LENGTH).toBe(125);
  });
  it("has MIN_ALT_LENGTH at least 3", () => {
    expect(MIN_ALT_LENGTH).toBeGreaterThanOrEqual(3);
  });
  it("has 3 category labels", () => {
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(3);
  });
  it("has 14 role labels", () => {
    expect(Object.keys(ROLE_LABELS)).toHaveLength(14);
  });
  it("has role templates for every role", () => {
    for (const r of Object.keys(ROLE_LABELS) as ImageRole[]) {
      expect(ROLE_TEMPLATES[r]).toBeDefined();
      expect(ROLE_TEMPLATES[r].length).toBeGreaterThan(0);
    }
  });
  it("has 100+ language templates", () => {
    expect(SUPPORTED_LANGUAGES.length).toBeGreaterThanOrEqual(100);
  });
  it("has complex prefixes", () => {
    expect(COMPLEX_PREFIXES.length).toBeGreaterThan(0);
  });
});

describe("ai-alt-text fileNameToSubject", () => {
  it("strips extension and converts separators", () => {
    // 'screenshot' is a stopword so only 'Dashboard' remains
    expect(fileNameToSubject("screenshot-dashboard.png")).toBe("Dashboard");
  });
  it("removes common stopwords", () => {
    expect(fileNameToSubject("img-of-product.jpg")).toBe("Product");
  });
  it("returns empty for stopword-only filenames", () => {
    expect(fileNameToSubject("image.png")).toBe("");
  });
  it("handles underscores", () => {
    expect(fileNameToSubject("user_avatar_01.png")).toBe("User Avatar 01");
  });
  it("handles no extension", () => {
    expect(fileNameToSubject("dashboard")).toBe("Dashboard");
  });
  it("handles empty input", () => {
    expect(fileNameToSubject("")).toBe("");
  });
});

describe("ai-alt-text guessRoleFromFileName", () => {
  it("detects screenshot", () => {
    expect(guessRoleFromFileName("screenshot-dashboard.png")).toBe("screenshot");
  });
  it("detects logo", () => {
    expect(guessRoleFromFileName("logo-company.png")).toBe("logo");
  });
  it("detects icon", () => {
    expect(guessRoleFromFileName("icon-home.svg")).toBe("icon");
  });
  it("detects avatar", () => {
    expect(guessRoleFromFileName("avatar-jane.png")).toBe("avatar");
  });
  it("detects background", () => {
    expect(guessRoleFromFileName("bg-hero.jpg")).toBe("background");
  });
  it("detects chart", () => {
    expect(guessRoleFromFileName("chart-sales.png")).toBe("chart");
  });
  it("defaults to photograph for unknown", () => {
    expect(guessRoleFromFileName("vacation-beach.jpg")).toBe("photograph");
  });
});

describe("ai-alt-text normalizeContext", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeContext("  product   photo  ")).toBe("product photo");
  });
  it("handles empty", () => {
    expect(normalizeContext("")).toBe("");
  });
});

describe("ai-alt-text computeAspectRatio", () => {
  it("computes 16:9", () => {
    expect(computeAspectRatio(1920, 1080)).toBe("16:9");
  });
  it("computes 4:3", () => {
    expect(computeAspectRatio(800, 600)).toBe("4:3");
  });
  it("computes 1:1", () => {
    expect(computeAspectRatio(500, 500)).toBe("1:1");
  });
  it("returns unknown for zero", () => {
    expect(computeAspectRatio(0, 100)).toBe("unknown");
  });
});

describe("ai-alt-text formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });
  it("formats KB", () => {
    expect(formatFileSize(2048)).toBe("2.0 KB");
  });
  it("formats MB", () => {
    expect(formatFileSize(1572864)).toBe("1.5 MB");
  });
  it("formats zero", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });
});

describe("ai-alt-text normalizeFormat", () => {
  it("strips image/ prefix", () => {
    expect(normalizeFormat("image/png")).toBe("png");
  });
  it("converts jpeg to jpg", () => {
    expect(normalizeFormat("jpeg")).toBe("jpg");
  });
  it("lowercases", () => {
    expect(normalizeFormat("WEBP")).toBe("webp");
  });
  it("handles empty", () => {
    expect(normalizeFormat("")).toBe("unknown");
  });
});

describe("ai-alt-text generateAltSuggestions", () => {
  it("generates suggestions for a screenshot with context", () => {
    const suggestions = generateAltSuggestions(SAMPLE_META, "analytics dashboard", "screenshot", "en");
    expect(suggestions.length).toBeGreaterThan(2);
    expect(suggestions.some((s) => s.text.includes("dashboard"))).toBe(true);
  });
  it("includes a decorative (empty) option for non-decorative roles", () => {
    const suggestions = generateAltSuggestions(SAMPLE_META, "x", "screenshot", "en");
    expect(suggestions.some((s) => s.category === "decorative" && s.text === "")).toBe(true);
  });
  it("includes a complex (long) option for non-decorative roles", () => {
    const suggestions = generateAltSuggestions(SAMPLE_META, "x", "screenshot", "en");
    expect(suggestions.some((s) => s.category === "complex")).toBe(true);
  });
  it("decorative role returns only the empty alt", () => {
    const suggestions = generateAltSuggestions(SAMPLE_META, "", "decorative", "en");
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].text).toBe("");
    expect(suggestions[0].category).toBe("decorative");
  });
  it("uses filename as subject when no context provided", () => {
    const suggestions = generateAltSuggestions(SAMPLE_META, "", "screenshot", "en");
    const texts = suggestions.map((s) => s.text).join(" ");
    expect(texts.toLowerCase()).toContain("dashboard");
  });
  it("interpolates color into background role templates", () => {
    const suggestions = generateAltSuggestions(SAMPLE_META, "", "background", "en");
    expect(suggestions.some((s) => s.text.includes("#3b82f6"))).toBe(true);
  });
});

describe("ai-alt-text localizePrefix", () => {
  it("returns English prefix", () => {
    expect(localizePrefix("en")).toBe("Image of");
  });
  it("returns Spanish prefix", () => {
    expect(localizePrefix("es")).toBe("Imagen de");
  });
  it("falls back to English for unknown language", () => {
    expect(localizePrefix("xxx")).toBe("Image of");
  });
});

describe("ai-alt-text withLanguagePrefix", () => {
  it("prepends localized prefix", () => {
    expect(withLanguagePrefix("a cat", "es")).toBe("Imagen de: a cat");
  });
  it("returns empty for empty alt", () => {
    expect(withLanguagePrefix("", "en")).toBe("");
  });
});

describe("ai-alt-text weaveKeyword", () => {
  it("appends keyword if missing", () => {
    const r = weaveKeyword("a cat sitting", "pet care");
    expect(r.text).toContain("pet care");
    expect(r.stuffed).toBe(false);
  });
  it("does not duplicate if keyword already present once", () => {
    const r = weaveKeyword("cat for pet care", "pet care");
    expect(r.stuffed).toBe(false);
  });
  it("flags stuffing when keyword appears twice or more", () => {
    const r = weaveKeyword("pet care tips for pet care pros", "pet care");
    expect(r.stuffed).toBe(true);
  });
  it("handles empty keyword", () => {
    const r = weaveKeyword("a cat", "");
    expect(r.text).toBe("a cat");
    expect(r.stuffed).toBe(false);
  });
});

describe("ai-alt-text lintAlt", () => {
  it("flags no-alt on informative image", () => {
    const r = lintAlt("", "informative", SAMPLE_META);
    expect(r.issues.some((i) => i.code === "no-alt" && i.severity === "error")).toBe(true);
    expect(r.passed).toBe(false);
  });
  it("passes decorative image with empty alt", () => {
    const r = lintAlt("", "decorative", SAMPLE_META);
    expect(r.passed).toBe(true);
    expect(r.issues).toHaveLength(0);
  });
  it("flags decorative-has-text", () => {
    const r = lintAlt("a description", "decorative", SAMPLE_META);
    expect(r.issues.some((i) => i.code === "decorative-has-text" && i.severity === "error")).toBe(true);
  });
  it("flags redundant-prefix 'image of'", () => {
    const r = lintAlt("Image of a cat", "informative", SAMPLE_META);
    expect(r.issues.some((i) => i.code === "redundant-prefix")).toBe(true);
  });
  it("flags redundant-prefix 'picture of'", () => {
    const r = lintAlt("Picture of a dog", "informative", SAMPLE_META);
    expect(r.issues.some((i) => i.code === "redundant-prefix")).toBe(true);
  });
  it("flags too-long alt text", () => {
    const long = "a".repeat(150);
    const r = lintAlt(long, "informative", SAMPLE_META);
    expect(r.issues.some((i) => i.code === "too-long")).toBe(true);
  });
  it("flags too-short alt text", () => {
    const r = lintAlt("ab", "informative", SAMPLE_META);
    expect(r.issues.some((i) => i.code === "too-short")).toBe(true);
  });
  it("flags same-as-filename", () => {
    const meta = { ...SAMPLE_META, fileName: "test.png" };
    const r = lintAlt("test", "informative", meta);
    expect(r.issues.some((i) => i.code === "same-as-filename")).toBe(true);
  });
  it("flags keyword-stuffing", () => {
    const r = lintAlt("pet care for pet care lovers", "informative", SAMPLE_META, "pet care");
    expect(r.issues.some((i) => i.code === "keyword-stuffing")).toBe(true);
  });
  it("passes clean informative alt text", () => {
    const r = lintAlt("Dashboard showing monthly revenue charts", "informative", SAMPLE_META);
    expect(r.passed).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(90);
  });
  it("score is 0-100", () => {
    const r = lintAlt("", "informative", SAMPLE_META);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe("ai-alt-text renderImgTag", () => {
  it("renders basic img tag with alt", () => {
    const tag = renderImgTag("/img/cat.png", "a cat");
    expect(tag).toBe('<img src="/img/cat.png" alt="a cat" />');
  });
  it("renders empty alt for decorative", () => {
    const tag = renderImgTag("/img/spacer.png", "");
    expect(tag).toContain('alt=""');
  });
  it("includes width and height when provided", () => {
    const tag = renderImgTag("/img/cat.png", "a cat", 200, 150);
    expect(tag).toContain('width="200"');
    expect(tag).toContain('height="150"');
  });
  it("escapes HTML in alt text", () => {
    const tag = renderImgTag("/x.png", 'a "cat" <script>');
    expect(tag).toContain("&quot;");
    expect(tag).toContain("&lt;script&gt;");
  });
  it("escapes HTML in src", () => {
    const tag = renderImgTag('/x"onerror="alert(1)', "a");
    expect(tag).not.toContain('onerror="alert');
  });
});

describe("ai-alt-text renderAriaHiddenImg", () => {
  it("includes aria-hidden and empty alt", () => {
    const tag = renderAriaHiddenImg("/x.png");
    expect(tag).toContain('aria-hidden="true"');
    expect(tag).toContain('alt=""');
  });
});

describe("ai-alt-text renderLongDescription", () => {
  it("renders figure with alt and figcaption", () => {
    const html = renderLongDescription("Short", "Long extended description here.");
    expect(html).toContain("<figure>");
    expect(html).toContain("alt=\"Short\"");
    expect(html).toContain("<figcaption>");
    expect(html).toContain("Long extended description here.");
  });
});

describe("ai-alt-text batch renderers", () => {
  const entries: BatchEntry[] = [
    { fileName: "a.png", alt: "first image", category: "informative", width: 100, height: 100, format: "png" },
    { fileName: "b.png", alt: "", category: "decorative", width: 200, height: 200, format: "png" },
    { fileName: "c.jpg", alt: "third, with comma", category: "informative", width: 300, height: 300, format: "jpg" },
  ];
  it("renderBatchCsv includes header", () => {
    const csv = renderBatchCsv(entries);
    expect(csv).toContain("filename,alt,category,width,height,format");
  });
  it("renderBatchCsv escapes commas", () => {
    const csv = renderBatchCsv(entries);
    expect(csv).toContain('"third, with comma"');
  });
  it("renderBatchJson returns valid JSON array", () => {
    const json = renderBatchJson(entries);
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(3);
  });
  it("renderBatchHtml returns img tags", () => {
    const html = renderBatchHtml(entries);
    expect(html).toContain("<img ");
    expect(html.split("\n").length).toBe(3);
  });
});

describe("ai-alt-text splitCsvRow", () => {
  it("splits simple", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
});

describe("ai-alt-text computeBatchStats", () => {
  it("computes stats for a batch", () => {
    const entries: BatchEntry[] = [
      { fileName: "a.png", alt: "first", category: "informative", width: 100, height: 100, format: "png" },
      { fileName: "b.png", alt: "", category: "decorative", width: 200, height: 200, format: "png" },
      { fileName: "c.png", alt: "longer description here", category: "complex", width: 300, height: 300, format: "png" },
    ];
    const s = computeBatchStats(entries);
    expect(s.total).toBe(3);
    expect(s.withAlt).toBe(2);
    expect(s.emptyAlt).toBe(1);
    expect(s.decorative).toBe(1);
    expect(s.informative).toBe(1);
    expect(s.complex).toBe(1);
    expect(s.avgLength).toBeGreaterThan(0);
  });
  it("handles empty batch", () => {
    const s = computeBatchStats([]);
    expect(s.total).toBe(0);
    expect(s.avgLength).toBe(0);
  });
});

describe("ai-alt-text history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, fileName: "x.png", role: "screenshot",
      category: "informative", altPreview: "preview", language: "en",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, fileName: `x${i}.png`, role: "screenshot",
        category: "informative", altPreview: "p", language: "en",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, fileName: "x.png", role: "screenshot",
      category: "informative", altPreview: "p", language: "en",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-alt-text shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      context: "cat photo", role: "photograph", category: "informative",
      language: "en", keyword: "pet", alt: "a cat",
    });
    expect(url).toContain("ctx=cat+photo");
    expect(url).toContain("role=photograph");
    expect(url).toContain("cat=informative");
    expect(url).toContain("lang=en");
    expect(url).toContain("kw=pet");
    expect(url).toContain("alt=a+cat");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("ctx=cat+photo&role=photograph&cat=informative&lang=es&kw=pet&alt=a+cat");
    expect(p.context).toBe("cat photo");
    expect(p.role).toBe("photograph");
    expect(p.category).toBe("informative");
    expect(p.language).toBe("es");
    expect(p.keyword).toBe("pet");
    expect(p.alt).toBe("a cat");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown role", () => {
    const p = parseShareUrl("role=not-a-role");
    expect(p.role).toBeUndefined();
  });
  it("filters unknown category", () => {
    const p = parseShareUrl("cat=not-a-cat");
    expect(p.category).toBeUndefined();
  });
});

describe("ai-alt-text LLM helpers", () => {
  it("buildLlmPrompt includes role, category, and rules", () => {
    const p = buildLlmPrompt("dashboard", "screenshot", "informative", "en", "analytics");
    expect(p.toLowerCase()).toContain("screenshot");
    expect(p.toLowerCase()).toContain("informative");
    expect(p).toContain("dashboard");
    expect(p).toContain("analytics");
    expect(p).toContain("Do NOT start with");
  });
  it("renderLlmResult strips markdown fences", () => {
    expect(renderLlmResult("```\na cat\n```")).toBe("a cat");
  });
  it("renderLlmResult strips surrounding quotes", () => {
    expect(renderLlmResult('"a cat"')).toBe("a cat");
  });
  it("renderLlmResult trims whitespace", () => {
    expect(renderLlmResult("  a cat  ")).toBe("a cat");
  });
  it("renderLlmResult handles empty", () => {
    expect(renderLlmResult("")).toBe("");
  });
});

describe("ai-alt-text describeColor", () => {
  it("describes red", () => {
    expect(describeColor("#ff0000")).toBe("red");
  });
  it("describes green", () => {
    expect(describeColor("#00ff00")).toBe("green");
  });
  it("describes blue", () => {
    expect(describeColor("#0000ff")).toBe("blue");
  });
  it("describes white as light", () => {
    expect(describeColor("#ffffff")).toBe("light");
  });
  it("describes black as dark", () => {
    expect(describeColor("#000000")).toBe("dark");
  });
  it("describes gray", () => {
    expect(describeColor("#808080")).toBe("gray");
  });
  it("describes yellow", () => {
    expect(describeColor("#ffff00")).toBe("yellow");
  });
  it("describes purple", () => {
    expect(describeColor("#800080")).toBe("purple");
  });
  it("describes orange", () => {
    expect(describeColor("#ff8000")).toBe("orange");
  });
  it("returns neutral for invalid hex", () => {
    expect(describeColor("not-a-color")).toBe("neutral");
  });
});

// Suppress unused-import lint
export type _Unused = ImageRole | ImageCategory;
