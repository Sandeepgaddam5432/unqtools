import { describe, it, expect, beforeEach } from "vitest";
import {
  PALETTES,
  PALETTE_BY_NAME,
  normalizeHex,
  parseColors,
  paletteFromInput,
  mulberry32,
  pick,
  rngRange,
  rngInt,
  esc,
  clamp,
  fmtNum,
  regularPolygon,
  starPoints,
  pointsToPath,
  heartPath,
  leafPath,
  lightningPath,
  generateGeometric,
  generateMandala,
  generatePattern,
  generateLandscape,
  generateIcon,
  generateSvg,
  minifySvg,
  validateSvg,
  rasterizeToPngDataUrl,
  svgToReactComponent,
  buildLlmRequestBody,
  extractSvgFromLlmResponse,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  parsePromptToOptions,
  type ArtStyle,
  type SvgOptions,
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

const basePalette = PALETTES[0];

function mkOpts(over: Partial<SvgOptions> = {}): SvgOptions {
  return {
    style: "geometric",
    width: 200,
    height: 200,
    complexity: 5,
    seed: 42,
    palette: basePalette,
    strokeWidth: 2,
    fill: true,
    rounded: false,
    ...over,
  };
}

// ---------- Palettes ----------

describe("svg-art palettes", () => {
  it("has 8 presets", () => {
    expect(PALETTES).toHaveLength(8);
  });
  it("indexes by name", () => {
    expect(PALETTES[0].name).toBeTruthy();
    expect(PALETTE_BY_NAME[PALETTES[0].name]).toBe(PALETTES[0]);
  });
  it("every palette has 3+ colors", () => {
    for (const p of PALETTES) {
      expect(p.colors.length).toBeGreaterThanOrEqual(3);
      expect(p.bg).toMatch(/^#/);
    }
  });
});

// ---------- Color parsing ----------

describe("svg-art normalizeHex", () => {
  it("accepts 6-digit", () => {
    expect(normalizeHex("#ff6b6b")).toBe("#ff6b6b");
  });
  it("expands 3-digit", () => {
    expect(normalizeHex("#fff")).toBe("#ffffff");
    expect(normalizeHex("abc")).toBe("#aabbcc");
  });
  it("returns empty for invalid", () => {
    expect(normalizeHex("xyz")).toBe("");
    expect(normalizeHex("")).toBe("");
  });
});

describe("svg-art parseColors", () => {
  it("parses space separated", () => {
    expect(parseColors("#ff0000 #00ff00 #0000ff")).toEqual(["#ff0000", "#00ff00", "#0000ff"]);
  });
  it("parses comma separated", () => {
    expect(parseColors("#ff0000, #00ff00, #0000ff")).toEqual(["#ff0000", "#00ff00", "#0000ff"]);
  });
  it("expands 3-digit hex", () => {
    expect(parseColors("#fff #000")).toEqual(["#ffffff", "#000000"]);
  });
  it("skips invalid", () => {
    expect(parseColors("#ff0000 notacolor #00ff00")).toEqual(["#ff0000", "#00ff00"]);
  });
  it("returns empty for empty", () => {
    expect(parseColors("")).toEqual([]);
  });
});

describe("svg-art paletteFromInput", () => {
  it("builds custom palette", () => {
    const p = paletteFromInput("#ffffff", "#ff0000 #00ff00");
    expect(p.bg).toBe("#ffffff");
    expect(p.colors).toEqual(["#ff0000", "#00ff00"]);
    expect(p.name).toBe("custom");
  });
  it("falls back to PALETTES[0] when no colors", () => {
    const p = paletteFromInput("#ffffff", "");
    expect(p).toBe(PALETTES[0]);
  });
  it("falls back when colors invalid", () => {
    const p = paletteFromInput("", "notcolor");
    expect(p).toBe(PALETTES[0]);
  });
});

// ---------- PRNG ----------

describe("svg-art mulberry32", () => {
  it("is deterministic for same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });
  it("produces values in [0,1)", () => {
    const r = mulberry32(123);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it("different seeds diverge", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).not.toEqual(seqB);
  });
});

describe("svg-art pick / rngRange / rngInt", () => {
  it("pick returns an element", () => {
    const rng = mulberry32(7);
    const arr = [1, 2, 3, 4];
    expect(arr).toContain(pick(rng, arr));
  });
  it("rngRange respects bounds", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 50; i++) {
      const v = rngRange(rng, 5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
    }
  });
  it("rngInt respects bounds", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 50; i++) {
      const v = rngInt(rng, 1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });
});

// ---------- Helpers ----------

describe("svg-art helpers", () => {
  it("esc escapes special chars", () => {
    expect(esc('a<b>"c"&d')).toBe("a&lt;b&gt;&quot;c&quot;&amp;d");
  });
  it("clamp clamps", () => {
    expect(clamp(5, 1, 10)).toBe(5);
    expect(clamp(0, 1, 10)).toBe(1);
    expect(clamp(15, 1, 10)).toBe(10);
  });
  it("fmtNum rounds", () => {
    expect(fmtNum(3.14159, 2)).toBe("3.14");
    expect(fmtNum(2.5, 0)).toBe("3");
  });
  it("regularPolygon returns points", () => {
    const pts = regularPolygon(50, 50, 10, 6, 0);
    expect(pts.split(" ").length).toBe(6);
  });
  it("starPoints returns 2n points", () => {
    const pts = starPoints(50, 50, 20, 10, 5, 0);
    expect(pts.split(" ").length).toBe(10);
  });
  it("pointsToPath produces M / L / Z", () => {
    const path = pointsToPath("0,0 10,0 10,10 0,10");
    expect(path.startsWith("M0,0")).toBe(true);
    expect(path.endsWith("Z")).toBe(true);
    expect(path).toContain("L10,0");
  });
  it("heartPath produces path with curves", () => {
    const p = heartPath(50, 50, 20);
    expect(p.startsWith("M50,")).toBe(true);
    expect(p).toContain("C");
    expect(p).toContain("Z");
  });
  it("leafPath produces path with curves", () => {
    const p = leafPath(50, 50, 20);
    expect(p).toContain("Q");
    expect(p).toContain("Z");
  });
  it("lightningPath produces path", () => {
    const p = lightningPath(50, 50, 20);
    expect(p).toContain("M");
    expect(p).toContain("Z");
  });
});

// ---------- Generators ----------

describe("svg-art generateGeometric", () => {
  it("renders rect + polygons + lines", () => {
    const out = generateGeometric(mkOpts());
    expect(out).toContain("<rect");
    expect(out).toContain("<polygon");
    expect(out).toContain("<line");
  });
  it("is deterministic for same seed", () => {
    const a = generateGeometric(mkOpts({ seed: 7 }));
    const b = generateGeometric(mkOpts({ seed: 7 }));
    expect(a).toBe(b);
  });
  it("stroke-only when fill=false", () => {
    const out = generateGeometric(mkOpts({ fill: false }));
    expect(out).toContain('fill="none"');
  });
});

describe("svg-art generateMandala", () => {
  it("renders rect + ellipses + circles", () => {
    const out = generateMandala(mkOpts({ style: "mandala" }));
    expect(out).toContain("<rect");
    expect(out).toContain("<ellipse");
    expect(out).toContain("<circle");
  });
  it("different seeds diverge", () => {
    const a = generateMandala(mkOpts({ style: "mandala", seed: 1 }));
    const b = generateMandala(mkOpts({ style: "mandala", seed: 2 }));
    expect(a).not.toBe(b);
  });
});

describe("svg-art generatePattern", () => {
  it("dots renders circles", () => {
    const out = generatePattern(mkOpts({ style: "pattern", pattern: "dots" }));
    expect(out).toContain("<circle");
  });
  it("hex-tiles renders polygons", () => {
    const out = generatePattern(mkOpts({ style: "pattern", pattern: "hex-tiles" }));
    expect(out).toContain("<polygon");
  });
  it("chevrons renders polylines", () => {
    const out = generatePattern(mkOpts({ style: "pattern", pattern: "chevrons" }));
    expect(out).toContain("<polyline");
  });
  it("waves renders paths", () => {
    const out = generatePattern(mkOpts({ style: "pattern", pattern: "waves" }));
    expect(out).toContain("<path");
  });
  it("triangles renders polygons", () => {
    const out = generatePattern(mkOpts({ style: "pattern", pattern: "triangles" }));
    expect(out).toContain("<polygon");
  });
});

describe("svg-art generateLandscape", () => {
  it("renders stars + sun + mountains", () => {
    const out = generateLandscape(mkOpts({ style: "landscape" }));
    expect(out).toContain("<circle"); // stars + sun
    expect(out).toContain("<path"); // mountains
  });
});

describe("svg-art generateIcon", () => {
  it("heart renders path", () => {
    const out = generateIcon(mkOpts({ style: "icon", icon: "heart" }));
    expect(out).toContain("<path");
  });
  it("star renders polygon", () => {
    const out = generateIcon(mkOpts({ style: "icon", icon: "star" }));
    expect(out).toContain("<polygon");
  });
  it("leaf renders path + line", () => {
    const out = generateIcon(mkOpts({ style: "icon", icon: "leaf" }));
    expect(out).toContain("<path");
    expect(out).toContain("<line");
  });
  it("lightning renders path", () => {
    const out = generateIcon(mkOpts({ style: "icon", icon: "lightning" }));
    expect(out).toContain("<path");
  });
  it("badge renders polygon + circle", () => {
    const out = generateIcon(mkOpts({ style: "icon", icon: "badge" }));
    expect(out).toContain("<polygon");
    expect(out).toContain("<circle");
  });
  it("hex-flower renders 7 polygons", () => {
    const out = generateIcon(mkOpts({ style: "icon", icon: "hex-flower" }));
    const matches = out.match(/<polygon/g) || [];
    expect(matches.length).toBe(7);
  });
});

// ---------- generateSvg ----------

describe("svg-art generateSvg", () => {
  it("wraps body in svg root", () => {
    const r = generateSvg(mkOpts());
    expect(r.svg.startsWith("<svg")).toBe(true);
    expect(r.svg.endsWith("</svg>")).toBe(true);
    expect(r.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(r.svg).toContain("viewBox");
  });
  it("returns bytes + pathCount + seed", () => {
    const r = generateSvg(mkOpts({ seed: 99 }));
    expect(r.bytes).toBeGreaterThan(0);
    expect(r.pathCount).toBeGreaterThan(0);
    expect(r.seed).toBe(99);
  });
  it("warns and falls back when palette has no colors", () => {
    const r = generateSvg(mkOpts({ palette: { name: "empty", bg: "#000", colors: [] } }));
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("clamps invalid dimensions", () => {
    const r = generateSvg(mkOpts({ width: 99999, height: -10 }));
    expect(r.svg).toContain('width="4000"');
  });
  it("is deterministic for same options", () => {
    const a = generateSvg(mkOpts({ seed: 5 }));
    const b = generateSvg(mkOpts({ seed: 5 }));
    expect(a.svg).toBe(b.svg);
  });
  it("handles all styles", () => {
    const styles: ArtStyle[] = ["geometric", "mandala", "pattern", "landscape", "icon"];
    for (const s of styles) {
      const r = generateSvg(mkOpts({ style: s }));
      expect(r.svg).toContain("<svg");
      expect(r.svg).toContain("</svg>");
      expect(r.bytes).toBeGreaterThan(0);
      expect(r.pathCount).toBeGreaterThan(0);
    }
  });
});

// ---------- Minifier ----------

describe("svg-art minifySvg", () => {
  it("collapses whitespace", () => {
    const s = `<svg>\n  <g>\n    <circle/>\n  </g>\n</svg>`;
    const m = minifySvg(s);
    expect(m).toBe("<svg><g><circle/></g></svg>");
  });
  it("strips comments", () => {
    const s = `<svg><!-- hi --><g/></svg>`;
    expect(minifySvg(s)).toBe("<svg><g/></svg>");
  });
  it("empty returns empty", () => {
    expect(minifySvg("")).toBe("");
  });
});

// ---------- Validator ----------

describe("svg-art validateSvg", () => {
  it("valid for proper svg", () => {
    const v = validateSvg('<svg xmlns="x" viewBox="0 0 10 10"><circle cx="5" cy="5" r="2"/></svg>');
    expect(v.valid).toBe(true);
    expect(v.errors).toHaveLength(0);
  });
  it("error when empty", () => {
    const v = validateSvg("");
    expect(v.valid).toBe(false);
    expect(v.errors.length).toBeGreaterThan(0);
  });
  it("error when no svg root", () => {
    const v = validateSvg("<div>nope</div>");
    expect(v.valid).toBe(false);
  });
  it("warns when no viewBox", () => {
    const v = validateSvg('<svg xmlns="x"><circle/></svg>');
    expect(v.warnings.some((w) => w.includes("viewBox"))).toBe(true);
  });
  it("warns when no xmlns", () => {
    const v = validateSvg('<svg viewBox="0 0 10 10"><circle/></svg>');
    expect(v.warnings.some((w) => w.includes("xmlns"))).toBe(true);
  });
  it("warns when embedded raster", () => {
    const v = validateSvg('<svg xmlns="x" viewBox="0 0 10 10"><image href="data:image/png;base64,xx"/></svg>');
    expect(v.warnings.some((w) => w.includes("raster"))).toBe(true);
  });
});

// ---------- PNG / React ----------

describe("svg-art rasterizeToPngDataUrl", () => {
  it("returns empty when document unavailable", () => {
    expect(rasterizeToPngDataUrl("<svg/>")).toBe("");
  });
  it("returns empty for empty input", () => {
    expect(rasterizeToPngDataUrl("")).toBe("");
  });
});

describe("svg-art svgToReactComponent", () => {
  it("converts to React component", () => {
    const svg = '<svg xmlns="x" width="10" height="10" viewBox="0 0 10 10"><g stroke-width="2" fill-opacity="0.5"><circle class="c" cx="5" cy="5" r="2"/></g></svg>';
    const out = svgToReactComponent(svg, "MyArt");
    expect(out).toContain("export default function MyArt");
    expect(out).toContain("strokeWidth=");
    expect(out).toContain("fillOpacity=");
    expect(out).toContain("className=");
    expect(out).not.toContain("xmlns=");
  });
  it("empty for empty input", () => {
    expect(svgToReactComponent("")).toBe("");
  });
});

// ---------- LLM hook ----------

describe("svg-art LLM hook", () => {
  it("builds request body", () => {
    const body = buildLlmRequestBody({ prompt: "neon mandala", apiKey: "k", style: "mandala", colors: ["#fff"] });
    const j = JSON.parse(body);
    expect(j.model).toBe("gpt-4o-mini");
    expect(j.messages[1].content).toContain("neon mandala");
  });
  it("extracts svg from response", () => {
    const txt = 'Here is your art: <svg xmlns="x" viewBox="0 0 10 10"><circle/></svg> thanks';
    const svg = extractSvgFromLlmResponse(txt);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
  });
  it("returns empty when no svg", () => {
    expect(extractSvgFromLlmResponse("no svg here")).toBe("");
    expect(extractSvgFromLlmResponse("")).toBe("");
  });
});

// ---------- History ----------

describe("svg-art history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, style: "mandala", seed: 42, bytes: 500, prompt: "test" });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].style).toBe("mandala");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, style: "geometric", seed: i, bytes: 100, prompt: `p${i}` });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, style: "geometric", seed: 1, bytes: 100, prompt: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------- Shareable URL ----------

describe("svg-art share URL", () => {
  it("builds URL with all params", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      style: "mandala",
      seed: 42,
      complexity: 7,
      paletteName: "neon",
      pattern: "waves",
      icon: "heart",
      prompt: "neon mandala",
    });
    expect(url).toContain("style=mandala");
    expect(url).toContain("seed=42");
    expect(url).toContain("cx=7");
    expect(url).toContain("pal=neon");
    expect(url).toContain("pat=waves");
    expect(url).toContain("icon=heart");
    expect(url).toContain("q=neon+mandala");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses back", () => {
    const p = parseShareUrl("style=mandala&seed=42&cx=7&pal=neon&pat=waves&icon=heart&q=hi");
    expect(p.style).toBe("mandala");
    expect(p.seed).toBe(42);
    expect(p.complexity).toBe(7);
    expect(p.paletteName).toBe("neon");
    expect(p.pattern).toBe("waves");
    expect(p.icon).toBe("heart");
    expect(p.prompt).toBe("hi");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown style", () => {
    const p = parseShareUrl("style=unknown");
    expect(p.style).toBeUndefined();
  });
  it("filters unknown pattern", () => {
    const p = parseShareUrl("pat=bogus");
    expect(p.pattern).toBeUndefined();
  });
});

// ---------- Prompt parser ----------

describe("svg-art parsePromptToOptions", () => {
  it("detects mandala", () => {
    const o = parsePromptToOptions("a mandala design");
    expect(o.style).toBe("mandala");
  });
  it("detects landscape", () => {
    const o = parsePromptToOptions("mountain landscape at night");
    expect(o.style).toBe("landscape");
  });
  it("detects icon variants", () => {
    expect(parsePromptToOptions("a heart icon").icon).toBe("heart");
    expect(parsePromptToOptions("a leaf icon").icon).toBe("leaf");
    expect(parsePromptToOptions("a lightning bolt").icon).toBe("lightning");
    expect(parsePromptToOptions("a badge icon").icon).toBe("badge");
    expect(parsePromptToOptions("a star icon").icon).toBe("star");
  });
  it("detects pattern variants", () => {
    expect(parsePromptToOptions("hex tile pattern").pattern).toBe("hex-tiles");
    expect(parsePromptToOptions("chevron pattern").pattern).toBe("chevrons");
    expect(parsePromptToOptions("wave pattern").pattern).toBe("waves");
    expect(parsePromptToOptions("triangle pattern").pattern).toBe("triangles");
    expect(parsePromptToOptions("dots pattern").pattern).toBe("dots");
  });
  it("detects geometric", () => {
    expect(parsePromptToOptions("geometric polygon kaleidoscope").style).toBe("geometric");
  });
  it("detects complexity hints", () => {
    expect(parsePromptToOptions("simple minimal design").complexity).toBe(2);
    expect(parsePromptToOptions("dense complex rich busy design").complexity).toBe(9);
  });
  it("detects palette name", () => {
    expect(parsePromptToOptions("neon sunset ocean").palette?.name).toBeTruthy();
  });
  it("returns empty overrides for empty prompt", () => {
    const o = parsePromptToOptions("");
    expect(o.style).toBeUndefined();
  });
  it("preserves base overrides", () => {
    const o = parsePromptToOptions("mandala", { width: 500 });
    expect(o.width).toBe(500);
    expect(o.style).toBe("mandala");
  });
});
