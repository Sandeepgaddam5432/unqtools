/**
 * Favicon Generator — pure logic.
 * Computes favicon sizes for browsers, iOS, Android, and PWA; estimates
 * PNG file sizes from raw RGBA pixels; packs sizes into manifest entries.
 */

export type OutputFormat = "png" | "ico" | "svg";

export interface FaviconSpec {
  name: string;
  size: number; // px (square)
  rel?: string; // link rel attribute
  type?: string; // mime type
  platform: "browser" | "ios" | "android" | "pwa" | "windows";
  purpose?: "any" | "maskable" | "monochrome";
}

/** Default favicon sizes supported by the generator. */
export const FAVICON_SIZES: FaviconSpec[] = [
  { name: "favicon-16x16.png", size: 16, rel: "icon", type: "image/png", platform: "browser" },
  { name: "favicon-32x32.png", size: 32, rel: "icon", type: "image/png", platform: "browser" },
  { name: "favicon-48x48.png", size: 48, rel: "icon", type: "image/png", platform: "browser" },
  { name: "favicon-64x64.png", size: 64, rel: "icon", type: "image/png", platform: "browser" },
  { name: "favicon-128x128.png", size: 128, rel: "icon", type: "image/png", platform: "browser" },
  { name: "apple-touch-icon-180x180.png", size: 180, rel: "apple-touch-icon", type: "image/png", platform: "ios" },
  { name: "android-chrome-192x192.png", size: 192, rel: "icon", type: "image/png", platform: "android", purpose: "any" },
  { name: "android-chrome-512x512.png", size: 512, rel: "icon", type: "image/png", platform: "android", purpose: "any" },
  { name: "pwa-192x192.png", size: 192, rel: "icon", type: "image/png", platform: "pwa", purpose: "any" },
  { name: "pwa-512x512.png", size: 512, rel: "icon", type: "image/png", platform: "pwa", purpose: "maskable" },
];

/** Filter specs by platform. */
export function filterByPlatform(specs: FaviconSpec[], platform: FaviconSpec["platform"]): FaviconSpec[] {
  return specs.filter((s) => s.platform === platform);
}

/** Compute total area for a list of specs (used for batch sizing). */
export function totalArea(specs: FaviconSpec[]): number {
  return specs.reduce((sum, s) => sum + s.size * s.size, 0);
}

/** Estimate PNG file size in bytes given RGBA pixel data. Uses a rough 2.5x compression ratio. */
export function estimatePngSize(width: number, height: number, rawBytes: number = 0): number {
  const pixelCount = width * height;
  const raw = rawBytes > 0 ? rawBytes : pixelCount * 4;
  // PNG compression averages 2.5x on photographic content, much better on flat color.
  const header = 64;
  return Math.round(header + raw / 2.5);
}

/** Estimate total bytes for a list of specs assuming an average PNG. */
export function estimateTotalBytes(specs: FaviconSpec[]): number {
  return specs.reduce((sum, s) => sum + estimatePngSize(s.size, s.size), 0);
}

/** Format bytes as a human-readable string. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Generate the <link> tags HTML for a set of favicon specs. */
export function generateLinkTags(specs: FaviconSpec[]): string {
  return specs
    .map((s) => {
      const rel = s.rel ? ` rel="${s.rel}"` : "";
      const type = s.type ? ` type="${s.type}"` : "";
      const sizes = ` sizes="${s.size}x${s.size}"`;
      return `<link${rel}${type}${sizes} href="/${s.name}" />`;
    })
    .join("\n");
}

/** Generate the web manifest icons array (JSON string). */
export function generateManifestIcons(specs: FaviconSpec[]): string {
  const icons = specs
    .filter((s) => s.platform === "pwa" || s.platform === "android" || s.platform === "browser")
    .map((s) => {
      const purpose = s.purpose ?? "any";
      return {
        src: `/${s.name}`,
        sizes: `${s.size}x${s.size}`,
        type: s.type ?? "image/png",
        purpose,
      };
    });
  return JSON.stringify({ icons }, null, 2);
}

/** Validate a target output size — must be a positive integer ≤ 2048. */
export function validateSize(size: number): { ok: boolean; reason?: string } {
  if (!Number.isInteger(size)) return { ok: false, reason: "Size must be an integer." };
  if (size <= 0) return { ok: false, reason: "Size must be positive." };
  if (size > 2048) return { ok: false, reason: "Size must be ≤ 2048." };
  return { ok: true };
}

/** Compute the next power-of-two size ≥ given size. */
export function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/** Determine if a size is power-of-two (used for ICO compatibility). */
export function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/** Compute scaling factor needed to render at target from source. */
export function scalingFactor(sourceSize: number, targetSize: number): number {
  if (sourceSize <= 0) return 1;
  return targetSize / sourceSize;
}

/** Given source w×h, compute destination w×h preserving aspect ratio within maxSize. */
export function fitWithin(sourceW: number, sourceH: number, maxSize: number): { w: number; h: number } {
  if (sourceW <= 0 || sourceH <= 0) return { w: maxSize, h: maxSize };
  const scale = Math.min(maxSize / sourceW, maxSize / sourceH);
  return { w: Math.round(sourceW * scale), h: Math.round(sourceH * scale) };
}

/** Build a custom spec list with arbitrary sizes. */
export function buildCustomSpecs(sizes: number[], platform: FaviconSpec["platform"] = "browser"): FaviconSpec[] {
  return sizes.map((size) => ({
    name: `favicon-${size}x${size}.png`,
    size,
    rel: "icon",
    type: "image/png",
    platform,
  }));
}

/** Render a simple checkerboard pattern to RGBA pixels (placeholder for testing). */
export function renderCheckerboard(size: number, light: [number, number, number] = [240, 240, 240], dark: [number, number, number] = [200, 200, 200]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(size * size * 4);
  const cell = Math.max(1, Math.floor(size / 8));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const isLight = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
      const c = isLight ? light : dark;
      out[i] = c[0];
      out[i + 1] = c[1];
      out[i + 2] = c[2];
      out[i + 3] = 255;
    }
  }
  return out;
}

/** Return a summary of all generated assets including byte estimates. */
export function summarizeSpecs(specs: FaviconSpec[]): Array<{ name: string; size: number; bytes: number; prettyBytes: string }> {
  return specs.map((s) => {
    const bytes = estimatePngSize(s.size, s.size);
    return { name: s.name, size: s.size, bytes, prettyBytes: formatBytes(bytes) };
  });
}
