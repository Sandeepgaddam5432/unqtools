# UnQTools — 100x Tools Test Log

> **Enduku:** waves 1–6 lo rebuild chesina **60 tools** anni, vaati options/features tho list
> chesanu — nuvvu oka oka tool ni methodically test cheyadaniki.
>
> **Elaa use cheyyali:**
> 1. Live site lo `/tools/<id>` open cheyyi (leda `npm run dev` → `http://localhost:3000/tools/<id>`).
> 2. Tool lo unna anni features try cheyyi (list lo unna checkboxes tho).
> 3. **Test status** column lo raayi: `✅ PASS` (pani chestundi), `❌ FAIL` (pani cheyyatledu),
>    leda `⚠️ ISSUE` (+ em jarigindo).
>
> Prathi row: `| Tool | Status | Issues |` — `⬜` sthanamlo nee verdict raayi.

**Legend:** ✅ PASS · ❌ FAIL · ⚠️ ISSUE (vivarinchu) · ⬜ inka TEST cheyyaledu

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

**Ee features test cheyyi:**

- [ ] **Drop zone** — okati leda ekkuva PDFs drag & drop cheyyi (batch lo 20 varaku)
- [ ] **Compression presets** — Very high / High / Normal / Compact / Maximum (5 presets) anni try cheyyi
- [ ] **Custom quality** — Custom toggle chesi JPEG quality slider (10–100%) + downscale slider (25–100%) adjust cheyyi
- [ ] **Exact target size** — checkbox on chesi KB type cheyyi (e.g. 200) → auto quality ladder target varaku reduce chestundi
- [ ] **Grayscale** — checkbox (scans ki best)
- [ ] **Strip metadata** — checkbox
- [ ] **Results table** — prathi file ki before/after size + % saved chudu
- [ ] **Download all (ZIP)** — multiple files unte ZIP download; okkate file aithe direct download
- [ ] **Privacy note** — footer lo "100% local" undi

**Note:** real in-browser JPEG re-encoding (canvas). PDF lo embedded images ledante structural-only compress avtundi — UI adi cheptundi.

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 2. Crop PDF Pages — `/tools/crop-pdf`

**Ee features test cheyyi:**

- [ ] **Drop zone** — oka PDF eyyi
- [ ] **Quick presets** — Trim 5mm / Trim 10mm / Trim 15mm / Cut 25mm anni try cheyyi
- [ ] **Reset to full page** — button click cheste crop pothundi, full page vastundi
- [ ] **Custom margins** — Top / Bottom / Left / Right values type cheyyi
- [ ] **Units** — mm / in / pt toggle cheyyi
- [ ] **Pages (optional)** — page-range type cheyyi (e.g. `1, 3-5`)
- [ ] **Live dimension preview** — "before → after" page size pt lo update avtundi type chestunte
- [ ] **Apply crop** → download cheyyi

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 3. HTML to PDF — `/tools/html-to-pdf`

**Ee features test cheyyi:**

- [ ] **HTML textarea** — HTML paste cheyyi (inline styles best pani chestayi)
- [ ] **Load invoice sample / Simple sample** buttons click cheyyi
- [ ] **Page size** — A4 / Letter / A5
- [ ] **Orientation** — Portrait / Landscape
- [ ] **Margin** — slider (0–40 mm)
- [ ] **Sharpness** — slider (1×–3×)
- [ ] **Quality** — slider (50–100%)
- [ ] **Page numbers in margin** — checkbox
- [ ] **Convert to PDF** → content ekkuva unte multi-page slicing → download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 4. Images to PDF — `/tools/images-to-pdf` *(already deep, 1,864 LOC)*

**Ee features test cheyyi:**

- [ ] Multiple images upload cheyyi (PNG/JPG/WebP/GIF/HEIC…)
- [ ] Page size (A4/Letter/Fit/A3/A5…)
- [ ] Orientation, fit modes (contain/cover/stretch/actual)
- [ ] Anchor positions, rotation, fill order (across/down)
- [ ] Units (mm/in), margins
- [ ] Output PDF download cheyyi

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 5. Merge PDF — `/tools/merge-pdf`

**Ee features test cheyyi:**

- [ ] Multiple PDFs add cheyyi, drag tho order marchu
- [ ] Per-file page-range (optional) — e.g. `1-3, 5`
- [ ] **Interleave pages** checkbox (A1, B1, A2, B2…)
- [ ] Output filename + metadata (title/author/subject)
- [ ] Live total page-count preview chudu
- [ ] Merge → download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 6. PDF Page Numbers — `/tools/pdf-page-numbers`

