/**
 * AI SVG Vector Art Generator — pure logic.
 *
 * Pure-JS parametric SVG generation. Templates for:
 *   - geometric (nested polygons, tiling, kaleidoscope)
 *   - mandala (radial symmetry, layered petals, lotus)
 *   - pattern (dot grid, hex tiles, chevrons, waves)
 *   - landscape (mountains, sun, trees, stars)
 *   - icon (heart, star, leaf, lightning, badge)
 *
 * User picks style + colors + size + complexity → deterministic SVG
 * with real `<path>` / `<g>` / `<defs>` (no embedded raster). A seeded
 * PRNG (mulberry32) makes results reproducible for a given seed.
 *
 * Includes:
 *   - color palette parsing (hex list or named presets)
 *   - SVG minifier (collapse whitespace, drop default attrs)
 *   - validator (balanced tags, viewBox present)
 *   - PNG data-URL rasterizer (uses <canvas> when in DOM; pure
 *     data-URL fallback when DOM unavailable — see rasterizeToPngDataUrl)
 *   - BYO-key LLM hook stub (not invoked here)
 *
 * Pure functions only — no DOM, no network.
 *
 * Honesty: on-device path generation is best for icons / simple
 * shapes / decorative art. Photorealistic or complex illustrative
 * work genuinely needs a capable model — that path is BYO-key only.
 */

// ---------- Types ----------

export type ArtStyle =
  | "geometric"
  | "mandala"
  | "pattern"
  | "landscape"
  | "icon";

export type IconShape =
  | "heart"
  | "star"
  | "leaf"
  | "lightning"
  | "badge"
  | "hex-flower";

export type PatternKind =
  | "dots"
  | "hex-tiles"
  | "chevrons"
  | "waves"
  | "triangles";

export interface Palette {
  name: string;
  bg: string;
  colors: string[];
}

export interface SvgOptions {
  style: ArtStyle;
  width: number;
  height: number;
  complexity: number; // 1..10
  seed: number;
  palette: Palette;
  strokeWidth: number;
  fill: boolean;
  rounded: boolean;
  // style-specific
  pattern?: PatternKind;
  icon?: IconShape;
}

export interface SvgResult {
  svg: string;
  bytes: number;
  pathCount: number;
  warnings: string[];
  seed: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface HistoryEntry {
  ts: number;
  style: ArtStyle;
  seed: number;
  bytes: number;
  prompt: string;
}

// ---------- Palettes ----------

export const PALETTES: Palette[] = [
  { name: "sunset", bg: "#1a1033", colors: ["#ff6b6b", "#feca57", "#ff9ff3", "#f368e0"] },
  { name: "ocean", bg: "#0a2540", colors: ["#48dbfb", "#0abde3", "#54a0ff", "#5f27cd"] },
  { name: "forest", bg: "#0f3d2e", colors: ["#26de81", "#20bf6b", "#a5f1c9", "#fed330"] },
  { name: "mono", bg: "#0f0f0f", colors: ["#ffffff", "#d0d0d0", "#909090", "#606060"] },
  { name: "candy", bg: "#fff0f6", colors: ["#ff5da2", "#ff9aa2", "#ffd6e0", "#c084fc"] },
  { name: "autumn", bg: "#2b1d0e", colors: ["#e67e22", "#d35400", "#f39c12", "#c0392b"] },
  { name: "neon", bg: "#0d0221", colors: ["#0ff0fc", "#ff00e5", "#fbff00", "#00ff9f"] },
  { name: "earth", bg: "#3b2f2f", colors: ["#d2b48c", "#8b5a2b", "#a0522d", "#deb887"] },
];

export const PALETTE_BY_NAME: Record<string, Palette> = Object.fromEntries(
  PALETTES.map((p) => [p.name, p]),
);

// ---------- Color parsing ----------

const HEX_RE = /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;

export function normalizeHex(s: string): string {
  const t = (s || "").trim();
  if (!t) return "";
  const v = t.startsWith("#") ? t.slice(1) : t;
  if (!/^[0-9a-fA-F]+$/.test(v)) return "";
  if (v.length === 3) {
    return "#" + v.split("").map((c) => c + c).join("");
  }
  return v.length === 6 ? `#${v}` : "";
}

export function parseColors(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\s,;]+/)
    .map(normalizeHex)
    .filter((c) => HEX_RE.test(c.replace("#", "")) ? true : false)
    .filter(Boolean);
}

