/**
 * Pixel Art Maker — pure logic. PART 1 of 5.
 *
 * Assembly: concatenate PART-1 + PART-2 + PART-3 + PART-4 + PART-5, in that
 * order, into the single real `src/tools/image/pixel-art-maker/logic.ts`.
 * Only this part carries the shared import. Later parts add no imports and
 * rely on being concatenated after this one (shared module scope).
 *
 * This part covers: types, id generation, color utilities, canvas
 * construction/clone, layer operations, frame operations, and the pixel
 * read/write primitives.
 *
 * Defect fixes shipped in this part (see DOCS.md section 3):
 * - #2 Layer lock is now actually enforced: `setPixel` and `setPixelInPlace`
 *   both refuse to write to a locked layer (silent no-op, same convention
 *   the original code already used for out-of-bounds writes). Every later
 *   drawing primitive in PART-2/PART-5 (line/rect/ellipse/fill/stamp/dither)
 *   calls the shared `isLayerLocked` helper defined here.
 *
 * Self-review fix: `Palette.tags` is keyed by color index -> single tag
 * (matching the original convention and PART-3's actual tag functions),
 * using the same 5-value tag union PART-3 exposes as `PaletteTag`.
 *
 * All operations are pure: they return new PixelCanvas objects (shallow
 * clone of struct, copy-on-write of the affected frame's affected layer
 * pixel data), except the explicitly "InPlace" variant used for
 * performance during freehand drawing.
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
  | "select-lasso"
  | "magic-wand"
  | "move"
  | "pan"
  | "stamp"
  | "tile-flip"
  | "dither"
  | "pattern-brush"
  | "gradient-brush"
  | "scatter-brush"
  | "color-replace";

export interface BrushSettings {
  size: number;
  mirrorX: boolean;
  mirrorY: boolean;
  /** Radial/rotational symmetry: 1 = off, or 4/6/8-way. Feature #16. */
  radialSymmetry: 1 | 4 | 6 | 8;
  pixelPerfect: boolean;
  ditherPattern: "bayer2" | "bayer4" | "checker";
  ditherThreshold: number;
  /** Stamp shape for brush sizes > 1. Feature #46. */
  stampShape: "square" | "circle" | "diamond";
}

export interface Palette {
  name: string;
  colors: string[];
  /**
   * Per-color tags, keyed by color index -> a single tag (matches the
   * original one-tag-per-color convention). The 5 allowed tag values match
   * PART-3's exported `PaletteTag` union exactly (duplicated here as a
   * literal type since PART-3 is concatenated after this file).
   */
  tags?: Record<number, "background" | "outline" | "shadow" | "highlight" | "skin">;
}

export interface Layer {
  id: string;
  name: string;
  opacity: number; // 0..1
  visible: boolean;
  locked: boolean;
  /** Feature #35: parent folder id, or null/undefined for top-level. */
  groupId?: string | null;
  /** Feature #36: clip this layer's alpha to the layer directly below it. */
  clipToBelow?: boolean;
  /** Feature #37: approximate blend mode against the layer(s) below. */
  blendMode?: "normal" | "multiply" | "screen" | "add";
  /** Feature #38: show this layer in onion-skin preview independent of `visible`. */
  onionSkin?: boolean;
}

export interface Frame {
  id: string;
  delay: number; // milliseconds
  layerData: Record<string, Uint8Array>;
  /** Feature #63: named animation ranges, e.g. "walk", "idle". */
  tag?: string;
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
  /** Feature #31: freehand lasso points, when the selection is not a rectangle. */
  lassoPoints?: Point[];
}

export interface ProjectFile {
  version: 1;
  canvas: PixelCanvas;
  savedAt: string;
}

export const CANVAS_MAX_DIM = 1024;

// ---------------------------------------------------------------------------
// ID generation (pure, deterministic-friendly for tests)
// ---------------------------------------------------------------------------

