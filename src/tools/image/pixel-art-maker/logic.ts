/**
 * Pixel Art Maker — pure logic.
 *
 * Design summary
 * --------------
 * - PixelCanvas: { width, height, layers: Layer[], frames: Frame[],
 *                  palette: Palette, activeLayerId, activeFrameId }
 * - Layer: { id, name, opacity, visible, locked } — metadata only.
 * - Frame: { id, delay, layerData: Record<layerId, Uint8Array> }
 *   where each Uint8Array is RGBA pixel data (length = width * height * 4).
 * - Palette: { name, colors: string[] }  (hex strings, '#rrggbb').
 *
 * All operations are pure: they return new PixelCanvas objects (shallow clone
 * of struct, copy-on-write of the affected frame's affected layer pixel data).
 * Browser-only export wrappers (PNG/GIF/APNG/sprite sheet) live at the bottom
 * and use dynamic imports so the heavy encoders are lazy-loaded only when the
 * user actually exports. Those wrappers are not exercised by unit tests
 * (vitest runs in node with no Canvas); tests cover the pure data layer.
 *
 * Color model: RGBA Uint8Array per layer per frame. The palette acts as a
 * snap constraint (drawing rounds to the nearest palette color when a palette
 * is active). Palette-swap remaps by nearest-match index in the old palette →
 * same index in the new palette, so swapping PICO-8 for Sweetie-16 keeps the
 * sprite's structure intact while changing its look.
 */

import type { ToolResult } from "../../../lib/tool";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Point {
  x: number;
  y: number;
}

export type Tool =
  | "pencil"
  | "eraser"
  | "bucket"
  | "bucket-global"
  | "line"
  | "rect"
  | "rect-filled"
  | "ellipse"
  | "ellipse-filled"
  | "eyedropper"
  | "select-rect"
  | "move"
  | "stamp"
  | "tile-flip"
  | "dither";

export interface BrushSettings {
  size: number;
  mirrorX: boolean;
  mirrorY: boolean;
  pixelPerfect: boolean;
  ditherPattern: "bayer2" | "bayer4" | "checker";
}

export interface Palette {
  name: string;
  colors: string[];
  /** Per-color tags. Optional. Index matches colors[]. */
  tags?: Record<number, "background" | "transparent" | "outline" | "shadow" | "highlight">;
}

export interface Layer {
  id: string;
  name: string;
  opacity: number; // 0..1
  visible: boolean;
  locked: boolean;
}

export interface Frame {
  id: string;
  delay: number; // milliseconds
  layerData: Record<string, Uint8Array>;
}

export interface PixelCanvas {
  width: number;
  height: number;
  layers: Layer[];
  frames: Frame[];
  palette: Palette;
  activeLayerId: string;
  activeFrameId: string;
}

