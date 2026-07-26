import { describe, it, expect } from "vitest";
import {
  newId,
  createAnnotation,
  moveAnnotation,
  resizeAnnotation,
  rotateAnnotation,
  bringToFront,
  sendToBack,
  reorder,
  hitTest,
  boundingBox,
  snapToGrid,
  serialize,
  deserialize,
  validateAnnotation,
  countByType,
  toSvgOverlay,
  COLOR_PALETTES,
  type Annotation,
} from "./logic";

describe("newId", () => {
  it("generates unique IDs", () => {
    const a = newId();
    const b = newId();
    expect(a).not.toBe(b);
  });
});

describe("createAnnotation", () => {
  it("creates arrow with default head", () => {
    const a = createAnnotation("arrow", 10, 20) as any;
    expect(a.type).toBe("arrow");
    expect(a.x).toBe(10);
    expect(a.headSize).toBeGreaterThan(0);
  });
  it("creates text with default text", () => {
    const a = createAnnotation("text", 0, 0) as any;
    expect(a.text).toBe("Label");
    expect(a.fontSize).toBeGreaterThan(0);
  });
  it("creates rect with dimensions", () => {
    const a = createAnnotation("rect", 0, 0) as any;
    expect(a.width).toBeGreaterThan(0);
    expect(a.height).toBeGreaterThan(0);
  });
  it("creates sticker with emoji", () => {
    const a = createAnnotation("sticker", 0, 0) as any;
    expect(a.emoji).toBeTruthy();
  });
  it("applies partial overrides", () => {
    const a = createAnnotation("rect", 0, 0, { color: "#ff0000", strokeWidth: 5 }) as any;
    expect(a.color).toBe("#ff0000");
    expect(a.strokeWidth).toBe(5);
  });
});

describe("moveAnnotation", () => {
  it("moves rect by dx, dy", () => {
    const a = createAnnotation("rect", 10, 20);
    const moved = moveAnnotation(a, 5, -5);
    expect(moved.x).toBe(15);
    expect(moved.y).toBe(15);
  });
  it("moves arrow endpoints", () => {
    const a = createAnnotation("arrow", 10, 10) as any;
    const moved = moveAnnotation(a, 5, 5) as any;
    expect(moved.x2).toBe(a.x2 + 5);
    expect(moved.y2).toBe(a.y2 + 5);
  });
  it("moves freehand points", () => {
    const a = createAnnotation("freehand", 0, 0) as any;
    a.points = [{ x: 10, y: 10 }, { x: 20, y: 20 }];
    const moved = moveAnnotation(a, 5, 5) as any;
    expect(moved.points[0]).toEqual({ x: 15, y: 15 });
  });
});

describe("resizeAnnotation", () => {
  it("scales rect dimensions", () => {
    const a = createAnnotation("rect", 0, 0) as any;
    const r = resizeAnnotation(a, 2) as any;
    expect(r.width).toBe(a.width * 2);
    expect(r.height).toBe(a.height * 2);
  });
  it("scales text fontSize", () => {
    const a = createAnnotation("text", 0, 0) as any;
    const r = resizeAnnotation(a, 2) as any;
    expect(r.fontSize).toBe(a.fontSize * 2);
  });
  it("scales arrow head", () => {
    const a = createAnnotation("arrow", 0, 0) as any;
    const r = resizeAnnotation(a, 2) as any;
    expect(r.headSize).toBe(a.headSize * 2);
  });
});

describe("rotateAnnotation", () => {
  it("adds rotation", () => {
    const a = createAnnotation("rect", 0, 0);
    const r = rotateAnnotation(a, 45);
    expect(r.rotation).toBe(45);
  });
  it("accumulates rotation mod 360", () => {
    const a = createAnnotation("rect", 0, 0);
    const r = rotateAnnotation(rotateAnnotation(a, 200), 200);
    expect(r.rotation).toBe(40);
  });
});

describe("layer order", () => {
  it("bringToFront moves annotation to end", () => {
    const anns = [createAnnotation("rect", 0, 0), createAnnotation("rect", 10, 10), createAnnotation("rect", 20, 20)];
    const moved = bringToFront(anns, anns[0].id);
    expect(moved[moved.length - 1].id).toBe(anns[0].id);
  });
  it("sendToBack moves annotation to start", () => {
    const anns = [createAnnotation("rect", 0, 0), createAnnotation("rect", 10, 10), createAnnotation("rect", 20, 20)];
    const moved = sendToBack(anns, anns[2].id);
    expect(moved[0].id).toBe(anns[2].id);
  });
  it("reorder by +1 swaps position", () => {
    const anns = [createAnnotation("rect", 0, 0), createAnnotation("rect", 10, 10)];
    const moved = reorder(anns, anns[0].id, 1);
    expect(moved[0].id).toBe(anns[1].id);
  });
  it("reorder clamps to bounds", () => {
    const anns = [createAnnotation("rect", 0, 0), createAnnotation("rect", 10, 10)];
    const moved = reorder(anns, anns[0].id, -5);
    expect(moved[0].id).toBe(anns[0].id);
  });
});

