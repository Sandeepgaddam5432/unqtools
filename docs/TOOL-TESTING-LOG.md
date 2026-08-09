# UnQTools — 100x Tools Test Log (తెలుగు)

> **ఉద్దేశ్యం:** waves 1–6 లో rebuild చేసిన **60 tools** అన్నీ, vaati exact options/features
> tho list chesanu — nuvvu oka oka tool ni methodically test cheyadaniki.
>
> **ఎలా ఉపయోగించాలి:**
> 1. Live site లో `/tools/<id>` open cheyyi (లేదా `npm run dev` → `http://localhost:3000/tools/<id>`).
> 2. Tool లో unna anni features try cheyyi (ఈ list లో unna checkboxes tho).
> 3. **Test status** column లో raayi: `✅ PASS` (పని చేస్తుంది), `❌ FAIL` (పని చెయ్యడం లేదు),
>    లేదా `⚠️ ISSUE` (+ ఏమి జరిగింది).
>
> ప్రతి row: `| Tool | Status | Issues |` — `⬜` స్థానంలో నీ verdict raayi.

**లెజెండ్:** ✅ PASS · ❌ FAIL · ⚠️ ISSUE (వివరించు) · ⬜ ఇంకా TEST చేయలేదు

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

**Test చేయవలసిన options/features:**

- [ ] **Drop zone** — ఒకటి లేదా అంతకంటే ఎక్కువ PDFs drag & drop (batch లో 20 వరకు)
- [ ] **Compression presets** — Very high / High / Normal / Compact / Maximum (5 presets)
- [ ] **Custom quality** — Custom toggle → JPEG quality slider (10–100%) + downscale slider (25–100%)
- [ ] **Exact target size** — checkbox → KB టైప్ చేయి (e.g. 200) → auto quality ladder ≤ target వరకు
- [ ] **Grayscale** — checkbox (scans కి బెస్ట్)
- [ ] **Strip metadata** — checkbox
- [ ] **Results table** — before/after size, ప్రతి file కి % saved
- [ ] **Download all (ZIP)** — multi-file → ZIP download; ఒక్క file అయితే direct download
- [ ] **Privacy note** — "100% local" footer text

**Notes:** నిజమైన in-browser JPEG re-encoding (canvas). PDF లో embedded images లేకపోతే,
structural-only compress అవుతుంది (quality పాడవదు) — UI అది చెప్తుంది.

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 2. Crop PDF Pages — `/tools/crop-pdf`

**Test చేయవలసిన options/features:**

- [ ] **Drop zone** — ఒక్క PDF
- [ ] **Quick presets** — Trim 5mm / Trim 10mm / Trim 15mm / Cut 25mm
- [ ] **Reset to full page** — preset button (crop తీసేసి పూర్తి పేజీ చూపిస్తుంది)
- [ ] **Custom margins** — Top / Bottom / Left / Right number inputs
- [ ] **Units** — mm / in / pt toggle
- [ ] **Pages (optional)** — page-range input (e.g. `1, 3-5`)
- [ ] **Live dimension preview** — "before → after" page size pt లో (టైప్ చేస్తుండగానే update)
- [ ] **Apply crop** → download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 3. HTML to PDF — `/tools/html-to-pdf`

**Test చేయవలసిన options/features:**

- [ ] **HTML textarea** — HTML paste చేయి (inline styles బెస్ట్ పని చేస్తాయి)
- [ ] **Load invoice sample / Simple sample** buttons
- [ ] **Page size** — A4 / Letter / A5
- [ ] **Orientation** — Portrait / Landscape
- [ ] **Margin** — slider (0–40 mm)
- [ ] **Sharpness** — slider (1×–3× render scale)
- [ ] **Quality** — slider (50–100%)
- [ ] **Page numbers in margin** — checkbox
- [ ] **Convert to PDF** → content ఎక్కువ ఉంటే multi-page slicing → download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 4. Images to PDF — `/tools/images-to-pdf` *(verified deep, 1,864 LOC)*

**Test చేయవలసిన options/features:**

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

**Test చేయవలసిన options/features:**

- [ ] Multiple PDFs add చేయి, drag తో reorder చేయి
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

**Test చేయవలసిన options/features:**

- [ ] **Position** — 6 buttons (bottom-left/center/right, top-left/center/right)
- [ ] **Format** — Plain (X) / Page X / Page X of N / X / N / - X - / Zero-padded / Roman
- [ ] **First number** — start value
- [ ] **Start on page** — numbering ఎక్కడ మొదలవ్వాలో physical page
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

