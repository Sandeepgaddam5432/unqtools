import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  parseHeadHtml,
  parseAttribute,
  hasAttribute,
  parseScriptTags,
  parseJsFileList,
  extractTitle,
  extractMetaDescription,
  extractH1s,
  extractLinks,
  simulateDom,
  detectBlockingScripts,
  countExternalInline,
  generateRecommendations,
  computeRenderScore,
  filterBlocking,
  summarizeStats,
  analyzeInputs,
  renderTextReport,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ScriptTag,
  type RenderAnalysis,
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

describe("js-render constants", () => {
  it("has stable history key", () => {
    expect(HISTORY_KEY).toBe("unqtools:javascript-seo-render-tester:history");
  });
  it("caps history at 20", () => {
    expect(HISTORY_MAX).toBe(20);
  });
});

describe("js-render parseHeadHtml", () => {
  it("extracts head content", () => {
    const head = parseHeadHtml("<html><head><title>X</title></head><body></body></html>");
    expect(head).toContain("<title>X</title>");
  });
  it("returns empty when no head", () => {
    expect(parseHeadHtml("<body></body>")).toBe("");
  });
  it("handles case-insensitive head tags", () => {
    const head = parseHeadHtml("<HEAD><meta name='x'></HEAD>");
    expect(head).toContain("<meta");
  });
});

describe("js-render parseAttribute", () => {
  it("parses double-quoted attribute", () => {
    expect(parseAttribute('<script src="app.js">', "src")).toBe("app.js");
  });
  it("parses single-quoted attribute", () => {
    expect(parseAttribute("<script src='app.js'>", "src")).toBe("app.js");
  });
  it("parses unquoted attribute", () => {
    expect(parseAttribute("<script src=app.js>", "src")).toBe("app.js");
  });
  it("returns undefined for missing attribute", () => {
    expect(parseAttribute("<script>", "src")).toBeUndefined();
  });
  it("handles attributes with special chars in value", () => {
    expect(parseAttribute('<a href="/p?a=1&b=2">', "href")).toBe("/p?a=1&b=2");
  });
});

describe("js-render hasAttribute", () => {
  it("detects boolean attribute", () => {
    expect(hasAttribute("<script src='x' defer>", "defer")).toBe(true);
  });
  it("returns false when attribute absent", () => {
    expect(hasAttribute("<script src='x'>", "defer")).toBe(false);
  });
});

describe("js-render parseScriptTags", () => {
  it("extracts external scripts with attributes", () => {
    const html = "<head><script src='/a.js' defer></script></head>";
    const tags = parseScriptTags(html);
    expect(tags).toHaveLength(1);
    expect(tags[0].src).toBe("/a.js");
    expect(tags[0].defer).toBe(true);
    expect(tags[0].async).toBe(false);
    expect(tags[0].isInline).toBe(false);
    expect(tags[0].inHead).toBe(true);
  });
  it("extracts inline scripts", () => {
    const html = "<body><script>console.log('hi')</script></body>";
    const tags = parseScriptTags(html);
    expect(tags).toHaveLength(1);
    expect(tags[0].isInline).toBe(true);
    expect(tags[0].body).toContain("console.log");
    expect(tags[0].inHead).toBe(false);
  });
  it("detects async and defer attributes together", () => {
    const html = "<head><script src='/x' async defer></script></head>";
    const tags = parseScriptTags(html);
    expect(tags[0].async).toBe(true);
    expect(tags[0].defer).toBe(true);
  });
  it("detects type=module", () => {
    const html = "<head><script type='module' src='/m.js'></script></head>";
    const tags = parseScriptTags(html);
    expect(tags[0].type).toBe("module");
  });
  it("marks body scripts correctly", () => {
    const html = "<head></head><body><script src='/b.js'></script></body>";
    const tags = parseScriptTags(html);
    expect(tags[0].inHead).toBe(false);
  });
  it("returns empty for empty input", () => {
    expect(parseScriptTags("")).toEqual([]);
  });
  it("returns empty when no script tags", () => {
    expect(parseScriptTags("<div>no scripts</div>")).toEqual([]);
  });
  it("handles multiple scripts and preserves order", () => {
    const html = "<head><script src='/a'></script></head><body><script src='/b'></script><script src='/c'></script></body>";
    const tags = parseScriptTags(html);
    expect(tags).toHaveLength(3);
    expect(tags[0].src).toBe("/a");
    expect(tags[1].src).toBe("/b");
    expect(tags[2].src).toBe("/c");
  });
});

