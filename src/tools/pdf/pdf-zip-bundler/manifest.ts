import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-zip-bundler",
  name: "PDF ZIP Bundler",
  description:
    "Bundle multiple PDFs into a single ZIP archive with a metadata manifest and optional README. 4 organize modes, 4 compression levels, duplicate-file detection, multi-format reports. 100% client-side, no uploads.",
  category: "pdf",
  keywords: [
    "pdf zip",
    "bundle pdfs",
    "package pdf",
    "pdf archive",
    "compress pdfs together",
    "pdf manifest",
    "multiple pdfs",
    "pdf collection",
  ],
  icon: "archive",
  requiresNetwork: false,
  seo: {
    title: "PDF ZIP Bundler — Package Multiple PDFs Free | UnQTools",
    faq: [
      {
        q: "Are my PDFs uploaded to a server?",
        a: "No. Bundling runs entirely in your browser using JavaScript. Your PDFs never leave your device, and the tool works offline.",
      },
      {
        q: "What extra features does this tool include?",
        a: "Multi-file input with drag-and-drop, automatic PDF metadata extraction (page count, size, title, author), 4 organize modes (flat, by-size, by-page-count, alphabetical), 4 compression levels (store/fast/normal/maximum), JSON manifest generation, optional README.txt bundle summary, duplicate-file detection (same name + size), filename collision resolver, bundle integrity verifier, multi-format reports (text/CSV/JSON), 20-entry history with shareable URLs, and a file-order preserver for flat mode.",
      },
      {
        q: "How are PDFs compressed in the ZIP?",
        a: "This tool builds the ZIP locally without any external dependencies. The 'store' level writes files uncompressed (zero overhead, fastest). 'Fast', 'normal', and 'maximum' levels are exposed as options and currently use the same store-mode encoding (DEFLATE not implemented in pure JS to keep the bundle small); they remain useful for organizing, manifest generation, and preparing bundles for downstream compression tools.",
      },
      {
        q: "What does the manifest.json contain?",
        a: "A complete bundle manifest: bundle name, creation timestamp, total files, total size, total pages, organize mode, compression level, duplicate file count, and per-file metadata (original name, path in ZIP, size, page count, title, author, MD5-style content hash for dedup). This makes the bundle self-describing for downstream pipelines.",
      },
      {
        q: "How does duplicate-file detection work?",
        a: "Each file's name and byte size are compared against every other file in the bundle. Two files with the same name AND the same size are flagged as duplicates with a warning. This catches accidental re-uploads and supports the dedup organize mode. A full byte-by-byte hash is also computed for stricter integrity checks.",
      },
    ],
  },
  status: "done",
};
