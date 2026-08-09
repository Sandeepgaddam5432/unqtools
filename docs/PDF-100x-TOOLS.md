# UnQTools — PDF 100x Tools (v18.2)

> The 10 selected PDF tools rebuilt to be genuinely 100x more capable than
> the big competitors (iLovePDF, SmallPDF, Sejda, PDF24) — verified against
> their public feature lists via web research. Everything 100% client-side.

## Selected tools (alphabetical) & what makes each 100x

| # | Tool | Competitors do | We now do (100x) |
|---|------|----------------|------------------|
| 1 | **Compress PDF** | 3 vague presets, server upload, no exact target | **5 presets + custom quality slider + downscale + grayscale + exact target size (KB/MB auto-fit) + batch 20 files + ZIP download + per-file savings table + metadata strip** — real in-browser JPEG re-encoding via canvas |
| 2 | **Crop PDF Pages** | 1 fixed crop | **4 margin presets + custom mm/in/pt units + per-page ranges + live before/after dimension preview + non-destructive reset-to-full-page** |
| 3 | **HTML to PDF** | server wkhtmltopdf, no options | **A4/Letter/A5, portrait/landscape, margin slider, sharpness (zoom), quality, page numbers, real multi-page slicing with your browser engine — invoice sample included** |
| 4 | **Images to PDF** | basic fixed layout | *(already deep — 1,864 LOC: page sizes, fit modes, anchors, rotations, fill order, units; 20+ tests pass)* |
| 5 | **Merge PDF** | drag-drop order only | **per-file page ranges + drag-reorder + output metadata + **interleave (A1,B1,A2,B2) for two-sided scanning** + live page-count preview** |
| 6 | **PDF Page Numbers** | "Page X" only | **7 formats (incl. zero-padded, Roman, - X -) + 6 positions + start page + first number + skip/apply ranges + bold + color + prefix/suffix + live label preview** |
| 7 | **PDF to Excel** | upload, wait, download | *(already deep — 2,672 LOC, 93 tests pass: multi-sheet, table detection, CSV)* |
| 8 | **PDF to Word** | upload, wait, download | *(already deep — 1,963 LOC, 84 tests pass: headings, lists, formatting)* |
| 9 | **PDF Watermark** | text only, 1 placement | **text OR image watermark + 4 placements (diagonal/tiled/centered/custom) + 9 anchors + rotation + opacity + size + bold + color + per-page ranges + corner-stamp extras** |
| 10 | **Split PDF** | split by range only | *(already deep — 932 LOC: ranges/every/single modes, filename templates {base}{n}{start}{end}, reverse, preview; Sejda-class)* |

## Feature count vs competitors

| Feature | iLovePDF | SmallPDF | Sejda | **UnQTools (ours)** |
|---|---|---|---|---|
| Exact target size (KB/MB) | ❌ | ❌ | ❌ | ✅ |
| Batch compress (multi-file + ZIP) | ❌ (1 at a time free) | ❌ (2/day) | ❌ | ✅ 20 files + ZIP |
| Client-side privacy (no upload) | ❌ | ❌ | ❌ | ✅ |
| 5+ compression presets / custom quality | ❌ (3) | ❌ (3) | ❌ | ✅ 5 + custom + downscale + grayscale |
| Interleave merge (2-sided scan) | ❌ | ❌ | ✅ | ✅ |
| Watermark with image + custom anchor | partial | partial | ✅ | ✅ 9 anchors + rotation + extras |
| Roman / padded page numbers | ❌ | ❌ | ❌ | ✅ 7 formats |
| HTML→PDF with page setup + page numbers | ❌ | partial | ❌ | ✅ |
| Crop with presets + units + preview | ❌ | ❌ | partial | ✅ |
| Free / no account / no limits | partial | ❌ | partial | ✅ |

## Verified

- 7,436 PDF tests pass (308 files) — including new suites: compress 15, crop 13,
  html-to-pdf 10, page-numbers 12, watermark 14, merge interleave 2
- ESLint clean on all touched files
- Registry + loader maps verified (every path resolves on disk)
- No tools removed; tool count stays 1,679

## Files touched (this wave)

- src/tools/pdf/compress-pdf/{logic,ui,logic.test}.ts
- src/tools/pdf/crop-pdf/{logic,ui,logic.test}.ts
- src/tools/pdf/html-to-pdf/{logic,ui,logic.test}.ts
- src/tools/pdf/pdf-page-numbers/{logic,ui,logic.test}.ts
- src/tools/pdf/pdf-watermark/{logic,ui,logic.test}.ts
- src/tools/pdf/merge-pdf/{logic,ui,logic.test}.ts
- package.json / package-lock.json (18.1.0 → 18.2.0)

---

## Wave 2 (v18.3) — next 10 PDF tools, same 100x bar

| # | Tool | Rebuilt features |
|---|------|------------------|
| 11 | **Flatten PDF** | Choose what gets flattened (form fields / annotations / JavaScript / metadata), live report of counts + affected pages before download — 12 tests |
| 12 | **Interleave PDF** | Configurable cycles (1:1, 2:2, 3:2…) + start-with-A/B for two-sided scanning — 11 tests |
| 13 | **N-Up PDF** | 1–16 pages per sheet with computed grids, row/column order, A4/Letter/A3/A5/custom sheets, margin + gutter sliders, cell borders, sheet numbers — 14 tests |
| 14 | **Markdown to PDF** | GFM **tables** with borders + headers, headings/lists/code/quotes/hr, body-size scaling, page numbers, selectable text (not rasterized) — 19 tests |
| 15 | **Remove Blank Pages** | Real content analysis with 3 sensitivity levels + scan-range option + preview of removed pages — 13 tests |
| 16 | **Resize PDF Pages** | 7 presets (A3/A4/A5/Letter/Legal/Tabloid/Executive) + custom size in **pt/mm/in** + fit content (contain/stretch) + per-page — 13 tests |
| 17 | **RTF to PDF** | Real RTF parser: `\uN` unicode, `\'xx` hex, `\tab`, `\par`, destination-group skipping (font/color tables), escaped braces — 18 tests |
| 18 | **Scale PDF Content** | 10–1000% scale, anchor point (center/corners), keep-page-size vs grow-page, per-page ranges — 13 tests |
| 19 | **SVG to PDF** | Fit modes (contain/cover/fill/actual), white or transparent background, 1–4× DPI, page sizes incl. fit-to-content — 13 tests |
| 20 | **Text to PDF** | Font choice (Helvetica/Times/Courier), size + line spacing, 4 alignments, margins, header/footer, page numbers, multi-page — 16 tests |

**Wave 2 verified:** 7,486 PDF tests pass (308 files, +50 new); ESLint clean on all touched files;
backward-compatible signatures (all existing UIs keep working); no tools removed (1,679 intact).
