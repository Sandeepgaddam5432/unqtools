# UnQTools — 100x Tools Test Log

> **Purpose:** every tool rebuilt to the 100x bar (waves 1–6, 60 tools) listed with
> its exact options/features so you can test each one methodically.
>
> **How to use:**
> 1. Open `/tools/<id>` on the live site (or `npm run dev` → `http://localhost:3000/tools/<id>`).
> 2. Test the features listed under each tool.
> 3. In the **Test status** column write `✅ PASS`, `❌ FAIL`, or `⚠️ ISSUE` (+ what happened).
>
> Every row is `| Tool | Status | Issues found |` — replace the `⬜` with your verdict.

**Legend:** ✅ PASS · ❌ FAIL · ⚠️ ISSUE (describe) · ⬜ NOT TESTED YET

---

## Wave 1 (v18.2) — 10 tools

| # | Tool (route) | Test status |
|---|--------------|-------------|
| 1 | **Compress PDF** — `/tools/compress-pdf` | ⬜ |
| 2 | **Crop PDF Pages** — `/tools/crop-pdf` | ⬜ |
| 3 | **HTML to PDF** — `/tools/html-to-pdf` | ⬜ |
| 4 | **Images to PDF** — `/tools/images-to-pdf` | ⬜ |
| 5 | **Merge PDF** — `/tools/merge-pdf` | ⬜ |
| 6 | **PDF Page Numbers** — `/tools/pdf-page-numbers` | ⬜ |
| 7 | **PDF to Excel** — `/tools/pdf-to-excel-converter` | ⬜ |
| 8 | **PDF to Word** — `/tools/pdf-to-word-converter` | ⬜ |
| 9 | **PDF Watermark** — `/tools/pdf-watermark` | ⬜ |
| 10 | **Split PDF** — `/tools/split-pdf` | ⬜ |

---

### 1. Compress PDF — `/tools/compress-pdf`

**What to test (options/features):**

- [ ] **Drop zone** — drag & drop one or more PDFs (batch up to 20)
- [ ] **Compression presets** — Very high / High / Normal / Compact / Maximum (5 presets)
- [ ] **Custom quality** — toggle Custom → JPEG quality slider (10–100%) + downscale slider (25–100%)
- [ ] **Exact target size** — checkbox → type KB (e.g. 200) → auto quality ladder until ≤ target
- [ ] **Grayscale** — checkbox (best for scans)
- [ ] **Strip metadata** — checkbox
- [ ] **Results table** — before/after size, % saved per file
- [ ] **Download all (ZIP)** — multi-file → ZIP download; single file → direct download
- [ ] **Privacy note** — "100% local" footer text

**Notes:** real in-browser JPEG re-encoding (canvas). If the PDF has no embedded images, output is structural-only (quality preserved) and the UI says so.

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 2. Crop PDF Pages — `/tools/crop-pdf`

**What to test (options/features):**

- [ ] **Drop zone** — single PDF
- [ ] **Quick presets** — Trim 5mm / Trim 10mm / Trim 15mm / Cut 25mm
- [ ] **Reset to full page** — preset button (removes crop, restores full page)
- [ ] **Custom margins** — Top / Bottom / Left / Right number inputs
- [ ] **Units** — mm / in / pt toggle
- [ ] **Pages (optional)** — page-range input (e.g. `1, 3-5`)
- [ ] **Live dimension preview** — shows "before → after" page size in pt (updates as you type)
- [ ] **Apply crop** → download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 3. HTML to PDF — `/tools/html-to-pdf`

**What to test (options/features):**

- [ ] **HTML textarea** — paste HTML (inline styles work best)
- [ ] **Load invoice sample / Simple sample** buttons
- [ ] **Page size** — A4 / Letter / A5
- [ ] **Orientation** — Portrait / Landscape
- [ ] **Margin** — slider (0–40 mm)
- [ ] **Sharpness** — slider (1×–3× render scale)
- [ ] **Quality** — slider (50–100%)
- [ ] **Page numbers in margin** — checkbox
- [ ] **Convert to PDF** → multi-page slicing if content is long → download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 4. Images to PDF — `/tools/images-to-pdf` *(verified deep, 1,864 LOC)*

**What to test (options/features):**