let _idCounter = 0;
/** Generate a unique-enough id for layers/frames. */
export function makeId(prefix: string): string {
  _idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${_idCounter.toString(36)}`;
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

/** Feature #55: complementary / triadic / analogous harmony suggestions for a base hex color. */
export function colorHarmony(hex: string): {
  complementary: string;
  triadic: [string, string];
  analogous: [string, string];
} {
  const [r, g, b] = hexToRgba(hex);
  const rgbToHsl = (rr: number, gg: number, bb: number): [number, number, number] => {
    const rn = rr / 255, gn = gg / 255, bn = bb / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    const d = max - min;
    if (d !== 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === rn) h = ((gn - bn) / d) % 6;
      else if (max === gn) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return [h, s, l];
  };
  const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let rr = 0, gg = 0, bb = 0;
    if (h < 60) { rr = c; gg = x; } else if (h < 120) { rr = x; gg = c; }
    else if (h < 180) { gg = c; bb = x; } else if (h < 240) { gg = x; bb = c; }
    else if (h < 300) { rr = x; bb = c; } else { rr = c; bb = x; }
    return [
      Math.round((rr + m) * 255),
      Math.round((gg + m) * 255),
      Math.round((bb + m) * 255),
    ];
  };
  const [h, s, l] = rgbToHsl(r, g, b);
  const at = (deltaDeg: number) => {
    const [nr, ng, nb] = hslToRgb((h + deltaDeg + 360) % 360, s, l);
    return rgbaToHex(nr, ng, nb);
  };
  return {
    complementary: at(180),
    triadic: [at(120), at(240)],
    analogous: [at(30), at(-30)],
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
  if (width > CANVAS_MAX_DIM || height > CANVAS_MAX_DIM) {
    throw new Error(`Canvas too large (max ${CANVAS_MAX_DIM}x${CANVAS_MAX_DIM}): ${width}x${height}`);
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
      tag: f.tag,
      layerData: Object.fromEntries(
        Object.entries(f.layerData).map(([k, v]) => [k, new Uint8Array(v)]),
      ),
    })),
    palette: {
      name: canvas.palette.name,
      colors: [...canvas.palette.colors],
      tags: canvas.palette.tags ? { ...canvas.palette.tags } : undefined,
    },
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

/**
 * Feature #12: duplicate a layer (new id, " copy" suffix, identical pixel
 * data in every frame), inserted directly above the source layer.
 */
export function duplicateLayer(canvas: PixelCanvas, layerId: string): PixelCanvas {
  const srcIndex = canvas.layers.findIndex((l) => l.id === layerId);
  if (srcIndex === -1) throw new Error(`Unknown layer id: ${layerId}`);
  const out = cloneCanvas(canvas);
  const src = out.layers[srcIndex]!;
  const newId = makeId("layer");
  const copy: Layer = { ...src, id: newId, name: `${src.name} copy` };
  out.layers.splice(srcIndex + 1, 0, copy);
  for (const f of out.frames) {
    const data = f.layerData[layerId];
    f.layerData[newId] = data ? new Uint8Array(data) : new Uint8Array(out.width * out.height * 4);
  }
  out.activeLayerId = newId;
  return out;
}

/**
 * Feature #12: merge a layer down into the layer directly below it
 * (source-over composite of just those two layers, per frame). The merged
 * result keeps the lower layer's id, name, opacity is reset to 1 since the
 * composite already bakes both layers' opacity in.
 */
export function mergeLayerDown(canvas: PixelCanvas, layerId: string): PixelCanvas {
  const index = canvas.layers.findIndex((l) => l.id === layerId);
  if (index <= 0) throw new Error("No layer below to merge into");
  const out = cloneCanvas(canvas);
  const top = out.layers[index]!;
  const bottom = out.layers[index - 1]!;
  for (const f of out.frames) {
    const topData = f.layerData[top.id];
    const bottomData = f.layerData[bottom.id];
    if (!topData || !bottomData) continue;
    const topOp = Math.max(0, Math.min(1, top.opacity));
    for (let i = 0; i < bottomData.length; i += 4) {
      const a = (topData[i + 3]! / 255) * topOp;
      if (a === 0) continue;
      const inv = 1 - a;
      bottomData[i] = Math.round(topData[i]! * a + bottomData[i]! * inv);
      bottomData[i + 1] = Math.round(topData[i + 1]! * a + bottomData[i + 1]! * inv);
      bottomData[i + 2] = Math.round(topData[i + 2]! * a + bottomData[i + 2]! * inv);
      bottomData[i + 3] = Math.round(255 * (a + (bottomData[i + 3]! / 255) * inv));
    }
    delete f.layerData[top.id];
  }
  out.layers.splice(index, 1);
  if (out.activeLayerId === top.id) out.activeLayerId = bottom.id;
  return out;
}

/** Feature #12: flatten every visible layer of a frame into one opaque layer. */
export function flattenImage(canvas: PixelCanvas): PixelCanvas {
  const out = cloneCanvas(canvas);
  const newId = makeId("layer");
  for (const f of out.frames) {
    const composite = new Uint8Array(out.width * out.height * 4);
    for (const layer of out.layers) {
      if (!layer.visible) continue;
      const data = f.layerData[layer.id];
      if (!data) continue;
      const op = Math.max(0, Math.min(1, layer.opacity));
      if (op === 0) continue;
      for (let i = 0; i < composite.length; i += 4) {
        const a = (data[i + 3]! / 255) * op;
        if (a === 0) continue;
        const inv = 1 - a;
        composite[i] = Math.round(data[i]! * a + composite[i]! * inv);
        composite[i + 1] = Math.round(data[i + 1]! * a + composite[i + 1]! * inv);
        composite[i + 2] = Math.round(data[i + 2]! * a + composite[i + 2]! * inv);
        composite[i + 3] = Math.round(255 * (a + (composite[i + 3]! / 255) * inv));
      }
    }
    f.layerData = { [newId]: composite };
  }
  out.layers = [{ id: newId, name: "Flattened", opacity: 1, visible: true, locked: false }];
  out.activeLayerId = newId;
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

/** Feature #37: set a layer's approximate blend mode. */
export function setLayerBlendMode(
  canvas: PixelCanvas,
  layerId: string,
  blendMode: NonNullable<Layer["blendMode"]>,
): PixelCanvas {
  const out = cloneCanvas(canvas);
  const layer = out.layers.find((l) => l.id === layerId);
  if (layer) layer.blendMode = blendMode;
  return out;
}

/** Feature #36: toggle whether a layer clips its alpha to the layer below it. */
export function setLayerClipToBelow(
  canvas: PixelCanvas,
  layerId: string,
  clip: boolean,
): PixelCanvas {
  const out = cloneCanvas(canvas);
  const layer = out.layers.find((l) => l.id === layerId);
  if (layer) layer.clipToBelow = clip;
  return out;
}

/** Feature #33: rename a layer. */
export function renameLayer(canvas: PixelCanvas, layerId: string, name: string): PixelCanvas {
  const trimmed = name.trim();
  if (trimmed === "") throw new Error("Layer name cannot be empty");
  const out = cloneCanvas(canvas);
  const layer = out.layers.find((l) => l.id === layerId);
  if (layer) layer.name = trimmed;
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

/**
 * Feature #57: duplicate a frame to any position in the sequence (not only
 * appended at the end).
 */
export function duplicateFrameAt(canvas: PixelCanvas, frameId: string, atIndex: number): PixelCanvas {
  const srcIndex = canvas.frames.findIndex((f) => f.id === frameId);
  if (srcIndex === -1) throw new Error(`Unknown frame id: ${frameId}`);
  const out = cloneCanvas(canvas);
  const src = out.frames[srcIndex]!;
  const newId = makeId("frame");
  const copy: Frame = {
    id: newId,
    delay: src.delay,
    tag: src.tag,
    layerData: Object.fromEntries(
      Object.entries(src.layerData).map(([k, v]) => [k, new Uint8Array(v)]),
    ),
  };
  const insertAt = Math.max(0, Math.min(out.frames.length, atIndex));
  out.frames.splice(insertAt, 0, copy);
  out.activeFrameId = newId;
  return out;
}

/** Feature #58: reverse the order of every frame. */
export function reverseFrames(canvas: PixelCanvas): PixelCanvas {
  const out = cloneCanvas(canvas);
  out.frames.reverse();
  return out;
}

/** Feature #96: apply one delay value to every frame at once. */
export function setAllFrameDelays(canvas: PixelCanvas, delay: number): PixelCanvas {
  const out = cloneCanvas(canvas);
  const clamped = Math.max(10, Math.round(delay));
  for (const f of out.frames) f.delay = clamped;
  return out;
}

/** Feature #63: tag a contiguous range of frames with a name (e.g. "walk"). */
export function tagFrameRange(canvas: PixelCanvas, fromIndex: number, toIndex: number, tag: string): PixelCanvas {
  const out = cloneCanvas(canvas);
  const lo = Math.max(0, Math.min(fromIndex, toIndex));
  const hi = Math.min(out.frames.length - 1, Math.max(fromIndex, toIndex));
  for (let i = lo; i <= hi; i++) {
    const f = out.frames[i];
    if (f) f.tag = tag;
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

/**
 * Defect #2 fix: shared lock-check used by every drawing primitive in this
 * file (PART-1 through PART-5). A layer is considered locked only when its
 * metadata explicitly says so — unlocked is always the default, so none of
 * the original (lock-unaware) call sites change behavior.
 */
function isLayerLocked(canvas: PixelCanvas, layerId: string): boolean {
  const layer = canvas.layers.find((l) => l.id === layerId);
  return layer ? layer.locked : false;
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
 * Read the RGBA pixel at (x, y) from the visible composite of every layer
 * (respecting visibility and opacity), not just one layer. Feature #9 fix:
 * used by the rebuilt eyedropper so it can pick up colors showing through a
 * transparent area of the active layer.
 */
export function getCompositePixel(
  canvas: PixelCanvas,
  frameId: string,
  x: number,
  y: number,
): [number, number, number, number] {
  if (!inBounds(canvas, x, y)) return [0, 0, 0, 0];
  const rgba = compositeFrameRgbaAt(canvas, frameId, x, y);
  return rgba;
}

// Forward-declared in PART-1, implemented fully once `compositeFrameRgba`
// exists in this same part (below). Kept as a thin single-pixel helper so
// getCompositePixel does not need to composite the entire frame.
function compositeFrameRgbaAt(
  canvas: PixelCanvas,
  frameId: string,
  x: number,
  y: number,
): [number, number, number, number] {
  const frame = canvas.frames.find((f) => f.id === frameId);
  if (!frame) return [0, 0, 0, 0];
  let r = 0, g = 0, b = 0, a = 0;
  for (const layer of canvas.layers) {
    if (!layer.visible) continue;
    const data = frame.layerData[layer.id];
    if (!data) continue;
    const op = Math.max(0, Math.min(1, layer.opacity));
    if (op === 0) continue;
    const i = pixelIndex(canvas, x, y);
    const sa = (data[i + 3]! / 255) * op;
    if (sa === 0) continue;
    const inv = 1 - sa;
    r = Math.round(data[i]! * sa + r * inv);
    g = Math.round(data[i + 1]! * sa + g * inv);
    b = Math.round(data[i + 2]! * sa + b * inv);
    a = Math.round(255 * (sa + (a / 255) * inv));
  }
  return [r, g, b, a];
}

/**
 * Set the pixel at (x, y) on a specific layer+frame to the given RGBA color.
 * Out-of-bounds writes are silently dropped (same as the original), and
 * writes to a locked layer are also silently dropped (defect #2 fix).
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
  if (isLayerLocked(canvas, layerId)) return canvas;
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
 * Refuses (returns false, no mutation) when the layer is locked (defect #2
 * fix).
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
  if (isLayerLocked(canvas, layerId)) return false;
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

/**
 * Composite all visible layers for a frame into a single RGBA Uint8Array.
 * Respects per-layer opacity and the layer order (bottom → top). Layers
 * marked `clipToBelow` (feature #36) only contribute where the layer
 * directly below already has non-zero alpha.
 */
export function compositeFrameRgba(
  canvas: PixelCanvas,
  frameId: string,
): Uint8Array {
  const frame = canvas.frames.find((f) => f.id === frameId);
  if (!frame) {
    return new Uint8Array(canvas.width * canvas.height * 4);
  }
  const out = new Uint8Array(canvas.width * canvas.height * 4);
  let prevData: Uint8Array | null = null;
  for (const layer of canvas.layers) {
    const data = frame.layerData[layer.id];
    if (!layer.visible || !data) {
      prevData = data ?? prevData;
      continue;
    }
    const op = Math.max(0, Math.min(1, layer.opacity));
    if (op === 0) {
      prevData = data;
      continue;
    }
    const blend = layer.blendMode ?? "normal";
    for (let i = 0; i < out.length; i += 4) {
      if (layer.clipToBelow && prevData && prevData[i + 3] === 0) continue;
      let sr = data[i]!, sg = data[i + 1]!, sb = data[i + 2]!;
      const a = (data[i + 3]! / 255) * op;
      if (a === 0) continue;
      if (blend === "multiply") {
        sr = Math.round((sr * out[i]!) / 255);
        sg = Math.round((sg * out[i + 1]!) / 255);
        sb = Math.round((sb * out[i + 2]!) / 255);
      } else if (blend === "screen") {
        sr = 255 - Math.round(((255 - sr) * (255 - out[i]!)) / 255);
        sg = 255 - Math.round(((255 - sg) * (255 - out[i + 1]!)) / 255);
        sb = 255 - Math.round(((255 - sb) * (255 - out[i + 2]!)) / 255);
      } else if (blend === "add") {
        sr = Math.min(255, sr + out[i]!);
        sg = Math.min(255, sg + out[i + 1]!);
        sb = Math.min(255, sb + out[i + 2]!);
      }
      const inv = 1 - a;
      out[i] = Math.round(sr * a + out[i]! * inv);
      out[i + 1] = Math.round(sg * a + out[i + 1]! * inv);
      out[i + 2] = Math.round(sb * a + out[i + 2]! * inv);
      out[i + 3] = Math.round(255 * (a + (out[i + 3]! / 255) * inv));
    }
    prevData = data;
  }
  return out;
}

 * Bresenham's line algorithm. Returns every integer pixel coordinate
 * on the line from (x0,y0) to (x1,y1), inclusive of both endpoints.
 */
export function bresenhamLine(x0: number, y0: number, x1: number, y1: number): Point[] {
	const points: Point[] = []
	let x = Math.round(x0)
	let y = Math.round(y0)
	const ex = Math.round(x1)
	const ey = Math.round(y1)
	const dx = Math.abs(ex - x)
	const dy = -Math.abs(ey - y)
	const sx = x < ex ? 1 : -1
	const sy = y < ey ? 1 : -1
	let err = dx + dy
	for (;;) {
		points.push({ x, y })
		if (x === ex && y === ey) break
		const e2 = 2 * err
		if (e2 >= dy) {
			err += dy
			x += sx
		}
		if (e2 <= dx) {
			err += dx
			y += sy
		}
	}
	return points
}

function stampBrush(
	canvas: PixelCanvas,
	frame: Frame,
	layerId: string,
	cx: number,
	cy: number,
	color: [number, number, number, number],
	brushSize: number,
	selection?: Selection | null,
): void {
	if (isLayerLocked(canvas, layerId)) return
	const half = Math.floor(brushSize / 2)
	for (let oy = 0; oy < brushSize; oy++) {
		for (let ox = 0; ox < brushSize; ox++) {
			const px = cx - half + ox
			const py = cy - half + oy
			if (selection && !isPointInSelection(selection, px, py)) continue
			setPixelInPlace(canvas, layerId, frame.id, px, py, color)
		}
	}
}

/**
 * Draws a straight line of pixels between two points on the given layer/frame.
 * brushSize >=1 draws a square brush centered on each line point (matches
 * the original single-pixel behavior when brushSize=1). If a selection is
 * active, pixels outside the selection are skipped (defect #3 fix).
 */
export function drawLine(
	canvas: PixelCanvas,
	layerId: string,
	frameId: string,
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	color: [number, number, number, number],
	brushSize = 1,
	selection?: Selection | null,
): PixelCanvas {
	const next = cloneCanvas(canvas)
	const frame = next.frames.find((f) => f.id === frameId)
	if (!frame) return next
	const points = bresenhamLine(x0, y0, x1, y1)
	for (const p of points) {
		stampBrush(next, frame, layerId, p.x, p.y, color, brushSize, selection)
	}
	return next
}

/**
 * Draws a rectangle outline or a filled rectangle between two corner points.
 */
export function drawRect(
	canvas: PixelCanvas,
	layerId: string,
	frameId: string,
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	color: [number, number, number, number],
	filled = false,
	selection?: Selection | null,
): PixelCanvas {
	const next = cloneCanvas(canvas)
	const frame = next.frames.find((f) => f.id === frameId)
	if (!frame) return next
	const minX = Math.min(x0, x1)
	const maxX = Math.max(x0, x1)
	const minY = Math.min(y0, y1)
	const maxY = Math.max(y0, y1)
	if (filled) {
		for (let y = minY; y <= maxY; y++) {
			for (let x = minX; x <= maxX; x++) {
				if (selection && !isPointInSelection(selection, x, y)) continue
				setPixelInPlace(next, layerId, frame.id, x, y, color)
			}
		}
	} else {
		for (let x = minX; x <= maxX; x++) {
			if (!selection || isPointInSelection(selection, x, minY)) setPixelInPlace(next, layerId, frame.id, x, minY, color)
			if (!selection || isPointInSelection(selection, x, maxY)) setPixelInPlace(next, layerId, frame.id, x, maxY, color)
		}
		for (let y = minY; y <= maxY; y++) {
			if (!selection || isPointInSelection(selection, minX, y)) setPixelInPlace(next, layerId, frame.id, minX, y, color)
			if (!selection || isPointInSelection(selection, maxX, y)) setPixelInPlace(next, layerId, frame.id, maxX, y, color)
		}
	}
	return next
}

/**
 * Draws an ellipse (outline or filled) inscribed in the bounding box defined
 * by the two corner points, using the midpoint ellipse algorithm.
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
	filled = false,
	selection?: Selection | null,
): PixelCanvas {
	const next = cloneCanvas(canvas)
	const frame = next.frames.find((f) => f.id === frameId)
	if (!frame) return next
	const cx = (x0 + x1) / 2
	const cy = (y0 + y1) / 2
	const rx = Math.max(1, Math.abs(x1 - x0) / 2)
	const ry = Math.max(1, Math.abs(y1 - y0) / 2)

	const plot = (px: number, py: number) => {
		if (selection && !isPointInSelection(selection, px, py)) return
		setPixelInPlace(next, layerId, frame.id, px, py, color)
	}
	const plotSpan = (yy: number, xLeft: number, xRight: number) => {
		if (filled) {
			for (let x = xLeft; x <= xRight; x++) plot(x, yy)
		} else {
			plot(xLeft, yy)
			plot(xRight, yy)
		}
	}

	// Midpoint ellipse algorithm, region 1 then region 2
	let x = 0
	let y = ry
	const rx2 = rx * rx
	const ry2 = ry * ry
	let dx = 2 * ry2 * x
	let dy = 2 * rx2 * y
	let err = ry2 - rx2 * ry + 0.25 * rx2

	while (dx < dy) {
		plotSpan(Math.round(cy + y), Math.round(cx - x), Math.round(cx + x))
		plotSpan(Math.round(cy - y), Math.round(cx - x), Math.round(cx + x))
		if (err < 0) {
			x += 1
			dx += 2 * ry2
			err += dx + ry2
		} else {
			x += 1
			y -= 1
			dx += 2 * ry2
			dy -= 2 * rx2
			err += dx - dy + ry2
		}
	}

	err = ry2 * (x + 0.5) * (x + 0.5) + rx2 * (y - 1) * (y - 1) - rx2 * ry2
	while (y >= 0) {
		plotSpan(Math.round(cy + y), Math.round(cx - x), Math.round(cx + x))
		plotSpan(Math.round(cy - y), Math.round(cx - x), Math.round(cx + x))
		if (err > 0) {
			y -= 1
			dy -= 2 * rx2
			err += rx2 - dy
		} else {
			y -= 1
			x += 1
			dx += 2 * ry2
			dy -= 2 * rx2
			err += dx - dy + rx2
		}
	}
	return next
}

// ---------- Flood fill ----------

function colorsMatch(
	a: [number, number, number, number],
	b: [number, number, number, number],
	tolerance: number,
): boolean {
	if (tolerance <= 0) return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]
	const dr = a[0] - b[0]
	const dg = a[1] - b[1]
	const db = a[2] - b[2]
	const da = a[3] - b[3]
	return Math.sqrt(dr * dr + dg * dg + db * db + da * da) <= tolerance
}

/**
 * Contiguous (4-connected) flood fill starting at (x,y), matching the
 * original color within the given tolerance (0 = exact match only).
 * Respects an active selection (defect #3 fix) and locked layers.
 */
export function floodFill(
	canvas: PixelCanvas,
	layerId: string,
	frameId: string,
	x: number,
	y: number,
	color: [number, number, number, number],
	tolerance = 0,
	selection?: Selection | null,
): PixelCanvas {
	if (isLayerLocked(canvas, layerId)) return canvas
	const next = cloneCanvas(canvas)
	const frame = next.frames.find((f) => f.id === frameId)
	if (!frame) return next
	const target = getPixel(next, layerId, frameId, x, y)
	if (!target) return next
	if (colorsMatch(target, color, 0)) return next

	const stack: Point[] = [{ x, y }]
	const visited = new Set<string>()
	while (stack.length > 0) {
		const p = stack.pop() as Point
		const key = `${p.x},${p.y}`
		if (visited.has(key)) continue
		visited.add(key)
		if (p.x < 0 || p.y < 0 || p.x >= next.width || p.y >= next.height) continue
		if (selection && !isPointInSelection(selection, p.x, p.y)) continue
		const current = getPixel(next, layerId, frameId, p.x, p.y)
		if (!current || !colorsMatch(current, target, tolerance)) continue
		setPixelInPlace(next, layerId, frame.id, p.x, p.y, color)
		stack.push({ x: p.x + 1, y: p.y })
		stack.push({ x: p.x - 1, y: p.y })
		stack.push({ x: p.x, y: p.y + 1 })
		stack.push({ x: p.x, y: p.y - 1 })
	}
	return next
}

/**
 * Replaces every pixel matching targetColor (within tolerance) anywhere on
 * the layer/frame, not just the contiguous region — a "global" bucket fill.
 */
export function floodFillGlobal(
	canvas: PixelCanvas,
	layerId: string,
	frameId: string,
	targetColor: [number, number, number, number],
	replacementColor: [number, number, number, number],
	tolerance = 0,
	selection?: Selection | null,
): PixelCanvas {
	if (isLayerLocked(canvas, layerId)) return canvas
	const next = cloneCanvas(canvas)
	const frame = next.frames.find((f) => f.id === frameId)
	if (!frame) return next
	for (let y = 0; y < next.height; y++) {
		for (let x = 0; x < next.width; x++) {
			if (selection && !isPointInSelection(selection, x, y)) continue
			const current = getPixel(next, layerId, frameId, x, y)
			if (current && colorsMatch(current, targetColor, tolerance)) {
				setPixelInPlace(next, layerId, frame.id, x, y, replacementColor)
			}
		}
	}
	return next
}

// ---------- Mirror / symmetry ----------

/** Mirrors the layer's pixel content horizontally (left-right flip in place). */
export function applyMirrorX(canvas: PixelCanvas, layerId: string, frameId: string): PixelCanvas {
	if (isLayerLocked(canvas, layerId)) return canvas
	const next = cloneCanvas(canvas)
	const frame = next.frames.find((f) => f.id === frameId)
	if (!frame) return next
	const w = next.width
	for (let y = 0; y < next.height; y++) {
		for (let x = 0; x < Math.floor(w / 2); x++) {
			const left = getPixel(next, layerId, frameId, x, y)
			const right = getPixel(next, layerId, frameId, w - 1 - x, y)
			if (left) setPixelInPlace(next, layerId, frame.id, w - 1 - x, y, left)
			if (right) setPixelInPlace(next, layerId, frame.id, x, y, right)
		}
	}
	return next
}

/** Mirrors the layer's pixel content vertically (top-bottom flip in place). */
export function applyMirrorY(canvas: PixelCanvas, layerId: string, frameId: string): PixelCanvas {
	if (isLayerLocked(canvas, layerId)) return canvas
	const next = cloneCanvas(canvas)
	const frame = next.frames.find((f) => f.id === frameId)
	if (!frame) return next
	const h = next.height
	for (let x = 0; x < next.width; x++) {
		for (let y = 0; y < Math.floor(h / 2); y++) {
			const top = getPixel(next, layerId, frameId, x, y)
			const bottom = getPixel(next, layerId, frameId, x, h - 1 - y)
			if (top) setPixelInPlace(next, layerId, frame.id, x, h - 1 - y, top)
			if (bottom) setPixelInPlace(next, layerId, frame.id, x, y, bottom)
		}
	}
	return next
}

/**
 * Given a brush stroke point and the canvas dimensions, returns every point
 * that should also be drawn to satisfy the brush's symmetry settings
 * (horizontal/vertical mirror axes plus N-way radial symmetry). Always
 * includes the original point. Radial symmetry rotates points around the
 * canvas center (new feature — wires up BrushSettings.radialSymmetry).
 */
export function getSymmetryPoints(canvas: PixelCanvas, brush: BrushSettings, x: number, y: number): Point[] {
	const pts: Point[] = [{ x, y }]
	const w = canvas.width
	const h = canvas.height
	if (brush.mirrorX) pts.push({ x: w - 1 - x, y })
	if (brush.mirrorY) pts.push({ x, y: h - 1 - y })
	if (brush.mirrorX && brush.mirrorY) pts.push({ x: w - 1 - x, y: h - 1 - y })

	const radial = brush.radialSymmetry ?? 0
	if (radial && radial > 1) {
		const cx = (w - 1) / 2
		const cy = (h - 1) / 2
		const dx0 = x - cx
		const dy0 = y - cy
		for (let i = 1; i < radial; i++) {
			const theta = (2 * Math.PI * i) / radial
			const cos = Math.cos(theta)
			const sin = Math.sin(theta)
			const rx = dx0 * cos - dy0 * sin
			const ry = dx0 * sin + dy0 * cos
			pts.push({ x: Math.round(cx + rx), y: Math.round(cy + ry) })
		}
	}
	// De-duplicate
	const seen = new Set<string>()
	const out: Point[] = []
	for (const p of pts) {
		const key = `${p.x},${p.y}`
		if (!seen.has(key)) {
			seen.add(key)
			out.push(p)
		}
	}
	return out
}

// ---------- Pixel-perfect stroke cleanup ----------

/**
 * Collapses "staircase" artifacts from a freehand pixel stroke: whenever
 * three consecutive points form an L-shaped corner where the middle point
 * is diagonally adjacent to both its neighbors, the middle point is dropped
 * only if it does not represent an actual direction change corner. Corners
 * (genuine direction changes) are preserved; only redundant collinear-ish
 * staircase midpoints are removed.
 */
export function applyPixelPerfect(points: Point[]): Point[] {
	if (points.length < 3) return points.slice()
	const result: Point[] = [points[0]]
	for (let i = 1; i < points.length - 1; i++) {
		const prev = points[i - 1]
		const curr = points[i]
		const next = points[i + 1]
		const dx1 = curr.x - prev.x
		const dy1 = curr.y - prev.y
		const dx2 = next.x - curr.x
		const dy2 = next.y - curr.y
		const isDiag1 = Math.abs(dx1) === 1 && Math.abs(dy1) === 1
		const isDiag2 = Math.abs(dx2) === 1 && Math.abs(dy2) === 1
		const prevNextDx = next.x - prev.x
		const prevNextDy = next.y - prev.y
		const isRedundantElbow = isDiag1 && isDiag2 && Math.abs(prevNextDx) === 2 && Math.abs(prevNextDy) === 0
		const isRedundantElbowV = isDiag1 && isDiag2 && Math.abs(prevNextDx) === 0 && Math.abs(prevNextDy) === 2
		if (isRedundantElbow || isRedundantElbowV) {
			continue
		}
		result.push(curr)
	}
	result.push(points[points.length - 1])
	return result
}

// ---------- Selection operations (defect #3 fix) ----------

/** Creates a normalized rectangular selection from two corner points. */
export function selectRect(x0: number, y0: number, x1: number, y1: number): Selection {
	return {
		x0: Math.min(x0, x1),
		y0: Math.min(y0, y1),
		x1: Math.max(x0, x1),
		y1: Math.max(y0, y1),
	}
}

/** Creates a freeform lasso selection from an ordered list of points. */
export function selectLasso(points: Point[]): Selection {
	let minX = Infinity
	let minY = Infinity
	let maxX = -Infinity
	let maxY = -Infinity
	for (const p of points) {
		if (p.x < minX) minX = p.x
		if (p.y < minY) minY = p.y
		if (p.x > maxX) maxX = p.x
		if (p.y > maxY) maxY = p.y
	}
	return { x0: minX, y0: minY, x1: maxX, y1: maxY, lassoPoints: points.slice() }
}

/**
 * Point-in-selection test. Uses ray casting against lassoPoints when present,
 * otherwise a simple inclusive rectangle test.
 */
export function isPointInSelection(selection: Selection, x: number, y: number): boolean {
	if (selection.lassoPoints && selection.lassoPoints.length >= 3) {
		const pts = selection.lassoPoints
		let inside = false
		for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
			const xi = pts[i].x
			const yi = pts[i].y
			const xj = pts[j].x
			const yj = pts[j].y
			const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
			if (intersect) inside = !inside
		}
		return inside
	}
	return x >= selection.x0 && x <= selection.x1 && y >= selection.y0 && y <= selection.y1
}

/** Inverts a rectangular selection to the full canvas minus that rectangle,
 * represented as the complement lasso polygon (outer canvas ring minus hole). */
export function invertSelection(canvas: PixelCanvas, selection: Selection): Selection {
	const w = canvas.width
	const h = canvas.height
	const outer: Point[] = [
		{ x: 0, y: 0 },
		{ x: w, y: 0 },
		{ x: w, y: h },
		{ x: 0, y: h },
		{ x: 0, y: 0 },
	]
	const hole: Point[] = [
		{ x: selection.x0, y: selection.y0 },
		{ x: selection.x0, y: selection.y1 },
		{ x: selection.x1, y: selection.y1 },
		{ x: selection.x1, y: selection.y0 },
		{ x: selection.x0, y: selection.y0 },
	]
	return { x0: 0, y0: 0, x1: w, y1: h, lassoPoints: [...outer, ...hole] }
}

/** Fills every pixel inside the selection with the given color. */
export function fillSelection(
	canvas: PixelCanvas,
	layerId: string,
	frameId: string,
	selection: Selection,
	color: [number, number, number, number],
): PixelCanvas {
	if (isLayerLocked(canvas, layerId)) return canvas
	const next = cloneCanvas(canvas)
	const frame = next.frames.find((f) => f.id === frameId)
	if (!frame) return next
	const x0 = Math.max(0, Math.floor(selection.x0))
	const y0 = Math.max(0, Math.floor(selection.y0))
	const x1 = Math.min(next.width - 1, Math.ceil(selection.x1))
	const y1 = Math.min(next.height - 1, Math.ceil(selection.y1))
	for (let y = y0; y <= y1; y++) {
		for (let x = x0; x <= x1; x++) {
			if (!isPointInSelection(selection, x, y)) continue
			setPixelInPlace(next, layerId, frame.id, x, y, color)
		}
	}
	return next
}

/** Clears (sets fully transparent) every pixel inside the selection. */
export function deleteSelectionPixels(
	canvas: PixelCanvas,
	layerId: string,
	frameId: string,
	selection: Selection,
): PixelCanvas {
	return fillSelection(canvas, layerId, frameId, selection, [0, 0, 0, 0])
}

/** Snapshot of pixel data captured for copy/paste, keyed by local offset from the selection's top-left corner. */
export type SelectionClip = {
	width: number
	height: number
	pixels: Array<{ dx: number; dy: number; color: [number, number, number, number] }>
}

/** Copies the pixels inside a selection into a portable clip object. */
export function copySelectionPixels(
	canvas: PixelCanvas,
	layerId: string,
	frameId: string,
	selection: Selection,
): SelectionClip {
	const x0 = Math.max(0, Math.floor(selection.x0))
	const y0 = Math.max(0, Math.floor(selection.y0))
	const x1 = Math.min(canvas.width - 1, Math.ceil(selection.x1))
	const y1 = Math.min(canvas.height - 1, Math.ceil(selection.y1))
	const pixels: SelectionClip["pixels"] = []
	for (let y = y0; y <= y1; y++) {
		for (let x = x0; x <= x1; x++) {
			if (!isPointInSelection(selection, x, y)) continue
			const color = getPixel(canvas, layerId, frameId, x, y)
			if (color && color[3] > 0) {
				pixels.push({ dx: x - x0, dy: y - y0, color })
			}
		}
	}
	return { width: x1 - x0 + 1, height: y1 - y0 + 1, pixels }
}

/** Pastes a previously copied clip so its top-left lands at (atX, atY). */
export function pasteSelectionPixels(
	canvas: PixelCanvas,
	layerId: string,
	frameId: string,
	clip: SelectionClip,
	atX: number,
	atY: number,
): PixelCanvas {
	if (isLayerLocked(canvas, layerId)) return canvas
	const next = cloneCanvas(canvas)
	const frame = next.frames.find((f) => f.id === frameId)
	if (!frame) return next
	for (const px of clip.pixels) {
		setPixelInPlace(next, layerId, frame.id, atX + px.dx, atY + px.dy, px.color)
	}
	return next
}

/** Moves the pixels inside a selection by (dx, dy), clearing their old positions, and returns the updated canvas plus the moved selection bounds. */
export function moveSelectionPixels(
	canvas: PixelCanvas,
	layerId: string,
	frameId: string,
	selection: Selection,
	dx: number,
	dy: number,
): { canvas: PixelCanvas; selection: Selection } {
	if (isLayerLocked(canvas, layerId)) return { canvas, selection }
	const clip = copySelectionPixels(canvas, layerId, frameId, selection)
	const cleared = deleteSelectionPixels(canvas, layerId, frameId, selection)
	const x0 = Math.max(0, Math.floor(selection.x0))
	const y0 = Math.max(0, Math.floor(selection.y0))
	const moved = pasteSelectionPixels(cleared, layerId, frameId, clip, x0 + dx, y0 + dy)
	const movedSelection: Selection = selection.lassoPoints
		? {
				x0: selection.x0 + dx,
				y0: selection.y0 + dy,
				x1: selection.x1 + dx,
				y1: selection.y1 + dy,
				lassoPoints: selection.lassoPoints.map((p) => ({ x: p.x + dx, y: p.y + dy })),
			}
		: {
				x0: selection.x0 + dx,
				y0: selection.y0 + dy,
				x1: selection.x1 + dx,
				y1: selection.y1 + dy,
			}
	return { canvas: moved, selection: movedSelection }
}

export type PaletteTag = "background" | "outline" | "shadow" | "highlight" | "skin"

export const PALETTE_TAGS: PaletteTag[] = ["background", "outline", "shadow", "highlight", "skin"]

/** Assigns a tag to a color index within a palette (one tag per index), returning a new Palette. */
export function tagPaletteColor(palette: Palette, colorIndex: number, tag: PaletteTag): Palette {
	const tags: Record<number, PaletteTag> = { ...(palette.tags ?? {}) }
	tags[colorIndex] = tag
	return { ...palette, tags }
}

/** Removes a tag assignment from a color index (only if it currently matches `tag`), returning a new Palette. */
export function untagPaletteColor(palette: Palette, colorIndex: number, tag: PaletteTag): Palette {
	const tags: Record<number, PaletteTag> = { ...(palette.tags ?? {}) }
	if (tags[colorIndex] === tag) delete tags[colorIndex]
	return { ...palette, tags }
}

// ---------- Palette file parsing ----------

/**
 * Parses a GIMP .gpl palette file. Lines are "R G B [optional name]";
 * header lines ("GIMP Palette", "Name:", "Columns:", "#" comments) are skipped.
 */
export function parseGplPalette(text: string, name = "Imported GPL"): Palette {
	const lines = text.split(/\r?\n/)
	const colors: string[] = []
	for (const rawLine of lines) {
		const line = rawLine.trim()
		if (!line) continue
		if (line.startsWith("GIMP Palette")) continue
		if (line.startsWith("#")) continue
		if (/^Name\s*:/i.test(line)) continue
		if (/^Columns\s*:/i.test(line)) continue
		const match = line.match(/^(\d+)\s+(\d+)\s+(\d+)/)
		if (!match) continue
		const r = Math.min(255, Math.max(0, parseInt(match[1], 10)))
		const g = Math.min(255, Math.max(0, parseInt(match[2], 10)))
		const b = Math.min(255, Math.max(0, parseInt(match[3], 10)))
		colors.push(rgbaToHex(r, g, b))
	}
	return { name, colors }
}

/**
 * Parses a JASC-PAL (Paint Shop Pro) palette file:
 * line 1 "JASC-PAL", line 2 version, line 3 color count, then "R G B" rows.
 */
export function parsePalPalette(text: string, name = "Imported PAL"): Palette {
	const lines = text.split(/\r?\n/).map((l) => l.trim())
	let startIndex = 0
	if (lines[0] === "JASC-PAL") startIndex = 3
	const colors: string[] = []
	for (let i = startIndex; i < lines.length; i++) {
		const line = lines[i]
		if (!line) continue
		const parts = line.split(/\s+/).map(Number)
		if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) continue
		const [r, g, b] = parts
		colors.push(rgbaToHex(r, g, b))
	}
	return { name, colors }
}

/**
 * Parses a plain-text list of hex colors (one per line, or comma/space
 * separated), tolerating a leading "#" and 3, 6, or 8 digit hex codes.
 */
export function parseHexPalette(text: string, name = "Imported Hex"): Palette {
	const tokens = text.split(/[\s,;]+/).filter(Boolean)
	const colors: string[] = []
	const hexPattern = /^#?[0-9a-fA-F]{3}$|^#?[0-9a-fA-F]{6}$|^#?[0-9a-fA-F]{8}$/
	for (const token of tokens) {
		if (!hexPattern.test(token)) continue
		const normalized = token.startsWith("#") ? token : `#${token}`
		const [r, g, b] = hexToRgba(normalized)
		colors.push(rgbaToHex(r, g, b))
	}
	return { name, colors }
}