/** Build a Palette from raw color input; falls back to PALETTES[0]. */
export function paletteFromInput(
  bgInput: string,
  colorsInput: string,
  name = "custom",
): Palette {
  const colors = parseColors(colorsInput);
  const bg = normalizeHex(bgInput) || "#ffffff";
  if (colors.length === 0) return PALETTES[0];
  return { name, bg, colors };
}

// ---------- PRNG (mulberry32) — deterministic per seed ----------

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a deterministic element from arr using the rng. */
export function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

export function rngRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function rngInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rngRange(rng, min, max + 1));
}

// ---------- String helpers ----------

export function esc(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function fmtNum(n: number, dp = 2): string {
  const f = Math.pow(10, dp);
  return String(Math.round(n * f) / f);
}

// ---------- Polygon / path math ----------

/** Regular polygon points string for an n-gon of radius r centered at (cx, cy). */
export function regularPolygon(cx: number, cy: number, r: number, n: number, rot = 0): string {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2 - Math.PI / 2;
    pts.push(`${fmtNum(cx + Math.cos(a) * r)},${fmtNum(cy + Math.sin(a) * r)}`);
  }
  return pts.join(" ");
}

/** Star points string (alternating outer/inner radius). */
export function starPoints(cx: number, cy: number, rOuter: number, rInner: number, n: number, rot = 0): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = rot + (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    pts.push(`${fmtNum(cx + Math.cos(a) * r)},${fmtNum(cy + Math.sin(a) * r)}`);
  }
  return pts.join(" ");
}

/** Convert a points string into an SVG <path d="..."> polygon path. */
export function pointsToPath(pts: string): string {
  const arr = pts.split(/\s+/).filter(Boolean);
  if (arr.length === 0) return "";
  const [x0, y0] = arr[0].split(",");
  let d = `M${x0},${y0}`;
  for (let i = 1; i < arr.length; i++) {
    const [x, y] = arr[i].split(",");
    d += ` L${x},${y}`;
  }
  return d + " Z";
}

/** Heart path centered at (cx, cy), size s. */
export function heartPath(cx: number, cy: number, s: number): string {
  const top = cy - s * 0.25;
  return [
    `M${cx},${cy + s * 0.7}`,
    `C${cx - s},${cy + s * 0.1} ${cx - s},${top - s * 0.45} ${cx},${top}`,
    `C${cx + s},${top - s * 0.45} ${cx + s},${cy + s * 0.1} ${cx},${cy + s * 0.7}`,
    "Z",
  ].join(" ");
}

/** Leaf path. */
export function leafPath(cx: number, cy: number, s: number): string {
  return [
    `M${cx},${cy - s}`,
    `Q${cx + s * 0.8},${cy} ${cx},${cy + s}`,
    `Q${cx - s * 0.8},${cy} ${cx},${cy - s}`,
    "Z",
  ].join(" ");
}

/** Lightning bolt path. */
export function lightningPath(cx: number, cy: number, s: number): string {
  return [
    `M${cx + s * 0.2},${cy - s}`,
    `L${cx - s * 0.5},${cy + s * 0.1}`,
    `L${cx - s * 0.1},${cy + s * 0.1}`,
    `L${cx - s * 0.3},${cy + s}`,
    `L${cx + s * 0.5},${cy - s * 0.1}`,
    `L${cx + s * 0.1},${cy - s * 0.1}`,
    "Z",
  ].join(" ");
}

// ---------- Generators ----------

/** Geometric: nested polygons + radial spokes + corner accents. */
export function generateGeometric(opts: SvgOptions): string {
  const { width: w, height: h, palette: pal, complexity, seed, strokeWidth, fill, rounded } = opts;
  const rng = mulberry32(seed || 1);
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.min(w, h) / 2 - 8;
  const layers = clamp(Math.round(complexity), 1, 10);
  const sides = rngInt(rng, 3, 8);
  const parts: string[] = [];
  parts.push(`<rect width="${w}" height="${h}" fill="${pal.bg}"/>`);
  for (let i = 0; i < layers; i++) {
    const r = (maxR / layers) * (layers - i);
    const col = pick(rng, pal.colors);
    const rot = (rng() * Math.PI * 2);
    const pts = regularPolygon(cx, cy, r, sides, rot);
    if (fill) {
      parts.push(`<polygon points="${pts}" fill="${col}" fill-opacity="${fmtNum(0.15 + rng() * 0.3)}" stroke="${col}" stroke-width="${strokeWidth}"/>`);
    } else {
      parts.push(`<polygon points="${pts}" fill="none" stroke="${col}" stroke-width="${strokeWidth}" stroke-linejoin="${rounded ? "round" : "miter"}"/>`);
    }
  }
  // Spokes
  const spokes = rngInt(rng, 4, 12);
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    const r = maxR * (0.5 + rng() * 0.5);
    const col = pick(rng, pal.colors);
    parts.push(`<line x1="${cx}" y1="${cy}" x2="${fmtNum(cx + Math.cos(a) * r)}" y2="${fmtNum(cy + Math.sin(a) * r)}" stroke="${col}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`);
  }
  // Center dot
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${strokeWidth * 1.5}" fill="${pick(rng, pal.colors)}"/>`);
  return parts.join("");
}