- [ ] Multiple image upload (PNG/JPG/WebP/GIF/HEIC…)
- [ ] Page size (A4/Letter/Fit/A3/A5…)
- [ ] Orientation, fit modes (contain/cover/stretch/actual)
- [ ] Anchor positions, rotation, fill order (across/down)
- [ ] Units (mm/in), margins
- [ ] Output PDF download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 5. Merge PDF — `/tools/merge-pdf`

**What to test (options/features):**

- [ ] Add multiple PDFs, drag to reorder
- [ ] Per-file page-range (optional) — e.g. `1-3, 5`
- [ ] **Interleave pages** checkbox (A1, B1, A2, B2…)
- [ ] Output filename + metadata (title/author/subject)
- [ ] Live total page-count preview
- [ ] Merge → download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 6. PDF Page Numbers — `/tools/pdf-page-numbers`

**What to test (options/features):**

- [ ] **Position** — 6 buttons (bottom-left/center/right, top-left/center/right)
- [ ] **Format** — Plain (X) / Page X / Page X of N / X / N / - X - / Zero-padded / Roman
- [ ] **First number** — start value
- [ ] **Start on page** — physical page where numbering begins
- [ ] **Font size, Bold, Color** (color picker)
- [ ] **Prefix / Suffix** — text boxes (e.g. `§ ` / `.`)
- [ ] **Skip pages** — e.g. `1, 3`
- [ ] **Only on pages** — e.g. `2-6`
- [ ] **Live preview** — "First … Last — N of M pages numbered"
- [ ] Add → download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 7. PDF to Excel — `/tools/pdf-to-excel-converter` *(verified deep, 2,672 LOC, 93 tests)*

**What to test (options/features):**

- [ ] Upload PDF with tables
- [ ] Table detection / multi-sheet output
- [ ] Download .xlsx

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 8. PDF to Word — `/tools/pdf-to-word-converter` *(verified deep, 1,963 LOC, 84 tests)*

**What to test (options/features):**

- [ ] Upload PDF → DOCX download
- [ ] Headings/lists/formatting preserved

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 9. PDF Watermark — `/tools/pdf-watermark`

**What to test (options/features):**

- [ ] **Watermark text** input
- [ ] **Image watermark** — choose PNG/JPG + width (pt)
- [ ] **Placement** — Diagonal / Tiled / Centered / Custom position
- [ ] **Custom anchor** — 9-grid anchor buttons + X/Y offset (pt)
- [ ] **Font size, Opacity slider, Rotation, Color** picker
- [ ] **Bold text** checkbox
- [ ] **Pages (optional)** — e.g. `1, 3-5`
- [ ] **Corner stamp** — extra text (bottom-left)
- [ ] Add → download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 10. Split PDF — `/tools/split-pdf` *(verified deep, 932 LOC)*

**What to test (options/features):**

- [ ] Split modes — ranges / every N pages / single page
- [ ] Custom ranges, filename templates ({base}{n}{start}{end})
- [ ] Reverse order option
- [ ] Preview of output files
- [ ] Download parts / ZIP

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

## Wave 2 (v18.3) — 10 tools

| # | Tool (route) | Test status |
|---|--------------|-------------|
| 11 | **Flatten PDF** — `/tools/flatten-pdf` | ⬜ |
| 12 | **Interleave PDF** — `/tools/interleave-pdf` | ⬜ |
| 13 | **N-Up PDF** — `/tools/n-up-pdf` | ⬜ |
| 14 | **Markdown to PDF** — `/tools/markdown-to-pdf` | ⬜ |
| 15 | **Remove Blank Pages** — `/tools/remove-blank-pages` | ⬜ |
| 16 | **Resize PDF Pages** — `/tools/resize-pdf-pages` | ⬜ |
| 17 | **RTF to PDF** — `/tools/rtf-to-pdf` | ⬜ |
| 18 | **Scale PDF Content** — `/tools/scale-pdf` | ⬜ |
| 19 | **SVG to PDF** — `/tools/svg-to-pdf` | ⬜ |
| 20 | **Text to PDF** — `/tools/text-to-pdf` | ⬜ |

---

### 11. Flatten PDF — `/tools/flatten-pdf`

**What to test (options/features):**

- [ ] **Remove form fields** checkbox (default on)
- [ ] **Remove annotations** checkbox (default on)
- [ ] **Remove JavaScript** checkbox (default on)
- [ ] **Strip metadata** checkbox (default off)
- [ ] Results report — fields/annotations/JS removed counts + pages with annotations
- [ ] Download flattened PDF

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 12. Interleave PDF — `/tools/interleave-pdf`

