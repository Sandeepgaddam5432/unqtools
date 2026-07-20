/**
 * User-Agent String Generator & Parser — Tool Manifest.
 * Tool #287 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "user-agent-string-generator-parser",
  name: "User-Agent String Generator & Parser",
  description:
    "Parse any User-Agent string into browser, engine, OS, CPU, device, and bot info — or generate realistic random UAs (Chrome, Firefox, Safari, Edge, mobile, bots) weighted by market share. Bulk export to CSV/JSON/Playwright array. 100% client-side.",
  category: "developer",
  keywords: [
    "user agent", "user-agent", "ua parser", "ua generator",
    "random user agent", "user agent string", "browser detection",
    "bot detection", "ua string list", "playwright user agent",
  ],
  icon: "globe",
  requiresNetwork: false,
  seo: {
    title: "User-Agent String Generator & Parser — Parse / Random UA List | UnQTools",
    faq: [
      {
        q: "How does the User-Agent parser work?",
        a: "Paste any UA string and we tokenize it client-side with a curated set of regex patterns that match browser name + version, rendering engine, operating system, CPU architecture (x86/x64/arm/arm64), device class (desktop/mobile/tablet/console/tv), device model, and bot identity. Every token in the UA is explained in a per-token breakdown table so you can see exactly what each segment means.",
      },
      {
        q: "How are random UAs generated?",
        a: "We pick from a curated catalog of 60+ realistic (browser × OS × device) combinations — Chrome, Firefox, Safari, Edge, Opera, Vivaldi, Brave, Samsung Internet, mobile devices, and 17+ bots. Each entry has a market-share weight so generated lists reflect real-world traffic, and each browser carries multiple recent major versions. A mulberry32 PRNG lets you seed the output for reproducible test fixtures.",
      },
      {
        q: "Can I generate bulk UA lists?",
        a: "Yes — generate from 1 to 10,000 UAs in one pass. Filter by device class (desktop/mobile/tablet/bot), browser family, or OS family. Export the result as plain text (one UA per line), CSV (with parsed fields), JSON, or a Playwright-ready JavaScript array of { userAgent, deviceClass } objects you can paste straight into a test fixture.",
      },
      {
        q: "Are my parsed UA strings uploaded anywhere?",
        a: "No. Parsing and generation run entirely in your browser. Nothing is sent to a server. The auto-detect button reads navigator.userAgent locally. History (last 20 generations/parses) is stored in localStorage on this device only, and the shareable URL encodes options in the fragment (after #) which browsers never transmit.",
      },
      {
        q: "What extra features does this tool have versus others?",
        a: "(1) Unified parse + generate in one tool. (2) 60+ realistic UA templates (Chrome/Firefox/Safari/Edge/Opera/Vivaldi/Brave/Samsung/mobile + 17 bots). (3) Market-share-weighted generation. (4) Device-class / browser / OS filters. (5) Bot detection for 17+ crawlers. (6) Per-token UA explanation table. (7) Seedable reproducibility (mulberry32 + FNV-1a). (8) Bulk up to 10,000. (9) Four export formats (TXT / CSV / JSON / Playwright array). (10) Auto-detect your own UA. (11) localStorage history (max 20). (12) Shareable-URL config.",
      },
    ],
  },
  status: "done",
};
