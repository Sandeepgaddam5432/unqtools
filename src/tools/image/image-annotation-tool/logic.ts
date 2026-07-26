/**
 * Image Annotation Tool — pure logic.
 * Defines annotation types, positioning, color/size, layer order. Pure functions
 * operate on annotation state; rendering is left to UI/canvas.
 */

export type AnnotationType = "arrow" | "text" | "rect" | "ellipse" | "line" | "freehand" | "highlight" | "blur" | "sticker";

export interface BaseAnnotation {
  id: string;
  type: AnnotationType;
  x: number;
  y: number;
  color: string;
  strokeWidth: number;
  opacity: number;
  rotation?: number;
}

export interface ArrowAnnotation extends BaseAnnotation {
  type: "arrow";
  x2: number;
  y2: number;
  headSize: number;
  headStyle: "filled" | "line";
}

export interface TextAnnotation extends BaseAnnotation {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  align: "left" | "center" | "right";
  background?: string;
  padding?: number;
}

export interface RectAnnotation extends BaseAnnotation {
  type: "rect";
  width: number;
  height: number;
  fill?: string;
  dashed?: boolean;
}

export interface EllipseAnnotation extends BaseAnnotation {
  type: "ellipse";
  rx: number;
  ry: number;
  fill?: string;
}

export interface LineAnnotation extends BaseAnnotation {
  type: "line";
  x2: number;
  y2: number;
  dashed?: boolean;
}

export interface FreehandAnnotation extends BaseAnnotation {
  type: "freehand";
  points: { x: number; y: number }[];
}

export interface HighlightAnnotation extends BaseAnnotation {
  type: "highlight";
  width: number;
  height: number;
}

export interface BlurAnnotation extends BaseAnnotation {
  type: "blur";
  width: number;
  height: number;
  blurRadius: number;
}

export interface StickerAnnotation extends BaseAnnotation {
  type: "sticker";
  emoji: string;
  size: number;
}

export type Annotation =
  | ArrowAnnotation
  | TextAnnotation
  | RectAnnotation
  | EllipseAnnotation
  | LineAnnotation
  | FreehandAnnotation
  | HighlightAnnotation
  | BlurAnnotation
  | StickerAnnotation;

let idCounter = 0;
/** Generate a unique annotation ID. */
export function newId(): string {
  idCounter++;
  return `ann-${Date.now()}-${idCounter}`;
}

/** Create a new annotation with default values. */
export function createAnnotation(type: AnnotationType, x: number, y: number, partial: Partial<Annotation> = {}): Annotation {
  const base = {
    id: newId(),
    type,
    x,
    y,
    color: "#ef4444",
    strokeWidth: 2,
    opacity: 1,
    ...partial,
  } as Annotation;
  switch (type) {
    case "arrow":
      return { ...base, x2: x + 100, y2: y + 50, headSize: 12, headStyle: "filled" } as ArrowAnnotation;
    case "text":
      return { ...base, text: "Label", fontSize: 18, fontFamily: "sans-serif", fontWeight: "normal", fontStyle: "normal", align: "left" } as TextAnnotation;
    case "rect":
      return { ...base, width: 200, height: 100 } as RectAnnotation;
    case "ellipse":
      return { ...base, rx: 100, ry: 60 } as EllipseAnnotation;
    case "line":
      return { ...base, x2: x + 100, y2: y + 50 } as LineAnnotation;
    case "freehand":
      return { ...base, points: [{ x, y }] } as FreehandAnnotation;
    case "highlight":
      return { ...base, width: 200, height: 30, color: "#fde047", opacity: 0.5 } as HighlightAnnotation;
    case "blur":
      return { ...base, width: 100, height: 100, blurRadius: 10 } as BlurAnnotation;
    case "sticker":
      return { ...base, emoji: "⭐", size: 48 } as StickerAnnotation;
  }
}

/** Move an annotation by (dx, dy). */
export function moveAnnotation(ann: Annotation, dx: number, dy: number): Annotation {
  const moved = { ...ann, x: ann.x + dx, y: ann.y + dy } as Annotation;
  if (moved.type === "arrow" || moved.type === "line") {
    (moved as ArrowAnnotation).x2 += dx;
    (moved as ArrowAnnotation).y2 += dy;
  }
  if (moved.type === "freehand") {
    (moved as FreehandAnnotation).points = (moved as FreehandAnnotation).points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  }
  return moved;
}