describe("js-render parseJsFileList", () => {
  it("parses bare URLs (one per line)", () => {
    const list = parseJsFileList("/app.js\n/vendor.js");
    expect(list).toHaveLength(2);
    expect(list[0].src).toBe("/app.js");
    expect(list[0].isInline).toBe(false);
  });
  it("parses URLs with trailing attributes", () => {
    const list = parseJsFileList("/app.js defer\n/vendor.js async");
    expect(list[0].defer).toBe(true);
    expect(list[1].async).toBe(true);
  });
  it("parses <script> tag lines", () => {
    const list = parseJsFileList("<script src='/x.js' type='module'></script>");
    expect(list).toHaveLength(1);
    expect(list[0].src).toBe("/x.js");
    expect(list[0].type).toBe("module");
  });
  it("skips blank lines", () => {
    expect(parseJsFileList("/a\n\n/b")).toHaveLength(2);
  });
  it("returns empty for empty input", () => {
    expect(parseJsFileList("")).toEqual([]);
  });
});

describe("js-render extractTitle", () => {
  it("extracts title text", () => {
    expect(extractTitle("<title>Hello World</title>")).toBe("Hello World");
  });
  it("returns null when no title", () => {
    expect(extractTitle("<body>no title</body>")).toBeNull();
  });
  it("handles attributes on title tag", () => {
    expect(extractTitle("<title id='t'>X</title>")).toBe("X");
  });
});

describe("js-render extractMetaDescription", () => {
  it("extracts meta description with name first", () => {
    expect(extractMetaDescription("<meta name='description' content='My page'>")).toBe("My page");
  });
  it("extracts meta description with content first", () => {
    expect(extractMetaDescription("<meta content='My page' name='description'>")).toBe("My page");
  });
  it("returns null when no description meta", () => {
    expect(extractMetaDescription("<meta name='keywords' content='x'>")).toBeNull();
  });
  it("handles self-closing meta tags", () => {
    expect(extractMetaDescription("<meta name='description' content='X' />")).toBe("X");
  });
});

describe("js-render extractH1s", () => {
  it("extracts single h1", () => {
    expect(extractH1s("<h1>Title</h1>")).toEqual(["Title"]);
  });
  it("extracts multiple h1s", () => {
    expect(extractH1s("<h1>A</h1><h1>B</h1>")).toEqual(["A", "B"]);
  });
  it("strips nested tags inside h1", () => {
    expect(extractH1s("<h1>Hello <span>world</span></h1>")).toEqual(["Hello world"]);
  });
  it("returns empty array when no h1", () => {
    expect(extractH1s("<body>no h1</body>")).toEqual([]);
  });
});

describe("js-render extractLinks", () => {
  it("extracts href and text", () => {
    expect(extractLinks("<a href='/p'>Page</a>")).toEqual([{ href: "/p", text: "Page" }]);
  });
  it("skips anchors without href", () => {
    expect(extractLinks("<a name='x'>no href</a>")).toEqual([]);
  });
  it("strips nested tags from anchor text", () => {
    expect(extractLinks("<a href='/p'>Click <b>here</b></a>")[0].text).toBe("Click here");
  });
  it("returns empty for no links", () => {
    expect(extractLinks("<body>none</body>")).toEqual([]);
  });
});

describe("js-render simulateDom", () => {
  it("aggregates all critical tags", () => {
    const html = "<head><title>T</title><meta name='description' content='D'></head><body><h1>H</h1><a href='/p'>P</a></body>";
    const d = simulateDom(html);
    expect(d.title).toBe("T");
    expect(d.metaDescription).toBe("D");
    expect(d.h1Count).toBe(1);
    expect(d.h1s).toEqual(["H"]);
    expect(d.linkCount).toBe(1);
  });
  it("reports missing tags", () => {
    const d = simulateDom("<body>nothing</body>");
    expect(d.title).toBeNull();
    expect(d.metaDescription).toBeNull();
    expect(d.h1Count).toBe(0);
    expect(d.linkCount).toBe(0);
  });
});