export interface Selection {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ProjectFile {
  version: 1;
  canvas: PixelCanvas;
  savedAt: string;
}

// ---------------------------------------------------------------------------
// ID generation (pure, deterministic-friendly for tests)
// ---------------------------------------------------------------------------

let _idCounter = 0;
/** Generate a unique-enough id for layers/frames. */
export function makeId(prefix: string): string {
  _idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${(_idCounter).toString(36)}`;
}

/** Reset the id counter — test helper. */
export function _resetIdCounter(): void {
  _idCounter = 0;
}

// ---------------------------------------------------------------------------
// Color utilities
// ---------------------------------------------------------------------------

/** Parse a hex color string ('#rgb' or '#rrggbb' or '#rrggbbaa') into [r,g,b,a]. */
export function hexToRgba(hex: string): [number, number, number, number] {
  let h = hex.trim();
  if (h.startsWith("#")) h = h.slice(1);
  if (h.length === 3) {
    const r = parseInt(h[0]! + h[0]!, 16);
    const g = parseInt(h[1]! + h[1]!, 16);
    const b = parseInt(h[2]! + h[2]!, 16);
    return [r, g, b, 255];
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return [r, g, b, 255];
  }
  if (h.length === 8) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = parseInt(h.slice(6, 8), 16);
    return [r, g, b, a];
  }
  return [0, 0, 0, 255];
}

/** Convert [r,g,b] or [r,g,b,a] to a '#rrggbb' hex string (alpha dropped). */
export function rgbaToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Squared distance between two RGB triples. */
export function colorDistance(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

/** Find the index of the nearest palette color to the given RGB. */
export function nearestPaletteIndex(
  palette: Palette,
  rgb: [number, number, number],
): number {
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < palette.colors.length; i++) {
    const p = hexToRgba(palette.colors[i]!);
    const d = colorDistance([p[0], p[1], p[2]], rgb);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/**
 * Color shading helper. Returns 5 variants: [darker2, darker1, base, lighter1,
 * lighter2]. Each step lightens/darkens by ~15%.
 */
export function shadeColor(hex: string): {
  darker2: string;
  darker1: string;
  base: string;
  lighter1: string;
  lighter2: string;
} {
  const [r, g, b] = hexToRgba(hex);
  const mix = (factor: number) =>
    rgbaToHex(
      Math.max(0, Math.min(255, Math.round(r * (1 - factor)))),
      Math.max(0, Math.min(255, Math.round(g * (1 - factor)))),
      Math.max(0, Math.min(255, Math.round(b * (1 - factor)))),
    );
  const lighten = (factor: number) =>
    rgbaToHex(
      Math.max(0, Math.min(255, Math.round(r + (255 - r) * factor))),
      Math.max(0, Math.min(255, Math.round(g + (255 - g) * factor))),
      Math.max(0, Math.min(255, Math.round(b + (255 - b) * factor))),
    );
  return {
    darker2: mix(0.3),
    darker1: mix(0.15),
    base: hex,
    lighter1: lighten(0.15),
    lighter2: lighten(0.3),
  };
}

// ---------------------------------------------------------------------------
// Canvas construction
// ---------------------------------------------------------------------------

/** Create a blank transparent canvas of the given dimensions. */
export function createCanvas(
  width: number,
  height: number,
  palette?: Palette,
): PixelCanvas {
  if (width < 1 || height < 1) {
    throw new Error(`Invalid canvas dimensions: ${width}x${height}`);
  }
  if (width > 1024 || height > 1024) {
    throw new Error(`Canvas too large (max 1024x1024): ${width}x${height}`);
  }
  const layerId = makeId("layer");
  const frameId = makeId("frame");
  return {
    width,
    height,
    layers: [{ id: layerId, name: "Layer 1", opacity: 1, visible: true, locked: false }],
    frames: [
      {
        id: frameId,
        delay: 100,
        layerData: { [layerId]: new Uint8Array(width * height * 4) },
      },
    ],
    palette: palette ?? { name: "Default", colors: ["#000000", "#ffffff"] },
    activeLayerId: layerId,
    activeFrameId: frameId,
  };
}

/** Deep-clone a PixelCanvas (including all pixel data). */
export function cloneCanvas(canvas: PixelCanvas): PixelCanvas {
  return {
    width: canvas.width,
    height: canvas.height,
    layers: canvas.layers.map((l) => ({ ...l })),
    frames: canvas.frames.map((f) => ({
      id: f.id,
      delay: f.delay,
      layerData: Object.fromEntries(
        Object.entries(f.layerData).map(([k, v]) => [k, new Uint8Array(v)]),
      ),
    })),
    palette: { name: canvas.palette.name, colors: [...canvas.palette.colors], tags: canvas.palette.tags ? { ...canvas.palette.tags } : undefined },
    activeLayerId: canvas.activeLayerId,
    activeFrameId: canvas.activeFrameId,
  };
}

// ---------------------------------------------------------------------------
// Layer operations
// ---------------------------------------------------------------------------

/** Add a new transparent layer above the active one. */
export function addLayer(canvas: PixelCanvas, name?: string): PixelCanvas {
  const out = cloneCanvas(canvas);
  const id = makeId("layer");
  const layer: Layer = {
    id,
    name: name ?? `Layer ${out.layers.length + 1}`,
    opacity: 1,
    visible: true,
    locked: false,
  };
  out.layers.push(layer);
  for (const f of out.frames) {
    f.layerData[id] = new Uint8Array(out.width * out.height * 4);
  }
  out.activeLayerId = id;
  return out;
}

/** Remove a layer by id (cannot remove the last layer). */
export function removeLayer(canvas: PixelCanvas, layerId: string): PixelCanvas {
  if (canvas.layers.length <= 1) {
    throw new Error("Cannot remove the last layer");
  }
  const out = cloneCanvas(canvas);
  out.layers = out.layers.filter((l) => l.id !== layerId);
  for (const f of out.frames) {
    delete f.layerData[layerId];
  }
  if (out.activeLayerId === layerId) {
    out.activeLayerId = out.layers[0]!.id;
  }
  return out;
}

/** Reorder layers given a list of layer IDs in the desired new order. */
export function reorderLayers(
  canvas: PixelCanvas,
  newOrder: string[],
): PixelCanvas {
  const layerIds = new Set(canvas.layers.map((l) => l.id));
  for (const id of newOrder) {
    if (!layerIds.has(id)) throw new Error(`Unknown layer id: ${id}`);
  }
  if (newOrder.length !== canvas.layers.length) {
    throw new Error("reorderLayers: length mismatch");
  }
  const out = cloneCanvas(canvas);
  const byId = new Map(out.layers.map((l) => [l.id, l] as const));
  out.layers = newOrder.map((id) => byId.get(id)!);
  return out;
}

export function setLayerOpacity(
  canvas: PixelCanvas,
  layerId: string,
  opacity: number,
): PixelCanvas {
  const out = cloneCanvas(canvas);
  const layer = out.layers.find((l) => l.id === layerId);
  if (layer) layer.opacity = Math.max(0, Math.min(1, opacity));
  return out;
}

export function setLayerVisible(
  canvas: PixelCanvas,
  layerId: string,
  visible: boolean,
): PixelCanvas {
  const out = cloneCanvas(canvas);
  const layer = out.layers.find((l) => l.id === layerId);
  if (layer) layer.visible = visible;
  return out;
}

export function setLayerLocked(
  canvas: PixelCanvas,
  layerId: string,
  locked: boolean,
): PixelCanvas {
  const out = cloneCanvas(canvas);
  const layer = out.layers.find((l) => l.id === layerId);
  if (layer) layer.locked = locked;
  return out;
}

// ---------------------------------------------------------------------------
// Frame operations
// ---------------------------------------------------------------------------

/** Add a new frame by copying the active frame's pixel data (animation flow). */
export function addFrame(canvas: PixelCanvas, delay?: number): PixelCanvas {
  const out = cloneCanvas(canvas);
  const id = makeId("frame");
  const src = out.frames.find((f) => f.id === out.activeFrameId);
  const layerData: Record<string, Uint8Array> = {};
  for (const layer of out.layers) {
    layerData[layer.id] = src ? new Uint8Array(src.layerData[layer.id]!) : new Uint8Array(out.width * out.height * 4);
  }
  out.frames.push({ id, delay: delay ?? 100, layerData });
  out.activeFrameId = id;
  return out;
}

/** Remove a frame by id (cannot remove the last frame). */
export function removeFrame(canvas: PixelCanvas, frameId: string): PixelCanvas {
  if (canvas.frames.length <= 1) {
    throw new Error("Cannot remove the last frame");
  }
  const out = cloneCanvas(canvas);
  out.frames = out.frames.filter((f) => f.id !== frameId);
  if (out.activeFrameId === frameId) {
    out.activeFrameId = out.frames[0]!.id;
  }
  return out;
}

/** Reorder frames given a list of frame IDs in the desired new order. */
export function reorderFrames(
  canvas: PixelCanvas,
  newOrder: string[],
): PixelCanvas {
  const ids = new Set(canvas.frames.map((f) => f.id));
  for (const id of newOrder) {
    if (!ids.has(id)) throw new Error(`Unknown frame id: ${id}`);
  }
  if (newOrder.length !== canvas.frames.length) {
    throw new Error("reorderFrames: length mismatch");
  }
  const out = cloneCanvas(canvas);
  const byId = new Map(out.frames.map((f) => [f.id, f] as const));
  out.frames = newOrder.map((id) => byId.get(id)!);
  return out;
}

export function setFrameDelay(
  canvas: PixelCanvas,
  frameId: string,
  delay: number,
): PixelCanvas {
  const out = cloneCanvas(canvas);
  const f = out.frames.find((x) => x.id === frameId);
  if (f) f.delay = Math.max(10, Math.round(delay));
  return out;
}

// ---------------------------------------------------------------------------
// Pixel primitives
// ---------------------------------------------------------------------------

function inBounds(canvas: PixelCanvas, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < canvas.width && y < canvas.height;
}

function pixelIndex(canvas: PixelCanvas, x: number, y: number): number {
  return (y * canvas.width + x) * 4;
}

/** Read the RGBA pixel at (x, y) on a specific layer+frame. */
export function getPixel(
  canvas: PixelCanvas,
  layerId: string,
  frameId: string,
  x: number,
  y: number,
): [number, number, number, number] {
  if (!inBounds(canvas, x, y)) return [0, 0, 0, 0];
  const frame = canvas.frames.find((f) => f.id === frameId);
  if (!frame) return [0, 0, 0, 0];
  const data = frame.layerData[layerId];
  if (!data) return [0, 0, 0, 0];
  const i = pixelIndex(canvas, x, y);
  return [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!];
}

/**
 * Set the pixel at (x, y) on a specific layer+frame to the given RGBA color.
 * Out-of-bounds writes are silently dropped.
 */
export function setPixel(
  canvas: PixelCanvas,
  layerId: string,
  frameId: string,
  x: number,
  y: number,
  color: [number, number, number, number],
): PixelCanvas {
  if (!inBounds(canvas, x, y)) return canvas;
  const out = cloneCanvas(canvas);
  const frame = out.frames.find((f) => f.id === frameId);
  if (!frame) return out;
  const data = frame.layerData[layerId];
  if (!data) return out;
  const i = pixelIndex(out, x, y);
  data[i] = color[0];
  data[i + 1] = color[1];
  data[i + 2] = color[2];
  data[i + 3] = color[3];
  return out;
}

/**
 * In-place setPixel — mutates the given frame's layerData for performance
 * during freehand drawing. Returns true if the pixel was actually changed.
 */
export function setPixelInPlace(
  canvas: PixelCanvas,
  layerId: string,
  frameId: string,
  x: number,
  y: number,
  color: [number, number, number, number],
): boolean {
  if (!inBounds(canvas, x, y)) return false;
  const frame = canvas.frames.find((f) => f.id === frameId);
  if (!frame) return false;
  const data = frame.layerData[layerId];
  if (!data) return false;
  const i = pixelIndex(canvas, x, y);
  if (
    data[i] === color[0] &&
    data[i + 1] === color[1] &&
    data[i + 2] === color[2] &&
    data[i + 3] === color[3]
  ) {
    return false;
  }
  data[i] = color[0];
  data[i + 1] = color[1];
  data[i + 2] = color[2];
  data[i + 3] = color[3];
  return true;
}

// ---------------------------------------------------------------------------
// Drawing primitives
// ---------------------------------------------------------------------------

/**
 * Bresenham line algorithm — returns the list of integer points on the line
 * between (x0, y0) and (x1, y1) inclusive.
 */
export function bresenhamLine(x0: number, y0: number, x1: number, y1: number): Point[] {
  const points: Point[] = [];
  let dx = Math.abs(x1 - x0);
  let dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  // Safety cap to prevent infinite loops on bad input.
  const cap = (Math.abs(dx) + Math.abs(dy)) * 2 + 4;
  let iter = 0;
  while (iter++ < cap) {
    points.push({ x, y });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return points;
}

/** Draw a line of pixels on a layer+frame. */
export function drawLine(
  canvas: PixelCanvas,
  layerId: string,
  frameId: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: [number, number, number, number],
): PixelCanvas {
  const out = cloneCanvas(canvas);
  const frame = out.frames.find((f) => f.id === frameId);
  if (!frame) return out;
  const data = frame.layerData[layerId];
  if (!data) return out;
  for (const p of bresenhamLine(x0, y0, x1, y1)) {
    if (inBounds(out, p.x, p.y)) {
      const i = pixelIndex(out, p.x, p.y);
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
      data[i + 3] = color[3];
    }
  }
  return out;
}

/** Draw a rectangle outline. */
export function drawRect(
  canvas: PixelCanvas,
  layerId: string,
  frameId: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: [number, number, number, number],
  filled: boolean,
): PixelCanvas {
  const out = cloneCanvas(canvas);
  const frame = out.frames.find((f) => f.id === frameId);
  if (!frame) return out;
  const data = frame.layerData[layerId];
  if (!data) return out;
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  const put = (x: number, y: number) => {
    if (inBounds(out, x, y)) {
      const i = pixelIndex(out, x, y);
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
      data[i + 3] = color[3];
    }
  };
  if (filled) {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        put(x, y);
      }
    }
  } else {
    for (let x = minX; x <= maxX; x++) {
      put(x, minY);
      put(x, maxY);
    }
    for (let y = minY; y <= maxY; y++) {
      put(minX, y);
      put(maxX, y);
    }
  }
  return out;
}

/**
 * Draw an ellipse using the midpoint algorithm. The ellipse is inscribed in
 * the rectangle defined by (x0,y0) and (x1,y1).
 */
export function drawEllipse(
  canvas: PixelCanvas,
  layerId: string,
  frameId: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: [number, number, number, number],
  filled: boolean,
): PixelCanvas {
  const out = cloneCanvas(canvas);
  const frame = out.frames.find((f) => f.id === frameId);
  if (!frame) return out;
  const data = frame.layerData[layerId];
  if (!data) return out;
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rx = (maxX - minX) / 2;
  const ry = (maxY - minY) / 2;
  const put = (x: number, y: number) => {
    if (inBounds(out, x, y)) {
      const i = pixelIndex(out, x, y);
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
      data[i + 3] = color[3];
    }
  };
  if (rx === 0 || ry === 0) {
    // Degenerate: a line or point — use Bresenham.
    for (const p of bresenhamLine(minX, minY, maxX, maxY)) put(p.x, p.y);
    return out;
  }
  if (filled) {
    // Scanline fill: for each y, find x range from ellipse equation.
    for (let y = minY; y <= maxY; y++) {
      const dy = (y + 0.5 - cy) / ry;
      if (dy * dy > 1) continue;
      const dx = Math.sqrt(1 - dy * dy) * rx;
      const xLeft = Math.round(cx - dx);
      const xRight = Math.round(cx + dx);
      for (let x = xLeft; x <= xRight; x++) put(x, y);
    }
  } else {
    // Outline: trace the ellipse with midpoint algorithm.
    // Use a parametric walk for robustness.
    const steps = Math.max(8, Math.floor(2 * Math.PI * Math.max(rx, ry)));
    for (let s = 0; s <= steps; s++) {
      const t = (s / steps) * 2 * Math.PI;
      const x = Math.round(cx + rx * Math.cos(t));
      const y = Math.round(cy + ry * Math.sin(t));
      put(x, y);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Flood fill
// ---------------------------------------------------------------------------

/**
 * Contiguous flood fill starting at (x, y) — replaces the connected region
 * of the same source color with newColor (4-connectivity).
 */
export function floodFill(
  canvas: PixelCanvas,
  layerId: string,
  frameId: string,
  x: number,
  y: number,
  newColor: [number, number, number, number],
): PixelCanvas {
  if (!inBounds(canvas, x, y)) return canvas;
  const out = cloneCanvas(canvas);
  const frame = out.frames.find((f) => f.id === frameId);
  if (!frame) return out;
  const data = frame.layerData[layerId];
  if (!data) return out;
  const i0 = pixelIndex(out, x, y);
  const src: [number, number, number, number] = [
    data[i0]!, data[i0 + 1]!, data[i0 + 2]!, data[i0 + 3]!,
  ];
  // If source equals target, nothing to do.
  if (
    src[0] === newColor[0] &&
    src[1] === newColor[1] &&
    src[2] === newColor[2] &&
    src[3] === newColor[3]
  ) {
    return out;
  }
  const matches = (i: number) =>
    data[i] === src[0] &&
    data[i + 1] === src[1] &&
    data[i + 2] === src[2] &&
    data[i + 3] === src[3];
  const paint = (i: number) => {
    data[i] = newColor[0];
    data[i + 1] = newColor[1];
    data[i + 2] = newColor[2];
    data[i + 3] = newColor[3];
  };
  // Iterative stack-based flood fill (avoids recursion stack overflow).
  const stack: number[] = [x, y];
  const visited = new Uint8Array(out.width * out.height);
  while (stack.length > 0) {
    const py = stack.pop()!;
    const px = stack.pop()!;
    if (px < 0 || py < 0 || px >= out.width || py >= out.height) continue;
    const vidx = py * out.width + px;
    if (visited[vidx]) continue;
    const i = vidx * 4;
    if (!matches(i)) continue;
    visited[vidx] = 1;
    paint(i);
    stack.push(px + 1, py);
    stack.push(px - 1, py);
    stack.push(px, py + 1);
    stack.push(px, py - 1);
  }
  return out;
}

/**
 * Global flood fill — replaces every pixel matching the source color anywhere
 * on the layer, not just the connected region.
 */
export function floodFillGlobal(
  canvas: PixelCanvas,
  layerId: string,
  frameId: string,
  x: number,
  y: number,
  newColor: [number, number, number, number],
): PixelCanvas {
  if (!inBounds(canvas, x, y)) return canvas;
  const out = cloneCanvas(canvas);
  const frame = out.frames.find((f) => f.id === frameId);
  if (!frame) return out;
  const data = frame.layerData[layerId];
  if (!data) return out;
  const i0 = pixelIndex(out, x, y);
  const src: [number, number, number, number] = [
    data[i0]!, data[i0 + 1]!, data[i0 + 2]!, data[i0 + 3]!,
  ];
  if (
    src[0] === newColor[0] &&
    src[1] === newColor[1] &&
    src[2] === newColor[2] &&
    src[3] === newColor[3]
  ) {
    return out;
  }
  for (let i = 0; i < data.length; i += 4) {
    if (
      data[i] === src[0] &&
      data[i + 1] === src[1] &&
      data[i + 2] === src[2] &&
      data[i + 3] === src[3]
    ) {
      data[i] = newColor[0];
      data[i + 1] = newColor[1];
      data[i + 2] = newColor[2];
      data[i + 3] = newColor[3];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Mirror symmetry
// ---------------------------------------------------------------------------

/**
 * Apply X-axis mirror symmetry — given a set of points painted on the left
 * half of the canvas, also paint their mirrored counterparts on the right.
 * Returns the union of original + mirrored points.
 */
export function applyMirrorX(
  canvas: PixelCanvas,
  points: Point[],
): Point[] {
  const mid = (canvas.width - 1) / 2;
  const out: Point[] = [];
  const seen = new Set<number>();
  const push = (p: Point) => {
    if (!inBounds(canvas, p.x, p.y)) return;
    const k = p.y * canvas.width + p.x;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(p);
  };
  for (const p of points) {
    push(p);
    push({ x: Math.round(2 * mid - p.x), y: p.y });
  }
  return out;
}

/** Apply Y-axis mirror symmetry. */
export function applyMirrorY(
  canvas: PixelCanvas,
  points: Point[],
): Point[] {
  const mid = (canvas.height - 1) / 2;
  const out: Point[] = [];
  const seen = new Set<number>();
  const push = (p: Point) => {
    if (!inBounds(canvas, p.x, p.y)) return;
    const k = p.y * canvas.width + p.x;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(p);
  };
  for (const p of points) {
    push(p);
    push({ x: p.x, y: Math.round(2 * mid - p.y) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pixel-perfect stroke correction
// ---------------------------------------------------------------------------

/**
 * Pixel-perfect stroke auto-correction.
 *
 * Walks the input stroke and removes "redundant" interior points: a point
 * p_i is dropped if the Bresenham line from p_{i-1} to p_{i+1} passes
 * through p_i. This eliminates diagonal stair-step "fuzz" that occurs when
 * a freehand stroke produces extra diagonal pixels.
 *
 * The first and last points are always preserved.
 */
export function applyPixelPerfect(points: Point[]): Point[] {
  if (points.length < 3) return points.slice();
  // First pass: remove consecutive duplicates.
  const deduped: Point[] = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    const prev = deduped[deduped.length - 1]!;
    const cur = points[i]!;
    if (cur.x !== prev.x || cur.y !== prev.y) deduped.push(cur);
  }
  if (deduped.length < 3) return deduped;
  // Second pass: remove redundant interior points.
  const result: Point[] = [deduped[0]!];
  for (let i = 1; i < deduped.length - 1; i++) {
    const prev = result[result.length - 1]!;
    const cur = deduped[i]!;
    const next = deduped[i + 1]!;
    const linePts = bresenhamLine(prev.x, prev.y, next.x, next.y);
    const onLine = linePts.some(
      (p) => p.x === cur.x && p.y === cur.y,
    );
    if (!onLine) {
      result.push(cur);
    }
  }
  result.push(deduped[deduped.length - 1]!);
  return result;
}

// ---------------------------------------------------------------------------
// Composite
// ---------------------------------------------------------------------------

/**
 * Composite all visible layers for a frame into a single RGBA Uint8Array.
 * Respects per-layer opacity and the layer order (bottom → top).
 */
export function compositeFrameRgba(
  canvas: PixelCanvas,
  frameId: string,
): Uint8Array {
  const frame = canvas.frames.find((f) => f.id === frameId);
  if (!frame) {
    return new Uint8Array(canvas.width * canvas.height * 4);
  }
  // Build from bottom to top. Our layers array is bottom-first by convention.
  const out = new Uint8Array(canvas.width * canvas.height * 4);
  for (const layer of canvas.layers) {
    if (!layer.visible) continue;
    const data = frame.layerData[layer.id];
    if (!data) continue;
    const op = Math.max(0, Math.min(1, layer.opacity));
    if (op === 0) continue;
    for (let i = 0; i < out.length; i += 4) {
      const a = data[i + 3]! / 255 * op;
      if (a === 0) continue;
      const inv = 1 - a;
      // Source-over compositing with premultiplied alpha for color, then
      // un-premultiply.
      out[i] = Math.round(data[i]! * a + out[i]! * inv);
      out[i + 1] = Math.round(data[i + 1]! * a + out[i + 1]! * inv);
      out[i + 2] = Math.round(data[i + 2]! * a + out[i + 2]! * inv);
      out[i + 3] = Math.round(255 * (a + (out[i + 3]! / 255) * inv));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Palette parsers
// ---------------------------------------------------------------------------

/**
 * Parse a GIMP .gpl palette file. Format:
 *   GIMP Palette
 *   Name: <name>
 *   Columns: <n>
 *   # optional comments
 *   <r> <g> <b>  # optional name
 * Returns a ToolResult with the palette.
 */
export function parseGplPalette(text: string): ToolResult<Palette> {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0 || !lines[0]!.trim().startsWith("GIMP Palette")) {
    return { ok: false, error: "Not a GIMP palette (missing 'GIMP Palette' header)" };
  }
  let name = "Imported GPL";
  const colors: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i]!;
    const line = raw.trim();
    if (line === "") continue;
    if (line.startsWith("#")) continue;
    if (line.toLowerCase().startsWith("name:")) {
      name = line.slice(5).trim() || name;
      continue;
    }
    if (line.toLowerCase().startsWith("columns:")) continue;
    // Color line: "<r> <g> <b>" optionally with a name after a tab/multi-space.
    const match = line.match(/^(\d+)\s+(\d+)\s+(\d+)/);
    if (!match) continue;
    const r = parseInt(match[1]!, 10);
    const g = parseInt(match[2]!, 10);
    const b = parseInt(match[3]!, 10);
    if (r > 255 || g > 255 || b > 255) continue;
    colors.push(rgbaToHex(r, g, b));
  }
  if (colors.length === 0) {
    return { ok: false, error: "GPL palette contained no valid color lines" };
  }
  return { ok: true, output: { name, colors } };
}

/**
 * Parse a .pal palette file (RIFF/8-byte-rgba or simple hex list). We accept
 * a simple "one hex per line" format (#rrggbb). Mixed comments with `#` only
 * count as comment if the line doesn't start with `#` followed by hex digits.
 */
export function parsePalPalette(text: string): ToolResult<Palette> {
  const lines = text.split(/\r?\n/);
  const colors: string[] = [];
  let name = "Imported PAL";
  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") continue;
    if (line.startsWith("JASC-PAL") || line.startsWith("JASC")) continue;
    // JASC format line 2 is count.
    if (/^\d+$/.test(line) && colors.length === 0) continue;
    const match = line.match(/^#?([0-9a-fA-F]{6})$/);
    if (match) {
      colors.push(`#${match[1]!.toLowerCase()}`);
      continue;
    }
    // JASC "r g b" format.
    const m2 = line.match(/^(\d+)\s+(\d+)\s+(\d+)$/);
    if (m2) {
      const r = parseInt(m2[1]!, 10);
      const g = parseInt(m2[2]!, 10);
      const b = parseInt(m2[3]!, 10);
      if (r <= 255 && g <= 255 && b <= 255) colors.push(rgbaToHex(r, g, b));
    }
  }
  if (colors.length === 0) {
    return { ok: false, error: "PAL file contained no valid colors" };
  }
  return { ok: true, output: { name, colors } };
}

/**
 * Parse a .hex palette file — one '#rrggbb' per line, comments allowed with `;` or `//`.
 */
export function parseHexPalette(text: string): ToolResult<Palette> {
  const lines = text.split(/\r?\n/);
  const colors: string[] = [];
  let name = "Imported HEX";
  for (const raw of lines) {
    let line = raw.trim();
    if (line === "") continue;
    if (line.startsWith(";") || line.startsWith("//")) continue;
    // Strip inline comments.
    const semiIdx = line.search(/[;]|\s\/\//);
    if (semiIdx > 0) line = line.slice(0, semiIdx).trim();
    const match = line.match(/^#?([0-9a-fA-F]{6})$/i);
    if (match) {
      colors.push(`#${match[1]!.toLowerCase()}`);
    }
  }
  if (colors.length === 0) {
    return { ok: false, error: "HEX file contained no valid colors" };
  }
  return { ok: true, output: { name, colors } };
}

// ---------------------------------------------------------------------------
// Palette operations
// ---------------------------------------------------------------------------

/**
 * Palette swap — remap every pixel of every layer/frame from the old palette
 * to a new palette by index. Each unique color in the canvas is matched to
 * its nearest old-palette index, then replaced with the new-palette color at
 * the same index. If indices exceed the new palette, fall back to nearest.
 */
export function paletteSwap(
  canvas: PixelCanvas,
  newPalette: Palette,
): PixelCanvas {
  const out = cloneCanvas(canvas);
  // Build old palette color lookup (RGB → old index).
  const oldRgb: [number, number, number][] = canvas.palette.colors.map((h) => {
    const [r, g, b] = hexToRgba(h);
    return [r, g, b];
  });
  const newRgb: [number, number, number][] = newPalette.colors.map((h) => {
    const [r, g, b] = hexToRgba(h);
    return [r, g, b];
  });
  // Cache: source RGB string → new RGBA.
  const cache = new Map<string, [number, number, number, number]>();
  for (const frame of out.frames) {
    for (const layerId of Object.keys(frame.layerData)) {
      const data = frame.layerData[layerId]!;
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3]!;
        if (a === 0) continue;
        const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
        let mapped = cache.get(key);
        if (!mapped) {
          const rgb: [number, number, number] = [data[i]!, data[i + 1]!, data[i + 2]!];
          // Find nearest old palette color, then take new palette at same index.
          let oldIdx = 0;
          let oldDist = Number.POSITIVE_INFINITY;
          for (let j = 0; j < oldRgb.length; j++) {
            const d = colorDistance(rgb, oldRgb[j]!);
            if (d < oldDist) {
              oldDist = d;
              oldIdx = j;
            }
          }
          let newIdx = oldIdx;
          if (newIdx >= newRgb.length) {
            // Find nearest in new palette.
            newIdx = 0;
            let newDist = Number.POSITIVE_INFINITY;
            for (let j = 0; j < newRgb.length; j++) {
              const d = colorDistance(rgb, newRgb[j]!);
              if (d < newDist) {
                newDist = d;
                newIdx = j;
              }
            }
          }
          const [nr, ng, nb] = newRgb[newIdx]!;
          mapped = [nr, ng, nb, a];
          cache.set(key, mapped);
        }
        data[i] = mapped[0];
        data[i + 1] = mapped[1];
        data[i + 2] = mapped[2];
        // Alpha preserved.
      }
    }
  }
  out.palette = { name: newPalette.name, colors: [...newPalette.colors] };
  return out;
}

/**
 * Tagged-color masking — set every pixel matching any tagged "background"
 * or "transparent" color to fully transparent across the entire canvas.
 */
export function applyTaggedMask(canvas: PixelCanvas): PixelCanvas {
  const tags = canvas.palette.tags;
  if (!tags) return canvas;
  const maskColors: [number, number, number][] = [];
  for (const [idxStr, tag] of Object.entries(tags)) {
    if (tag === "background" || tag === "transparent") {
      const idx = parseInt(idxStr, 10);
      const hex = canvas.palette.colors[idx];
      if (hex) {
        const [r, g, b] = hexToRgba(hex);
        maskColors.push([r, g, b]);
      }
    }
  }
  if (maskColors.length === 0) return canvas;
  const out = cloneCanvas(canvas);
  for (const frame of out.frames) {
    for (const layerId of Object.keys(frame.layerData)) {
      const data = frame.layerData[layerId]!;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        const r = data[i]!;
        const g = data[i + 1]!;
        const b = data[i + 2]!;
        for (const mc of maskColors) {
          if (r === mc[0] && g === mc[1] && b === mc[2]) {
            data[i + 3] = 0;
            break;
          }
        }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sprite sheet import
// ---------------------------------------------------------------------------

/**
 * Import a sprite sheet — slice the given RGBA pixel buffer into a sequence
 * of frames each frameW x frameH. Returns a PixelCanvas with one layer and
 * one frame per slice.
 */
export function importSpriteSheet(
  imageData: { width: number; height: number; data: Uint8Array },
  frameWidth: number,
  frameHeight: number,
  palette?: Palette,
): ToolResult<PixelCanvas> {
  if (frameWidth < 1 || frameHeight < 1) {
    return { ok: false, error: "Frame dimensions must be positive" };
  }
  const { width, height, data } = imageData;
  if (width < frameWidth || height < frameHeight) {
    return { ok: false, error: "Sheet is smaller than frame dimensions" };
  }
  if (data.length !== width * height * 4) {
    return { ok: false, error: "Image data length mismatch" };
  }
  const cols = Math.floor(width / frameWidth);
  const rows = Math.floor(height / frameHeight);
  if (cols < 1 || rows < 1) {
    return { ok: false, error: "Frame dimensions do not divide the sheet evenly" };
  }
  const layerId = makeId("layer");
  const frames: Frame[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const frameData = new Uint8Array(frameWidth * frameHeight * 4);
      for (let y = 0; y < frameHeight; y++) {
        const srcRow = (r * frameHeight + y) * width * 4;
        const dstRow = y * frameWidth * 4;
        for (let x = 0; x < frameWidth * 4; x++) {
          frameData[dstRow + x] = data[srcRow + c * frameWidth * 4 + x]!;
        }
      }
      frames.push({
        id: makeId("frame"),
        delay: 100,
        layerData: { [layerId]: frameData },
      });
    }
  }
  const canvas: PixelCanvas = {
    width: frameWidth,
    height: frameHeight,
    layers: [{ id: layerId, name: "Layer 1", opacity: 1, visible: true, locked: false }],
    frames,
    palette: palette ?? { name: "Default", colors: ["#000000", "#ffffff"] },
    activeLayerId: layerId,
    activeFrameId: frames[0]!.id,
  };
  return { ok: true, output: canvas };
}

/**
 * Build an Aseprite-compatible JSON metadata string for a sprite sheet.
 * Output matches the Aseprite "Export Sprite Sheet → JSON data" format with
 * the "Hash" frame structure, so it can be loaded directly by game engines.
 */
export function exportAsepriteJson(
  canvas: PixelCanvas,
  sheet: { cols: number; rows: number; frameWidth: number; frameHeight: number },
  options: { scale?: number; imageName?: string } = {},
): string {
  const scale = options.scale ?? 1;
  const fw = sheet.frameWidth * scale;
  const fh = sheet.frameHeight * scale;
  const framesObj: Record<string, {
    frame: { x: number; y: number; w: number; h: number };
    rotated: boolean;
    trimmed: boolean;
    spriteSourceSize: { x: number; y: number; w: number; h: number };
    sourceSize: { w: number; h: number };
    duration: number;
  }> = {};
  let i = 0;
  for (let r = 0; r < sheet.rows; r++) {
    for (let c = 0; c < sheet.cols; c++) {
      const frame = canvas.frames[i];
      const x = c * fw;
      const y = r * fh;
      framesObj[`${i}`] = {
        frame: { x, y, w: fw, h: fh },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: fw, h: fh },
        sourceSize: { w: fw, h: fh },
        duration: frame ? frame.delay : 100,
      };
      i++;
      if (i >= canvas.frames.length) break;
    }
    if (i >= canvas.frames.length) break;
  }
  const meta = {
    app: "https://unqtools.com/tools/pixel-art-maker",
    version: "1.0",
    image: options.imageName ?? "spritesheet.png",
    format: "RGBA8888",
    size: { w: sheet.cols * fw, h: sheet.rows * fh },
    scale: String(scale),
    frameTags: [] as Array<{ name: string; from: number; to: number; direction: string }>,
    layers: canvas.layers.map((l) => ({
      name: l.name,
      opacity: Math.round(l.opacity * 255),
      blendMode: "normal",
    })),
    slices: [],
  };
  return JSON.stringify({ frames: framesObj, meta }, null, 2);
}

// ---------------------------------------------------------------------------
// Project serialize / deserialize
// ---------------------------------------------------------------------------

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  // btoa is browser-only, but Node 16+ has it as a global. Fallback for older.
  if (typeof btoa === "function") return btoa(bin);
  return Buffer.from(bin, "binary").toString("base64");
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
}

/** Serialize the canvas to a project JSON string. */
export function serializeProject(canvas: PixelCanvas): string {
  const serializable = {
    width: canvas.width,
    height: canvas.height,
    layers: canvas.layers,
    frames: canvas.frames.map((f) => ({
      id: f.id,
      delay: f.delay,
      layerData: Object.fromEntries(
        Object.entries(f.layerData).map(([k, v]) => [k, bytesToBase64(v)]),
      ),
    })),
    palette: canvas.palette,
    activeLayerId: canvas.activeLayerId,
    activeFrameId: canvas.activeFrameId,
  };
  const project: ProjectFile = {
    version: 1,
    canvas: serializable as unknown as PixelCanvas,
    savedAt: new Date().toISOString(),
  };
  return JSON.stringify(project, null, 2);
}

/** Deserialize a project JSON string back into a PixelCanvas. */
export function deserializeProject(json: string): ToolResult<PixelCanvas> {
  try {
    const parsed = JSON.parse(json) as ProjectFile;
    if (!parsed || parsed.version !== 1 || !parsed.canvas) {
      return { ok: false, error: "Not a valid Pixel Art Maker project file" };
    }
    const c = parsed.canvas;
    if (
      typeof c.width !== "number" ||
      typeof c.height !== "number" ||
      !Array.isArray(c.layers) ||
      !Array.isArray(c.frames)
    ) {
      return { ok: false, error: "Corrupt project: missing required fields" };
    }
    const frames: Frame[] = c.frames.map((f) => ({
      id: f.id,
      delay: f.delay,
      layerData: Object.fromEntries(
        Object.entries(f.layerData).map(([k, v]) => [
          k,
          base64ToBytes(v as unknown as string),
        ]),
      ),
    }));
    const canvas: PixelCanvas = {
      width: c.width,
      height: c.height,
      layers: c.layers,
      frames,
      palette: c.palette,
      activeLayerId: c.activeLayerId,
      activeFrameId: c.activeFrameId,
    };
    return { ok: true, output: canvas };
  } catch (e) {
    return { ok: false, error: `Failed to parse project: ${(e as Error).message}` };
  }
}

// ---------------------------------------------------------------------------
// Undo / redo
// ---------------------------------------------------------------------------

export interface HistoryState {
  stack: PixelCanvas[];
  index: number;
}

export function pushHistory(
  history: HistoryState,
  canvas: PixelCanvas,
  max = 50,
): HistoryState {
  const stack = history.stack.slice(0, history.index + 1);
  stack.push(canvas);
  while (stack.length > max) stack.shift();
  return { stack, index: stack.length - 1 };
}

export function undo(history: HistoryState): {
  canvas: PixelCanvas | null;
  history: HistoryState;
} {
  if (history.index <= 0) {
    return { canvas: history.stack[0] ?? null, history };
  }
  const newIndex = history.index - 1;
  return {
    canvas: history.stack[newIndex]!,
    history: { stack: history.stack, index: newIndex },
  };
}

export function redo(history: HistoryState): {
  canvas: PixelCanvas | null;
  history: HistoryState;
} {
  if (history.index >= history.stack.length - 1) {
    return { canvas: history.stack[history.index] ?? null, history };
  }
  const newIndex = history.index + 1;
  return {
    canvas: history.stack[newIndex]!,
    history: { stack: history.stack, index: newIndex },
  };
}

// ---------------------------------------------------------------------------
// Tile-flip brush (extra #10)
// ---------------------------------------------------------------------------

/** 8 rotation/mirror variants of a tile pattern. */
export type TileVariant = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * Apply a rotation/mirror variant to a tile (a 2D array of RGBA colors).
 * Variants follow the dihedral group D4:
 *   0: identity
 *   1: rotate 90° CW
 *   2: rotate 180°
 *   3: rotate 270° CW
 *   4: flip horizontal
 *   5: flip vertical
 *   6: transpose (flip along main diagonal)
 *   7: anti-transpose (flip along anti-diagonal)
 */
export function transformTile(
  tile: [number, number, number, number][][],
  variant: TileVariant,
): [number, number, number, number][][] {
  const h = tile.length;
  const w = tile[0]?.length ?? 0;
  const out: [number, number, number, number][][] = [];
  for (let y = 0; y < h; y++) out.push([]);
  switch (variant) {
    case 0:
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y]![x] = tile[y]![x]!;
      break;
    case 1: // 90° CW
      for (let y = 0; y < w; y++) for (let x = 0; x < h; x++) {
        if (!out[y]) out[y] = [];
        out[y]![x] = tile[h - 1 - x]![y]!;
      }
      break;
    case 2: // 180°
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!out[y]) out[y] = [];
        out[y]![x] = tile[h - 1 - y]![w - 1 - x]!;
      }
      break;
    case 3: // 270° CW
      for (let y = 0; y < w; y++) for (let x = 0; x < h; x++) {
        if (!out[y]) out[y] = [];
        out[y]![x] = tile[x]![w - 1 - y]!;
      }
      break;
    case 4: // flip H
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!out[y]) out[y] = [];
        out[y]![x] = tile[y]![w - 1 - x]!;
      }
      break;
    case 5: // flip V
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!out[y]) out[y] = [];
        out[y]![x] = tile[h - 1 - y]![x]!;
      }
      break;
    case 6: // transpose
      for (let y = 0; y < w; y++) for (let x = 0; x < h; x++) {
        if (!out[y]) out[y] = [];
        out[y]![x] = tile[x]![y]!;
      }
      break;
    case 7: // anti-transpose
      for (let y = 0; y < w; y++) for (let x = 0; x < h; x++) {
        if (!out[y]) out[y] = [];
        out[y]![x] = tile[h - 1 - x]![w - 1 - y]!;
      }
      break;
  }
  return out;
}