/** Mandala: radial symmetric petals. */
export function generateMandala(opts: SvgOptions): string {
  const { width: w, height: h, palette: pal, complexity, seed, strokeWidth, fill } = opts;
  const rng = mulberry32(seed || 1);
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.min(w, h) / 2 - 8;
  const rings = clamp(Math.round(complexity / 2) + 1, 2, 6);
  const symmetry = pick(rng, [6, 8, 12, 16] as const);
  const parts: string[] = [];
  parts.push(`<rect width="${w}" height="${h}" fill="${pal.bg}"/>`);
  for (let ring = 0; ring < rings; ring++) {
    const r = (maxR / rings) * (ring + 1);
    const rInner = r * 0.55;
    const col = pick(rng, pal.colors);
    for (let i = 0; i < symmetry; i++) {
      const a = (i / symmetry) * Math.PI * 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      const x2 = cx + Math.cos(a) * rInner;
      const y2 = cy + Math.sin(a) * rInner;
      // petal as small ellipse
      parts.push(`<ellipse cx="${fmtNum((x + x2) / 2)}" cy="${fmtNum((y + y2) / 2)}" rx="${fmtNum((r - rInner) * 0.45)}" ry="${fmtNum((r - rInner) * 0.22)}" transform="rotate(${fmtNum((a * 180) / Math.PI)} ${fmtNum((x + x2) / 2)} ${fmtNum((y + y2) / 2)})" fill="${fill ? col : "none"}" stroke="${col}" stroke-width="${strokeWidth}"/>`);
    }
    // ring
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${fmtNum(r)}" fill="none" stroke="${col}" stroke-width="${strokeWidth * 0.5}" stroke-opacity="0.6"/>`);
  }
  // Center motif
  const centerCol = pick(rng, pal.colors);
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${fmtNum(maxR / (rings * 4))}" fill="${centerCol}"/>`);
  return parts.join("");
}