**Test చేయవలసిన options/features:**

- [ ] Tables unna PDF upload చేయి
- [ ] Table detection / multi-sheet output
- [ ] Download .xlsx

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 8. PDF to Word — `/tools/pdf-to-word-converter` *(verified deep, 1,963 LOC, 84 tests)*

**Test చేయవలసిన options/features:**

- [ ] PDF upload → DOCX download
- [ ] Headings/lists/formatting అలాగే ఉండాలి

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 9. PDF Watermark — `/tools/pdf-watermark`

**Test చేయవలసిన options/features:**

- [ ] **Watermark text** input
- [ ] **Image watermark** — PNG/JPG ఎంచుకో + width (pt)
- [ ] **Placement** — Diagonal / Tiled / Centered / Custom position
- [ ] **Custom anchor** — 9-grid anchor buttons + X/Y offset (pt)
- [ ] **Font size, Opacity slider, Rotation, Color** picker
- [ ] **Bold text** checkbox
- [ ] **Pages (optional)** — e.g. `1, 3-5`
- [ ] **Corner stamp** — అదనపు text (bottom-left)
- [ ] Add → download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 10. Split PDF — `/tools/split-pdf` *(verified deep, 932 LOC)*

**Test చేయవలసిన options/features:**

- [ ] Split modes — ranges / every N pages / single page
- [ ] Custom ranges, filename templates ({base}{n}{start}{end})
- [ ] Reverse order option
- [ ] Output files preview
- [ ] Parts / ZIP download

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

**Test చేయవలసిన options/features:**

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

**Test చేయవలసిన options/features:**

- [ ] PDF A + PDF B upload చేయి
- [ ] **Cycle A / Cycle B** — ఒక్కో round కి pages (e.g. 1:1, 2:2, 3:2)
- [ ] **Start with A / Start with B** toggle
- [ ] Result — total page count (A+B)
- [ ] Download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 13. N-Up PDF — `/tools/n-up-pdf`

**Test చేయవలసిన options/features:**

- [ ] **Pages per sheet** — 1–16 (grid auto-compute అవుతుంది)
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

**Test చేయవలసిన options/features:**

- [ ] Markdown textarea (headings, **bold**, *italic*, lists, code blocks, quotes)
- [ ] **GFM tables** — `| a | b |` rows borders + header shading తో render అవ్వాలి
- [ ] Page size / orientation / margin
- [ ] **Body size** slider, **page numbers** checkbox
- [ ] Convert → selectable-text PDF

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 15. Remove Blank Pages — `/tools/remove-blank-pages`

**Test చేయవలసిన options/features:**

- [ ] **Sensitivity** — Off/Light/Strong (0/1/2)
- [ ] **Scan-range pages** (optional) — e.g. `1-10` మాత్రమే scan
- [ ] **Preview** — download కి ముందు removed page numbers చూపిస్తుంది
- [ ] Remove → download cleaned PDF

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 16. Resize PDF Pages — `/tools/resize-pdf-pages`

**Test చేయవలసిన options/features:**

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

**Test చేయవలసిన options/features:**

- [ ] RTF content paste చేయి (లేదా .rtf upload)
- [ ] Unicode (`\u233`), hex (`\'e9`), `\tab`, `\par` సరిగ్గా వస్తాయా
- [ ] Page size / orientation / margin / font size
- [ ] Convert → PDF

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 18. Scale PDF Content — `/tools/scale-pdf`

**Test చేయవలసిన options/features:**

- [ ] **Scale** — 10–1000% (0.1–10)
- [ ] **Anchor** — center / 4 corners
- [ ] **Keep page size** — content sheet లోపలే scale అవుతుంది (page పెరగదు)
- [ ] **Pages (optional)**
- [ ] Download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 19. SVG to PDF — `/tools/svg-to-pdf`

**Test చేయవలసిన options/features:**

- [ ] SVG paste చేయి
- [ ] **Fit mode** — Contain / Cover / Fill / Actual
- [ ] **White background** toggle (లేదా transparent)
- [ ] **DPI** — 1×–4× render
- [ ] Page size (A4/Letter/Fit) + orientation
- [ ] Convert → PDF

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 20. Text to PDF — `/tools/text-to-pdf`

**Test చేయవలసిన options/features:**

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

