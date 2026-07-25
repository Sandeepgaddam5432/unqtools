/**
 * Image Stitcher — pure logic. No DOM/canvas access.
 * Compute total dimensions for stitching multiple images H or V.
 */

export type StitchDirection = "horizontal" | "vertical";

export interface ImageSize {
  width: number;
  height: number;
}

export interface StitchResult {
  width: number;
  height: number;
  positions: { x: number; y: number; width: number; height: number }[];
}

/** Compute the canvas size and per-image positions for a stitch. */
export function computeLayout(
  images: ImageSize[],
  direction: StitchDirection,
): StitchResult | { error: string } {
  if (images.length === 0) return { error: "Need at least one image" };
  if (images.some((i) => i.width <= 0 || i.height <= 0)) {
    return { error: "All images must have positive dimensions" };
  }
  const positions: { x: number; y: number; width: number; height: number }[] = [];
  if (direction === "horizontal") {
    const height = Math.max(...images.map((i) => i.height));
    let x = 0;
    for (const img of images) {
      positions.push({ x, y: 0, width: img.width, height: img.height });
      x += img.width;
    }
    return { width: x, height, positions };
  }
  const width = Math.max(...images.map((i) => i.width));
  let y = 0;
  for (const img of images) {
    positions.push({ x: 0, y, width: img.width, height: img.height });
    y += img.height;
  }
  return { width, height: y, positions };
}

/** Align an image's position with an alignment option. */
export type AlignOption = "start" | "center" | "end";

export function applyAlignment(
  layout: StitchResult,
  direction: StitchDirection,
  align: AlignOption,
): StitchResult {
  const positions = layout.positions.map((pos) => {
    if (direction === "horizontal") {
      const delta = layout.height - pos.height;
      const y =
        align === "start" ? 0 : align === "center" ? Math.round(delta / 2) : delta;
      return { ...pos, y };
    }
    const delta = layout.width - pos.width;
    const x =
      align === "start" ? 0 : align === "center" ? Math.round(delta / 2) : delta;
    return { ...pos, x };
  });
  return { ...layout, positions };
}

/** Estimate the resulting size summary. */
export function summarize(images: ImageSize[], direction: StitchDirection): string {
  const layout = computeLayout(images, direction);
  if ("error" in layout) return layout.error;
  return `${layout.width}×${layout.height}px from ${images.length} images`;
}
