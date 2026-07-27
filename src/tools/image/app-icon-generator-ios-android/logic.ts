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