**Ee features test cheyyi:**

- [ ] **Position** — 6 buttons (bottom-left/center/right, top-left/center/right)
- [ ] **Format** — Plain (X) / Page X / Page X of N / X / N / - X - / Zero-padded / Roman anni try cheyyi
- [ ] **First number** — start value
- [ ] **Start on page** — numbering ekkada start avvalo physical page
- [ ] **Font size, Bold, Color** (color picker)
- [ ] **Prefix / Suffix** — text boxes (e.g. `§ ` / `.`)
- [ ] **Skip pages** — e.g. `1, 3`
- [ ] **Only on pages** — e.g. `2-6`
- [ ] **Live preview** — "First … Last — N of M pages numbered" chudu
- [ ] Add → download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 7. PDF to Excel — `/tools/pdf-to-excel-converter` *(already deep, 2,672 LOC, 93 tests)*

**Ee features test cheyyi:**

- [ ] Tables unna PDF upload cheyyi
- [ ] Table detection / multi-sheet output chudu
- [ ] Download .xlsx cheyyi

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 8. PDF to Word — `/tools/pdf-to-word-converter` *(already deep, 1,963 LOC, 84 tests)*

**Ee features test cheyyi:**

- [ ] PDF upload → DOCX download
- [ ] Headings/lists/formatting alaage unda chudu

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 9. PDF Watermark — `/tools/pdf-watermark`

**Ee features test cheyyi:**

- [ ] **Watermark text** type cheyyi
- [ ] **Image watermark** — PNG/JPG choose cheyyi + width (pt)
- [ ] **Placement** — Diagonal / Tiled / Centered / Custom position
- [ ] **Custom anchor** — 9-grid anchor buttons + X/Y offset (pt)
- [ ] **Font size, Opacity slider, Rotation, Color** picker
- [ ] **Bold text** checkbox
- [ ] **Pages (optional)** — e.g. `1, 3-5`
- [ ] **Corner stamp** — additional text (bottom-left)
- [ ] Add → download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 10. Split PDF — `/tools/split-pdf` *(already deep, 932 LOC)*

**Ee features test cheyyi:**

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

**Ee features test cheyyi:**

- [ ] **Remove form fields** checkbox (default on)
- [ ] **Remove annotations** checkbox (default on)
- [ ] **Remove JavaScript** checkbox (default on)
- [ ] **Strip metadata** checkbox (default off)
- [ ] Results report — fields/annotations/JS removed counts + pages with annotations chudu
- [ ] Download flattened PDF

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 12. Interleave PDF — `/tools/interleave-pdf`

**Ee features test cheyyi:**

- [ ] PDF A + PDF B upload cheyyi
- [ ] **Cycle A / Cycle B** — oka round ki enni pages (e.g. 1:1, 2:2, 3:2)
- [ ] **Start with A / Start with B** toggle
- [ ] Result — total page count (A+B) chudu
- [ ] Download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 13. N-Up PDF — `/tools/n-up-pdf`

**Ee features test cheyyi:**

- [ ] **Pages per sheet** — 1–16 (grid auto-compute avtundi)
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

**Ee features test cheyyi:**

- [ ] Markdown textarea (headings, **bold**, *italic*, lists, code blocks, quotes)
- [ ] **GFM tables** — `| a | b |` rows borders + header shading tho render avvali
- [ ] Page size / orientation / margin
- [ ] **Body size** slider, **page numbers** checkbox
- [ ] Convert → selectable-text PDF

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 15. Remove Blank Pages — `/tools/remove-blank-pages`

**Ee features test cheyyi:**

- [ ] **Sensitivity** — Off/Light/Strong (0/1/2)
- [ ] **Scan-range pages** (optional) — e.g. `1-10` matrame scan
- [ ] **Preview** — download ki mundu removed page numbers chupistundi
- [ ] Remove → download cleaned PDF

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 16. Resize PDF Pages — `/tools/resize-pdf-pages`

**Ee features test cheyyi:**

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

**Ee features test cheyyi:**

- [ ] RTF content paste cheyyi (leda .rtf upload)
- [ ] Unicode (`\u233`), hex (`\'e9`), `\tab`, `\par` correct ga vasthaya chudu
- [ ] Page size / orientation / margin / font size
- [ ] Convert → PDF

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 18. Scale PDF Content — `/tools/scale-pdf`