describe("js-render detectBlockingScripts", () => {
  it("flags head scripts without async/defer", () => {
    const tags = parseScriptTags("<head><script src='/a.js'></script></head>");
    const blocking = detectBlockingScripts(tags);
    expect(blocking).toHaveLength(1);
  });
  it("does not flag deferred head scripts", () => {
    const tags = parseScriptTags("<head><script src='/a.js' defer></script></head>");
    expect(detectBlockingScripts(tags)).toHaveLength(0);
  });
  it("does not flag async head scripts", () => {
    const tags = parseScriptTags("<head><script src='/a.js' async></script></head>");
    expect(detectBlockingScripts(tags)).toHaveLength(0);
  });
  it("does not flag body scripts", () => {
    const tags = parseScriptTags("<body><script src='/a.js'></script></body>");
    expect(detectBlockingScripts(tags)).toHaveLength(0);
  });
  it("does not flag inline head scripts", () => {
    const tags = parseScriptTags("<head><script>var x=1;</script></head>");
    expect(detectBlockingScripts(tags)).toHaveLength(0);
  });
});

describe("js-render countExternalInline", () => {
  it("counts external vs inline", () => {
    const html = "<head><script src='/a.js'></script></head><body><script>var x=1;</script></body>";
    const tags = parseScriptTags(html);
    const counts = countExternalInline(tags);
    expect(counts.external).toBe(1);
    expect(counts.inline).toBe(1);
  });
  it("returns zeros for empty input", () => {
    expect(countExternalInline([])).toEqual({ external: 0, inline: 0 });
  });
});

describe("js-render generateRecommendations", () => {
  it("warns about render-blocking head scripts", () => {
    const recs = generateRecommendations({
      scripts: [],
      domSummary: { title: "T", metaDescription: "D", h1Count: 1, h1s: ["H"], linkCount: 0, links: [] },
      blockingCount: 2,
      externalCount: 2,
      inlineCount: 0,
      missingTitle: false,
      missingMetaDescription: false,
      missingH1: false,
    });
    expect(recs.some((r) => r.code === "RENDER_BLOCKING_HEAD")).toBe(true);
  });
  it("warns about missing title", () => {
    const recs = generateRecommendations({
      scripts: [],
      domSummary: { title: null, metaDescription: null, h1Count: 0, h1s: [], linkCount: 0, links: [] },
      blockingCount: 0,
      externalCount: 0,
      inlineCount: 0,
      missingTitle: true,
      missingMetaDescription: false,
      missingH1: false,
    });
    expect(recs.some((r) => r.code === "MISSING_TITLE")).toBe(true);
  });
  it("warns about missing meta description", () => {
    const recs = generateRecommendations({
      scripts: [],
      domSummary: { title: "T", metaDescription: null, h1Count: 1, h1s: ["H"], linkCount: 0, links: [] },
      blockingCount: 0,
      externalCount: 0,
      inlineCount: 0,
      missingTitle: false,
      missingMetaDescription: true,
      missingH1: false,
    });
    expect(recs.some((r) => r.code === "MISSING_META_DESCRIPTION")).toBe(true);
  });
  it("warns about missing h1", () => {
    const recs = generateRecommendations({
      scripts: [],
      domSummary: { title: "T", metaDescription: "D", h1Count: 0, h1s: [], linkCount: 0, links: [] },
      blockingCount: 0,
      externalCount: 0,
      inlineCount: 0,
      missingTitle: false,
      missingMetaDescription: false,
      missingH1: true,
    });
    expect(recs.some((r) => r.code === "MISSING_H1")).toBe(true);
  });
  it("warns when too many external scripts", () => {
    const recs = generateRecommendations({
      scripts: [],
      domSummary: { title: "T", metaDescription: "D", h1Count: 1, h1s: ["H"], linkCount: 0, links: [] },
      blockingCount: 0,
      externalCount: 7,
      inlineCount: 0,
      missingTitle: false,
      missingMetaDescription: false,
      missingH1: false,
    });
    expect(recs.some((r) => r.code === "TOO_MANY_EXTERNAL")).toBe(true);
  });
  it("returns ALL_GOOD when nothing wrong", () => {
    const recs = generateRecommendations({
      scripts: [],
      domSummary: { title: "T", metaDescription: "D", h1Count: 1, h1s: ["H"], linkCount: 0, links: [] },
      blockingCount: 0,
      externalCount: 1,
      inlineCount: 0,
      missingTitle: false,
      missingMetaDescription: false,
      missingH1: false,
    });
    expect(recs.some((r) => r.code === "ALL_GOOD")).toBe(true);
  });
});