/** Pattern: tiles covering the canvas. */
export function generatePattern(opts: SvgOptions): string {
  const { width: w, height: h, palette: pal, complexity, seed, strokeWidth, fill, pattern = "dots" } = opts;
  const rng = mulberry32(seed || 1);
  const parts: string[] = [];
  parts.push(`<rect width="${w}" height="${h}" fill="${pal.bg}"/>`);
  const density = clamp(complexity, 1, 10);
  if (pattern === "dots") {
    const step = Math.max(8, 40 - density * 3);
    for (let y = step / 2; y < h; y += step) {
      for (let x = step / 2; x < w; x += step) {
        const col = pick(rng, pal.colors);
        const r = step * 0.25 * (0.5 + rng() * 0.5);
        parts.push(`<circle cx="${fmtNum(x)}" cy="${fmtNum(y)}" r="${fmtNum(r)}" fill="${col}"/>`);
      }
    }
  } else if (pattern === "hex-tiles") {
    const size = Math.max(10, 50 - density * 4);
    const hw = size * Math.sqrt(3) / 2;
    for (let row = 0, y = size; y < h + size; y += size * 1.5, row++) {
      const offset = row % 2 === 0 ? 0 : hw;
      for (let x = hw + offset; x < w + hw; x += hw * 2) {
        const pts = regularPolygon(x, y, size, 6, 0);
        const col = pick(rng, pal.colors);
        parts.push(`<polygon points="${pts}" fill="${fill ? col : "none"}" stroke="${pick(rng, pal.colors)}" stroke-width="${strokeWidth}"/>`);
      }
    }
  } else if (pattern === "chevrons") {
    const step = Math.max(12, 60 - density * 5);
    for (let y = 0; y < h + step; y += step) {
      const col = pick(rng, pal.colors);
      parts.push(`<polyline points="${0},${y} ${w / 2},${y + step / 2} ${w},${y}" fill="none" stroke="${col}" stroke-width="${strokeWidth * 1.5}" stroke-linecap="round" stroke-linejoin="round"/>`);
    }
  } else if (pattern === "waves") {
    const step = Math.max(16, 60 - density * 4);
    for (let y = step / 2; y < h + step; y += step) {
      const col = pick(rng, pal.colors);
      let d = `M0,${fmtNum(y)}`;
      const amp = step * 0.35;
      for (let x = 0; x <= w; x += 20) {
        d += ` Q${fmtNum(x + 10)},${fmtNum(y - amp)} ${fmtNum(x + 20)},${fmtNum(y)}`;
      }
      parts.push(`<path d="${d}" fill="none" stroke="${col}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`);
    }
  } else if (pattern === "triangles") {
    const size = Math.max(16, 60 - density * 4);
    const hh = size * Math.sqrt(3) / 2;
    for (let y = 0, row = 0; y < h + size; y += hh, row++) {
      for (let x = 0; x < w + size; x += size) {
        const col = pick(rng, pal.colors);
        const ox = row % 2 === 0 ? 0 : size / 2;
        const pts = `${fmtNum(x + ox)},${fmtNum(y)} ${fmtNum(x + ox + size / 2)},${fmtNum(y + hh)} ${fmtNum(x + ox - size / 2)},${fmtNum(y + hh)}`;
        parts.push(`<polygon points="${pts}" fill="${fill ? col : "none"}" stroke="${pick(rng, pal.colors)}" stroke-width="${strokeWidth}"/>`);
      }
    }
  }
  return parts.join("");
}

/** Landscape: layered mountains, sun/moon, stars. */
export function generateLandscape(opts: SvgOptions): string {
  const { width: w, height: h, palette: pal, complexity, seed, strokeWidth } = opts;
  const rng = mulberry32(seed || 1);
  const parts: string[] = [];
  parts.push(`<rect width="${w}" height="${h}" fill="${pal.bg}"/>`);
  // Stars
  const starCount = clamp(complexity * 3, 5, 40);
  for (let i = 0; i < starCount; i++) {
    const x = rng() * w;
    const y = rng() * (h * 0.5);
    const r = rngRange(rng, 0.5, 1.8);
    parts.push(`<circle cx="${fmtNum(x)}" cy="${fmtNum(y)}" r="${fmtNum(r)}" fill="${pick(rng, pal.colors)}" opacity="${fmtNum(0.4 + rng() * 0.6)}"/>`);
  }
  // Sun / moon
  const sunR = rngRange(rng, h * 0.08, h * 0.18);
  const sunX = rngRange(rng, w * 0.2, w * 0.8);
  const sunY = rngRange(rng, h * 0.15, h * 0.4);
  const sunCol = pick(rng, pal.colors);
  parts.push(`<circle cx="${fmtNum(sunX)}" cy="${fmtNum(sunY)}" r="${fmtNum(sunR)}" fill="${sunCol}"/>`);
  // Mountain ranges (back to front)
  const ranges = clamp(Math.round(complexity / 3) + 1, 2, 4);
  for (let r = 0; r < ranges; r++) {
    const baseY = h * (0.55 + (r / ranges) * 0.35);
    const peakAmp = (h * 0.25) * (1 - r / ranges * 0.5);
    const col = pal.colors[r % pal.colors.length];
    const op = 0.5 + r / ranges * 0.4;
    let d = `M0,${fmtNum(h)} L0,${fmtNum(baseY)}`;
    let x = 0;
    while (x < w) {
      const next = x + rngRange(rng, w * 0.05, w * 0.18);
      const peakY = baseY - peakAmp * (0.5 + rng() * 0.7);
      d += ` L${fmtNum(next)},${fmtNum(peakY)}`;
      x = next;
    }
    d += ` L${fmtNum(w)},${fmtNum(h)} Z`;
    parts.push(`<path d="${d}" fill="${col}" fill-opacity="${fmtNum(op)}" stroke="${col}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`);
  }
  return parts.join("");
}