**Ee features test cheyyi:**

- [ ] **Scale** — 10–1000% (0.1–10)
- [ ] **Anchor** — center / 4 corners
- [ ] **Keep page size** — content sheet lopale scale avtundi (page pedda avvadu)
- [ ] **Pages (optional)**
- [ ] Download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 19. SVG to PDF — `/tools/svg-to-pdf`

**Ee features test cheyyi:**

- [ ] SVG paste cheyyi
- [ ] **Fit mode** — Contain / Cover / Fill / Actual
- [ ] **White background** toggle (leda transparent)
- [ ] **DPI** — 1×–4× render
- [ ] Page size (A4/Letter/Fit) + orientation
- [ ] Convert → PDF

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 20. Text to PDF — `/tools/text-to-pdf`

**Ee features test cheyyi:**

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

**Ee features test cheyyi:**

- [ ] **Mode** — Solid color / Image / PDF page
- [ ] Color picker + **opacity** slider
- [ ] Image mode — PNG/JPG choose + fit / tile / stretch
- [ ] PDF-page mode — underlay PDF + page number
- [ ] **Pages (optional)** — e.g. `1, 3-5`
- [ ] Add → download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 22. Add Page Border — `/tools/pdf-add-border`

**Ee features test cheyyi:**

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

**Ee features test cheyyi:**

- [ ] Header text + Footer text (`{page}` / `{pages}` placeholders tho)
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

**Ee features test cheyyi:**

- [ ] PDF choose + okati leda ekkuva files attach (multi-select)
- [ ] **Description** (optional)
- [ ] Attach → download; result open cheste attachments panel lo files + page 1 meeda paperclip kanipinchali

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 25. Combine Pages Side-by-Side (2-up) — `/tools/pdf-2up-join`

**Ee features test cheyyi:**

- [ ] Sheet size — A4/Letter/Custom, orientation (landscape default)
- [ ] **Margin + gutter** (pt)
- [ ] **Repeat last page when odd** checkbox
- [ ] **Divider line** checkbox
- [ ] Create → download (1+2, 3+4… oka sheet lo)

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 26. B&W Scan Optimizer — `/tools/bw-scan-optimizer`

**Ee features test cheyyi:**

- [ ] Scanned/image PDF upload cheyyi
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

**Ee features test cheyyi:**

- [ ] .epub file upload cheyyi
- [ ] Page size / orientation / margin / body size
- [ ] **Include chapter titles** checkbox
- [ ] Convert → selectable-text PDF + chapter/char count report

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 28. Office to PDF — `/tools/office-to-pdf`

**Ee features test cheyyi:**

- [ ] .docx upload (bold/italic undali)
- [ ] .xlsx upload (tables rows ga)
- [ ] .pptx upload (slides separate ga)
- [ ] .txt / .rtf / .csv upload
- [ ] Page size / orientation / margin / body size
- [ ] Convert → PDF + char-count report

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 29. Bates Numbering Tool — `/tools/bates-numbering-tool` *(already real, 24 tests)*

**Ee features test cheyyi:**

- [ ] Custom format, prefix/suffix
- [ ] 9-grid position, font size, start number
- [ ] Page range, batch
- [ ] CSV / report export

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 30. PDF Accessibility Checker — `/tools/pdf-accessibility-checker` *(already deep, 2,794 LOC, 78 tests)*

**Ee features test cheyyi:**

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

**Ee features test cheyyi:**

- [ ] Top/Bottom/Left/Right margin inputs
- [ ] **Unit** — mm / in / pt
- [ ] **Pages (optional)**
- [ ] Add → download (page pedda avtundi, whitespace margin content chuttu vastundi)

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 32. Edit/Annotate PDF — `/tools/pdf-annotate`

**Ee features test cheyyi:**

- [ ] **Type** — Highlight / Note / Square / Line
- [ ] X, Y, Width, Height (pt)
- [ ] **Color** picker, **opacity** slider
- [ ] **Text** (note contents)
- [ ] **Pages** (e.g. `1` leda `1,3`)
- [ ] Add → download (annotations viewer lo kanipinchali)

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 33. PDF Bookmarks Editor — `/tools/pdf-bookmarks`

**Ee features test cheyyi:**