describe("js-render computeRenderScore", () => {
  it("returns 100 for perfect setup", () => {
    expect(computeRenderScore({
      blockingCount: 0,
      missingTitle: false,
      missingMetaDescription: false,
      missingH1: false,
      externalCount: 1,
      scripts: [],
    })).toBe(100);
  });
  it("deducts 15 per blocking script up to 45", () => {
    expect(computeRenderScore({
      blockingCount: 1,
      missingTitle: false,
      missingMetaDescription: false,
      missingH1: false,
      externalCount: 1,
      scripts: [],
    })).toBe(85);
    expect(computeRenderScore({
      blockingCount: 4,
      missingTitle: false,
      missingMetaDescription: false,
      missingH1: false,
      externalCount: 1,
      scripts: [],
    })).toBe(55); // capped at -45
  });
  it("deducts 15 for missing title", () => {
    expect(computeRenderScore({
      blockingCount: 0,
      missingTitle: true,
      missingMetaDescription: false,
      missingH1: false,
      externalCount: 1,
      scripts: [],
    })).toBe(85);
  });
  it("deducts 10 for missing h1", () => {
    expect(computeRenderScore({
      blockingCount: 0,
      missingTitle: false,
      missingMetaDescription: false,
      missingH1: true,
      externalCount: 1,
      scripts: [],
    })).toBe(90);
  });
  it("clamps to minimum possible score (5) when all deductions fire", () => {
    // Max deductions: 45 (blocking cap) + 15 (title) + 15 (meta) + 10 (h1) + 5 (external > 5) + 5 (body no-async-defer) = 95
    const bodyScript: ScriptTag = {
      raw: "<script src='/body.js'></script>",
      src: "/body.js",
      async: false,
      defer: false,
      isInline: false,
      inHead: false,
    };
    expect(computeRenderScore({
      blockingCount: 4,
      missingTitle: true,
      missingMetaDescription: true,
      missingH1: true,
      externalCount: 10,
      scripts: [bodyScript],
    })).toBe(5);
  });
  it("never returns negative even with absurd blockingCount", () => {
    // Verify Math.max(0, ...) clamp
    expect(computeRenderScore({
      blockingCount: 100,
      missingTitle: true,
      missingMetaDescription: true,
      missingH1: true,
      externalCount: 100,
      scripts: [],
    })).toBeGreaterThanOrEqual(0);
  });
});

describe("js-render filterBlocking", () => {
  const tags = parseScriptTags(
    "<head><script src='/a.js'></script><script src='/b.js' defer></script></head><body><script src='/c.js'></script></body>",
  );
  it("returns all when onlyBlocking=false", () => {
    expect(filterBlocking(tags, false)).toHaveLength(3);
  });
  it("returns only blocking when onlyBlocking=true", () => {
    const blocking = filterBlocking(tags, true);
    expect(blocking).toHaveLength(1);
    expect(blocking[0].src).toBe("/a.js");
  });
});

describe("js-render summarizeStats", () => {
  it("counts missing critical tags", () => {
    const analysis: RenderAnalysis = {
      scripts: [],
      domSummary: { title: null, metaDescription: null, h1Count: 0, h1s: [], linkCount: 0, links: [] },
      recommendations: [],
      renderScore: 60,
      externalCount: 0,
      inlineCount: 0,
      blockingCount: 0,
      missingTitle: true,
      missingMetaDescription: true,
      missingH1: true,
      summary: {
        totalScripts: 0,
        externalCount: 0,
        inlineCount: 0,
        blockingCount: 0,
        renderScore: 0,
        missingCriticalTags: 0,
      },
    };
    const s = summarizeStats(analysis);
    expect(s.missingCriticalTags).toBe(3);
  });
});