**What to test (options/features):**

- [ ] Upload PDF A + PDF B
- [ ] **Cycle A / Cycle B** — pages per round (e.g. 1:1, 2:2, 3:2)
- [ ] **Start with A / Start with B** toggle
- [ ] Result — total page count (A+B)
- [ ] Download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 13. N-Up PDF — `/tools/n-up-pdf`

**What to test (options/features):**

- [ ] **Pages per sheet** — 1–16 (grid auto-computed)
- [ ] **Sheet size** — A4/Letter/A3/A5/Custom (w/h pt)
- [ ] **Order** — row-wise / column-wise
- [ ] **Margin + gutter** (pt)
- [ ] **Cell borders** checkbox
- [ ] **Sheet numbers** checkbox
- [ ] Download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 14. Markdown to PDF — `/tools/markdown-to-pdf`

**What to test (options/features):**

- [ ] Markdown textarea (headings, **bold**, *italic*, lists, code blocks, quotes)
- [ ] **GFM tables** — `| a | b |` rows render with borders + header shading
- [ ] Page size / orientation / margin
- [ ] **Body size** slider, **page numbers** checkbox
- [ ] Convert → selectable-text PDF

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 15. Remove Blank Pages — `/tools/remove-blank-pages`

**What to test (options/features):**

- [ ] **Sensitivity** — Off/Light/Strong (0/1/2)
- [ ] **Scan-range pages** (optional) — only scan e.g. `1-10`
- [ ] **Preview** — reports removed page numbers before download
- [ ] Remove → download cleaned PDF

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 16. Resize PDF Pages — `/tools/resize-pdf-pages`

**What to test (options/features):**

- [ ] **Presets** — A3/A4/A5/Letter/Legal/Tabloid/Executive
- [ ] **Custom size** — width/height + unit (pt/mm/in)
- [ ] Orientation (portrait/landscape)
- [ ] **Fit content** — None / Contain / Stretch
- [ ] **Pages (optional)** — per-page range
- [ ] Download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 17. RTF to PDF — `/tools/rtf-to-pdf`

**What to test (options/features):**

- [ ] Paste RTF content (or upload .rtf)
- [ ] Unicode (`\u233`), hex (`\'e9`), `\tab`, `\par` handling
- [ ] Page size / orientation / margin / font size
- [ ] Convert → PDF

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 18. Scale PDF Content — `/tools/scale-pdf`

**What to test (options/features):**

- [ ] **Scale** — 10–1000% (0.1–10)
- [ ] **Anchor** — center / 4 corners
- [ ] **Keep page size** — content scales inside the sheet (vs grow page)
- [ ] **Pages (optional)**
- [ ] Download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 19. SVG to PDF — `/tools/svg-to-pdf`

**What to test (options/features):**

- [ ] Paste SVG
- [ ] **Fit mode** — Contain / Cover / Fill / Actual
- [ ] **White background** toggle (or transparent)
- [ ] **DPI** — 1×–4× render
- [ ] Page size (A4/Letter/Fit) + orientation
- [ ] Convert → PDF

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 20. Text to PDF — `/tools/text-to-pdf`

**What to test (options/features):**

- [ ] Text textarea
- [ ] **Font** — Helvetica / Times / Courier
- [ ] Font size, **line spacing** slider
- [ ] **Alignment** — Left / Center / Right
- [ ] Margin, page size, orientation
- [ ] **Header / Footer** text + **page numbers** checkbox
- [ ] Multi-page output → download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

## Wave 3 (v18.4) — 10 tools

| # | Tool (route) | Test status |
|---|--------------|-------------|
| 21 | **Add Background to PDF** — `/tools/pdf-add-background` | ⬜ |
| 22 | **Add Page Border to PDF** — `/tools/pdf-add-border` | ⬜ |
| 23 | **Add Header & Footer** — `/tools/pdf-add-header-footer` | ⬜ |
| 24 | **Add Attachment to PDF** — `/tools/pdf-add-attachment` | ⬜ |
| 25 | **Combine Pages Side-by-Side (2-up)** — `/tools/pdf-2up-join` | ⬜ |
| 26 | **B&W Scan Optimizer** — `/tools/bw-scan-optimizer` | ⬜ |
| 27 | **EPUB to PDF** — `/tools/epub-to-pdf-converter` | ⬜ |
| 28 | **Office to PDF** — `/tools/office-to-pdf` | ⬜ |
| 29 | **Bates Numbering Tool** — `/tools/bates-numbering-tool` | ⬜ |
| 30 | **PDF Accessibility Checker** — `/tools/pdf-accessibility-checker` | ⬜ |