// ---------- Palette swap ----------

/**
 * Remaps every pixel on the layer/frame from its nearest color in
 * `oldPalette` to the same-index color in `newPalette`, preserving each
 * pixel's original alpha. Pixels with alpha=0 are left untouched.
 * This is a pure function — callers should snapshot the canvas themselves
 * before calling it so a real Cancel can restore the exact prior state
 * (defect #4 fix: do not rely on a generic undo() call for Cancel).
 */
export function paletteSwap(
	canvas: PixelCanvas,
	layerId: string,
	frameId: string,
	oldPalette: Palette,
	newPalette: Palette,
): PixelCanvas {
	if (isLayerLocked(canvas, layerId)) return canvas
	if (oldPalette.colors.length === 0 || newPalette.colors.length === 0) return canvas
	const next = cloneCanvas(canvas)
	const frame = next.frames.find((f) => f.id === frameId)
	if (!frame) return next
	for (let y = 0; y < next.height; y++) {
		for (let x = 0; x < next.width; x++) {
			const px = getPixel(next, layerId, frameId, x, y)
			if (!px || px[3] === 0) continue
			const idx = nearestPaletteIndex(oldPalette, [px[0], px[1], px[2]])
			const newIdx = Math.min(idx, newPalette.colors.length - 1)
			const newRgba = hexToRgba(newPalette.colors[newIdx])
			setPixelInPlace(next, layerId, frame.id, x, y, [newRgba[0], newRgba[1], newRgba[2], px[3]])
		}
	}
	return next
}