**Test చేయవలసిన options/features:**

- [ ] **Mode** — Solid color / Image / PDF page
- [ ] Color picker + **opacity** slider
- [ ] Image mode — PNG/JPG ఎంచుకో + fit / tile / stretch
- [ ] PDF-page mode — underlay PDF + page number
- [ ] **Pages (optional)** — e.g. `1, 3-5`
- [ ] Add → download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 22. Add Page Border — `/tools/pdf-add-border`

**Test చేయవలసిన options/features:**

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

**Test చేయవలసిన options/features:**

- [ ] Header text + Footer text (`{page}` / `{pages}` placeholders తో)
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

**Test చేయవలసిన options/features:**

- [ ] PDF ఎంచుకో + ఒకటి లేదా ఎక్కువ files attach (multi-select)
- [ ] **Description** (optional)
- [ ] Attach → download; result open చేస్తే attachments panel లో files + page 1 మీద paperclip కనిపించాలి

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 25. Combine Pages Side-by-Side (2-up) — `/tools/pdf-2up-join`

**Test చేయవలసిన options/features:**

- [ ] Sheet size — A4/Letter/Custom, orientation (landscape default)
- [ ] **Margin + gutter** (pt)
- [ ] **Repeat last page when odd** checkbox
- [ ] **Divider line** checkbox
- [ ] Create → download (1+2, 3+4… ఒక్కో sheet లో)

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 26. B&W Scan Optimizer — `/tools/bw-scan-optimizer`

**Test చేయవలసిన options/features:**

- [ ] Scanned/image PDF upload చేయి
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

**Test చేయవలసిన options/features:**

- [ ] .epub file upload చేయి
- [ ] Page size / orientation / margin / body size
- [ ] **Include chapter titles** checkbox
- [ ] Convert → selectable-text PDF + chapter/char count report

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 28. Office to PDF — `/tools/office-to-pdf`

**Test చేయవలసిన options/features:**

- [ ] .docx upload (bold/italic ఉండాలి)
- [ ] .xlsx upload (tables rows గా)
- [ ] .pptx upload (slides వేరుగా)
- [ ] .txt / .rtf / .csv upload
- [ ] Page size / orientation / margin / body size
- [ ] Convert → PDF + char-count report

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 29. Bates Numbering Tool — `/tools/bates-numbering-tool` *(verified real, 24 tests)*

**Test చేయవలసిన options/features:**

- [ ] Custom format, prefix/suffix
- [ ] 9-grid position, font size, start number
- [ ] Page range, batch
- [ ] CSV / report export

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 30. PDF Accessibility Checker — `/tools/pdf-accessibility-checker` *(verified deep, 2,794 LOC, 78 tests)*

**Test చేయవలసిన options/features:**

- [ ] PDF upload → accessibility report (tags, contrast, text layer, language…)
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

**Test చేయవలసిన options/features:**

- [ ] Top/Bottom/Left/Right margin inputs
- [ ] **Unit** — mm / in / pt
- [ ] **Pages (optional)**
- [ ] Add → download (page పెరుగుతుంది, whitespace margin content చుట్టూ వస్తుంది)

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 32. Edit/Annotate PDF — `/tools/pdf-annotate`

**Test చేయవలసిన options/features:**

- [ ] **Type** — Highlight / Note / Square / Line
- [ ] X, Y, Width, Height (pt)
- [ ] **Color** picker, **opacity** slider
- [ ] **Text** (note contents)
- [ ] **Pages** (e.g. `1` లేదా `1,3`)
- [ ] Add → download (annotations viewer లో కనిపించాలి)

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 33. PDF Bookmarks Editor — `/tools/pdf-bookmarks`

**Test చేయవలసిన options/features:**

- [ ] PDF upload → **existing bookmarks** చూపించాలి
- [ ] Add bookmark — title + page
- [ ] Add చేసిన bookmark ని remove చేయి
- [ ] **Remove all bookmarks** button (existing ఉంటేనే)
- [ ] Save → download; viewer లో open చేస్తే outline panel లో bookmarks కనిపించాలి

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 34. PDF Batch Processor — `/tools/pdf-batch-pipeline`

**Test చేయవలసిన options/features:**

- [ ] Multiple PDFs add చేయి
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

**Test చేయవలసిన options/features:**