/** Resize an annotation by a scale factor (centered on its position). */
export function resizeAnnotation(ann: Annotation, scale: number): Annotation {
  const r = { ...ann } as Annotation;
  r.strokeWidth = Math.max(0.5, (r.strokeWidth || 1) * scale);
  switch (r.type) {
    case "arrow":
    case "line":
      (r as ArrowAnnotation).x2 = r.x + ((r as ArrowAnnotation).x2 - r.x) * scale;
      (r as ArrowAnnotation).y2 = r.y + ((r as ArrowAnnotation).y2 - r.y) * scale;
      if (r.type === "arrow") (r as ArrowAnnotation).headSize *= scale;
      break;
    case "rect":
    case "highlight":
    case "blur":
      (r as RectAnnotation).width *= scale;
      (r as RectAnnotation).height *= scale;
      break;
    case "ellipse":
      (r as EllipseAnnotation).rx *= scale;
      (r as EllipseAnnotation).ry *= scale;
      break;
    case "text":
      (r as TextAnnotation).fontSize *= scale;
      break;
    case "sticker":
      (r as StickerAnnotation).size *= scale;
      break;
    case "freehand":
      (r as FreehandAnnotation).points = (r as FreehandAnnotation).points.map((p) => ({
        x: r.x + (p.x - r.x) * scale,
        y: r.y + (p.y - r.y) * scale,
      }));
      break;
  }
  return r;
}

/** Rotate an annotation around its center by degrees. */
export function rotateAnnotation(ann: Annotation, degrees: number): Annotation {
  return { ...ann, rotation: ((ann.rotation ?? 0) + degrees) % 360 } as Annotation;
}

/** Bring annotation to front of layer order. Pure: does not mutate input. */
export function bringToFront(annotations: Annotation[], id: string): Annotation[] {
  const idx = annotations.findIndex((a) => a.id === id);
  if (idx === -1) return annotations;
  const removed = annotations[idx];
  const rest = annotations.filter((a) => a.id !== id);
  return [...rest, removed];
}

/** Send annotation to back. Pure: does not mutate input. */
export function sendToBack(annotations: Annotation[], id: string): Annotation[] {
  const idx = annotations.findIndex((a) => a.id === id);
  if (idx === -1) return annotations;
  const removed = annotations[idx];
  const rest = annotations.filter((a) => a.id !== id);
  return [removed, ...rest];
}

/** Reorder annotations (move by delta in z-index). Pure: does not mutate input. */
export function reorder(annotations: Annotation[], id: string, delta: number): Annotation[] {
  const idx = annotations.findIndex((a) => a.id === id);
  if (idx === -1) return annotations;
  const newIdx = Math.max(0, Math.min(annotations.length - 1, idx + delta));
  const copy = [...annotations];
  const [removed] = copy.splice(idx, 1);
  copy.splice(newIdx, 0, removed);
  return copy;
}

/** Hit-test: is point (px, py) inside the annotation's bounding box? */
export function hitTest(ann: Annotation, px: number, py: number): boolean {
  switch (ann.type) {
    case "rect":
    case "highlight":
    case "blur": {
      const r = ann as RectAnnotation;
      return px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height;
    }
    case "ellipse": {
      const e = ann as EllipseAnnotation;
      const cx = e.x + e.rx;
      const cy = e.y + e.ry;
      const dx = (px - cx) / e.rx;
      const dy = (py - cy) / e.ry;
      return dx * dx + dy * dy <= 1;
    }
    case "text": {
      const t = ann as TextAnnotation;
      const width = (t.text.length * t.fontSize) / 1.8;
      return px >= t.x && px <= t.x + width && py >= t.y - t.fontSize && py <= t.y + t.fontSize / 2;
    }
    case "sticker": {
      const s = ann as StickerAnnotation;
      return px >= s.x && px <= s.x + s.size && py >= s.y && py <= s.y + s.size;
    }
    default: {
      // Bounding box of points / endpoints
      return px >= ann.x - 10 && px <= ann.x + 60 && py >= ann.y - 10 && py <= ann.y + 60;
    }
  }
}

/** Compute bounding box of an annotation. */
export function boundingBox(ann: Annotation): { x: number; y: number; width: number; height: number } {
  switch (ann.type) {
    case "rect":
    case "highlight":
    case "blur":
      return { x: ann.x, y: ann.y, width: (ann as RectAnnotation).width, height: (ann as RectAnnotation).height };
    case "ellipse": {
      const e = ann as EllipseAnnotation;
      return { x: e.x, y: e.y, width: e.rx * 2, height: e.ry * 2 };
    }
    case "arrow":
    case "line": {
      const a = ann as ArrowAnnotation;
      return {
        x: Math.min(a.x, a.x2),
        y: Math.min(a.y, a.y2),
        width: Math.abs(a.x2 - a.x),
        height: Math.abs(a.y2 - a.y),
      };
    }
    case "freehand": {
      const f = ann as FreehandAnnotation;
      const xs = f.points.map((p) => p.x);
      const ys = f.points.map((p) => p.y);
      return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      };
    }
    case "text": {
      const t = ann as TextAnnotation;
      return { x: t.x, y: t.y - t.fontSize, width: (t.text.length * t.fontSize) / 1.8, height: t.fontSize * 1.2 };
    }
    case "sticker": {
      const s = ann as StickerAnnotation;
      return { x: s.x, y: s.y, width: s.size, height: s.size };
    }
  }
}

