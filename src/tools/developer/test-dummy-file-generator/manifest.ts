/**
 * Test Dummy File Generator — Tool Manifest.
 * Tool #288 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "test-dummy-file-generator",
  name: "Test / Dummy File Generator",
  description:
    "Generate dummy files of an exact byte size — TXT, CSV, JSON, XML, HTML, PNG (solid color), binary, ZIP (real archive), or PDF. Bulk generate with {n} naming patterns. Random / zeros / lorem / pattern content. All client-side via Blob — nothing uploaded.",
  category: "developer",
  keywords: [
    "dummy file", "test file", "dummy file generator",
    "test file generator", "exact size file", "large file online",
    "fake file", "10mb file", "100mb file", "sample file",
  ],
  icon: "file-plus",
  requiresNetwork: false,
  seo: {
    title: "Test / Dummy File Generator — Exact-Size TXT/CSV/JSON/PNG/ZIP/PDF | UnQTools",
    faq: [
      {
        q: "How does the dummy file generator work?",
        a: "Pick a target size (bytes / KB / MB / GB), a file type, and a content mode. We generate the file in-browser with exact byte precision using TextEncoder (text formats), typed arrays (binary), and minimal valid file headers (PNG / ZIP / PDF). The file is downloaded instantly via Blob — nothing is uploaded to a server.",
      },
      {
        q: "Which file types are supported?",
        a: "Nine: TXT (plain text), CSV (random table), JSON (nested object with a long string field), XML (root + items), HTML (basic page), PNG (solid color image — a real, openable PNG file padded with tEXt chunks), binary (raw bytes), ZIP (a real ZIP archive with one inner file), and PDF (a minimal valid PDF padded with a comment line). Each format honors the exact requested byte count.",
      },
      {
        q: "What content modes are available?",
        a: "Four: random (PRNG-seeded pseudo-random bytes), zeros (all 0x00 bytes), lorem (Lorem Ipsum text), and pattern (your own byte/character pattern repeated). The seedable mulberry32 PRNG lets you reproduce identical files across runs — useful for golden-master tests.",
      },
      {
        q: "Are my generated files uploaded anywhere?",
        a: "No. All generation runs locally in your browser using Uint8Array and Blob. The file never leaves your device. History (last 20 generations) is stored in localStorage on this device only — and only stores metadata (size, type, timestamp), not the file contents. The shareable URL encodes options in the fragment (after #) which browsers never transmit.",
      },
      {
        q: "What extra features does this tool have versus others?",
        a: "(1) 9 file formats including real PNG/ZIP/PDF. (2) Exact byte-count sizing with B/KB/MB/GB units. (3) 4 content modes (random / zeros / lorem / pattern). (4) Seedable reproducibility (mulberry32 + FNV-1a). (5) Bulk generation (1–100 files) with {n} naming pattern. (6) Configurable PNG color (hex) and dimensions. (7) CSV rows/cols control. (8) SHA-256-style checksum display (computed locally). (9) Bulk ZIP download of multiple generated files. (10) localStorage history (max 20). (11) Shareable-URL config. (12) Download speed estimator.",
      },
    ],
  },
  status: "done",
};