- [ ] PDF upload → Clean metadata
- [ ] Report — fields removed, Info dict, XMP, size saved
- [ ] Download cleaned PDF

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 36. Compress to Target Size — `/tools/pdf-compress-target`

**Test చేయవలసిన options/features:**

- [ ] **Target size (KB)** input — e.g. 200, 500, 1000
- [ ] Grayscale + strip metadata checkboxes
- [ ] Run → report "Target reached ✅ / as close as possible" + % saved
- [ ] Download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 37. PDF Permissions Editor — `/tools/pdf-permissions`

**Test చేయవలసిన options/features:**

- [ ] Owner password (required) + user password (optional)
- [ ] Printing — None / Low / High
- [ ] Copying / Modifying / Form filling / Annotations checkboxes
- [ ] Lock → download
- [ ] *Note:* build లో encryption లేకపోతే clear error వస్తుంది (అదే expected)

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 38. Unlock PDF — `/tools/pdf-unlock`

**Test చేయవలసిన options/features:**

- [ ] Password-protected PDF upload చేయి
- [ ] Password enter చేసి Unlock → download (password లేకుండా open అవ్వాలి)
- [ ] తప్పు password → clear error

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 39. Split PDF by Size — `/tools/pdf-split-by-size`

**Test చేయవలసిన options/features:**

- [ ] **Max size per part (KB)**
- [ ] Run → parts table (name, pages, size) + **Download all (ZIP)**
- [ ] ప్రతి part ని వేరుగా download చేయడం

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 40. Create PDF Form — `/tools/pdf-form-builder`

**Test చేయవలసిన options/features:**

- [ ] Form title, margin, font size
- [ ] Fields add చేయి — Text / Checkbox / Radio / Dropdown
- [ ] Labels edit చేయి; radio/dropdown options (comma separated)
- [ ] Create → download fillable PDF; viewer లో open చేస్తే fields పని చేయాలి

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

**Test చేయవలసిన options/features:**

- [ ] PDF upload → Extract → text preview + page/char report
- [ ] **Copy text** button
- [ ] **Download .txt**
- [ ] Scanned PDF → friendly "no extractable text" error

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 42. PDF Word Count — `/tools/pdf-word-count`

**Test చేయవలసిన options/features:**

- [ ] PDF upload → Count → stat cards (words/chars/no-spaces/sentences/paragraphs/reading time)
- [ ] Per-page table (పేజీలు >1 ఉంటే)

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 43. PDF to JSON — `/tools/pdf-to-json`

**Test చేయవలసిన options/features:**

- [ ] PDF upload → Convert → pretty JSON preview (metadata + per-page text + counts)
- [ ] **Copy JSON** / **Download .json**

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 44. PDF to Markdown — `/tools/pdf-to-markdown`

**Test చేయవలసిన options/features:**

- [ ] PDF upload → Convert → Markdown `##` headings తో (పెద్ద font → headings)
- [ ] **Copy Markdown** / **Download .md**

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 45. Extract Images — `/tools/pdf-extract-images`

**Test చేయవలసిన options/features:**

- [ ] Image-based PDF upload → Extract → table (name/format/dimensions/size)
- [ ] ప్రతి image ని వేరుగా download
- [ ] **Download all (ZIP)**
- [ ] Text-only PDF → "no images found" error

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 46. Invert PDF Colors (Dark Mode) — `/tools/pdf-invert-colors`

**Test చేయవలసిన options/features:**

- [ ] Image-based PDF upload → Invert → report (images inverted, pixels)
- [ ] Download inverted PDF (images dark-mode అవ్వాలి)

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 47. Grayscale PDF — `/tools/pdf-grayscale`

**Test చేయవలసిన options/features:**

- [ ] Image-based PDF upload → Convert → report
- [ ] Download grayscale PDF

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 48. Split PDF by Bookmarks — `/tools/pdf-split-by-bookmarks`

**Test చేయవలసిన options/features:**

- [ ] **≥2 bookmarks ఉన్న PDF** upload → Split → chapter parts (title, pages, size)
- [ ] **Download all (ZIP)**
- [ ] Bookmarks లేకపోతే clear error

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 49. Export PDF Form Data — `/tools/pdf-export-form-data`

**Test చేయవలసిన options/features:**

- [ ] Filled form PDF upload → Export → field/type/value table
- [ ] **Download CSV / JSON / FDF**

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 50. Poster Split — `/tools/pdf-poster-split`

**Test చేయవలసిన options/features:**