- [ ] PDF upload → **existing bookmarks** chupinchali
- [ ] Add bookmark — title + page
- [ ] Add chesina bookmark ni remove cheyyi
- [ ] **Remove all bookmarks** button (existing unte)
- [ ] Save → download; viewer lo open cheste outline panel lo bookmarks kanipinchali

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 34. PDF Batch Processor — `/tools/pdf-batch-pipeline`

**Ee features test cheyyi:**

- [ ] Multiple PDFs add cheyyi
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

**Ee features test cheyyi:**

- [ ] PDF upload → Clean metadata
- [ ] Report — fields removed, Info dict, XMP, size saved
- [ ] Download cleaned PDF

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 36. Compress to Target Size — `/tools/pdf-compress-target`

**Ee features test cheyyi:**

- [ ] **Target size (KB)** input — e.g. 200, 500, 1000
- [ ] Grayscale + strip metadata checkboxes
- [ ] Run → report "Target reached ✅ / as close as possible" + % saved
- [ ] Download

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 37. PDF Permissions Editor — `/tools/pdf-permissions`

**Ee features test cheyyi:**

- [ ] Owner password (required) + user password (optional)
- [ ] Printing — None / Low / High
- [ ] Copying / Modifying / Form filling / Annotations checkboxes
- [ ] Lock → download
- [ ] *Note:* build lo encryption ledante clear error vastundi (ade expected)

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 38. Unlock PDF — `/tools/pdf-unlock`

**Ee features test cheyyi:**

- [ ] Password-protected PDF upload cheyyi
- [ ] Password enter chesi Unlock → download (password lekunda open avvali)
- [ ] Tappu password → clear error

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 39. Split PDF by Size — `/tools/pdf-split-by-size`

**Ee features test cheyyi:**

- [ ] **Max size per part (KB)**
- [ ] Run → parts table (name, pages, size) + **Download all (ZIP)**
- [ ] Prathi part ni separate ga download cheyyadam

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 40. Create PDF Form — `/tools/pdf-form-builder`

**Ee features test cheyyi:**

- [ ] Form title, margin, font size
- [ ] Fields add cheyyi — Text / Checkbox / Radio / Dropdown
- [ ] Labels edit cheyyi; radio/dropdown options (comma separated)
- [ ] Create → download fillable PDF; viewer lo open cheste fields pani cheyali

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

**Ee features test cheyyi:**

- [ ] PDF upload → Extract → text preview + page/char report
- [ ] **Copy text** button
- [ ] **Download .txt**
- [ ] Scanned PDF → friendly "no extractable text" error

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 42. PDF Word Count — `/tools/pdf-word-count`

**Ee features test cheyyi:**

- [ ] PDF upload → Count → stat cards (words/chars/no-spaces/sentences/paragraphs/reading time)
- [ ] Per-page table (pages >1 unte)

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 43. PDF to JSON — `/tools/pdf-to-json`

**Ee features test cheyyi:**

- [ ] PDF upload → Convert → pretty JSON preview (metadata + per-page text + counts)
- [ ] **Copy JSON** / **Download .json**

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 44. PDF to Markdown — `/tools/pdf-to-markdown`

**Ee features test cheyyi:**

- [ ] PDF upload → Convert → Markdown `##` headings tho (pedda font → headings)
- [ ] **Copy Markdown** / **Download .md**

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 45. Extract Images — `/tools/pdf-extract-images`

**Ee features test cheyyi:**

- [ ] Image-based PDF upload → Extract → table (name/format/dimensions/size)
- [ ] Prathi image ni separate ga download
- [ ] **Download all (ZIP)**
- [ ] Text-only PDF → "no images found" error

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 46. Invert PDF Colors (Dark Mode) — `/tools/pdf-invert-colors`

**Ee features test cheyyi:**

- [ ] Image-based PDF upload → Invert → report (images inverted, pixels)
- [ ] Download inverted PDF (images dark-mode avvali)

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 47. Grayscale PDF — `/tools/pdf-grayscale`

**Ee features test cheyyi:**

- [ ] Image-based PDF upload → Convert → report
- [ ] Download grayscale PDF

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 48. Split PDF by Bookmarks — `/tools/pdf-split-by-bookmarks`

**Ee features test cheyyi:**

- [ ] **≥2 bookmarks unna PDF** upload → Split → chapter parts (title, pages, size)
- [ ] **Download all (ZIP)**
- [ ] Bookmarks ledante clear error

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 49. Export PDF Form Data — `/tools/pdf-export-form-data`