/**
 * Stamp a tile onto a layer+frame at (originX, originY) with the given
 * rotation/mirror variant. Pixels outside the canvas are dropped.
 */
export function stampTile(
  canvas: PixelCanvas,
  layerId: string,
  frameId: string,
  tile: [number, number, number, number][][],
  originX: number,
  originY: number,
  variant: TileVariant,
): PixelCanvas {
  const out = cloneCanvas(canvas);
  const frame = out.frames.find((f) => f.id === frameId);
  if (!frame) return out;
  const data = frame.layerData[layerId];
  if (!data) return out;
  const transformed = transformTile(tile, variant);
  for (let y = 0; y < transformed.length; y++) {
    for (let x = 0; x < transformed[y]!.length; x++) {
      const cx = originX + x;
      const cy = originY + y;
      if (!inBounds(out, cx, cy)) continue;
      const color = transformed[y]![x]!;
      if (color[3] === 0) continue;
      const i = pixelIndex(out, cx, cy);
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
      data[i + 3] = color[3];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Dithering brush (advanced)
// ---------------------------------------------------------------------------

const BAYER_2 = [[0, 2], [3, 1]];
const BAYER_4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** Returns true if the pixel at (x, y) should be painted for a dither brush. */
export function ditherAt(
  x: number,
  y: number,
  pattern: "bayer2" | "bayer4" | "checker",
  threshold = 0.5,
): boolean {
  if (pattern === "checker") {
    return ((x + y) & 1) === 0;
  }
  const matrix = pattern === "bayer2" ? BAYER_2 : BAYER_4;
  const size = matrix.length;
  const val = matrix[y % size]![x % size]! / (size * size);
  return val < threshold;
}

// ---------------------------------------------------------------------------
// Export wrappers (browser-only, lazy-loaded encoders)
// ---------------------------------------------------------------------------

/**
 * Export a single frame as a scaled PNG. Uses Canvas API with
 * nearest-neighbor (imageSmoothingEnabled=false) for crisp pixel scaling.
 */
export async function exportPng(
  canvas: PixelCanvas,
  frameId: string,
  scale: number,
): Promise<ToolResult<Blob>> {
  try {
    if (typeof document === "undefined") {
      return { ok: false, error: "PNG export requires a browser environment" };
    }
    if (scale < 1 || scale > 32) {
      return { ok: false, error: "Scale must be between 1 and 32" };
    }
    const rgba = compositeFrameRgba(canvas, frameId);
    const c = document.createElement("canvas");
    c.width = canvas.width * scale;
    c.height = canvas.height * scale;
    const ctx = c.getContext("2d");
    if (!ctx) return { ok: false, error: "Canvas 2D context unavailable" };
    ctx.imageSmoothingEnabled = false;
    // Put the RGBA data into a small ImageData, then drawImage scaled.
    const src = document.createElement("canvas");
    src.width = canvas.width;
    src.height = canvas.height;
    const sctx = src.getContext("2d");
    if (!sctx) return { ok: false, error: "Source canvas context unavailable" };
    sctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), canvas.width, canvas.height), 0, 0);
    ctx.drawImage(src, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
    });
    return { ok: true, output: blob };
  } catch (e) {
    return { ok: false, error: `PNG export failed: ${(e as Error).message}` };
  }
}