/**
 * Snapshot wrapper for palette swap so a UI's Cancel button can restore the
 * exact prior canvas (fixes defect #4, where Cancel previously called a
 * general handleUndo() that could undo an unrelated prior action instead).
 */
export type PaletteSwapSession = {
	beforeCanvas: PixelCanvas
	afterCanvas: PixelCanvas
}

export function beginPaletteSwap(
	canvas: PixelCanvas,
	layerId: string,
	frameId: string,
	oldPalette: Palette,
	newPalette: Palette,
): PaletteSwapSession {
	return {
		beforeCanvas: cloneCanvas(canvas),
		afterCanvas: paletteSwap(canvas, layerId, frameId, oldPalette, newPalette),
	}
}

/** Confirms a palette-swap session, returning the swapped canvas. */
export function commitPaletteSwap(session: PaletteSwapSession): PixelCanvas {
	return session.afterCanvas
}

/** Cancels a palette-swap session, returning the exact canvas from before the swap (defect #4 fix). */
export function cancelPaletteSwap(session: PaletteSwapSession): PixelCanvas {
	return session.beforeCanvas
}

// ---------- Tagged mask (defect #8: wire up all 5 tags) ----------

/**
 * Builds a selection covering every pixel on the layer/frame whose color
 * matches one of the palette colors assigned to the given tag. Works for
 * all 5 PALETTE_TAGS (previously only "background" was wired). Reads
 * `palette.tags` as index -> single tag, matching PART 1's declared shape.
 */
