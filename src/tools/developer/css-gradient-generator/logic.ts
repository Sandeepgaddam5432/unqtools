/**
 * CSS Gradient Generator — pure logic.
 * Generates CSS for: background-image
 */

export interface LayerSpec {
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
  inset: boolean;
}

export interface GenerateOptions {
  layers: LayerSpec[];
  important?: boolean;
}

export function generateCSS(opts: GenerateOptions): string {
  if (!opts.layers || opts.layers.length === 0) return "";
  const layerStrings = opts.layers.map((l) => {
    const insetPrefix = l.inset ? "inset " : "";
    return `${insetPrefix}${l.offsetX}px ${l.offsetY}px ${l.blur}px ${l.spread}px ${l.color}`;
  });
  const joined = layerStrings.join(", ");
  const important = opts.important ? " !important" : "";
  return `background-image: ${joined}${important};`;
}

export function parseCSS(css: string): LayerSpec[] | null {
  const escaped = "background-image".replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(escaped + ":\\s*([^;]+);?"));
  if (!match) return null;
  const value = match[1].trim();
  const layers: LayerSpec[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of value) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      layers.push(parseLayer(cur.trim()));
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) layers.push(parseLayer(cur.trim()));
  return layers;
}

function parseLayer(str: string): LayerSpec {
  const inset = /^inset\b/i.test(str);
  if (inset) str = str.replace(/^inset\s+/i, "");
  const colorMatch = str.match(/(#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|[a-z]+)$/i);
  const color = colorMatch ? colorMatch[1] : "#000000";
  const rest = colorMatch ? str.slice(0, str.length - colorMatch[1].length).trim() : str;
  const parts = rest.split(/\s+/).filter(Boolean);
  const nums = parts.map((p) => parseFloat(p)).filter((n) => !isNaN(n));
  return {
    offsetX: nums[0] ?? 0,
    offsetY: nums[1] ?? 0,
    blur: nums[2] ?? 0,
    spread: nums[3] ?? 0,
    color,
    inset,
  };
}

export function defaultLayer(): LayerSpec {
  return { offsetX: 0, offsetY: 4, blur: 6, spread: -1, color: "rgba(0, 0, 0, 0.1)", inset: false };
}

export function presetLayers(): Record<string, LayerSpec[]> {
  return {
    "Material Elevation 1": [
      { offsetX: 0, offsetY: 1, blur: 3, spread: 0, color: "rgba(0,0,0,0.12)", inset: false },
      { offsetX: 0, offsetY: 1, blur: 2, spread: 0, color: "rgba(0,0,0,0.24)", inset: false },
    ],
    "Material Elevation 2": [
      { offsetX: 0, offsetY: 3, blur: 6, spread: 0, color: "rgba(0,0,0,0.16)", inset: false },
      { offsetX: 0, offsetY: 3, blur: 6, spread: 0, color: "rgba(0,0,0,0.23)", inset: false },
    ],
    "Neumorphism": [
      { offsetX: 6, offsetY: 6, blur: 12, spread: 0, color: "rgba(174,174,192,0.4)", inset: false },
      { offsetX: -6, offsetY: -6, blur: 12, spread: 0, color: "rgba(255,255,255,0.9)", inset: false },
    ],
    "Neumorphism Inset": [
      { offsetX: 6, offsetY: 6, blur: 12, spread: 0, color: "rgba(174,174,192,0.4)", inset: true },
      { offsetX: -6, offsetY: -6, blur: 12, spread: 0, color: "rgba(255,255,255,0.9)", inset: true },
    ],
    "Neon Glow": [
      { offsetX: 0, offsetY: 0, blur: 5, spread: 2, color: "rgba(0,255,255,0.7)", inset: false },
      { offsetX: 0, offsetY: 0, blur: 20, spread: 5, color: "rgba(0,255,255,0.5)", inset: false },
    ],
    "Soft Drop": [
      { offsetX: 0, offsetY: 4, blur: 12, spread: 0, color: "rgba(0,0,0,0.15)", inset: false },
    ],
    "Hard Drop": [
      { offsetX: 10, offsetY: 10, blur: 0, spread: 0, color: "rgba(0,0,0,0.5)", inset: false },
    ],
    "Inner Shadow": [
      { offsetX: 0, offsetY: 2, blur: 8, spread: 0, color: "rgba(0,0,0,0.3)", inset: true },
    ],
    "Long Shadow": Array.from({ length: 8 }, (_, i) => ({ offsetX: i + 1, offsetY: i + 1, blur: 0, spread: 0, color: `rgba(0,0,0,${0.1 - i * 0.01})`, inset: false })),
    "Layered Soft": [
      { offsetX: 0, offsetY: 2, blur: 4, spread: 0, color: "rgba(0,0,0,0.1)", inset: false },
      { offsetX: 0, offsetY: 6, blur: 12, spread: 0, color: "rgba(0,0,0,0.1)", inset: false },
    ],
  };
}

export function exportJSON(opts: GenerateOptions): string {
  return JSON.stringify(opts, null, 2);
}

export function importJSON(json: string): GenerateOptions | null {
  try {
    const parsed = JSON.parse(json);
    if (!parsed.layers || !Array.isArray(parsed.layers)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function randomColor(): string {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  const a = 0.5 + Math.random() * 0.4;
  return `rgba(${r},${g},${b},${a.toFixed(2)})`;
}

export function randomLayer(): LayerSpec {
  return {
    offsetX: Math.floor((Math.random() - 0.5) * 40),
    offsetY: Math.floor((Math.random() - 0.5) * 40),
    blur: Math.floor(Math.random() * 30),
    spread: Math.floor((Math.random() - 0.5) * 20),
    color: randomColor(),
    inset: Math.random() > 0.7,
  };
}

export function hexToRgba(hex: string, alpha = 1): string {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return hex;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function rgbaToHex(rgba: string): string {
  const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return rgba;
  return "#" + [m[1], m[2], m[3]].map((n) => parseInt(n).toString(16).padStart(2, "0")).join("");
}

export function validateLayer(l: LayerSpec): string[] {
  const errors: string[] = [];
  if (l.offsetX < -200 || l.offsetX > 200) errors.push("Offset X out of range");
  if (l.offsetY < -200 || l.offsetY > 200) errors.push("Offset Y out of range");
  if (l.blur < 0 || l.blur > 200) errors.push("Blur out of range");
  if (!l.color) errors.push("Color is required");
  return errors;
}

export function darkenColor(hex: string, amount: number): string {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return hex;
  const r = Math.max(0, parseInt(m[1].slice(0, 2), 16) - Math.round(255 * amount));
  const g = Math.max(0, parseInt(m[1].slice(2, 4), 16) - Math.round(255 * amount));
  const b = Math.max(0, parseInt(m[1].slice(4, 6), 16) - Math.round(255 * amount));
  return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
}

export function lightenColor(hex: string, amount: number): string {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return hex;
  const r = Math.min(255, parseInt(m[1].slice(0, 2), 16) + Math.round(255 * amount));
  const g = Math.min(255, parseInt(m[1].slice(2, 4), 16) + Math.round(255 * amount));
  const b = Math.min(255, parseInt(m[1].slice(4, 6), 16) + Math.round(255 * amount));
  return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
}