/** Group multiple annotations into a single named group. */
export function groupAnnotations(annotations: Annotation[], ids: string[], groupId: string): Annotation[] {
  return annotations.map((a) => (ids.includes(a.id) ? ({ ...a, groupId } as Annotation) : a));
}

/** Snap a coordinate to a grid. */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/** Color palette presets. */
export const COLOR_PALETTES: { name: string; colors: string[] }[] = [
  { name: "Vibrant", colors: ["#ef4444", "#f97316", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"] },
  { name: "Pastel", colors: ["#fecaca", "#fed7aa", "#fef08a", "#bbf7d0", "#bfdbfe", "#ddd6fe", "#fbcfe8"] },
  { name: "Mono", colors: ["#000000", "#374151", "#6b7280", "#9ca3af", "#d1d5db", "#e5e7eb", "#ffffff"] },
  { name: "Highlight", colors: ["#fde047", "#fef08a", "#fbbf24", "#f97316", "#ef4444"] },
];

/** Serialize annotations to JSON. */
export function serialize(annotations: Annotation[]): string {
  return JSON.stringify({ version: 1, annotations }, null, 2);
}

/** Deserialize JSON back to annotations. */
export function deserialize(json: string): Annotation[] {
  const parsed = JSON.parse(json);
  return parsed.annotations ?? parsed;
}

/** Validate annotation. */
export function validateAnnotation(ann: Annotation): string[] {
  const errs: string[] = [];
  if (!ann.id) errs.push("Missing id");
  if (ann.opacity < 0 || ann.opacity > 1) errs.push("Opacity must be 0-1");
  if (ann.strokeWidth < 0) errs.push("Stroke width cannot be negative");
  if (ann.type === "text" && !(ann as TextAnnotation).text) errs.push("Text annotation requires text");
  if ((ann.type === "rect" || ann.type === "highlight" || ann.type === "blur") && (ann as RectAnnotation).width <= 0) {
    errs.push("Width must be positive");
  }
  return errs;
}

/** Count annotations by type. */
export function countByType(annotations: Annotation[]): Record<AnnotationType, number> {
  const counts: Record<string, number> = {};
  for (const a of annotations) counts[a.type] = (counts[a.type] ?? 0) + 1;
  return counts as Record<AnnotationType, number>;
}

/** Export annotations as SVG overlay (for compositing). */
export function toSvgOverlay(annotations: Annotation[], width: number, height: number): string {
  const shapes = annotations.map((a) => {
    const opacity = a.opacity;
    const stroke = a.color;
    const sw = a.strokeWidth;
    switch (a.type) {
      case "rect":
        return `<rect x="${a.x}" y="${a.y}" width="${(a as RectAnnotation).width}" height="${(a as RectAnnotation).height}" fill="${(a as RectAnnotation).fill ?? "none"}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}" />`;
      case "ellipse": {
        const e = a as EllipseAnnotation;
        return `<ellipse cx="${e.x + e.rx}" cy="${e.y + e.ry}" rx="${e.rx}" ry="${e.ry}" fill="${e.fill ?? "none"}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}" />`;
      }
      case "line":
        return `<line x1="${a.x}" y1="${a.y}" x2="${(a as LineAnnotation).x2}" y2="${(a as LineAnnotation).y2}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}" />`;
      case "arrow": {
        const ar = a as ArrowAnnotation;
        return `<line x1="${ar.x}" y1="${ar.y}" x2="${ar.x2}" y2="${ar.y2}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}" /><polygon points="${ar.x2},${ar.y2} ${ar.x2 - ar.headSize},${ar.y2 - ar.headSize / 2} ${ar.x2 - ar.headSize},${ar.y2 + ar.headSize / 2}" fill="${stroke}" opacity="${opacity}" />`;
      }
      case "text": {
        const t = a as TextAnnotation;
        return `<text x="${t.x}" y="${t.y}" font-size="${t.fontSize}" font-family="${t.fontFamily}" font-weight="${t.fontWeight}" fill="${stroke}" opacity="${opacity}">${escapeXml(t.text)}</text>`;
      }
      case "sticker": {
        const s = a as StickerAnnotation;
        return `<text x="${s.x}" y="${s.y + s.size}" font-size="${s.size}" opacity="${opacity}">${s.emoji}</text>`;
      }
      case "freehand": {
        const f = a as FreehandAnnotation;
        const d = f.points.map((p) => `${p.x},${p.y}`).join(" ");
        return `<polyline points="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}" />`;
      }
      case "highlight":
        return `<rect x="${a.x}" y="${a.y}" width="${(a as HighlightAnnotation).width}" height="${(a as HighlightAnnotation).height}" fill="${stroke}" opacity="${opacity}" />`;
      case "blur":
        return `<rect x="${a.x}" y="${a.y}" width="${(a as BlurAnnotation).width}" height="${(a as BlurAnnotation).height}" fill="rgba(128,128,128,0.4)" opacity="${opacity}" />`;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${shapes.join("")}</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] ?? c);
}