/**
 * Export the canvas as an animated GIF using gifenc. Each frame is quantized
 * to 256 colors. The encoder is lazy-loaded to keep the initial bundle small.
 */
export async function exportGif(
  canvas: PixelCanvas,
  opts: { loop?: boolean; dispose?: boolean } = {},
): Promise<ToolResult<Blob>> {
  try {
    if (typeof document === "undefined") {
      return { ok: false, error: "GIF export requires a browser environment" };
    }
    const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
    const gif = GIFEncoder();
    const w = canvas.width;
    const h = canvas.height;
    for (const frame of canvas.frames) {
      const rgba = compositeFrameRgba(canvas, frame.id);
      // Quantize to 256-color palette.
      const palette = quantize(rgba, 256, { format: "rgb565" });
      const indexed = applyPalette(rgba, palette, "rgb565");
      gif.writeFrame(indexed, w, h, {
        palette,
        delay: frame.delay,
        transparent: false,
        dispose: opts.dispose ? 2 : -1,
        repeat: opts.loop === false ? -1 : 0,
      });
    }
    gif.finish();
    const bytes = gif.bytes();
    return { ok: true, output: new Blob([bytes], { type: "image/gif" }) };
  } catch (e) {
    return { ok: false, error: `GIF export failed: ${(e as Error).message}` };
  }
}