---

### 21. Add Background to PDF — `/tools/pdf-add-background`

**What to test (options/features):**

- [ ] **Mode** — Solid color / Image / PDF page
- [ ] Color picker + **opacity** slider
- [ ] Image mode — choose PNG/JPG + fit / tile / stretch
- [ ] PDF-page mode — underlay PDF + page number
- [ ] **Pages (optional)** — e.g. `1, 3-5`
- [ ] Add → download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 22. Add Page Border — `/tools/pdf-add-border`

**What to test (options/features):**

- [ ] **Width** (0.25–24 pt), **Inset** (0–100 pt)
- [ ] **Color** picker
- [ ] **Style** — Solid / Dashed / Double
- [ ] **Pages (optional)**
- [ ] Add → download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 23. Add Header & Footer — `/tools/pdf-add-header-footer`

**What to test (options/features):**

- [ ] Header text + Footer text (with `{page}` / `{pages}` placeholders)
- [ ] Header position + Footer position — Left / Center / Right
- [ ] Font size, **Bold**, Color
- [ ] **Rule lines** checkbox
- [ ] **Pages (optional)**
- [ ] Add → download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 24. Add Attachment to PDF — `/tools/pdf-add-attachment`

**What to test (options/features):**

- [ ] Choose PDF + attach one or more files (multi-select)
- [ ] **Description** (optional)
- [ ] Attach → download; open result → attachments panel shows files + paperclip on page 1

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 25. Combine Pages Side-by-Side (2-up) — `/tools/pdf-2up-join`

**What to test (options/features):**

- [ ] Sheet size — A4/Letter/Custom, orientation (landscape default)
- [ ] **Margin + gutter** (pt)
- [ ] **Repeat last page when odd** checkbox
- [ ] **Divider line** checkbox
- [ ] Create → download (1+2, 3+4… per sheet)

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 26. B&W Scan Optimizer — `/tools/bw-scan-optimizer`

**What to test (options/features):**

- [ ] Upload scanned/image PDF
- [ ] **Threshold** slider (0–255)
- [ ] **Despeckle** — Off / Light (3×3) / Strong (5×5)
- [ ] **Dither (halftones)** checkbox
- [ ] **Quality** slider (50–100%)
- [ ] **Pages (optional)**
- [ ] Optimize → download (1-bit B&W embedded images)

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 27. EPUB to PDF — `/tools/epub-to-pdf-converter`

**What to test (options/features):**

- [ ] Upload an .epub file
- [ ] Page size / orientation / margin / body size
- [ ] **Include chapter titles** checkbox
- [ ] Convert → selectable-text PDF + chapter/char count report

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 28. Office to PDF — `/tools/office-to-pdf`

**What to test (options/features):**

- [ ] Upload .docx (bold/italic preserved)
- [ ] Upload .xlsx (tables as rows)
- [ ] Upload .pptx (slides separated)
- [ ] Upload .txt / .rtf / .csv
- [ ] Page size / orientation / margin / body size
- [ ] Convert → PDF + char-count report

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 29. Bates Numbering Tool — `/tools/bates-numbering-tool` *(verified real, 24 tests)*

**What to test (options/features):**

- [ ] Custom format, prefix/suffix
- [ ] 9-grid position, font size, start number
- [ ] Page range, batch
- [ ] CSV / report export

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 30. PDF Accessibility Checker — `/tools/pdf-accessibility-checker` *(verified deep, 2,794 LOC, 78 tests)*

**What to test (options/features):**

- [ ] Upload PDF → accessibility report (tags, contrast, text layer, language…)
- [ ] Recommendations + summary stats

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

## Wave 4 (v18.5) — 10 tools

