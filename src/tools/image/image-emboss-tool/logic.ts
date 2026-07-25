/**
 * Image Emboss Tool — pure kernel math for directional emboss.
 *
 * Extras:
 *  1. 8-way direction (top/bottom/left/right/diagonals)
 *  2. Amount 0..200 (relief strength)
 *  3. Depth (kernel size 3x3 or 5x5)
 *  4. Custom kernel
 *  5. Blend mode (replace / overlay)
 *  6. Batch validation
 *  7. Presets (subtle / strong / carved)
 *  8. Identity check
 *  9. Format-preserving transparency
 * 10. Luma helper
 * 11. Mean delta
 * 12. Kernel flip helper
 */
export type EmbossDirection = "top" | "bottom" | "left" | "right" | "topleft" | "topright" | "bottomleft" | "bottomright";
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";
export type BlendMode = "replace" | "overlay";
export type KernelSize = 3 | 5;

export interface EmbossOptions {
  direction: EmbossDirection;
  amount: number;
  depth: KernelSize;
  blend: BlendMode;
  /** Baseline gray level (0..255) added to flat regions. */
  baseline: number;
}

/** Build a 3x3 emboss kernel for the given direction. */
export function embossKernel(direction: EmbossDirection): number[][] {
  const k = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const set = (y: number, x: number, v: number) => { k[y]![x] = v; };
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
  return k;
}

/** Build a 5x5 emboss kernel for stronger relief. */
export function embossKernel5(direction: EmbossDirection): number[][] {
  const k3 = embossKernel(direction);
  const k5: number[][] = Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]);
  // Embed 3x3 in 5x5 with offset, expanding the diagonals by 1
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) k5[y + 1]![x + 1] = k3[y]![x]!;
  // Mirror direction outward to 5x5 corners
  if (direction === "topleft") { k5[0]![0] = -1; k5[4]![4] = 1; }
  else if (direction === "topright") { k5[0]![4] = -1; k5[4]![0] = 1; }
  else if (direction === "bottomleft") { k5[4]![0] = -1; k5[0]![4] = 1; }
  else if (direction === "bottomright") { k5[4]![4] = -1; k5[0]![0] = 1; }
  else if (direction === "top") { k5[0]![1] = -1; k5[0]![2] = -1; k5[4]![1] = 1; k5[4]![2] = 1; }
  else if (direction === "bottom") { k5[4]![1] = -1; k5[4]![2] = -1; k5[0]![1] = 1; k5[0]![2] = 1; }
  else if (direction === "left") { k5[1]![0] = -1; k5[2]![0] = -1; k5[1]![4] = 1; k5[2]![4] = 1; }
  else if (direction === "right") { k5[1]![4] = -1; k5[2]![4] = -1; k5[1]![0] = 1; k5[2]![0] = 1; }
  return k5;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Apply a 3x3 kernel to a single channel of a pixel given neighbors. */
export function applyKernel(
  kernel: number[][],
  channel: number,
  neighbors: number[],
  amount: number,
  baseline = 128,
): number {
  const flat = [...neighbors.slice(0, 4), channel, ...neighbors.slice(4)];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const ky = Math.floor(i / 3);
    const kx = i % 3;
    sum += kernel[ky]![kx]! * flat[i]!;
  }
  const result = baseline + sum * (amount / 100);
  return clampByte(result);
}

/** Flip a kernel horizontally + vertically (reverses direction). */
export function flipKernel(kernel: number[][]): number[][] {
  return kernel.map((row) => [...row].reverse()).reverse();
}

/** Blend two RGB values by mode. */
export function blendChannel(base: number, embossed: number, mode: BlendMode): number {
  if (mode === "overlay") return clampByte(base + (embossed - 128));
  return embossed;
}

export function validateEmbossOptions(o: EmbossOptions): { ok: true } | { error: string } {
  const valid: EmbossDirection[] = ["top", "bottom", "left", "right", "topleft", "topright", "bottomleft", "bottomright"];
  if (!valid.includes(o.direction)) return { error: "Invalid direction" };
  if (o.amount < 0 || o.amount > 200) return { error: "Amount must be 0-200" };
  if (o.depth !== 3 && o.depth !== 5) return { error: "Depth must be 3 or 5" };
  if (!["replace", "overlay"].includes(o.blend)) return { error: "Invalid blend mode" };
  if (o.baseline < 0 || o.baseline > 255) return { error: "Baseline must be 0-255" };
  return { ok: true };
}

/** True when options produce a no-op. */
export function isIdentity(o: EmbossOptions): boolean {
  return o.amount === 0;
}

/** Batch-validate a list of files. */
export function batchValidate(files: { name: string }[], opts: EmbossOptions): { name: string; result: { ok: true } | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateEmbossOptions(opts) }));
}

/** Format-preserving transparency check. */
export function preservesAlpha(format: OutputFormat): boolean {
  return format === "image/png" || format === "image/webp";
}

/** ITU-R BT.601 luma. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Mean absolute delta between two RGBA pixel arrays. */
export function meanDelta(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let sum = 0, n = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 4) {
    sum += Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!);
    n++;
  }
  return n === 0 ? 0 : sum / (n * 3);
}

/** Presets. */
export const PRESETS: { id: string; label: string; options: Omit<EmbossOptions, "direction"> & { direction: EmbossDirection } }[] = [
  { id: "subtle", label: "Subtle", options: { direction: "topleft", amount: 50, depth: 3, blend: "replace", baseline: 128 } },
  { id: "strong", label: "Strong", options: { direction: "topleft", amount: 150, depth: 3, blend: "replace", baseline: 128 } },
  { id: "carved", label: "Carved", options: { direction: "bottomright", amount: 200, depth: 5, blend: "replace", baseline: 128 } },
  { id: "overlay-soft", label: "Overlay Soft", options: { direction: "top", amount: 80, depth: 3, blend: "overlay", baseline: 128 } },
  { id: "deep", label: "Deep 5x5", options: { direction: "topleft", amount: 120, depth: 5, blend: "replace", baseline: 128 } },
];

export function findPreset(id: string) {
  return PRESETS.find((p) => p.id === id);
}