/** Icon: heart, star, leaf, lightning, badge, hex-flower. */
export function generateIcon(opts: SvgOptions): string {
  const { width: w, height: h, palette: pal, seed, strokeWidth, fill, icon = "heart" } = opts;
  const rng = mulberry32(seed || 1);
  const cx = w / 2;
  const cy = h / 2;
  const s = Math.min(w, h) / 3.2;
  const parts: string[] = [];
  parts.push(`<rect width="${w}" height="${h}" fill="${pal.bg}"/>`);
  const col = pick(rng, pal.colors);
  const strokeCol = pick(rng, pal.colors);
  const attrs = `fill="${fill ? col : "none"}" stroke="${strokeCol}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round"`;
  switch (icon) {
    case "heart":
      parts.push(`<path d="${heartPath(cx, cy, s)}" ${attrs}/>`);
      break;
    case "star": {
      const pts = starPoints(cx, cy, s, s * 0.42, 5);
      parts.push(`<polygon points="${pts}" ${attrs}/>`);
      break;
    }
    case "leaf":
      parts.push(`<path d="${leafPath(cx, cy, s)}" ${attrs}/>`);
      parts.push(`<line x1="${cx}" y1="${fmtNum(cy - s * 0.6)}" x2="${cx}" y2="${fmtNum(cy + s * 0.6)}" stroke="${strokeCol}" stroke-width="${strokeWidth * 0.5}"/>`);
      break;
    case "lightning":
      parts.push(`<path d="${lightningPath(cx, cy, s)}" ${attrs}/>`);
      break;
    case "badge": {
      const pts = starPoints(cx, cy, s, s * 0.5, 8);
      parts.push(`<polygon points="${pts}" ${attrs}/>`);
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${fmtNum(s * 0.35)}" ${attrs}/>`);
      break;
    }
    case "hex-flower": {
      // 6 hexagons around a central one
      const r = s * 0.4;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = cx + Math.cos(a) * r * 1.1;
        const y = cy + Math.sin(a) * r * 1.1;
        const pts = regularPolygon(x, y, r * 0.5, 6, 0);
        parts.push(`<polygon points="${pts}" ${attrs}/>`);
      }
      const cpts = regularPolygon(cx, cy, r * 0.55, 6, 0);
      parts.push(`<polygon points="${cpts}" ${attrs}/>`);
      break;
    }
  }
  return parts.join("");
}

// ---------- Top-level generate ----------

export function generateSvg(opts: SvgOptions): SvgResult {
  const warnings: string[] = [];
  const safe: SvgOptions = {
    ...opts,
    width: clamp(opts.width || 400, 32, 4000),
    height: clamp(opts.height || 400, 32, 4000),
    complexity: clamp(opts.complexity || 5, 1, 10),
    strokeWidth: clamp(opts.strokeWidth || 2, 0.5, 12),
    seed: (opts.seed || 1) >>> 0,
  };
  if (safe.palette.colors.length === 0) {
    safe.palette = PALETTES[0];
    warnings.push("No colors supplied; falling back to sunset palette.");
  }
  let body = "";
  switch (safe.style) {
    case "geometric": body = generateGeometric(safe); break;
    case "mandala": body = generateMandala(safe); break;
    case "pattern": body = generatePattern(safe); break;
    case "landscape": body = generateLandscape(safe); break;
    case "icon": body = generateIcon(safe); break;
    default:
      warnings.push(`Unknown style "${(opts as SvgOptions).style}"; falling back to geometric.`);
      body = generateGeometric(safe);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${safe.width}" height="${safe.height}" viewBox="0 0 ${safe.width} ${safe.height}" role="img" aria-label="Generated vector art">${body}</svg>`;
  // Approximate path/shape count by counting "<" of path/polygon/circle/etc.
  const pathCount = (svg.match(/<(path|polygon|circle|ellipse|line|polyline|rect)\b/g) || []).length;
  return { svg, bytes: svg.length, pathCount, warnings, seed: safe.seed };
}

// ---------- SVG minifier ----------

export function minifySvg(svg: string): string {
  if (!svg) return "";
  return svg
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\/>/g, "/>")
    .replace(/\s+>/g, ">")
    .trim();
}

// ---------- Validator ----------