/**
 * Export the canvas as an animated PNG (APNG) using UPNG. The encoder is
 * lazy-loaded to keep the initial bundle small. APNG preserves full alpha
 * and 8-bit color depth (no quantization), so it's preferred over GIF when
 * the target platform supports it.
 */
export async function exportApng(
  canvas: PixelCanvas,
  opts: { cnum?: number } = {},
): Promise<ToolResult<Blob>> {
  try {
    if (typeof document === "undefined") {
      return { ok: false, error: "APNG export requires a browser environment" };
    }
    const UPNG = (await import("upng-js")).default as any;
    const w = canvas.width;
    const h = canvas.height;
    const bufs: Uint8Array[] = [];
    const dels: number[] = [];
    for (const frame of canvas.frames) {
      const rgba = compositeFrameRgba(canvas, frame.id);
      bufs.push(rgba);
      dels.push(frame.delay);
    }
    // cnum=0 means RGBA lossless (no palette); 256 = max indexed.
    const out: ArrayBuffer = UPNG.encode(bufs, w, h, opts.cnum ?? 0, dels);
    return { ok: true, output: new Blob([out], { type: "image/png" }) };
  } catch (e) {
    return { ok: false, error: `APNG export failed: ${(e as Error).message}` };
  }
}

/**
 * Export the canvas as a sprite sheet PNG (cols × rows layout) plus an
 * Aseprite-compatible JSON metadata string.
 */
