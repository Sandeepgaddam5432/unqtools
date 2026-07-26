/**
 * App Icon Generator — pure logic.
 * Computes iOS and Android app-icon sizes, platform manifest entries,
 * padding/rounding requirements, and byte estimates.
 */

export type Platform = "ios" | "android" | "watchos" | "macos";

export interface AppIconSpec {
  name: string;
  size: number; // square px
  platform: Platform;
  device?: string; // e.g. "iPhone", "iPad", "Android"
  scale?: 1 | 2 | 3;
  rounded: boolean; // platform requires corner rounding
  padding: number; // safe-area padding fraction (0..1)
  format: "png";
}

/** Standard iOS app icon sizes (20..180). */
export const IOS_SIZES: AppIconSpec[] = [
  { name: "Icon-20.png", size: 20, platform: "ios", device: "iPhone", scale: 1, rounded: true, padding: 0, format: "png" },
  { name: "Icon-20@2x.png", size: 40, platform: "ios", device: "iPhone", scale: 2, rounded: true, padding: 0, format: "png" },
  { name: "Icon-20@3x.png", size: 60, platform: "ios", device: "iPhone", scale: 3, rounded: true, padding: 0, format: "png" },
  { name: "Icon-29.png", size: 29, platform: "ios", device: "iPhone", scale: 1, rounded: true, padding: 0, format: "png" },
  { name: "Icon-29@2x.png", size: 58, platform: "ios", device: "iPhone", scale: 2, rounded: true, padding: 0, format: "png" },
  { name: "Icon-29@3x.png", size: 87, platform: "ios", device: "iPhone", scale: 3, rounded: true, padding: 0, format: "png" },
  { name: "Icon-40@2x.png", size: 80, platform: "ios", device: "iPhone", scale: 2, rounded: true, padding: 0, format: "png" },
  { name: "Icon-40@3x.png", size: 120, platform: "ios", device: "iPhone", scale: 3, rounded: true, padding: 0, format: "png" },
  { name: "Icon-60@2x.png", size: 120, platform: "ios", device: "iPhone", scale: 2, rounded: true, padding: 0, format: "png" },
  { name: "Icon-60@3x.png", size: 180, platform: "ios", device: "iPhone", scale: 3, rounded: true, padding: 0, format: "png" },
  { name: "Icon-76.png", size: 76, platform: "ios", device: "iPad", scale: 1, rounded: true, padding: 0, format: "png" },
  { name: "Icon-76@2x.png", size: 152, platform: "ios", device: "iPad", scale: 2, rounded: true, padding: 0, format: "png" },
  { name: "Icon-83.5@2x.png", size: 167, platform: "ios", device: "iPad Pro", scale: 2, rounded: true, padding: 0, format: "png" },
  { name: "Icon-1024.png", size: 1024, platform: "ios", device: "App Store", scale: 1, rounded: false, padding: 0, format: "png" },
];

/** Standard Android launcher icon densities. */
export const ANDROID_SIZES: AppIconSpec[] = [
  { name: "mdpi.png", size: 48, platform: "android", device: "mdpi", scale: 1, rounded: true, padding: 0.08, format: "png" },
  { name: "hdpi.png", size: 72, platform: "android", device: "hdpi", scale: 1, rounded: true, padding: 0.08, format: "png" },
  { name: "xhdpi.png", size: 96, platform: "android", device: "xhdpi", scale: 1, rounded: true, padding: 0.08, format: "png" },
  { name: "xxhdpi.png", size: 144, platform: "android", device: "xxhdpi", scale: 1, rounded: true, padding: 0.08, format: "png" },
  { name: "xxxhdpi.png", size: 192, platform: "android", device: "xxxhdpi", scale: 1, rounded: true, padding: 0.08, format: "png" },
  { name: "playstore.png", size: 512, platform: "android", device: "Play Store", scale: 1, rounded: false, padding: 0, format: "png" },
];