- [ ] PDF upload → Page / Rows / Columns / Overlap inputs
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

**Test చేయవలసిన options/features:**

- [ ] PDF upload → Convert → HTML preview (paragraphs + images data URLs గా)
- [ ] **Copy HTML** / **Download .html**

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 52. Find & Replace Text — `/tools/pdf-find-replace`

**Test చేయవలసిన options/features:**

- [ ] Real text ఉన్న PDF upload → Find / Replace with
- [ ] **Case sensitive** checkbox
- [ ] Run → report (N replacements in M streams)
- [ ] Download updated PDF; open చేస్తే text replaced అయ్యి ఉండాలి

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 53. Auto-Redact PII — `/tools/pdf-auto-redact-pii`

**Test చేయవలసిన options/features:**

- [ ] Emails/phones/Aadhaar/cards/IP/PAN/SSN ఉన్న PDF upload
- [ ] Scan → per-type counts + match table (page, type, value)
- [ ] **Download masked TXT** (values `***` తో replace అవ్వాలి)
- [ ] Clean text → no matches

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 54. Merge PDF with Bookmarks — `/tools/pdf-merge-bookmarks`

**Test చేయవలసిన options/features:**

- [ ] 2+ PDFs add → Merge → file-level bookmarks + internal bookmarks re-anchored
- [ ] Report (files/pages/bookmarks)
- [ ] Download; open చేస్తే outline panel లో అన్ని bookmarks కనిపించాలి

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 55. PDF Document Info Viewer — `/tools/pdf-document-info-viewer`

**Test చేయవలసిన options/features:**

- [ ] PDF upload → View → metadata cards (title/author/subject/creator/producer/pages/encrypted)
- [ ] Per-page table (size + rotation)
- [ ] **Download JSON**

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 56. Import Form Data — `/tools/pdf-import-form-data`

**Test చేయవలసిన options/features:**

- [ ] Form PDF + FDF / JSON / CSV data file upload
- [ ] Fill → report (set/skipped fields)
- [ ] Download filled PDF; open చేస్తే values కనిపించాలి

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 57. Repair PDF — `/tools/pdf-repair`

**Test చేయవలసిన options/features:**

- [ ] Damaged PDF upload (లేదా trailing garbage ఉన్నది) → Repair
- [ ] Notes list (trimmed junk / permissive parse / re-saved)
- [ ] Download repaired PDF; viewer లో open అవ్వాలి

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 58. PDF Text-to-Speech — `/tools/pdf-text-to-speech`

**Test చేయవలసిన options/features:**

- [ ] PDF upload → Extract for reading
- [ ] **Read aloud** button (browser voice) + Stop
- [ ] **Rate** (0.5–2×) + **Pitch** (0–2) sliders
- [ ] Extracted text preview

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 59. PDF Summarize (On-Device AI) — `/tools/pdf-summarize-ai`

**Test చేయవలసిన options/features:**

- [ ] PDF upload → **Summary length** (sentences)
- [ ] Summarize → key-sentence summary + ratio report
- [ ] **Copy summary** / **Download .txt**
- [ ] Sentences లేకపోతే clear error

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 60. PDF to EPUB — `/tools/pdf-to-epub`

**Test చేయవలసిన options/features:**

- [ ] PDF upload → Convert → EPUB report (chapters/chars)
- [ ] **Download .epub**; e-book reader లో open చేయి (e.g. Calibre)

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

## Summary tally

| Wave | Tools | ✅ Pass | ❌ Fail | ⚠️ Issue | ⬜ Test కాలేదు |
|------|------:|-------:|-------:|---------:|--------------:|
| 1 (v18.2) | 10 | 0 | 0 | 0 | 10 |
| 2 (v18.3) | 10 | 0 | 0 | 0 | 10 |
| 3 (v18.4) | 10 | 0 | 0 | 0 | 10 |
| 4 (v18.5) | 10 | 0 | 0 | 0 | 10 |
| 5 (v18.6) | 10 | 0 | 0 | 0 | 10 |
| 6 (v18.7) | 10 | 0 | 0 | 0 | 10 |
| **Total** | **60** | **0** | **0** | **0** | **60** |

> Test పూర్తి చేసిన తర్వాత: ఈ file update చేయి (✅/❌/⚠️ mark చేసి issues రాయి), commit + push
> చేయి — లేదా failed tools నాకు పంపిస్తే నేను fix చేస్తాను.