| # | Tool (route) | Test status |
|---|--------------|-------------|
| 31 | **Add Margins to PDF** — `/tools/pdf-add-margins` | ⬜ |
| 32 | **Edit/Annotate PDF** — `/tools/pdf-annotate` | ⬜ |
| 33 | **PDF Bookmarks Editor** — `/tools/pdf-bookmarks` | ⬜ |
| 34 | **PDF Batch Processor** — `/tools/pdf-batch-pipeline` | ⬜ |
| 35 | **PDF Metadata Cleaner** — `/tools/pdf-clean-metadata` | ⬜ |
| 36 | **Compress to Target Size** — `/tools/pdf-compress-target` | ⬜ |
| 37 | **PDF Permissions Editor** — `/tools/pdf-permissions` | ⬜ |
| 38 | **Unlock PDF** — `/tools/pdf-unlock` | ⬜ |
| 39 | **Split PDF by Size** — `/tools/pdf-split-by-size` | ⬜ |
| 40 | **Create PDF Form** — `/tools/pdf-form-builder` | ⬜ |

---

### 31. Add Margins to PDF — `/tools/pdf-add-margins`

**What to test (options/features):**

- [ ] Top/Bottom/Left/Right margin inputs
- [ ] **Unit** — mm / in / pt
- [ ] **Pages (optional)**
- [ ] Add → download (page grows, whitespace margin surrounds content)

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 32. Edit/Annotate PDF — `/tools/pdf-annotate`

**What to test (options/features):**

- [ ] **Type** — Highlight / Note / Square / Line
- [ ] X, Y, Width, Height (pt)
- [ ] **Color** picker, **opacity** slider
- [ ] **Text** (note contents)
- [ ] **Pages** (e.g. `1` or `1,3`)
- [ ] Add → download (annotations visible in viewer)

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 33. PDF Bookmarks Editor — `/tools/pdf-bookmarks`

**What to test (options/features):**

- [ ] Upload PDF → shows **existing bookmarks**
- [ ] Add bookmark — title + page
- [ ] Remove individual added bookmark
- [ ] **Remove all bookmarks** button (needs existing)
- [ ] Save → download; open in viewer → outline panel shows bookmarks

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 34. PDF Batch Processor — `/tools/pdf-batch-pipeline`

**What to test (options/features):**

- [ ] Add multiple PDFs
- [ ] **Operation** — Rotate / Compress / Strip metadata / Watermark
- [ ] Rotate: 90/180/270° choice
- [ ] Watermark: text input
- [ ] Compress: strip metadata checkbox
- [ ] Run → per-file results + **Download all (ZIP)**

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 35. PDF Metadata Cleaner — `/tools/pdf-clean-metadata`

**What to test (options/features):**

- [ ] Upload PDF → Clean metadata
- [ ] Report — fields removed, Info dict, XMP, size saved
- [ ] Download cleaned PDF

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 36. Compress to Target Size — `/tools/pdf-compress-target`

**What to test (options/features):**

- [ ] **Target size (KB)** input — e.g. 200, 500, 1000
- [ ] Grayscale + strip metadata checkboxes
- [ ] Run → report "Target reached ✅ / as close as possible" + % saved
- [ ] Download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 37. PDF Permissions Editor — `/tools/pdf-permissions`

**What to test (options/features):**

- [ ] Owner password (required) + user password (optional)
- [ ] Printing — None / Low / High
- [ ] Copying / Modifying / Form filling / Annotations checkboxes
- [ ] Lock → download
- [ ] *Note:* if the build lacks encryption, a clear error explains it (expected behavior)

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 38. Unlock PDF — `/tools/pdf-unlock`

**What to test (options/features):**

- [ ] Upload password-protected PDF
- [ ] Enter password → Unlock → download (opens without password)
- [ ] Wrong password → clear error

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 39. Split PDF by Size — `/tools/pdf-split-by-size`

**What to test (options/features):**

- [ ] **Max size per part (KB)**
- [ ] Run → parts table (name, pages, size) + **Download all (ZIP)**
- [ ] Individual downloads per part

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 40. Create PDF Form — `/tools/pdf-form-builder`

**What to test (options/features):**

- [ ] Form title, margin, font size
- [ ] Add fields — Text / Checkbox / Radio / Dropdown
- [ ] Edit labels; radio/dropdown options (comma separated)
- [ ] Create → download fillable PDF; open in viewer → fields work

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

## Wave 5 (v18.6) — 10 tools