/** Combine iOS + Android into one master list. */
export function allSpecs(): AppIconSpec[] {
  return [...IOS_SIZES, ...ANDROID_SIZES];
}

/** Filter specs by platform. */
export function filterByPlatform(specs: AppIconSpec[], platform: Platform): AppIconSpec[] {
  return specs.filter((s) => s.platform === platform);
}

/** Estimate PNG file size for a given icon dimension. */
export function estimatePngSize(size: number): number {
  const raw = size * size * 4;
  const header = 64;
  return Math.round(header + raw / 2.5);
}

/** Compute the safe-area inset (px) for an icon given its padding fraction. */
export function safeAreaInset(size: number, padding: number): number {
  return Math.round(size * Math.max(0, Math.min(0.5, padding)));
}

/** Compute the effective drawing size after applying padding. */
export function effectiveDrawSize(size: number, padding: number): number {
  const inset = safeAreaInset(size, padding);
  return Math.max(1, size - inset * 2);
}

/** Compute iOS corner radius (~22% of size for the squircle look). */
export function iosCornerRadius(size: number): number {
  return Math.round(size * 0.2237);
}

/** Compute Android adaptive icon mask radius (circle inscribed in size). */
export function androidMaskRadius(size: number): number {
  return Math.floor(size / 2);
}

/** Generate the iOS Contents.json for an asset catalog. */
export function generateIosContentsJson(specs: AppIconSpec[]): string {
  const images = specs
    .filter((s) => s.platform === "ios")
    .map((s) => ({
      size: `${s.size / (s.scale ?? 1)}x${s.size / (s.scale ?? 1)}`,
      idiom: s.device === "iPad" || s.device === "iPad Pro" ? "ipad" : "iphone",
      filename: s.name,
      scale: `${s.scale ?? 1}x`,
    }));
  return JSON.stringify({ images, info: { version: 1, author: "unqtools" } }, null, 2);
}

/** Generate Android adaptive icon XML config. */
export function generateAndroidAdaptiveXml(foreground = "@mipmap/ic_launcher_foreground", background = "@color/ic_launcher_background"): string {
  return [
    "<?xml version=\"1.0\" encoding=\"utf-8\"?>",
    "<adaptive-icon xmlns:android=\"http://schemas.android.com/apk/res/android\">",
    `    <background android:drawable="${background}" />`,
    `    <foreground android:drawable="${foreground}" />`,
    "</adaptive-icon>",
  ].join("\n");
}

/** Format bytes. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Total estimated bytes for a list of specs. */
export function estimateTotalBytes(specs: AppIconSpec[]): number {
  return specs.reduce((s, spec) => s + estimatePngSize(spec.size), 0);
}

/** Validate source image dimensions for the largest required icon. */
export function validateSourceForMax(sourceW: number, sourceH: number, maxSize: number): { ok: boolean; reason?: string } {
  if (sourceW < maxSize || sourceH < maxSize) {
    return { ok: false, reason: `Source must be at least ${maxSize}×${maxSize}px (got ${sourceW}×${sourceH}).` };
  }
  if (Math.abs(sourceW - sourceH) > 1) {
    return { ok: false, reason: "Source should be square for app icons." };
  }
  return { ok: true };
}

/** Return a summary table of specs. */
export function summarize(specs: AppIconSpec[]): Array<{ name: string; size: number; platform: Platform; bytes: number; pretty: string }> {
  return specs.map((s) => {
    const bytes = estimatePngSize(s.size);
    return { name: s.name, size: s.size, platform: s.platform, bytes, pretty: formatBytes(bytes) };
  });
}

/** Render a simple solid-color icon to RGBA pixels (placeholder). */
export function renderSolidIcon(size: number, color: [number, number, number] = [80, 120, 220]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const o = i * 4;
    out[o] = color[0];
    out[o + 1] = color[1];
    out[o + 2] = color[2];
    out[o + 3] = 255;
  }
  return out;
}