export async function exportSpriteSheet(
  canvas: PixelCanvas,
  cols: number,
  rows: number,
  scale: number,
): Promise<ToolResult<{ png: Blob; json: string }>> {
  try {
    if (typeof document === "undefined") {
      return { ok: false, error: "Sprite sheet export requires a browser environment" };
    }
    if (cols < 1 || rows < 1) {
      return { ok: false, error: "cols and rows must be positive" };
    }
    if (scale < 1 || scale > 16) {
      return { ok: false, error: "Scale must be between 1 and 16" };
    }
    if (cols * rows < canvas.frames.length) {
      return {
        ok: false,
        error: `Sheet size ${cols}×${rows}=${cols * rows} cells is too small for ${canvas.frames.length} frames`,
      };
    }
    const frameW = canvas.width * scale;
    const frameH = canvas.height * scale;
    const sheetW = cols * frameW;
    const sheetH = rows * frameH;
    const c = document.createElement("canvas");
    c.width = sheetW;
    c.height = sheetH;
    const ctx = c.getContext("2d");
    if (!ctx) return { ok: false, error: "Canvas 2D context unavailable" };
    ctx.imageSmoothingEnabled = false;
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        if (i >= canvas.frames.length) break;
        const frame = canvas.frames[i]!;
        const rgba = compositeFrameRgba(canvas, frame.id);
        const src = document.createElement("canvas");
        src.width = canvas.width;
        src.height = canvas.height;
        const sctx = src.getContext("2d");
        if (!sctx) return { ok: false, error: "Source canvas context unavailable" };
        sctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), canvas.width, canvas.height), 0, 0);
        ctx.drawImage(src, col * frameW, r * frameH, frameW, frameH);
        i++;
      }
    }
    const png = await new Promise<Blob>((resolve, reject) => {
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
    });
    const json = exportAsepriteJson(
      canvas,
      { cols, rows, frameWidth: canvas.width, frameHeight: canvas.height },
      { scale, imageName: "spritesheet.png" },
    );
    return { ok: true, output: { png, json } };
  } catch (e) {
    return { ok: false, error: `Sprite sheet export failed: ${(e as Error).message}` };
  }
}