describe("hitTest", () => {
  it("hits rect inside bounds", () => {
    const a = createAnnotation("rect", 10, 10) as any;
    a.width = 100;
    a.height = 50;
    expect(hitTest(a, 50, 30)).toBe(true);
  });
  it("misses rect outside bounds", () => {
    const a = createAnnotation("rect", 10, 10) as any;
    a.width = 100;
    a.height = 50;
    expect(hitTest(a, 200, 200)).toBe(false);
  });
  it("hits ellipse", () => {
    const a = createAnnotation("ellipse", 0, 0) as any;
    a.rx = 50;
    a.ry = 50;
    expect(hitTest(a, 50, 50)).toBe(true); // center
  });
  it("misses ellipse outside", () => {
    const a = createAnnotation("ellipse", 0, 0) as any;
    a.rx = 50;
    a.ry = 50;
    expect(hitTest(a, 200, 200)).toBe(false);
  });
});

describe("boundingBox", () => {
  it("computes rect bounding box", () => {
    const a = createAnnotation("rect", 10, 20) as any;
    a.width = 100;
    a.height = 50;
    const bb = boundingBox(a);
    expect(bb.x).toBe(10);
    expect(bb.width).toBe(100);
  });
  it("computes arrow bounding box", () => {
    const a = createAnnotation("arrow", 0, 0) as any;
    a.x2 = 100;
    a.y2 = 50;
    const bb = boundingBox(a);
    expect(bb.width).toBe(100);
    expect(bb.height).toBe(50);
  });
  it("computes freehand bounding box", () => {
    const a = createAnnotation("freehand", 0, 0) as any;
    a.points = [{ x: 10, y: 20 }, { x: 30, y: 5 }, { x: 5, y: 50 }];
    const bb = boundingBox(a);
    expect(bb.x).toBe(5);
    expect(bb.y).toBe(5);
    expect(bb.width).toBe(25);
  });
});

describe("snapToGrid", () => {
  it("snaps to nearest grid multiple", () => {
    expect(snapToGrid(13, 10)).toBe(10);
    expect(snapToGrid(17, 10)).toBe(20);
  });
});

describe("serialize / deserialize", () => {
  it("round-trips annotations", () => {
    const anns = [createAnnotation("rect", 0, 0), createAnnotation("text", 10, 10)];
    const json = serialize(anns);
    const restored = deserialize(json);
    expect(restored.length).toBe(2);
    expect(restored[0].type).toBe("rect");
  });
});

describe("validateAnnotation", () => {
  it("flags invalid opacity", () => {
    const a = createAnnotation("rect", 0, 0) as any;
    a.opacity = 2;
    expect(validateAnnotation(a)).toContain("Opacity must be 0-1");
  });
  it("flags negative stroke", () => {
    const a = createAnnotation("rect", 0, 0) as any;
    a.strokeWidth = -1;
    expect(validateAnnotation(a)).toContain("Stroke width cannot be negative");
  });
  it("passes valid annotation", () => {
    const a = createAnnotation("rect", 0, 0);
    expect(validateAnnotation(a)).toHaveLength(0);
  });
});

describe("countByType", () => {
  it("counts by type", () => {
    const anns = [createAnnotation("rect", 0, 0), createAnnotation("rect", 10, 10), createAnnotation("text", 0, 0)];
    const c = countByType(anns);
    expect(c.rect).toBe(2);
    expect(c.text).toBe(1);
  });
});

describe("toSvgOverlay", () => {
  it("produces SVG string", () => {
    const anns = [createAnnotation("rect", 0, 0), createAnnotation("text", 0, 0)];
    const svg = toSvgOverlay(anns, 800, 600);
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain("</svg>");
  });
  it("escapes XML special chars in text", () => {
    const a = createAnnotation("text", 0, 0) as any;
    a.text = "<script>";
    const svg = toSvgOverlay([a], 100, 100);
    expect(svg).toContain("&lt;script&gt;");
  });
});

describe("COLOR_PALETTES", () => {
  it("has multiple palettes", () => {
    expect(COLOR_PALETTES.length).toBeGreaterThan(0);
    expect(COLOR_PALETTES[0].colors.length).toBeGreaterThan(0);
  });
});
