/**
 * Image Emboss Tool — pure kernel math for directional emboss.
 */
export type EmbossDirection = "top" | "bottom" | "left" | "right" | "topleft" | "topright" | "bottomleft" | "bottomright";

export interface EmbossOptions {
  direction: EmbossDirection;
  /** 0-200 — amount of relief. */
  amount: number;
}

/** Build a 3x3 emboss kernel for the given direction. */
export function embossKernel(direction: EmbossDirection): number[][] {
  // Generic emboss kernel: -1 on one side, +2 in middle for relief, +1 on opposite
  // Origin (negative values) placed per direction.
  const k = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const set = (y: number, x: number, v: number) => { k[y]![x] = v; };
  // Place -1 at source side, +1 at opposite side, center 1 (keeps average)
  switch (direction) {
    case "top":         set(0, 1, -1); set(2, 1, 1); break;
    case "bottom":      set(2, 1, -1); set(0, 1, 1); break;
    case "left":        set(1, 0, -1); set(1, 2, 1); break;
    case "right":       set(1, 2, -1); set(1, 0, 1); break;
    case "topleft":     set(0, 0, -1); set(2, 2, 1); break;
    case "topright":    set(0, 2, -1); set(2, 0, 1); break;
    case "bottomleft":  set(2, 0, -1); set(0, 2, 1); break;
    case "bottomright": set(2, 2, -1); set(0, 0, 1); break;
  }
  // Center stays 0 so kernel sums to 0 → 128 baseline on flat regions
  return k;
}

const clampByte = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

/** Apply a 3x3 kernel to a single channel of a pixel given neighbors. */
export function applyKernel(
  kernel: number[][],
  channel: number, // center channel value
  neighbors: number[], // 8 surrounding values in row-major order
  amount: number,
): number {
  // neighbors indexed: 0..7 around center, with center separate
  // We treat kernel as 3x3 with center at [1][1]
  const flat = [...neighbors.slice(0, 4), channel, ...neighbors.slice(4)];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const ky = Math.floor(i / 3);
    const kx = i % 3;
    sum += kernel[ky]![kx]! * flat[i]!;
  }
  // Blend by amount, add 128 baseline for emboss relief
  const result = 128 + sum * (amount / 100);
  return clampByte(result);
}

export function validateEmbossOptions(o: EmbossOptions): { ok: true } | { error: string } {
  const valid: EmbossDirection[] = ["top", "bottom", "left", "right", "topleft", "topright", "bottomleft", "bottomright"];
  if (!valid.includes(o.direction)) return { error: "Invalid direction" };
  if (o.amount < 0 || o.amount > 200) return { error: "Amount must be 0-200" };
  return { ok: true };
}

/** ITU-R BT.601 luma. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