export function applyTaggedMask(
	canvas: PixelCanvas,
	layerId: string,
	frameId: string,
	palette: Palette,
	tag: PaletteTag,
): Selection {
	const taggedIndices = new Set(
		Object.entries(palette.tags ?? {})
			.filter(([, t]) => t === tag)
			.map(([idx]) => Number(idx)),
	)
	const taggedHex = new Set([...taggedIndices].map((i) => palette.colors[i]).filter(Boolean))
	const points: Point[] = []
	let minX = canvas.width
	let minY = canvas.height
	let maxX = 0
	let maxY = 0
	for (let y = 0; y < canvas.height; y++) {
		for (let x = 0; x < canvas.width; x++) {
			const px = getPixel(canvas, layerId, frameId, x, y)
			if (!px || px[3] === 0) continue
			const hex = rgbaToHex(px[0], px[1], px[2])
			if (taggedHex.has(hex)) {
				points.push({ x, y })
				if (x < minX) minX = x
				if (y < minY) minY = y
				if (x > maxX) maxX = x
				if (y > maxY) maxY = y
			}
		}
	}
	if (points.length === 0) return { x0: 0, y0: 0, x1: 0, y1: 0, lassoPoints: [] }
	return { x0: minX, y0: minY, x1: maxX, y1: maxY, lassoPoints: points }
}

/**
 * Precise membership test for a tagged mask's exact pixel set (not just its
 * bounding box), for callers that need per-pixel accuracy rather than the
 * lasso polygon approximation used by isPointInSelection.
 */
export function isPointInTaggedMask(mask: Selection, x: number, y: number): boolean {
	if (!mask.lassoPoints) return false
	return mask.lassoPoints.some((p) => p.x === x && p.y === y)
}

// ---------- Additional palette features ----------

/** Extracts the palette of unique opaque colors actually used on a layer/frame, ordered by first appearance. */
export function extractPaletteFromCanvas(
	canvas: PixelCanvas,
	layerId: string,
	frameId: string,
	name = "Extracted",
	maxColors = 256,
): Palette {
	const seen = new Set<string>()
	const colors: string[] = []
	for (let y = 0; y < canvas.height && colors.length < maxColors; y++) {
		for (let x = 0; x < canvas.width && colors.length < maxColors; x++) {
			const px = getPixel(canvas, layerId, frameId, x, y)
			if (!px || px[3] === 0) continue
			const hex = rgbaToHex(px[0], px[1], px[2])
			if (!seen.has(hex)) {
				seen.add(hex)
				colors.push(hex)
			}
		}
	}
	return { name, colors }
}

function hexToHsl(hex: string): [number, number, number] {
	const [r, g, b] = hexToRgba(hex)
	const rn = r / 255
	const gn = g / 255
	const bn = b / 255
	const max = Math.max(rn, gn, bn)
	const min = Math.min(rn, gn, bn)
	const l = (max + min) / 2
	if (max === min) return [0, 0, l]
	const d = max - min
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
	let h = 0
	if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60
	else if (max === gn) h = ((bn - rn) / d + 2) * 60
	else h = ((rn - gn) / d + 4) * 60
	return [h, s, l]
}

/** Returns a new Palette with colors sorted by hue, then saturation, then lightness (new feature: palette organization). */
export function sortPaletteByHue(palette: Palette): Palette {
	const sorted = palette.colors
		.map((hex) => ({ hex, hsl: hexToHsl(hex) }))
		.sort((a, b) => a.hsl[0] - b.hsl[0] || a.hsl[1] - b.hsl[1] || a.hsl[2] - b.hsl[2])
		.map((c) => c.hex)
	return { ...palette, colors: sorted }
}

export type SpriteSheetImportResult = {
	canvas: PixelCanvas
	warnings: string[]
}

/**
 * Slices a flat RGBA source image into a new PixelCanvas whose frames are the
 * individual sprite cells. If the source dimensions are not an exact
 * multiple of the cell size, the leftover partial row/column is dropped and
 * a warning is returned instead of being silently discarded (defect #6 fix).
 */
export function importSpriteSheet(
	sourceRgba: Uint8ClampedArray,
	sourceWidth: number,
	sourceHeight: number,
	cellWidth: number,
	cellHeight: number,
): SpriteSheetImportResult {
	const warnings: string[] = []
	const cols = Math.floor(sourceWidth / cellWidth)
	const rows = Math.floor(sourceHeight / cellHeight)
	const remainderX = sourceWidth % cellWidth
	const remainderY = sourceHeight % cellHeight
	if (remainderX !== 0) {
		warnings.push(
			`Source width ${sourceWidth}px is not an exact multiple of cell width ${cellWidth}px — the rightmost ${remainderX}px column was dropped.`,
		)
	}
	if (remainderY !== 0) {
		warnings.push(
			`Source height ${sourceHeight}px is not an exact multiple of cell height ${cellHeight}px — the bottom ${remainderY}px row was dropped.`,
		)
	}
	if (cols === 0 || rows === 0) {
		warnings.push("Cell size is larger than the source image — no frames could be extracted.")
		return { canvas: createCanvas(Math.max(1, cellWidth), Math.max(1, cellHeight)), warnings }
	}

	const canvas = createCanvas(cellWidth, cellHeight)
	const layerId = canvas.layers[0].id
	const frames: Frame[] = []
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			const frameId = makeId("frame")
			const data = new Uint8Array(cellWidth * cellHeight * 4)
			for (let y = 0; y < cellHeight; y++) {
				for (let x = 0; x < cellWidth; x++) {
					const srcX = col * cellWidth + x
					const srcY = row * cellHeight + y
					const srcIdx = (srcY * sourceWidth + srcX) * 4
					const dstIdx = (y * cellWidth + x) * 4
					data[dstIdx] = sourceRgba[srcIdx] ?? 0
					data[dstIdx + 1] = sourceRgba[srcIdx + 1] ?? 0
					data[dstIdx + 2] = sourceRgba[srcIdx + 2] ?? 0
					data[dstIdx + 3] = sourceRgba[srcIdx + 3] ?? 0
				}
			}
			frames.push({ id: frameId, delay: 100, layerData: { [layerId]: data } })
		}
	}
	canvas.frames = frames
	canvas.activeFrameId = frames[0].id
	return { canvas, warnings }
}

// ---------- Aseprite JSON export ----------

export type AsepriteFrameTag = { name: string; from: number; to: number; direction: "forward" | "reverse" | "pingpong" }