/**
 * Bundle the sprite sheet PNG + Aseprite JSON + project file into a single
 * ZIP using JSZip (already a dependency).
 */
export async function exportSheetBundle(
  canvas: PixelCanvas,
  cols: number,
  rows: number,
  scale: number,
): Promise<ToolResult<Blob>> {
  try {
    const sheet = await exportSpriteSheet(canvas, cols, rows, scale);
    if (!sheet.ok) return sheet;
    const JSZip = (await import("jszip")).default as any;
    const zip = new JSZip();
    zip.file("spritesheet.png", sheet.output.png);
    zip.file("spritesheet.json", sheet.output.json);
    zip.file("project.pam.json", serializeProject(canvas));
    const blob: Blob = await zip.generateAsync({ type: "blob" });
    return { ok: true, output: blob };
  } catch (e) {
    return { ok: false, error: `Sheet bundle export failed: ${(e as Error).message}` };
  }
}

// ---------------------------------------------------------------------------
// IndexedDB autosave helpers (browser-only)
// ---------------------------------------------------------------------------

const AUTOSAVE_DB = "unqtools-pixel-art-maker";
const AUTOSAVE_STORE = "projects";
const AUTOSAVE_KEY = "current";

/** Save the current canvas to IndexedDB. Returns true on success. */
export async function autosaveProject(canvas: PixelCanvas): Promise<boolean> {
  try {
    if (typeof indexedDB === "undefined") return false;
    const json = serializeProject(canvas);
    // Warn at >10MB.
    if (json.length > 10 * 1024 * 1024) {
      console.warn("Pixel Art Maker project >10MB — consider splitting");
    }
    const db = await openAutosaveDb();
    if (!db) return false;
    return new Promise<boolean>((resolve) => {
      try {
        const tx = db.transaction(AUTOSAVE_STORE, "readwrite");
        tx.objectStore(AUTOSAVE_STORE).put({ id: AUTOSAVE_KEY, json, savedAt: Date.now() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

/** Load the autosaved project from IndexedDB. Returns null if none. */
export async function loadAutosave(): Promise<PixelCanvas | null> {
  try {
    if (typeof indexedDB === "undefined") return null;
    const db = await openAutosaveDb();
    if (!db) return null;
    return new Promise<PixelCanvas | null>((resolve) => {
      try {
        const tx = db.transaction(AUTOSAVE_STORE, "readonly");
        const req = tx.objectStore(AUTOSAVE_STORE).get(AUTOSAVE_KEY);
        req.onsuccess = () => {
          const row = req.result as { json: string } | undefined;
          if (!row) return resolve(null);
          const result = deserializeProject(row.json);
          resolve(result.ok ? result.output : null);
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

/** Clear the autosaved project. */
export async function clearAutosave(): Promise<void> {
  try {
    if (typeof indexedDB === "undefined") return;
    const db = await openAutosaveDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(AUTOSAVE_STORE, "readwrite");
        tx.objectStore(AUTOSAVE_STORE).delete(AUTOSAVE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    /* ignore */
  }
}

function openAutosaveDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(AUTOSAVE_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(AUTOSAVE_STORE)) {
          db.createObjectStore(AUTOSAVE_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}