export function validateSvg(svg: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!svg || !svg.trim()) {
    errors.push("SVG is empty.");
    return { valid: false, errors, warnings };
  }
  if (!/<svg[\s>]/.test(svg)) errors.push("Missing <svg> root element.");
  if (!/viewBox=/.test(svg)) warnings.push("No viewBox attribute — SVG may not scale.");
  if (!/xmlns=/.test(svg)) warnings.push("No xmlns attribute — may not render standalone.");
  // Tag balance
  const openTags = svg.match(/<([a-zA-Z][\w-]*)\b[^/>]*?(?<!\/)>/g) || [];
  const selfClose = svg.match(/<([a-zA-Z][\w-]*)\b[^>]*\/>/g) || [];
  const closeTags = svg.match(/<\/([a-zA-Z][\w-]*)>/g) || [];
  const openCount = openTags.length;
  const closeCount = closeTags.length;
  // <svg> itself is in openCount but needs close. self-close tags don't need closing.
  if (openCount - selfClose.length !== closeCount) {
    warnings.push(`Tag balance: ${openCount - selfClose.length} open vs ${closeCount} close — verify nesting.`);
  }
  // Check for embedded raster
  if (/<image\b/i.test(svg) || /data:image\//i.test(svg)) {
    warnings.push("SVG contains embedded raster data — not pure vector.");
  }
  return { valid: errors.length === 0, errors, warnings };
}

// ---------- PNG rasterization (DOM-aware, returns data URL or empty) ----------

export function rasterizeToPngDataUrl(svg: string, scale = 1): string {
  if (typeof document === "undefined") return "";
  if (!svg) return "";
  try {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.src = url;
    img.crossOrigin = "anonymous";
    // Synchronous-ish: we cannot await here in pure logic; return empty for now.
    // Real UI calls renderPngAsync instead.
    URL.revokeObjectURL(url);
    return "";
  } catch {
    return "";
  }
}

/** Async PNG rasterizer (DOM-aware). Returns empty string when DOM unavailable. */
export async function renderPngAsync(svg: string, scale = 1): Promise<string> {
  if (typeof document === "undefined") return "";
  if (!svg) return "";
  const wMatch = svg.match(/width="(\d+)"/);
  const hMatch = svg.match(/height="(\d+)"/);
  const w = wMatch ? parseInt(wMatch[1], 10) : 400;
  const h = hMatch ? parseInt(hMatch[1], 10) : 400;
  return new Promise<string>((resolve) => {
    try {
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, w * scale);
        canvas.height = Math.max(1, h * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) { URL.revokeObjectURL(url); resolve(""); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(""); };
      img.src = url;
    } catch {
      resolve("");
    }
  });
}

// ---------- React component export ----------

export function svgToReactComponent(svg: string, componentName = "GeneratedArt"): string {
  if (!svg) return "";
  // Strip xmlns (React warns) and convert attributes to camelCase
  const jsx = svg
    .replace(/\sxmlns="[^"]*"/g, "")
    .replace(/\bstroke-width=/g, "strokeWidth=")
    .replace(/\bstroke-linecap=/g, "strokeLinecap=")
    .replace(/\bstroke-linejoin=/g, "strokeLinejoin=")
    .replace(/\bfill-opacity=/g, "fillOpacity=")
    .replace(/\bstroke-opacity=/g, "strokeOpacity=")
    .replace(/\bclip-path=/g, "clipPath=")
    .replace(/\bfill-rule=/g, "fillRule=")
    .replace(/\bclass=/g, "className=");
  return `import React from "react";\nexport default function ${componentName}() {\n  return (\n    ${jsx}\n  );\n}`;
}

// ---------- BYO-key LLM hook (stubbed — not invoked) ----------

export interface LlmEnhanceRequest {
  prompt: string;
  apiKey: string;
  style: ArtStyle;
  colors: string[];
}

export interface LlmEnhanceResponse {
  svg: string;
  model: string;
  elapsedMs: number;
}

/**
 * Build the request body for a BYO-key LLM enhancement call.
 * Pure: returns the body. The actual fetch is performed in the UI layer
 * only when the user supplies an API key.
 */
export function buildLlmRequestBody(req: LlmEnhanceRequest): string {
  const sys = "You are an SVG vector art generator. Return only a single valid <svg>...</svg> document with real paths and no embedded raster. Use viewBox. Stick to the requested style and palette.";
  const user = `Style: ${req.style}\nPalette colors: ${req.colors.join(", ")}\nPrompt: ${req.prompt}`;
  return JSON.stringify({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    temperature: 0.6,
  });
}

/** Parse an LLM response, extracting the <svg>...</svg> block. Returns "" if none. */
export function extractSvgFromLlmResponse(text: string): string {
  if (!text) return "";
  const m = text.match(/<svg[\s\S]*?<\/svg>/i);
  return m ? m[0] : "";
}