/** Produces an Aseprite-compatible sprite sheet JSON descriptor for the canvas's frames, including frame tags. */
export function exportAsepriteJson(canvas: PixelCanvas, imageFileName: string): Record<string, unknown> {
	const frames: Record<string, unknown> = {}
	canvas.frames.forEach((frame, i) => {
		frames[`frame_${i}`] = {
			frame: { x: i * canvas.width, y: 0, w: canvas.width, h: canvas.height },
			rotated: false,
			trimmed: false,
			spriteSourceSize: { x: 0, y: 0, w: canvas.width, h: canvas.height },
			sourceSize: { w: canvas.width, h: canvas.height },
			duration: frame.delay,
		}
	})

	const frameTags: AsepriteFrameTag[] = []
	let runStart = -1
	let runTag: string | undefined
	canvas.frames.forEach((frame, i) => {
		if (frame.tag !== runTag) {
			if (runTag) frameTags.push({ name: runTag, from: runStart, to: i - 1, direction: "forward" })
			runTag = frame.tag
			runStart = i
		}
	})
	if (runTag) frameTags.push({ name: runTag, from: runStart, to: canvas.frames.length - 1, direction: "forward" })

	return {
		frames,
		meta: {
			app: "unqtools-pixel-art-maker",
			image: imageFileName,
			format: "RGBA8888",
			size: { w: canvas.width * canvas.frames.length, h: canvas.height },
			scale: "1",
			frameTags,
		},
	}
}

// ---------- Base64 <-> bytes helpers (browser-safe, no Node Buffer) ----------

/** Encodes a Uint8Array as a base64 string using chunked btoa (avoids call-stack limits on large buffers). */
export function bytesToBase64(bytes: Uint8Array): string {
	let binary = ""
	const chunkSize = 0x8000
	for (let i = 0; i < bytes.length; i += chunkSize) {
		const chunk = bytes.subarray(i, i + chunkSize)
		binary += String.fromCharCode(...Array.from(chunk))
	}
	return btoa(binary)
}

/** Decodes a base64 string back into a Uint8Array. */
export function base64ToBytes(base64: string): Uint8Array {
	const binary = atob(base64)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
	return bytes
}

// ---------- Project serialize / deserialize ----------

type SerializedFrame = {
	id: string
	delay: number
	tag?: string
	layerData: Record<string, string> // base64-encoded RGBA bytes
}

/**
 * Serializes a full project into the exact `ProjectFile` shape declared in
 * PART 1 ({ version, canvas, savedAt }), so downstream code that only knows
 * about the PART-1 type still works. Pixel buffers are base64-encoded
 * in-place so the result round-trips cleanly through `JSON.stringify` /
 * `JSON.parse` for file download and IndexedDB storage; `deserializeProject`
 * reverses the encoding transparently. The encoded frames are only
 * shaped like `Frame[]` for the type system's sake between these two
 * functions — nothing else should read a `ProjectFile.canvas.frames` field
 * directly.
 */
export function serializeProject(canvas: PixelCanvas): ProjectFile {
	const encodedFrames: SerializedFrame[] = canvas.frames.map((f) => ({
		id: f.id,
		delay: f.delay,
		tag: f.tag,
		layerData: Object.fromEntries(Object.entries(f.layerData).map(([layerId, data]) => [layerId, bytesToBase64(data)])),
	}))
	return {
		version: 1,
		canvas: { ...canvas, frames: encodedFrames as unknown as Frame[] },
		savedAt: new Date().toISOString(),
	}
}

/** Reconstructs a PixelCanvas from a serialized ProjectFile, decoding base64 pixel buffers back into Uint8Arrays. */
export function deserializeProject(file: ProjectFile): PixelCanvas {
	const encodedFrames = file.canvas.frames as unknown as SerializedFrame[]
	const frames: Frame[] = encodedFrames.map((f) => ({
		id: f.id,
		delay: f.delay,
		tag: f.tag,
		layerData: Object.fromEntries(Object.entries(f.layerData).map(([layerId, b64]) => [layerId, base64ToBytes(b64)])),
	}))
	return { ...file.canvas, frames }
}

// ---------- Diff-based undo history (defects #13/#14 fix) ----------

type PixelDiffEntry = {
	layerId: string
	frameId: string
	x: number
	y: number
	before: [number, number, number, number]
	after: [number, number, number, number]
}

type HistoryEntry =
	| { kind: "pixels"; diffs: PixelDiffEntry[] }
	| { kind: "full"; before: PixelCanvas; after: PixelCanvas }

export type HistoryState = {
	baseCanvas: PixelCanvas
	entries: HistoryEntry[]
	index: number
	max: number
}

export function createHistory(initial: PixelCanvas, max = 50): HistoryState {
	return { baseCanvas: cloneCanvas(initial), entries: [], index: 0, max }
}

function sameStructure(a: PixelCanvas, b: PixelCanvas): boolean {
	if (a.width !== b.width || a.height !== b.height) return false
	if (a.layers.length !== b.layers.length) return false
	if (a.frames.length !== b.frames.length) return false
	for (let i = 0; i < a.layers.length; i++) if (a.layers[i].id !== b.layers[i].id) return false
	for (let i = 0; i < a.frames.length; i++) if (a.frames[i].id !== b.frames[i].id) return false
	return true
}

function diffCanvases(before: PixelCanvas, after: PixelCanvas): HistoryEntry {
	if (!sameStructure(before, after)) {
		return { kind: "full", before: cloneCanvas(before), after: cloneCanvas(after) }
	}
	const diffs: PixelDiffEntry[] = []
	for (const frame of after.frames) {
		const beforeFrame = before.frames.find((f) => f.id === frame.id)
		if (!beforeFrame) continue
		for (const layer of after.layers) {
			const afterData = frame.layerData[layer.id]
			const beforeData = beforeFrame.layerData[layer.id]
			if (!afterData || !beforeData) continue
			const pixelCount = Math.min(afterData.length, beforeData.length) / 4
			for (let i = 0; i < pixelCount; i++) {
				const o = i * 4
				if (
					afterData[o] !== beforeData[o] ||
					afterData[o + 1] !== beforeData[o + 1] ||
					afterData[o + 2] !== beforeData[o + 2] ||
					afterData[o + 3] !== beforeData[o + 3]
				) {
					diffs.push({
						layerId: layer.id,
						frameId: frame.id,
						x: i % after.width,
						y: Math.floor(i / after.width),
						before: [beforeData[o], beforeData[o + 1], beforeData[o + 2], beforeData[o + 3]],
						after: [afterData[o], afterData[o + 1], afterData[o + 2], afterData[o + 3]],
					})
				}
			}
		}
	}
	return { kind: "pixels", diffs }
}

function applyEntryForward(canvas: PixelCanvas, entry: HistoryEntry): PixelCanvas {
	if (entry.kind === "full") return cloneCanvas(entry.after)
	const next = cloneCanvas(canvas)
	for (const d of entry.diffs) {
		const frame = next.frames.find((f) => f.id === d.frameId)
		if (!frame) continue
		setPixelInPlace(next, d.layerId, frame.id, d.x, d.y, d.after)
	}
	return next
}

function applyEntryBackward(canvas: PixelCanvas, entry: HistoryEntry): PixelCanvas {
	if (entry.kind === "full") return cloneCanvas(entry.before)
	const next = cloneCanvas(canvas)
	for (const d of entry.diffs) {
		const frame = next.frames.find((f) => f.id === d.frameId)
		if (!frame) continue
		setPixelInPlace(next, d.layerId, frame.id, d.x, d.y, d.before)
	}
	return next
}

/** Materializes the canvas state at a given history index by replaying diffs forward from the base canvas. */
function materializeAt(history: HistoryState, targetIndex: number): PixelCanvas {
	let canvas = cloneCanvas(history.baseCanvas)
	for (let i = 0; i < targetIndex; i++) {
		canvas = applyEntryForward(canvas, history.entries[i])
	}
	return canvas
}

/**
 * Records a transition from `before` to `after` as a new history entry.
 * Any redo entries beyond the current index are discarded. Stores a compact
 * per-pixel diff instead of a full canvas snapshot whenever possible, so
 * memory usage no longer scales with canvas resolution on every edit
 * (defects #13/#14 fix). When the entry count exceeds `max`, the oldest
 * entry is folded into the base canvas and dropped, keeping the history
 * list itself bounded regardless of how long the session runs.
 */
export function pushHistory(history: HistoryState, before: PixelCanvas, after: PixelCanvas): HistoryState {
	const truncated = history.entries.slice(0, history.index)
	const entry = diffCanvases(before, after)
	let entries = [...truncated, entry]
	let baseCanvas = history.baseCanvas
	let index = history.index + 1
	const max = history.max
	while (entries.length > max) {
		baseCanvas = applyEntryForward(baseCanvas, entries[0])
		entries = entries.slice(1)
		index -= 1
	}
	return { baseCanvas, entries, index, max }
}

/** Steps one entry backward in history, returning the restored canvas, or null if there is nothing to undo. */
export function undo(history: HistoryState): { history: HistoryState; canvas: PixelCanvas } | null {
	if (history.index <= 0) return null
	const newIndex = history.index - 1
	const canvas = materializeAt(history, newIndex)
	return { history: { ...history, index: newIndex }, canvas }
}

/** Steps one entry forward in history (redo), returning the restored canvas, or null if there is nothing to redo. */
export function redo(history: HistoryState): { history: HistoryState; canvas: PixelCanvas } | null {
	if (history.index >= history.entries.length) return null
	const newIndex = history.index + 1
	const canvas = materializeAt(history, newIndex)
	return { history: { ...history, index: newIndex }, canvas }
}

// ---------- Canvas resize / crop / flip / rotate (defects #10, #11) ----------

/**
 * Resizes the canvas in place (anchored top-left) to new dimensions, either
 * cropping (shrinking) or padding with transparent pixels (growing), for
 * every layer of every frame. New feature — no in-place resize previously existed.
 */
export function resizeCanvas(canvas: PixelCanvas, newWidth: number, newHeight: number): PixelCanvas {
	const clampedW = Math.max(1, Math.min(CANVAS_MAX_DIM, Math.round(newWidth)))
	const clampedH = Math.max(1, Math.min(CANVAS_MAX_DIM, Math.round(newHeight)))
	const frames: Frame[] = canvas.frames.map((frame) => {
		const layerData: Record<string, Uint8Array> = {}
		for (const [layerId, data] of Object.entries(frame.layerData)) {
			const newData = new Uint8Array(clampedW * clampedH * 4)
			const copyW = Math.min(canvas.width, clampedW)
			const copyH = Math.min(canvas.height, clampedH)
			for (let y = 0; y < copyH; y++) {
				for (let x = 0; x < copyW; x++) {
					const srcIdx = (y * canvas.width + x) * 4
					const dstIdx = (y * clampedW + x) * 4
					newData[dstIdx] = data[srcIdx]
					newData[dstIdx + 1] = data[srcIdx + 1]
					newData[dstIdx + 2] = data[srcIdx + 2]
					newData[dstIdx + 3] = data[srcIdx + 3]
				}
			}
			layerData[layerId] = newData
		}
		return { ...frame, layerData }
	})
	return { ...canvas, width: clampedW, height: clampedH, frames }
}