**Ee features test cheyyi:**

- [ ] Filled form PDF upload → Export → field/type/value table
- [ ] **Download CSV / JSON / FDF**

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 50. Poster Split — `/tools/pdf-poster-split`

**Ee features test cheyyi:**

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

**Ee features test cheyyi:**

- [ ] PDF upload → Convert → HTML preview (paragraphs + images data URLs ga)
- [ ] **Copy HTML** / **Download .html**

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 52. Find & Replace Text — `/tools/pdf-find-replace`

**Ee features test cheyyi:**

- [ ] Real text unna PDF upload → Find / Replace with
- [ ] **Case sensitive** checkbox
- [ ] Run → report (N replacements in M streams)
- [ ] Download updated PDF; open cheste text replaced ayyi undali

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 53. Auto-Redact PII — `/tools/pdf-auto-redact-pii`

**Ee features test cheyyi:**

- [ ] Emails/phones/Aadhaar/cards/IP/PAN/SSN unna PDF upload
- [ ] Scan → per-type counts + match table (page, type, value)
- [ ] **Download masked TXT** (values `***` tho replace avvali)
- [ ] Clean text → no matches

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 54. Merge PDF with Bookmarks — `/tools/pdf-merge-bookmarks`

**Ee features test cheyyi:**

- [ ] 2+ PDFs add → Merge → file-level bookmarks + internal bookmarks re-anchored
- [ ] Report (files/pages/bookmarks)
- [ ] Download; open cheste outline panel lo anni bookmarks kanipinchali

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 55. PDF Document Info Viewer — `/tools/pdf-document-info-viewer`

**Ee features test cheyyi:**

- [ ] PDF upload → View → metadata cards (title/author/subject/creator/producer/pages/encrypted)
- [ ] Per-page table (size + rotation)
- [ ] **Download JSON**

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 56. Import Form Data — `/tools/pdf-import-form-data`

**Ee features test cheyyi:**

- [ ] Form PDF + FDF / JSON / CSV data file upload
- [ ] Fill → report (set/skipped fields)
- [ ] Download filled PDF; open cheste values kanipinchali

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 57. Repair PDF — `/tools/pdf-repair`

**Ee features test cheyyi:**

- [ ] Damaged PDF upload (leda trailing garbage unnaadi) → Repair
- [ ] Notes list (trimmed junk / permissive parse / re-saved)
- [ ] Download repaired PDF; viewer lo open avvali

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 58. PDF Text-to-Speech — `/tools/pdf-text-to-speech`

**Ee features test cheyyi:**

- [ ] PDF upload → Extract for reading
- [ ] **Read aloud** button (browser voice) + Stop
- [ ] **Rate** (0.5–2×) + **Pitch** (0–2) sliders
- [ ] Extracted text preview

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 59. PDF Summarize (On-Device AI) — `/tools/pdf-summarize-ai`

**Ee features test cheyyi:**

- [ ] PDF upload → **Summary length** (sentences)
- [ ] Summarize → key-sentence summary + ratio report
- [ ] **Copy summary** / **Download .txt**
- [ ] Sentences ledante clear error

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

### 60. PDF to EPUB — `/tools/pdf-to-epub`

**Ee features test cheyyi:**

- [ ] PDF upload → Convert → EPUB report (chapters/chars)
- [ ] **Download .epub**; e-book reader lo open cheyyi (e.g. Calibre)

| Verdict | Issues |
|---------|--------|
| ⬜ | |

---

## Summary tally

| Wave | Tools | ✅ Pass | ❌ Fail | ⚠️ Issue | ⬜ Test cheyyaledu |
|------|------:|-------:|-------:|---------:|--------------:|
| 1 (v18.2) | 10 | 0 | 0 | 0 | 10 |
| 2 (v18.3) | 10 | 0 | 0 | 0 | 10 |
| 3 (v18.4) | 10 | 0 | 0 | 0 | 10 |
| 4 (v18.5) | 10 | 0 | 0 | 0 | 10 |
| 5 (v18.6) | 10 | 0 | 0 | 0 | 10 |
| 6 (v18.7) | 10 | 0 | 0 | 0 | 10 |
| **Total** | **60** | **0** | **0** | **0** | **60** |

> Test poorthi chesaka: ee file update cheyyi (✅/❌/⚠️ mark chesi issues raayi), commit + push
> cheyyi — leda failed tools naaku pampisthe nenu fix chestanu.
