# UnQTools — 100x Tools Test Log (Auto-Verified)

> Auto-generated: 2026-08-09T18:43 UTC · node scripts/auto-verify-tools.mjs

Two automated layers cover **every** rebuilt tool:
1. **ENGINE** — vitest unit tests run each tool's real logic (pdf-lib operations, pure functions).
2. **PAGE** — dev server SSR check: `/tools/<id>` returns 200 and contains the tool name.

> **Note:** real browser interaction (drag-drop files, canvas rendering, toBlob output) cannot
> run in this sandbox (no browser binaries available). Those parts still need a manual/browser
> pass — marked with ⚠️ needs-browser below where relevant.

## Wave 1

| Tool | Engine tests | Page render | Verdict |
|------|--------------|-------------|---------|
| **Compress PDF** — `compress-pdf` | ✅ 16 tests | ✅ 200 + name | ✅ PASS |
| **Crop PDF Pages** — `crop-pdf` | ✅ 14 tests | ✅ 200 + name | ✅ PASS |
| **HTML to PDF** — `html-to-pdf` | ✅ 11 tests | ✅ 200 + name | ✅ PASS |
| **Images to PDF** — `images-to-pdf` | ✅ 6 tests | ✅ 200 + name | ✅ PASS |
| **Merge PDF** — `merge-pdf` | ✅ 25 tests | ✅ 200 + name | ✅ PASS |
| **PDF Page Numbers** — `pdf-page-numbers` | ✅ 13 tests | ✅ 200 + name | ✅ PASS |
| **PDF to Excel** — `pdf-to-excel-converter` | ✅ 94 tests | ✅ 200 + name | ✅ PASS |
| **PDF to Word** — `pdf-to-word-converter` | ✅ 85 tests | ✅ 200 + name | ✅ PASS |
| **PDF Watermark** — `pdf-watermark` | ✅ 55 tests | ✅ 200 + name | ✅ PASS |
| **Split PDF** — `split-pdf` | ✅ 28 tests | ✅ 200 + name | ✅ PASS |

## Wave 2

| Tool | Engine tests | Page render | Verdict |
|------|--------------|-------------|---------|
| **Flatten PDF** — `flatten-pdf` | ✅ 13 tests | ✅ 200 + name | ✅ PASS |
| **Interleave PDF** — `interleave-pdf` | ✅ 12 tests | ✅ 200 + name | ✅ PASS |
| **N-Up PDF** — `n-up-pdf` | ✅ 15 tests | ✅ 200 + name | ✅ PASS |
| **Markdown to PDF** — `markdown-to-pdf` | ✅ 20 tests | ✅ 200 + name | ✅ PASS |
| **Remove Blank Pages** — `remove-blank-pages` | ✅ 14 tests | ✅ 200 + name | ✅ PASS |
| **Resize PDF Pages** — `resize-pdf-pages` | ✅ 14 tests | ✅ 200 + name | ✅ PASS |
| **RTF to PDF** — `rtf-to-pdf` | ✅ 19 tests | ✅ 200 + name | ✅ PASS |
| **Scale PDF Content** — `scale-pdf` | ✅ 14 tests | ✅ 200 + name | ✅ PASS |
| **SVG to PDF** — `svg-to-pdf` | ✅ 14 tests | ✅ 200 + name | ✅ PASS |
| **Text to PDF** — `text-to-pdf` | ✅ 17 tests | ✅ 200 + name | ✅ PASS |

## Wave 3

| Tool | Engine tests | Page render | Verdict |
|------|--------------|-------------|---------|
| **Add Background to PDF** — `pdf-add-background` | ✅ 12 tests | ✅ 200 + name | ✅ PASS |
| **Add Page Border to PDF** — `pdf-add-border` | ✅ 10 tests | ✅ 200 + name | ✅ PASS |
| **Add Header & Footer** — `pdf-add-header-footer` | ✅ 11 tests | ✅ 200 + name | ✅ PASS |
| **Add Attachment to PDF** — `pdf-add-attachment` | ✅ 6 tests | ✅ 200 + name | ✅ PASS |
| **Combine Pages Side-by-Side (2-up)** — `pdf-2up-join` | ✅ 29 tests | ✅ 200 + name | ✅ PASS |
| **B&W Scan Optimizer** — `bw-scan-optimizer` | ✅ 10 tests | ✅ 200 + name | ✅ PASS |
| **EPUB to PDF** — `epub-to-pdf-converter` | ✅ 9 tests | ✅ 200 + name | ✅ PASS |
| **Office to PDF** — `office-to-pdf` | ✅ 27 tests | ✅ 200 + name | ✅ PASS |
| **Bates Numbering Tool** — `bates-numbering-tool` | ✅ 23 tests | ✅ 200 + name | ✅ PASS |
| **PDF Accessibility Checker** — `pdf-accessibility-checker` | ✅ 81 tests | ✅ 200 + name | ✅ PASS |

