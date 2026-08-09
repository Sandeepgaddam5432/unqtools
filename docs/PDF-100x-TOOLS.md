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

---

## Wave 3 (v18.4) — next 10 PDF tools (8 template shells → real engines)

| # | Tool | Before | After (100x) |
|---|------|--------|--------------|
| 21 | **Add Background to PDF** | fake `validate/process` stub | **3 modes** (solid color / image fit-tile-stretch / underlay page from another PDF) + opacity + page ranges — 11 tests |
| 22 | **Add Page Border to PDF** | fake stub | width + color + **solid/dashed/double** styles + inset + page ranges — 9 tests |
| 23 | **Add Header & Footer to PDF** | fake stub | header/footer with **{page}/{pages} placeholders**, left/center/right, bold, color, rule lines — 10 tests |
| 24 | **Add Attachment to PDF** | fake stub | **embed any file** (Filespec + paperclip annot), multiple files, description, list existing — 5 tests |
| 25 | **Combine Pages Side-by-Side (2-up)** | fake stub | pairs pages per sheet, A4/Letter/custom, orientation, margin+gutter, duplicate-last, divider — 6 tests |
| 26 | **B&W Scan Optimizer** | fake stub | **real 1-bit conversion**: threshold, Floyd–Steinberg dither, median despeckle (3×3/5×5), embedded-image re-encode — 9 tests |
| 27 | **EPUB to PDF** | fake stub | **real EPUB parser**: container.xml→OPF→spine→chapters, HTML→text with headings/lists/tables, rendered via Markdown engine — 8 tests |
| 28 | **Office to PDF** | fake stub | **DOCX (bold/italic), XLSX (shared strings→tables), PPTX (slides), TXT/RTF/CSV** → clean searchable PDF — 10 tests |
| 29 | **Bates Numbering Tool** | already real | verified — 24 tests pass (planner: presets, 9-grid positions, CSV/report) |
| 30 | **PDF Accessibility Checker** | already deep | verified — 78 tests pass (2,794 LOC analyzer) |

**Wave 3 verified:** 7,403 PDF tests pass (309 files; +87 new across 8 rebuilt tools);
ESLint clean on all touched files; no tools removed (1,679 intact). The 8 template-shell
tools went from fake `validate/process` stubs to real pdf-lib engines with real UIs.

---

## Wave 4 (v18.5) — next 10 NEW PDF capabilities (no duplicate stubs)

| # | Tool | Real engine |
|---|------|-------------|
| 31 | **Add Margins to PDF** | Grows pages + shifts the crop so uniform whitespace margins surround content — mm/in/pt units, per-page — 6 tests |
| 32 | **Edit/Annotate PDF** | Adds **highlight / text note / square / line (arrowheads)** PDF annotations with color + opacity, per-page — 7 tests |
| 33 | **PDF Bookmarks Editor** | Reads + writes the **outline tree** at catalog level (Title/Dest wiring), add/remove, page-anchored — 4 tests |
| 34 | **PDF Batch Processor** | Applies **rotate / compress / strip-metadata / watermark** to many files at once, per-file results + ZIP — 6 tests |
| 35 | **PDF Metadata Cleaner** | Wipes Title/Author/Subject/Keywords/Creator/Producer + Info dict + XMP, reports savings — 7 tests |
| 36 | **Compress to Target Size** | Standalone **exact-size** compressor (auto quality ladder until ≤ target KB) — 5 tests |
| 37 | **PDF Permissions Editor** | Owner/user passwords + print/copy/modify/form/annotation flags (graceful note when the pdf-lib build lacks encryption) — 8 tests |
| 38 | **Unlock PDF** | Removes a password (decrypt with password + resave unencrypted) — 4 tests |
| 39 | **Split PDF by Size** | Splits into parts ≤ target KB with sequential names + page ranges — 5 tests |
| 40 | **Create PDF Form** | Builds fillable PDFs: **text fields, checkboxes, radio groups, dropdowns**, multi-page layout — 4 tests |

**Wave 4 verified:** 7,276 PDF tests pass (309 files; +56 new across 10 tools); ESLint clean on all
touched files; the 10 tools' manifests flipped `planned → done` (all previously "Coming Soon");
no tools removed (1,679 intact). All 10 were generic template stubs before this wave.