| # | Tool (route) | Test status |
|---|--------------|-------------|
| 41 | **Extract Text (PDF to TXT)** — `/tools/pdf-extract-text` | ⬜ |
| 42 | **PDF Word Count** — `/tools/pdf-word-count` | ⬜ |
| 43 | **PDF to JSON** — `/tools/pdf-to-json` | ⬜ |
| 44 | **PDF to Markdown** — `/tools/pdf-to-markdown` | ⬜ |
| 45 | **Extract Images** — `/tools/pdf-extract-images` | ⬜ |
| 46 | **Invert PDF Colors (Dark Mode)** — `/tools/pdf-invert-colors` | ⬜ |
| 47 | **Grayscale PDF** — `/tools/pdf-grayscale` | ⬜ |
| 48 | **Split PDF by Bookmarks** — `/tools/pdf-split-by-bookmarks` | ⬜ |
| 49 | **Export PDF Form Data** — `/tools/pdf-export-form-data` | ⬜ |
| 50 | **Poster Split** — `/tools/pdf-poster-split` | ⬜ |

---

### 41. Extract Text (PDF to TXT) — `/tools/pdf-extract-text`

**What to test (options/features):**

- [ ] Upload PDF → Extract → text preview + page/char report
- [ ] **Copy text** button
- [ ] **Download .txt**
- [ ] Scanned PDF → friendly "no extractable text" error

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 42. PDF Word Count — `/tools/pdf-word-count`

**What to test (options/features):**

- [ ] Upload PDF → Count → stat cards (words/chars/no-spaces/sentences/paragraphs/reading time)
- [ ] Per-page table (when >1 page)

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 43. PDF to JSON — `/tools/pdf-to-json`

**What to test (options/features):**

- [ ] Upload PDF → Convert → pretty JSON preview (metadata + per-page text + counts)
- [ ] **Copy JSON** / **Download .json**

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 44. PDF to Markdown — `/tools/pdf-to-markdown`

**What to test (options/features):**

- [ ] Upload PDF → Convert → Markdown with `##` headings (large font → headings)
- [ ] **Copy Markdown** / **Download .md**

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 45. Extract Images — `/tools/pdf-extract-images`

**What to test (options/features):**

- [ ] Upload image-based PDF → Extract → table (name/format/dimensions/size)
- [ ] Individual download per image
- [ ] **Download all (ZIP)**
- [ ] Text-only PDF → "no images found" error

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 46. Invert PDF Colors (Dark Mode) — `/tools/pdf-invert-colors`

**What to test (options/features):**

- [ ] Upload image-based PDF → Invert → report (images inverted, pixels)
- [ ] Download inverted PDF (images now dark-mode)

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 47. Grayscale PDF — `/tools/pdf-grayscale`

**What to test (options/features):**

- [ ] Upload image-based PDF → Convert → report
- [ ] Download grayscale PDF

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 48. Split PDF by Bookmarks — `/tools/pdf-split-by-bookmarks`

**What to test (options/features):**

- [ ] Upload a PDF **with ≥2 bookmarks** → Split → chapter parts (title, pages, size)
- [ ] **Download all (ZIP)**
- [ ] No bookmarks → clear error

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 49. Export PDF Form Data — `/tools/pdf-export-form-data`

**What to test (options/features):**

- [ ] Upload filled form PDF → Export → field/type/value table
- [ ] **Download CSV / JSON / FDF**

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 50. Poster Split — `/tools/pdf-poster-split`

**What to test (options/features):**

- [ ] Upload PDF → Page / Rows / Columns / Overlap inputs
- [ ] **Tile output size** — Fit / A4 / Letter
- [ ] Create → tiles report (rows×cols) → download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

## Wave 6 (v18.7) — 10 tools

| # | Tool (route) | Test status |
|---|--------------|-------------|
| 51 | **PDF to HTML** — `/tools/pdf-to-html` | ⬜ |
| 52 | **Find & Replace Text** — `/tools/pdf-find-replace` | ⬜ |
| 53 | **Auto-Redact PII** — `/tools/pdf-auto-redact-pii` | ⬜ |
| 54 | **Merge PDF with Bookmarks** — `/tools/pdf-merge-bookmarks` | ⬜ |
| 55 | **PDF Document Info Viewer** — `/tools/pdf-document-info-viewer` | ⬜ |
| 56 | **Import Form Data** — `/tools/pdf-import-form-data` | ⬜ |
| 57 | **Repair PDF** — `/tools/pdf-repair` | ⬜ |
| 58 | **PDF Text-to-Speech** — `/tools/pdf-text-to-speech` | ⬜ |
| 59 | **PDF Summarize (On-Device AI)** — `/tools/pdf-summarize-ai` | ⬜ |
| 60 | **PDF to EPUB** — `/tools/pdf-to-epub` | ⬜ |