## Wave 4

| Tool | Engine tests | Page render | Verdict |
|------|--------------|-------------|---------|
| **Add Margins to PDF** — `pdf-add-margins` | ✅ 7 tests | ✅ 200 + name | ✅ PASS |
| **Edit/Annotate PDF** — `pdf-annotate` | ✅ 30 tests | ✅ 200 + name | ✅ PASS |
| **PDF Bookmarks Editor** — `pdf-bookmarks` | ✅ 60 tests | ✅ 200 + name | ✅ PASS |
| **PDF Batch Processor** — `pdf-batch-pipeline` | ✅ 7 tests | ✅ 200 + name | ✅ PASS |
| **PDF Metadata Cleaner** — `pdf-clean-metadata` | ✅ 9 tests | ✅ 200 + name | ✅ PASS |
| **Compress to Target Size** — `pdf-compress-target` | ✅ 26 tests | ✅ 200 + name | ✅ PASS |
| **PDF Permissions Editor** — `pdf-permissions` | ✅ 9 tests | ✅ 200 + name | ✅ PASS |
| **Unlock PDF** — `pdf-unlock` | ✅ 5 tests | ✅ 200 + name | ✅ PASS |
| **Split PDF by Size** — `pdf-split-by-size` | ✅ 6 tests | ✅ 200 + name | ✅ PASS |
| **Create PDF Form** — `pdf-form-builder` | ✅ 26 tests | ✅ 200 + name | ✅ PASS |

## Wave 5

| Tool | Engine tests | Page render | Verdict |
|------|--------------|-------------|---------|
| **Extract Text (PDF to TXT)** — `pdf-extract-text` | ✅ 26 tests | ✅ 200 + name | ✅ PASS |
| **PDF Word Count** — `pdf-word-count` | ✅ 28 tests | ✅ 200 + name | ✅ PASS |
| **PDF to JSON** — `pdf-to-json` | ✅ 4 tests | ✅ 200 + name | ✅ PASS |
| **PDF to Markdown** — `pdf-to-markdown` | ✅ 6 tests | ✅ 200 + name | ✅ PASS |
| **Extract Images** — `pdf-extract-images` | ✅ 26 tests | ✅ 200 + name | ✅ PASS |
| **Invert PDF Colors (Dark Mode)** — `pdf-invert-colors` | ✅ 26 tests | ✅ 200 + name | ✅ PASS |
| **Grayscale PDF** — `pdf-grayscale` | ✅ 79 tests | ✅ 200 + name | ✅ PASS |
| **Split PDF by Bookmarks** — `pdf-split-by-bookmarks` | ✅ 5 tests | ✅ 200 + name | ✅ PASS |
| **Export PDF Form Data** — `pdf-export-form-data` | ✅ 46 tests | ✅ 200 + name | ✅ PASS |
| **Poster Split** — `pdf-poster-split` | ✅ 6 tests | ✅ 200 + name | ✅ PASS |

## Wave 6

| Tool | Engine tests | Page render | Verdict |
|------|--------------|-------------|---------|
| **PDF to HTML** — `pdf-to-html` | ✅ 6 tests | ✅ 200 + name | ✅ PASS |
| **Find & Replace Text** — `pdf-find-replace` | ✅ 27 tests | ✅ 200 + name | ✅ PASS |
| **Auto-Redact PII** — `pdf-auto-redact-pii` | ✅ 28 tests | ✅ 200 + name | ✅ PASS |
| **Merge PDF with Bookmarks** — `pdf-merge-bookmarks` | ✅ 25 tests | ✅ 200 + name | ✅ PASS |
| **PDF Document Info Viewer** — `pdf-document-info-viewer` | ✅ 4 tests | ✅ 200 + name | ✅ PASS |
| **Import Form Data** — `pdf-import-form-data` | ✅ 48 tests | ✅ 200 + name | ✅ PASS |
| **Repair PDF** — `pdf-repair` | ✅ 44 tests | ✅ 200 + name | ✅ PASS |
| **PDF Text-to-Speech** — `pdf-text-to-speech` | ✅ 24 tests | ✅ 200 + name | ✅ PASS |
| **PDF Summarize (On-Device AI)** — `pdf-summarize-ai` | ✅ 25 tests | ✅ 200 + name | ✅ PASS |
| **PDF to EPUB** — `pdf-to-epub` | ✅ 6 tests | ✅ 200 + name | ✅ PASS |

## Summary

| Layer | Result |
|-------|--------|
| Engine unit tests (60 tools) | ALL PASS |
| Page SSR render (60 tools) | 60/60 render OK |

> Manual browser pass still recommended for: file drag-drop, canvas-based tools (compress/invert/grayscale/B&W),
> speech synthesis (TTS), and final visual review of generated PDFs.
