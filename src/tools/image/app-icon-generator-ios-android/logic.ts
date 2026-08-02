/**
 * App Icon Generator (iOS/Android) — pure logic.
 */

export interface IconSize {
  platform: "iOS" | "Android";
  size: number;
  name: string;
  context: string;
}

export const IOS_SIZES: IconSize[] = [
  { platform: "iOS", size: 29, name: "Icon-29.png", context: "Settings (1x)" },
  { platform: "iOS", size: 40, name: "Icon-40.png", context: "Spotlight (2x)" },
  { platform: "iOS", size: 58, name: "Icon-58.png", context: "Settings (2x)" },
  { platform: "iOS", size: 60, name: "Icon-60.png", context: "iPhone (2x)" },
  { platform: "iOS", size: 76, name: "Icon-76.png", context: "iPad (1x)" },
  { platform: "iOS", size: 80, name: "Icon-80.png", context: "Spotlight (3x)" },
  { platform: "iOS", size: 87, name: "Icon-87.png", context: "Settings (3x)" },
  { platform: "iOS", size: 120, name: "Icon-120.png", context: "iPhone (3x) / iPad (2x)" },
  { platform: "iOS", size: 152, name: "Icon-152.png", context: "iPad (2x)" },
  { platform: "iOS", size: 167, name: "Icon-167.png", context: "iPad Pro (2x)" },
  { platform: "iOS", size: 180, name: "Icon-180.png", context: "iPhone (3x)" },
  { platform: "iOS", size: 1024, name: "Icon-1024.png", context: "App Store" },
];

export const ANDROID_SIZES: IconSize[] = [
  { platform: "Android", size: 48, name: "mdpi.png", context: "mdpi (1x)" },
  { platform: "Android", size: 72, name: "hdpi.png", context: "hdpi (1.5x)" },
  { platform: "Android", size: 96, name: "xhdpi.png", context: "xhdpi (2x)" },
  { platform: "Android", size: 144, name: "xxhdpi.png", context: "xxhdpi (3x)" },
  { platform: "Android", size: 192, name: "xxxhdpi.png", context: "xxxhdpi (4x)" },
  { platform: "Android", size: 512, name: "play-store.png", context: "Google Play Store" },
];

export function getAllSizes(): IconSize[] {
  return [...IOS_SIZES, ...ANDROID_SIZES];
}

export function getSizesByPlatform(platform: "iOS" | "Android"): IconSize[] {
  return getAllSizes().filter((s) => s.platform === platform);
}

export function generateAssetCatalog(name: string): string {
  return `{
  "images" : [
    ${IOS_SIZES.map((s) => `{
      "size" : "${s.size}x${s.size}",
      "idiom" : "universal",
      "filename" : "${s.name}",
      "scale" : "1x"
    }`).join(",\n    ")}
  ],
  "info" : { "version" : 1, "author" : "xcode" }
}`;
}

export function generateAndroidManifestEntries(): string {
  return ANDROID_SIZES.filter((s) => s.size <= 192).map((s) => {
    const density = { 48: "mdpi", 72: "hdpi", 96: "xhdpi", 144: "xxhdpi", 192: "xxxhdpi" }[s.size] || "";
    return `<icon density="${density}" src="res/mipmap-${density}/ic_launcher.png" />`;
  }).join("\n");
}

export function calculateTotalIcons(includeIOS: boolean, includeAndroid: boolean): number {
  let count = 0;
  if (includeIOS) count += IOS_SIZES.length;
  if (includeAndroid) count += ANDROID_SIZES.length;
  return count;
}

// ============================================================================
// Backward-compat stub exports (added to satisfy UI template imports).
// ============================================================================

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function getStats(input: string, output: string): {
  inputSize: number;
  outputSize: number;
} {
  return {
    inputSize: new Blob([input]).size,
    outputSize: new Blob([output]).size,
  };
}

export function validate(input: string): string[] {
  const issues: string[] = [];
  if (!input || input.trim().length === 0) {
    issues.push("Input is empty.");
  }
  return issues;
}

export function process(input: string): { output: string; error: string | null } {
  try {
    const result = generateAssetCatalog(input);
    if (typeof result === "string") {
      return { output: result, error: null };
    }
    if (result && typeof result === "object") {
      const r = result as Record<string, unknown>;
      const output =
        (typeof r.output === "string" && r.output) ||
        (typeof r.html === "string" && r.html) ||
        (typeof r.result === "string" && r.result) ||
        (typeof r.text === "string" && r.text) ||
        (typeof r.code === "string" && r.code) ||
        (typeof r.value === "string" && r.value) ||
        JSON.stringify(result, null, 2);
      const error =
        (typeof r.error === "string" && r.error) ||
        (r.ok === false && typeof r.message === "string" && r.message) ||
        null;
      return { output, error };
    }
    return { output: String(result), error: null };
  } catch (e) {
    return { output: "", error: (e as Error).message };
  }
}