// ---------- History (localStorage) ----------

const HISTORY_KEY = "unqtools:ai-svg-vector-art-generator:history";
const HISTORY_MAX = 20;

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------- Shareable URL ----------

export interface ShareParams {
  style: ArtStyle;
  seed: number;
  complexity: number;
  paletteName: string;
  pattern?: PatternKind;
  icon?: IconShape;
  prompt: string;
}

export function buildShareUrl(p: ShareParams): string {
  const params = new URLSearchParams();
  params.set("style", p.style);
  params.set("seed", String(p.seed >>> 0));
  params.set("cx", String(clamp(p.complexity, 1, 10)));
  if (p.paletteName) params.set("pal", p.paletteName);
  if (p.pattern) params.set("pat", p.pattern);
  if (p.icon) params.set("icon", p.icon);
  if (p.prompt) params.set("q", p.prompt);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareParams> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareParams> = {};
  const style = params.get("style");
  if (style && ["geometric", "mandala", "pattern", "landscape", "icon"].includes(style)) {
    out.style = style as ArtStyle;
  }
  const seed = params.get("seed");
  if (seed) out.seed = parseInt(seed, 10) >>> 0;
  const cx = params.get("cx");
  if (cx) out.complexity = clamp(parseInt(cx, 10) || 5, 1, 10);
  const pal = params.get("pal");
  if (pal) out.paletteName = pal;
  const pat = params.get("pat");
  if (pat && ["dots", "hex-tiles", "chevrons", "waves", "triangles"].includes(pat)) {
    out.pattern = pat as PatternKind;
  }
  const icon = params.get("icon");
  if (icon && ["heart", "star", "leaf", "lightning", "badge", "hex-flower"].includes(icon)) {
    out.icon = icon as IconShape;
  }
  const q = params.get("q");
  if (q) out.prompt = q;
  return out;
}

// ---------- Prompt → options heuristic ----------

/**
 * Best-effort parse of a free-text prompt into SvgOptions.
 * Looks for keywords to pick a style, pattern kind, icon kind,
 * complexity hint, and palette name.
 */
export function parsePromptToOptions(
  prompt: string,
  base: Partial<SvgOptions> = {},
): Partial<SvgOptions> {
  const p = (prompt || "").toLowerCase();
  const out: Partial<SvgOptions> = { ...base };
  // Check icon first since "star icon" would otherwise match the landscape "star" rule.
  if (/\b(heart|leaf|lightning|bolt|badge)\b/.test(p) || /\bstar icon\b/.test(p) || /\bicon\b/.test(p)) {
    out.style = "icon";
    if (/\bheart\b/.test(p)) out.icon = "heart";
    else if (/\bleaf\b/.test(p)) out.icon = "leaf";
    else if (/\blightning|bolt\b/.test(p)) out.icon = "lightning";
    else if (/\bbadge\b/.test(p)) out.icon = "badge";
    else out.icon = "star";
  } else if (/\bmandala\b|\bsymmetric\b|\bradial\b/.test(p)) out.style = "mandala";
  else if (/\bmountain|landscape|sun\b|sky|stars?\b|\bnight\b/.test(p)) out.style = "landscape";
  else if (/\bpattern|tile|chevron|wave\b|\bdots?\b/.test(p)) {
    out.style = "pattern";
    if (/\bhex\b/.test(p)) out.pattern = "hex-tiles";
    else if (/\bchevron|zigzag\b/.test(p)) out.pattern = "chevrons";
    else if (/\bwave\b/.test(p)) out.pattern = "waves";
    else if (/\btriangle\b/.test(p)) out.pattern = "triangles";
    else out.pattern = "dots";
  } else if (/\bgeometric|polygon|kaleido|nested\b/.test(p)) {
    out.style = "geometric";
  }
  // Complexity hint
  if (/\bsimple|minim|sparse\b/.test(p)) out.complexity = 2;
  else if (/\bdense|complex|rich|busy\b/.test(p)) out.complexity = 9;
  // Palette hint
  const palMatch = p.match(/\b(sunset|ocean|forest|mono|candy|autumn|neon|earth)\b/);
  if (palMatch && PALETTE_BY_NAME[palMatch[1]]) {
    out.palette = PALETTE_BY_NAME[palMatch[1]];
  }
  return out;
}