---

### 51. PDF to HTML — `/tools/pdf-to-html`

**What to test (options/features):**

- [ ] Upload PDF → Convert → HTML preview (paragraphs + images as data URLs)
- [ ] **Copy HTML** / **Download .html**

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 52. Find & Replace Text — `/tools/pdf-find-replace`

**What to test (options/features):**

- [ ] Upload PDF with real text → Find / Replace with
- [ ] **Case sensitive** checkbox
- [ ] Run → report (N replacements in M streams)
- [ ] Download updated PDF; open → text replaced

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 53. Auto-Redact PII — `/tools/pdf-auto-redact-pii`

**What to test (options/features):**

- [ ] Upload PDF with emails/phones/Aadhaar/cards/IP/PAN/SSN
- [ ] Scan → per-type counts + match table (page, type, value)
- [ ] **Download masked TXT** (values replaced with ***)
- [ ] Clean text → no matches

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 54. Merge PDF with Bookmarks — `/tools/pdf-merge-bookmarks`

**What to test (options/features):**

- [ ] Add 2+ PDFs → Merge → file-level bookmarks + internal bookmarks re-anchored
- [ ] Report (files/pages/bookmarks)
- [ ] Download; open → outline panel shows all bookmarks

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 55. PDF Document Info Viewer — `/tools/pdf-document-info-viewer`

**What to test (options/features):**

- [ ] Upload PDF → View → metadata cards (title/author/subject/creator/producer/pages/encrypted)
- [ ] Per-page table (size + rotation)
- [ ] **Download JSON**

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 56. Import Form Data — `/tools/pdf-import-form-data`

**What to test (options/features):**

- [ ] Upload form PDF + FDF / JSON / CSV data file
- [ ] Fill → report (set/skipped fields)
- [ ] Download filled PDF; open → values visible

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 57. Repair PDF — `/tools/pdf-repair`

**What to test (options/features):**

- [ ] Upload a damaged PDF (or one with trailing garbage) → Repair
- [ ] Notes list (trimmed junk / permissive parse / re-saved)
- [ ] Download repaired PDF; opens in viewer

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 58. PDF Text-to-Speech — `/tools/pdf-text-to-speech`

**What to test (options/features):**

- [ ] Upload PDF → Extract for reading
- [ ] **Read aloud** button (browser voice) + Stop
- [ ] **Rate** (0.5–2×) + **Pitch** (0–2) sliders
- [ ] Extracted text preview

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 59. PDF Summarize (On-Device AI) — `/tools/pdf-summarize-ai`

**What to test (options/features):**

- [ ] Upload PDF → **Summary length** (sentences)
- [ ] Summarize → key-sentence summary + ratio report
- [ ] **Copy summary** / **Download .txt**
- [ ] No sentences → clear error

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 60. PDF to EPUB — `/tools/pdf-to-epub`

**What to test (options/features):**

- [ ] Upload PDF → Convert → EPUB report (chapters/chars)
- [ ] **Download .epub**; open in an e-book reader (e.g. Calibre)

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

## Summary tally

| Wave | Tools | ✅ Pass | ❌ Fail | ⚠️ Issue | ⬜ Not tested |
|------|------:|-------:|-------:|---------:|--------------:|
| 1 (v18.2) | 10 | 0 | 0 | 0 | 10 |
| 2 (v18.3) | 10 | 0 | 0 | 0 | 10 |
| 3 (v18.4) | 10 | 0 | 0 | 0 | 10 |
| 4 (v18.5) | 10 | 0 | 0 | 0 | 10 |
| 5 (v18.6) | 10 | 0 | 0 | 0 | 10 |
| 6 (v18.7) | 10 | 0 | 0 | 0 | 10 |
| **Total** | **60** | **0** | **0** | **0** | **60** |

> After you finish testing: update this file (mark ✅/❌/⚠️ + write issues), commit, and
> push — or send me the failed tools and I'll fix them.