describe("js-render analyzeInputs end-to-end", () => {
  it("analyzes a typical CSR page", () => {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <script src="/vendor.js"></script>
  <script src="/app.js"></script>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;
    const result = analyzeInputs(html, "");
    expect(result.scripts).toHaveLength(2);
    expect(result.blockingCount).toBe(2);
    expect(result.missingTitle).toBe(true);
    expect(result.missingMetaDescription).toBe(true);
    expect(result.missingH1).toBe(true);
    expect(result.renderScore).toBeLessThan(70);
  });
  it("rewards a well-optimized SSR page", () => {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>My Page</title>
  <meta name="description" content="A great page">
  <script src="/app.js" defer></script>
</head>
<body>
  <h1>Welcome</h1>
  <p>content</p>
</body>
</html>`;
    const result = analyzeInputs(html, "");
    expect(result.blockingCount).toBe(0);
    expect(result.missingTitle).toBe(false);
    expect(result.missingMetaDescription).toBe(false);
    expect(result.missingH1).toBe(false);
    expect(result.renderScore).toBe(100);
  });
  it("combines HTML scripts and JS file list", () => {
    const html = "<head><script src='/a.js' defer></script></head>";
    const jsList = "/b.js\n/c.js async";
    const result = analyzeInputs(html, jsList);
    expect(result.scripts).toHaveLength(3);
  });
  it("handles empty inputs", () => {
    const result = analyzeInputs("", "");
    expect(result.scripts).toEqual([]);
    expect(result.renderScore).toBeLessThanOrEqual(100);
  });
});

describe("js-render renderTextReport", () => {
  it("renders header and key sections", () => {
    const result = analyzeInputs("<head><title>T</title></head>", "");
    const text = renderTextReport(result);
    expect(text).toContain("JavaScript SEO Render Test");
    expect(text).toContain("Render score:");
    expect(text).toContain("DOM after render simulation");
    expect(text).toContain("Recommendations");
    expect(text).toContain("Script inventory");
  });
  it("renders scripts inventory", () => {
    const result = analyzeInputs("<head><script src='/a.js' defer></script></head>", "");
    const text = renderTextReport(result);
    expect(text).toContain("/a.js");
    expect(text).toContain("head");
    expect(text).toContain("defer");
  });
  it("handles empty analysis", () => {
    const result = analyzeInputs("", "");
    const text = renderTextReport(result);
    expect(text).toContain("(no scripts detected)");
  });
});

describe("js-render renderCsv", () => {
  it("renders header row", () => {
    expect(renderCsv([])).toContain("src,type,location,async,defer,blocking");
  });
  it("renders script rows", () => {
    const tags = parseScriptTags("<head><script src='/a.js' defer></script></head>");
    const csv = renderCsv(tags);
    expect(csv).toContain("/a.js");
    expect(csv).toContain("head");
    expect(csv).toContain("yes"); // defer=yes
    expect(csv).toContain("no"); // blocking=no (deferred)
  });
  it("marks blocking scripts as 'yes'", () => {
    const tags = parseScriptTags("<head><script src='/a.js'></script></head>");
    const csv = renderCsv(tags);
    const row = csv.split("\n")[1];
    expect(row.endsWith(",yes")).toBe(true);
  });
  it("labels inline scripts", () => {
    const tags = parseScriptTags("<body><script>var x=1;</script></body>");
    const csv = renderCsv(tags);
    expect(csv).toContain("(inline)");
  });
});

describe("js-render history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, scriptCount: 5, blockingCount: 2, renderScore: 70 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, scriptCount: 1, blockingCount: 0, renderScore: 100 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, scriptCount: 1, blockingCount: 0, renderScore: 100 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("js-render shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("<head></head>", "/app.js");
    expect(url).toContain("html=");
    expect(url).toContain("js=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const htmlEnc = encodeURIComponent("<head><title>X</title></head>");
    const jsEnc = encodeURIComponent("/app.js");
    const p = parseShareUrl(`html=${htmlEnc}&js=${jsEnc}`);
    expect(p.html).toBe("<head><title>X</title></head>");
    expect(p.jsList).toBe("/app.js");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ html: "", jsList: "" });
  });
  it("round-trips through build/parse", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const html = "<head><script src='/a.js'></script></head>";
    const js = "/b.js\n/c.js async";
    const url = buildShareUrl(html, js);
    const hash = url.startsWith("?") ? url.slice(1) : url.split("#")[1] || "";
    const p = parseShareUrl(hash);
    expect(p.html).toBe(html);
    expect(p.jsList).toBe(js);
    (globalThis as Record<string, unknown>).window = origWindow;
  });
});

// Suppress unused-import lint
export type _Unused = ScriptTag;