/** Crops the canvas to the given rectangle, re-anchoring pixel data to (0,0). New feature (defect #10). */
export function cropCanvas(canvas: PixelCanvas, x0: number, y0: number, x1: number, y1: number): PixelCanvas {
	const cx0 = Math.max(0, Math.min(x0, x1))
	const cy0 = Math.max(0, Math.min(y0, y1))
	const cx1 = Math.min(canvas.width - 1, Math.max(x0, x1))
	const cy1 = Math.min(canvas.height - 1, Math.max(y0, y1))
	const newWidth = Math.max(1, cx1 - cx0 + 1)
	const newHeight = Math.max(1, cy1 - cy0 + 1)
	const frames: Frame[] = canvas.frames.map((frame) => {
		const layerData: Record<string, Uint8Array> = {}
		for (const [layerId, data] of Object.entries(frame.layerData)) {
			const newData = new Uint8Array(newWidth * newHeight * 4)
			for (let y = 0; y < newHeight; y++) {
				for (let x = 0; x < newWidth; x++) {
					const srcIdx = ((cy0 + y) * canvas.width + (cx0 + x)) * 4
					const dstIdx = (y * newWidth + x) * 4
					newData[dstIdx] = data[srcIdx]
					newData[dstIdx + 1] = data[srcIdx + 1]
					newData[dstIdx + 2] = data[srcIdx + 2]
					newData[dstIdx + 3] = data[srcIdx + 3]
				}
			}
			layerData[layerId] = newData
		}
		return { ...frame, layerData }
	})
	return { ...canvas, width: newWidth, height: newHeight, frames }
}

/** Flips every layer of every frame horizontally across the whole canvas (defect #11: previously only per-stroke mirroring existed, no whole-canvas flip). */
export function flipCanvasHorizontal(canvas: PixelCanvas): PixelCanvas {
	let next = cloneCanvas(canvas)
	for (const layer of next.layers) {
		for (const frame of next.frames) {
			const points: Point[] = []
			for (let y = 0; y < next.height; y++) for (let x = 0; x < next.width; x++) points.push({ x, y })
			const mirrored = applyMirrorX(next, layer.id, frame.id)
			next = mirrored
		}
	}
	return next
}

/** Flips every layer of every frame vertically across the whole canvas (defect #11 fix). */
export function flipCanvasVertical(canvas: PixelCanvas): PixelCanvas {
	let next = cloneCanvas(canvas)
	for (const layer of next.layers) {
		for (const frame of next.frames) {
			next = applyMirrorY(next, layer.id, frame.id)
		}
	}
	return next
}

/** Rotates the entire canvas (all layers, all frames) by 90 degrees clockwise, swapping width and height (defect #11 fix). */
export function rotateCanvas90(canvas: PixelCanvas): PixelCanvas {
	const newWidth = canvas.height
	const newHeight = canvas.width
	const frames: Frame[] = canvas.frames.map((frame) => {
		const layerData: Record<string, Uint8Array> = {}
		for (const [layerId, data] of Object.entries(frame.layerData)) {
			const newData = new Uint8Array(newWidth * newHeight * 4)
			for (let y = 0; y < canvas.height; y++) {
				for (let x = 0; x < canvas.width; x++) {
					const srcIdx = (y * canvas.width + x) * 4
					const newX = newWidth - 1 - y
					const newY = x
					const dstIdx = (newY * newWidth + newX) * 4
					newData[dstIdx] = data[srcIdx]
					newData[dstIdx + 1] = data[srcIdx + 1]
					newData[dstIdx + 2] = data[srcIdx + 2]
					newData[dstIdx + 3] = data[srcIdx + 3]
				}
			}
			layerData[layerId] = newData
		}
		return { ...frame, layerData }
	})
	return { ...canvas, width: newWidth, height: newHeight, frames }
}

export type TileVariant = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
// 0=identity, 1=90°CW, 2=180°, 3=270°CW, 4=flipH, 5=flipV, 6=transpose, 7=anti-transpose

export type TileData = {
	width: number
	height: number
	pixels: Array<[number, number, number, number]> // row-major, length = width*height
}

/**
 * Applies one of the 8 dihedral-group (D4) transforms to a full multi-pixel
 * tile, not just a single pixel (defect #1 fix: the original tile-flip brush
 * only ever operated on a 1x1 "tile" so all 8 variants looked identical).
 */
export function transformTile(tile: TileData, variant: TileVariant): TileData {
	const { width: w, height: h, pixels } = tile
	const get = (x: number, y: number) => pixels[y * w + x]
	const rotatedDims = variant === 1 || variant === 3 || variant === 6 || variant === 7 ? { width: h, height: w } : { width: w, height: h }
	const out: Array<[number, number, number, number]> = new Array(rotatedDims.width * rotatedDims.height)

	const set = (x: number, y: number, v: [number, number, number, number]) => {
		out[y * rotatedDims.width + x] = v
	}

	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const v = get(x, y)
			switch (variant) {
				case 0:
					set(x, y, v)
					break
				case 1:
					set(h - 1 - y, x, v)
					break
				case 2:
					set(w - 1 - x, h - 1 - y, v)
					break
				case 3:
					set(y, w - 1 - x, v)
					break
				case 4:
					set(w - 1 - x, y, v)
					break
				case 5:
					set(x, h - 1 - y, v)
					break
				case 6:
					set(y, x, v)
					break
				case 7:
					set(h - 1 - y, w - 1 - x, v)
					break
			}
		}
	}
	return { width: rotatedDims.width, height: rotatedDims.height, pixels: out }
}

/** Captures a rectangular multi-pixel tile from the canvas for later transform/stamp. */
export function captureTile(canvas: PixelCanvas, layerId: string, frameId: string, x0: number, y0: number, width: number, height: number): TileData {
	const pixels: Array<[number, number, number, number]> = []
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			pixels.push(getPixel(canvas, layerId, frameId, x0 + x, y0 + y) ?? [0, 0, 0, 0])
		}
	}
	return { width, height, pixels }
}

/** Stamps a (possibly transformed) multi-pixel tile onto the canvas at (x,y), skipping fully transparent source pixels so surrounding art is preserved. */
export function stampTile(canvas: PixelCanvas, layerId: string, frameId: string, tile: TileData, x: number, y: number): PixelCanvas {
	if (isLayerLockedExported(canvas, layerId)) return canvas
	const next = cloneCanvas(canvas)
	const frame = next.frames.find((f) => f.id === frameId)
	if (!frame) return next
	for (let ty = 0; ty < tile.height; ty++) {
		for (let tx = 0; tx < tile.width; tx++) {
			const color = tile.pixels[ty * tile.width + tx]
			if (!color || color[3] === 0) continue
			setPixelInPlace(next, layerId, frame.id, x + tx, y + ty, color)
		}
	}
	return next
}

// Local re-implementation of the PART-1 private lock check (that one is not
// exported across parts by design outside the same module scope boundary in
// isolation, but since all parts concatenate into one module we can call it
// directly; kept as a thin wrapper name here for readability in this part).
function isLayerLockedExported(canvas: PixelCanvas, layerId: string): boolean {
	const layer = canvas.layers.find((l) => l.id === layerId)
	return layer ? layer.locked : false
}

// ---------- Dithering (defect #5 fix: real pattern selector, not hardcoded) ----------

const BAYER_2 = [
	[0, 2],
	[3, 1],
]
const BAYER_4 = [
	[0, 8, 2, 10],
	[12, 4, 14, 6],
	[3, 11, 1, 9],
	[15, 7, 13, 5],
]

export type DitherPattern = "checker" | "bayer2" | "bayer4"

/**
 * Returns whether pixel (x,y) should be "lit" for the given dither pattern
 * and threshold (0..1). Previously the tool always used bayer2 at a fixed
 * 0.5 threshold regardless of the UI's pattern selector (defect #5 fix).
 */
export function ditherAt(x: number, y: number, pattern: DitherPattern, threshold: number): boolean {
	const t = Math.min(1, Math.max(0, threshold))
	if (pattern === "checker") {
		return (x + y) % 2 === 0 ? t > 0 : t > 0.999
	}
	if (pattern === "bayer2") {
		const v = BAYER_2[y % 2][x % 2] / 4
		return v < t
	}
	const v = BAYER_4[y % 4][x % 4] / 16
	return v < t
}

// ---------- New brushes ----------

/** Stamps a boolean pattern mask (e.g. a dither or texture stencil) onto the canvas centered at (cx,cy) using a single color. */
export function patternBrush(
	canvas: PixelCanvas,
	layerId: string,
	frameId: string,
	cx: number,
	cy: number,
	pattern: boolean[][],
	color: [number, number, number, number],
): PixelCanvas {
	if (isLayerLockedExported(canvas, layerId)) return canvas
	const next = cloneCanvas(canvas)
	const frame = next.frames.find((f) => f.id === frameId)
	if (!frame) return next
	const h = pattern.length
	const w = h > 0 ? pattern[0].length : 0
	const offsetX = Math.floor(w / 2)
	const offsetY = Math.floor(h / 2)
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (!pattern[y][x]) continue
			setPixelInPlace(next, layerId, frame.id, cx - offsetX + x, cy - offsetY + y, color)
		}
	}
	return next
}

function lerpColor(a: [number, number, number, number], b: [number, number, number, number], t: number): [number, number, number, number] {
	return [
		Math.round(a[0] + (b[0] - a[0]) * t),
		Math.round(a[1] + (b[1] - a[1]) * t),
		Math.round(a[2] + (b[2] - a[2]) * t),
		Math.round(a[3] + (b[3] - a[3]) * t),
	]
}

/** Draws a line whose color interpolates from colorA at the start point to colorB at the end point. */
export function gradientBrush(
	canvas: PixelCanvas,
	layerId: string,
	frameId: string,
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	colorA: [number, number, number, number],
	colorB: [number, number, number, number],
): PixelCanvas {
	if (isLayerLockedExported(canvas, layerId)) return canvas
	const next = cloneCanvas(canvas)
	const frame = next.frames.find((f) => f.id === frameId)
	if (!frame) return next
	const points = bresenhamLine(x0, y0, x1, y1)
	const n = Math.max(1, points.length - 1)
	points.forEach((p, i) => {
		const t = i / n
		setPixelInPlace(next, layerId, frame.id, p.x, p.y, lerpColor(colorA, colorB, t))
	})
	return next
}

