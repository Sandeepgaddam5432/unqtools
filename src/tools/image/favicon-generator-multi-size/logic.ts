/**
 * Favicon Generator (multi-size) — pure logic.
 */

export interface FaviconSize {
  size: number;
  name: string;
  context: string;
}

export const FAVICON_SIZES: FaviconSize[] = [
  { size: 16, name: "favicon-16x16.png", context: "Browser tab (classic)" },
  { size: 32, name: "favicon-32x32.png", context: "Browser tab (retina)" },
  { size: 48, name: "favicon-48x48.png", context: "Windows site icon" },
  { size: 64, name: "favicon-64x64.png", context: "Desktop shortcut" },
  { size: 96, name: "favicon-96x96.png", context: "Android Chrome" },
  { size: 128, name: "favicon-128x128.png", context: "Chrome Web Store" },
  { size: 180, name: "apple-touch-icon.png", context: "Apple Touch Icon (iOS)" },
  { size: 192, name: "android-chrome-192x192.png", context: "Android Chrome (home screen)" },
  { size: 256, name: "favicon-256x256.png", context: "Safari pinned tab" },
  { size: 384, name: "android-chrome-384x384.png", context: "Android Chrome (splash)" },
  { size: 512, name: "android-chrome-512x512.png", context: "PWA manifest icon" },
];

export function generateHtmlTags(includeApple: boolean = true, includeManifest: boolean = true): string {
  const tags: string[] = [
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
    '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
    '<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">',
  ];
  if (includeApple) {
    tags.push('<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">');
    tags.push('<link rel="apple-touch-icon" sizes="192x192" href="/android-chrome-192x192.png">');
  }
  if (includeManifest) tags.push('<link rel="manifest" href="/site.webmanifest">');
  return tags.join("\n");
}

export function generateWebmanifest(name: string, themeColor: string = "#ffffff", bgColor: string = "#ffffff"): string {
  return JSON.stringify({
    name,
    short_name: name.slice(0, 12),
    icons: [
      { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/android-chrome-384x384.png", sizes: "384x384", type: "image/png" },
      { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    theme_color: themeColor,
    background_color: bgColor,
    display: "standalone",
  }, null, 2);
}

export function generateIcoHeader(sizes: number[]): string {
  const count = sizes.length;
  const header = [0, 0, count, 0];
  let offset = 6 + count * 16;
  const entries: number[] = [];
  for (const size of sizes) {
    entries.push(size >= 256 ? 0 : size, size >= 256 ? 0 : size, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, offset & 0xff, (offset >> 8) & 0xff, (offset >> 16) & 0xff, (offset >> 24) & 0xff);
    offset += 4096;
  }
  return `ICO header: ${count} icons (${sizes.join(", ")}px)`;
}

export function getSizes(): number[] {
  return FAVICON_SIZES.map((s) => s.size);
}