/** Seeded PRNG (mulberry32) so scatter-brush results are reproducible per D12 (seeded randomness required for any tool feature involving randomness). */
export function createSeededRandom(seed: number): () => number {
	let a = seed >>> 0
	return function next() {
		a |= 0
		a = (a + 0x6d2b79f5) | 0
		let t = Math.imul(a ^ (a >>> 15), 1 | a)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

/** Scatters colored dots randomly within a radius of (cx,cy) at the given density (0..1), using a seeded RNG for reproducible strokes. */
export function scatterBrush(
	canvas: PixelCanvas,
	layerId: string,
	frameId: string,
	cx: number,
	cy: number,
	radius: number,
	density: number,
	color: [number, number, number, number],
	seed: number,
): PixelCanvas {
	if (isLayerLockedExported(canvas, layerId)) return canvas
	const next = cloneCanvas(canvas)
	const frame = next.frames.find((f) => f.id === frameId)
	if (!frame) return next
	const rng = createSeededRandom(seed)
	const area = Math.PI * radius * radius
	const dotCount = Math.max(1, Math.round(area * Math.min(1, Math.max(0, density))))
	for (let i = 0; i < dotCount; i++) {
		const angle = rng() * Math.PI * 2
		const dist = Math.sqrt(rng()) * radius
		const x = Math.round(cx + Math.cos(angle) * dist)
		const y = Math.round(cy + Math.sin(angle) * dist)
		setPixelInPlace(next, layerId, frame.id, x, y, color)
	}
	return next
}

/** Repaints only pixels matching the color under the brush center (within tolerance) as the stroke moves — a "recolor as you drag" tool. */
export function colorReplaceBrush(
	canvas: PixelCanvas,
	layerId: string,
	frameId: string,
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	newColor: [number, number, number, number],
	tolerance: number,
	brushSize = 1,
): PixelCanvas {
	if (isLayerLockedExported(canvas, layerId)) return canvas
	const next = cloneCanvas(canvas)
	const frame = next.frames.find((f) => f.id === frameId)
	if (!frame) return next
	const target = getPixel(next, layerId, frameId, x0, y0)
	if (!target) return next
	const points = bresenhamLine(x0, y0, x1, y1)
	const half = Math.floor(brushSize / 2)
	for (const p of points) {
		for (let oy = 0; oy < brushSize; oy++) {
			for (let ox = 0; ox < brushSize; ox++) {
				const px = p.x - half + ox
				const py = p.y - half + oy
				const current = getPixel(next, layerId, frameId, px, py)
				if (current && colorDistance([current[0], current[1], current[2]], [target[0], target[1], target[2]]) <= tolerance) {
					setPixelInPlace(next, layerId, frame.id, px, py, newColor)
				}
			}
		}
	}
	return next
}

// ---------- Export progress / cancellation ----------

export class ExportCancelledError extends Error {
	constructor() {
		super("Export was cancelled")
		this.name = "ExportCancelledError"
	}
}

export type ExportOptions = {
	onProgress?: (fraction: number) => void
	signal?: AbortSignal
}

function checkCancelled(signal?: AbortSignal): void {
	if (signal?.aborted) throw new ExportCancelledError()
}

function upscaleRgba(data: Uint8Array | Uint8ClampedArray, width: number, height: number, scale: number): Uint8Array {
	if (scale <= 1) return new Uint8Array(data)
	const outW = width * scale
	const outH = height * scale
	const out = new Uint8Array(outW * outH * 4)
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const srcIdx = (y * width + x) * 4
			for (let sy = 0; sy < scale; sy++) {
				for (let sx = 0; sx < scale; sx++) {
					const dstX = x * scale + sx
					const dstY = y * scale + sy
					const dstIdx = (dstY * outW + dstX) * 4
					out[dstIdx] = data[srcIdx]
					out[dstIdx + 1] = data[srcIdx + 1]
					out[dstIdx + 2] = data[srcIdx + 2]
					out[dstIdx + 3] = data[srcIdx + 3]
				}
			}
		}
	}
	return out
}

// ---------- PNG / GIF / APNG / sprite-sheet / bundle export (defect #15: progress + cancel) ----------

/** Exports a single frame as a PNG, optionally upscaled for visibility (pixel art is tiny by default). */
export async function exportPng(canvas: PixelCanvas, frameId: string, scale = 1, options: ExportOptions = {}): Promise<Uint8Array> {
	checkCancelled(options.signal)
	const rgba = compositeFrameRgba(canvas, frameId)
	const scaled = upscaleRgba(rgba, canvas.width, canvas.height, scale)
	options.onProgress?.(0.5)
	checkCancelled(options.signal)
	const png = UPNG.encode([scaled.buffer], canvas.width * scale, canvas.height * scale, 0)
	options.onProgress?.(1)
	return new Uint8Array(png)
}

/** Exports all frames as an animated GIF, reporting progress per frame and honoring cancellation. */
export async function exportGif(canvas: PixelCanvas, scale = 1, options: ExportOptions = {}): Promise<Uint8Array> {
	const gif = GIFEncoder()
	const total = canvas.frames.length
	for (let i = 0; i < total; i++) {
		checkCancelled(options.signal)
		const frame = canvas.frames[i]
		const rgba = compositeFrameRgba(canvas, frame.id)
		const scaled = upscaleRgba(rgba, canvas.width, canvas.height, scale)
		const w = canvas.width * scale
		const h = canvas.height * scale
		const palette = quantize(scaled, 256)
		const indexed = applyPalette(scaled, palette)
		gif.writeFrame(indexed, w, h, { palette, delay: frame.delay, transparent: true })
		options.onProgress?.((i + 1) / total)
	}
	gif.finish()
	return gif.bytes()
}

/** Exports all frames as an animated PNG (APNG), preserving per-frame delays. */
export async function exportApng(canvas: PixelCanvas, scale = 1, options: ExportOptions = {}): Promise<Uint8Array> {
	const buffers: ArrayBuffer[] = []
	const delays: number[] = []
	const total = canvas.frames.length
	for (let i = 0; i < total; i++) {
		checkCancelled(options.signal)
		const frame = canvas.frames[i]
		const rgba = compositeFrameRgba(canvas, frame.id)
		const scaled = upscaleRgba(rgba, canvas.width, canvas.height, scale)
		buffers.push(scaled.buffer)
		delays.push(frame.delay)
		options.onProgress?.(((i + 1) / total) * 0.9)
	}
	checkCancelled(options.signal)
	const apng = UPNG.encode(buffers, canvas.width * scale, canvas.height * scale, 0, delays)
	options.onProgress?.(1)
	return new Uint8Array(apng)
}

/** Composites all frames into a single horizontal sprite-sheet PNG. */
export async function exportSpriteSheet(canvas: PixelCanvas, scale = 1, options: ExportOptions = {}): Promise<Uint8Array> {
	const frameW = canvas.width * scale
	const frameH = canvas.height * scale
	const total = canvas.frames.length
	const sheet = new Uint8Array(frameW * total * frameH * 4)
	for (let i = 0; i < total; i++) {
		checkCancelled(options.signal)
		const frame = canvas.frames[i]
		const rgba = compositeFrameRgba(canvas, frame.id)
		const scaled = upscaleRgba(rgba, canvas.width, canvas.height, scale)
		for (let y = 0; y < frameH; y++) {
			for (let x = 0; x < frameW; x++) {
				const srcIdx = (y * frameW + x) * 4
				const dstX = i * frameW + x
				const dstIdx = (y * frameW * total + dstX) * 4
				sheet[dstIdx] = scaled[srcIdx]
				sheet[dstIdx + 1] = scaled[srcIdx + 1]
				sheet[dstIdx + 2] = scaled[srcIdx + 2]
				sheet[dstIdx + 3] = scaled[srcIdx + 3]
			}
		}
		options.onProgress?.(((i + 1) / total) * 0.9)
	}
	checkCancelled(options.signal)
	const png = UPNG.encode([sheet.buffer], frameW * total, frameH, 0)
	options.onProgress?.(1)
	return new Uint8Array(png)
}

/** Bundles every frame as an individual PNG plus the Aseprite JSON descriptor and palette into a single ZIP. Palette is read from canvas.palette — no separate argument needed. */
export async function exportSheetBundle(canvas: PixelCanvas, scale = 1, options: ExportOptions = {}): Promise<Uint8Array> {
	const zip = new JSZip()
	const total = canvas.frames.length
	for (let i = 0; i < total; i++) {
		checkCancelled(options.signal)
		const frame = canvas.frames[i]
		const png = await exportPng(canvas, frame.id, scale)
		zip.file(`frame_${String(i).padStart(3, "0")}.png`, png)
		options.onProgress?.(((i + 1) / total) * 0.8)
	}
	checkCancelled(options.signal)
	const asepriteJson = exportAsepriteJson(canvas, "sheet.png")
	zip.file("sheet.json", JSON.stringify(asepriteJson, null, 2))
	zip.file("palette.txt", canvas.palette.colors.join("\n"))
	options.onProgress?.(0.9)
	const content = await zip.generateAsync({ type: "uint8array" })
	options.onProgress?.(1)
	return content
}

// ---------- Autosave (IndexedDB) ----------

const AUTOSAVE_DB = "pixel-art-maker-autosave"
const AUTOSAVE_STORE = "projects"
const AUTOSAVE_KEY = "current"

let autosaveDbPromise: Promise<IDBPDatabase> | null = null

function openAutosaveDb(): Promise<IDBPDatabase> {
	if (!autosaveDbPromise) {
		autosaveDbPromise = openDB(AUTOSAVE_DB, 1, {
			upgrade(db) {
				if (!db.objectStoreNames.contains(AUTOSAVE_STORE)) {
					db.createObjectStore(AUTOSAVE_STORE)
				}
			},
		})
	}
	return autosaveDbPromise
}

/** Persists the current project to IndexedDB for crash/reload recovery, using the corrected PART-1-shape ProjectFile. Never called automatically in a way that overwrites user intent without their edits driving it (D10: drafts/history never auto-applied on load). */
export async function autosaveProject(canvas: PixelCanvas): Promise<void> {
	const db = await openAutosaveDb()
	const file = serializeProject(canvas)
	await db.put(AUTOSAVE_STORE, file, AUTOSAVE_KEY)
}

/** Loads the last autosaved project, if any, as a plain PixelCanvas. The caller decides whether to offer it to the user — it is never applied automatically. */
export async function loadAutosave(): Promise<PixelCanvas | null> {
	const db = await openAutosaveDb()
	const file = (await db.get(AUTOSAVE_STORE, AUTOSAVE_KEY)) as ProjectFile | undefined
	if (!file) return null
	return deserializeProject(file)
}

/** Clears the autosave record (e.g. after the user explicitly saves/exports a final project). */
export async function clearAutosave(): Promise<void> {
	const db = await openAutosaveDb()
	await db.delete(AUTOSAVE_STORE, AUTOSAVE_KEY)
}
