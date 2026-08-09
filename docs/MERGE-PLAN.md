# UnQTools — Tool Consolidation Plan (v18+)

> Owner directive (2026-08-09): **merge the 1,704 overlapping tools into fewer,
> far more powerful "mega tools".** Every merge keeps the old URLs alive with a 301
> redirect (see `public/_redirects`) — nothing 404s, engines are never lost, and
> each mega tool is built advanced from day one instead of patching basic shells.

## Wave 1 — DONE: PDF Page Manager (26 tools → 1)

| Merged into | Ops | Old tools (all 301 → `/tools/pdf-page-manager`) |
|---|---|---|
| `pdf-page-manager` | delete, extract, duplicate, insert, reorder, rotate, reverse | 26 tools (delete ×4, extract ×4, duplicate ×3, insert ×3, reorder ×4, rotate ×5, reverse ×3) |

**Why this pattern:** one upload → 7 tabs → chain operations ("Apply next op") →
download. Same engines, single source of truth in `src/tools/pdf/pdf-page-manager/logic.ts`
(12 unit tests). Old standalone dirs removed from registry; URLs 301-redirect.

## Remaining duplicate clusters (audit, 2026-08-09)

The auditor found **114 exact duplicate clusters** covering **231 tools** (v18.0 audit).
These are the next mega-tool candidates, biggest clusters first:

| Cluster | Members | Suggested canonical | Proposed mega tool |
|---|---|---|---|
| `converter-json-to-xml` | 3 | xml-to-json-converter (40), json-to-xml-converter (85), xml-to-json-converter (85) | JSON ↔ XML Converter (bidirectional) |
| `converter-epub-pdf-to` | 3 | epub-to-pdf-converter (80), pdf-to-epub-converter (80), epub-to-pdf-converter (40) | E-Book Converter (EPUB ↔ PDF ↔ MOBI ↔ AZW3) |
| `editor-hyperlink-pdf` | 3 | pdf-hyperlink-editor (40), pdf-hyperlink-editor-pdf (40), pdf-hyperlink-editor-tool (40) | PDF Link Editor |
| `calculator-duration-time` | 2 | time-duration-calc (80), time-duration-calculator (85) | Time Duration Calculator |
| `base64-converter-hex-to` | 2 | base64-to-hex-converter (60), hex-to-base64-converter (40) | Base64 ↔ Hex Converter |
| `commonjs-esm-to` | 2 | commonjs-to-esm (40), esm-to-commonjs (40) | JS Module Converter (CJS ↔ ESM) |
| `css-scss-to` | 2 | css-to-scss (40), scss-to-css (40) | CSS Preprocessor Converter (CSS ↔ SCSS) |
| `csv-json-to` | 2 | csv-to-json (40), json-to-csv (40) | CSV ↔ JSON Converter |
| `html-markdown-to` | 2 | html-to-markdown (40), markdown-to-html (40) | HTML ↔ Markdown Converter |
| `calculator-ipv6-subnet` | 2 | ipv6-subnet-calculator (85), ipv6-subnet-calc (25) | IP Calculator (IPv4 + IPv6 subnet) |
| `format-js` | 2 | js-beautifier (40), js-beautifier-formatter (40) | Code Formatter (JS/JSON/HTML/CSS) |
| `js-json-object-to` | 2 | js-object-to-json (40), json-to-js-object (40) | JS Object ↔ JSON Converter |
| `js-to-typescript` | 2 | js-to-typescript (20), typescript-to-js (40) | JS ↔ TS Converter |
| `flattener-json` | 2 | json-flattener (40), json-flattener-tool (40) | JSON Flattener / Nester |
| `line-multi-single-to` | 2 | multi-line-to-single (40), multi-to-single-line (40) | Multi-line ↔ Single-line Converter |
| `ndjson-viewer` | 2 | ndjson-viewer (40), ndjson-viewer-tool (40) | NDJSON Viewer |
| `printable-quoted` | 2 | quoted-printable (40), quoted-printable-tool (40) | Quoted-Printable Encoder |
| `calculator-semver` | 2 | semver-calculator (40), semver-calculator-tool (40) | SemVer Calculator |
| `escape-string` | 2 | string-escape (40), string-escape-tool (40) | String Escaper / Unescaper |
| `css-tailwind-to` | 2 | tailwind-to-css (40), tailwind-to-css-tool (40) | Tailwind ↔ CSS Converter |
| `generator-totp` | 2 | totp-generator-tool (30), totp-generator (80) | TOTP Generator (merge with authenticator tools) |
| `calculator-grade` | 2 | grade-calc (45), grade-calculator (85) | Grade Calculator |
| `azw3-converter-pdf-to` | 2 | azw3-to-pdf-converter (80), pdf-to-azw3-converter (80) | E-Book Converter |
| `converter-csv-excel-to` | 2 | csv-to-excel-converter (85), excel-to-csv-converter (85) | CSV ↔ Excel Converter |
| `converter-csv-to-tsv` | 2 | csv-to-tsv-converter (85), tsv-to-csv-converter (85) | TSV ↔ CSV Converter |
| `converter-djvu-pdf-to` | 2 | djvu-to-pdf-converter (75), pdf-to-djvu-converter (85) | DJVU ↔ PDF Converter |
| `converter-epub-mobi-to` | 2 | epub-to-mobi-converter (85), mobi-to-epub-converter (85) | E-Book Converter |
| `converter-excel-json-to` | 2 | excel-to-json-converter (85), json-to-excel-converter (85) | Excel ↔ JSON Converter |
| `file-hash-validate` | 2 | file-hash-checker (85), file-hash-validator (75) | File Hash Checker (merge with hasher) |
| `converter-mobi-pdf-to` | 2 | mobi-to-pdf-converter (80), pdf-to-mobi-converter (80) | E-Book Converter |
| `converter-odp-pdf-to` | 2 | odp-to-pdf-converter (85), pdf-to-odp-converter (85) | Office → PDF Converter (ODP/ODS/ODT) |
| `converter-ods-pdf-to` | 2 | ods-to-pdf-converter (85), pdf-to-ods-converter (85) | Office → PDF Converter |
| `converter-odt-pdf-to` | 2 | odt-to-pdf-converter (85), pdf-to-odt-converter (80) | Office → PDF Converter |
| `converter-excel-pdf-to` | 2 | pdf-to-excel-converter (75), pdf-to-excel-converter (85) | Excel ↔ PDF Converter |
| `converter-pdf-postscript-to` | 2 | pdf-to-postscript-converter (85), postscript-to-pdf-converter (85) | PS ↔ PDF Converter |
| `converter-pdf-powerpoint-to` | 2 | pdf-to-powerpoint-converter (85), pdf-to-powerpoint-converter (80) | PPT ↔ PDF Converter |
| `converter-pdf-to-word` | 2 | pdf-to-word-converter (85), pdf-to-word-converter (80) | PDF ↔ Word Converter |
| `converter-pdf-to-xps` | 2 | pdf-to-xps-converter (70), xps-to-pdf-converter (80) | XPS ↔ PDF Converter |
| `base64-image-to` | 2 | base64-to-image (80), image-to-base64 (80) | Mega converter/editor tool |
| `duotone-image-maker` | 2 | duotone-image-maker (85), image-duotone-maker (80) | Mega converter/editor tool |
| `color-image-picker` | 2 | image-color-picker (85), image-color-picker-tool (80) | Mega converter/editor tool |
| `generator-image-placeholder` | 2 | image-placeholder-gen (75), image-placeholder-generator (85) | Mega converter/editor tool |
| `color-generator-image-solid` | 2 | image-solid-color-gen (75), solid-color-image-generator (85) | Mega converter/editor tool |
| `compress-pdf` | 2 | compress-pdf (40), pdf-compress (80) | Mega converter/editor tool |
| `crop-pdf` | 2 | crop-pdf (30), pdf-crop (40) | Mega converter/editor tool |
| `epub-pdf-to` | 2 | epub-to-pdf-tool (40), pdf-to-epub (40) | Mega converter/editor tool |
| `html-pdf-to` | 2 | html-to-pdf (30), pdf-to-html (40) | Mega converter/editor tool |
| `images-pdf-to` | 2 | images-to-pdf (70), pdf-to-images (70) | Mega converter/editor tool |
| `markdown-pdf-to` | 2 | markdown-to-pdf (30), pdf-to-markdown (40) | Mega converter/editor tool |
| `merge-pdf` | 2 | merge-pdf (75), pdf-merge (80) | Mega converter/editor tool |
| `n-pdf-up` | 2 | n-up-pdf (30), pdf-n-up (40) | Mega converter/editor tool |
| `2up-join-pdf` | 2 | pdf-2up-join (40), pdf-2up-join-tool (40) | Mega converter/editor tool |
| `ai-chat-pdf` | 2 | pdf-ai-chat (40), pdf-ai-chat-qa (40) | Mega converter/editor tool |
| `annotate-pdf` | 2 | pdf-annotate (40), pdf-annotate-tool (40) | Mega converter/editor tool |
| `annotation-pdf-summary` | 2 | pdf-annotation-summary (40), pdf-annotation-summary-tool (40) | Mega converter/editor tool |
| `attachment-embed-pdf` | 2 | pdf-attachment-embed (40), pdf-attachment-embed-tool (40) | Mega converter/editor tool |
| `auto-pdf-pii-redact` | 2 | pdf-auto-redact-pii (40), pdf-auto-redact-pii-tool (40) | Mega converter/editor tool |
| `auto-pdf-rotate` | 2 | pdf-auto-rotate (40), pdf-auto-rotate-tool (40) | Mega converter/editor tool |
| `background-image-pdf` | 2 | pdf-background-image (40), pdf-background-image-tool (40) | Mega converter/editor tool |
| `batch-pdf-processor` | 2 | pdf-batch-processor (40), pdf-batch-processor-tool (40) | Mega converter/editor tool |
| `border-frame-pdf` | 2 | pdf-border-frame (40), pdf-border-frame-tool (40) | Mega converter/editor tool |
| `chat-pdf` | 2 | pdf-chat (40), pdf-chat-qa (40) | Mega converter/editor tool |
| `compare-diff-pdf` | 2 | pdf-compare-diff (40), pdf-compare-diff-tool (40) | Mega converter/editor tool |
| `deskew-pdf` | 2 | pdf-deskew (40), pdf-deskew-tool (70) | Mega converter/editor tool |
| `digital-pdf-signature` | 2 | pdf-digital-signature (40), pdf-digital-signature-tool (40) | Mega converter/editor tool |
| `assembler-document-pdf` | 2 | pdf-document-assembler (40), pdf-document-assembler-tool (40) | Mega converter/editor tool |
| `draw-pdf-signature` | 2 | pdf-draw-signature (40), pdf-draw-signature-tool (40) | Mega converter/editor tool |
| `data-export-form-pdf` | 2 | pdf-export-form-data (40), pdf-export-form-data-tool (40) | Mega converter/editor tool |
| `annotations-extract-pdf` | 2 | pdf-extract-annotations (40), pdf-extract-annotations-tool (40) | Mega converter/editor tool |
| `fill-form-pdf` | 2 | pdf-fill-form (40), pdf-fill-form-tool (40) | Mega converter/editor tool |
| `find-pdf-replace` | 2 | pdf-find-replace (40), pdf-find-replace-tool (40) | Mega converter/editor tool |
| `embedder-font-pdf` | 2 | pdf-font-embedder (40), pdf-font-embedder-tool (40) | Mega converter/editor tool |
| `font-lister-pdf` | 2 | pdf-font-lister (40), pdf-font-lister-tool (40) | Mega converter/editor tool |
| `builder-form-pdf` | 2 | pdf-form-builder (40), pdf-form-builder-tool (40) | Mega converter/editor tool |
| `full-pdf-search-text` | 2 | pdf-full-text-search (40), pdf-full-text-search-tool (40) | Mega converter/editor tool |
| `grayscale-pdf` | 2 | pdf-grayscale (40), pdf-grayscale-tool (40) | Mega converter/editor tool |
| `extractor-highlight-pdf` | 2 | pdf-highlight-extractor (40), pdf-highlight-extractor-tool (40) | Mega converter/editor tool |
| `highlight-markup-pdf` | 2 | pdf-highlight-markup (40), pdf-highlight-markup-tool (40) | Mega converter/editor tool |
| `data-form-import-pdf` | 2 | pdf-import-form-data (40), pdf-import-form-data-tool (40) | Mega converter/editor tool |
| `interleave-merge-pdf` | 2 | pdf-interleave-merge (40), pdf-interleave-merge-tool (40) | Mega converter/editor tool |
| `colors-invert-pdf` | 2 | pdf-invert-colors (40), pdf-invert-colors-tool (40) | Mega converter/editor tool |
| `editor-layers-ocg-pdf` | 2 | pdf-layers-ocg-editor (40), pdf-layers-ocg-editor-tool (40) | Mega converter/editor tool |
| `linearize-pdf` | 2 | pdf-linearize (40), pdf-linearize-web (40) | Mega converter/editor tool |
| `margin-padding-pdf` | 2 | pdf-margin-padding (40), pdf-margin-padding-tool (40) | Mega converter/editor tool |
| `calibrate-measure-pdf` | 2 | pdf-measure-calibrate (40), pdf-measure-calibrate-tool (40) | Mega converter/editor tool |
| `bookmarks-merge-pdf` | 2 | pdf-merge-bookmarks (40), pdf-merge-bookmarks-tool (40) | Mega converter/editor tool |
| `merge-multiple-pdf` | 2 | pdf-merge-combine-multiple (40), pdf-merge-combine-multiple-tool (40) | Mega converter/editor tool |
| `metadata-pdf-viewer` | 2 | pdf-metadata-viewer (40), pdf-metadata-viewer-tool (40) | Mega converter/editor tool |
| `organize-pdf` | 2 | pdf-organize (40), pdf-organize-tool (40) | Mega converter/editor tool |
| `blank-insert-page-pdf` | 2 | pdf-page-blank-insert (40), pdf-page-blank-insert-tool (40) | Mega converter/editor tool |
| `editor-label-page-pdf` | 2 | pdf-page-label-editor (40), pdf-page-label-editor-tool (40) | Mega converter/editor tool |
| `individual-page-pdf-resize` | 2 | pdf-page-resize-individual (40), pdf-page-resize-individual-tool (40) | Mega converter/editor tool |
| `pdf-permanent-redact` | 2 | pdf-permanent-redact (40), pdf-permanent-redact-tool (40) | Mega converter/editor tool |
| `builder-pdf-portfolio` | 2 | pdf-portfolio-builder (40), pdf-portfolio-builder-tool (40) | Mega converter/editor tool |
| `pattern-pdf-redact` | 2 | pdf-redact-pattern (40), pdf-redact-pattern-tool (40) | Mega converter/editor tool |
| `pdf-redact-search` | 2 | pdf-redact-search (40), pdf-redact-search-tool (40) | Mega converter/editor tool |
| `pdf-repair` | 2 | pdf-repair (40), pdf-repair-tool (40) | Mega converter/editor tool |
| `check-pdf-spell` | 2 | pdf-spell-check (40), pdf-spell-check-tool (40) | Mega converter/editor tool |
| `pdf-split` | 2 | pdf-split (80), split-pdf (70) | Mega converter/editor tool |
| `advanced-pdf-split` | 2 | pdf-split-advanced (40), pdf-split-advanced-tool (40) | Mega converter/editor tool |
| `pdf-split-spreads` | 2 | pdf-split-spreads (40), pdf-split-spreads-tool (40) | Mega converter/editor tool |
| `advanced-pdf-stamp` | 2 | pdf-stamp-advanced (40), pdf-stamp-advanced-tool (40) | Mega converter/editor tool |
| `confidential-pdf-stamp` | 2 | pdf-stamp-confidential (40), pdf-stamp-confidential-tool (40) | Mega converter/editor tool |
| `ai-pdf-summarize` | 2 | pdf-summarize-ai (40), pdf-summarize-ai-tool (40) | Mega converter/editor tool |
| `pdf-speech-text-to` | 2 | pdf-text-to-speech (40), pdf-text-to-speech-tool (40) | Mega converter/editor tool |
| `pdf-rtf-to` | 2 | pdf-to-rtf (40), rtf-to-pdf (30) | Mega converter/editor tool |
| `pdf-svg-to` | 2 | pdf-to-svg (40), svg-to-pdf (30) | Mega converter/editor tool |
| `accessibility-pdf-ua` | 2 | pdf-ua-accessibility (40), pdf-ua-accessibility-tool (40) | Mega converter/editor tool |
| `advanced-pdf-watermark` | 2 | pdf-watermark-advanced (40), pdf-watermark-advanced-tool (40) | Mega converter/editor tool |
| `count-pdf-word` | 2 | pdf-word-count (40), pdf-word-count-tool (40) | Mega converter/editor tool |
| `content-count-word` | 2 | content-word-count (85), content-word-count-tool (50) | Mega converter/editor tool |
| `binary-text-to` | 2 | binary-to-text (95), text-to-binary (95) | Mega converter/editor tool |
| `binary-octal-text-to` | 2 | text-binary-to-octal (95), text-octal-to-binary (95) | Mega converter/editor tool |
| `hex-text-to` | 2 | text-hex-to-text (85), text-text-to-hex (85) | Mega converter/editor tool |

## Mega-tool architecture (reusable)

1. **One engine file** (`logic.ts`) — every operation as an exported function + a typed `runX()` dispatcher; unit-tested with real inputs.
2. **One tabbed UI** (`ui.tsx`) — single file drop zone powers all tabs; "Apply next op" chains operations without re-uploading.
3. **Manifest + SEO** — one page, one canonical URL, FAQ explains the merge ("old URLs redirect here").
4. **Redirects** — every merged tool id gets a 301 in `public/_redirects`; no URL ever breaks; sitemap drops the old pages.
5. **Counts** — `src/lib/counts.ts`, catalog (`scripts/regenerate-catalog.mjs`), sitemap (`scripts/regenerate-sitemap.mjs`), `docs/TOOLS-INDEX.md` all regenerate from the single source of truth.

## Build order (recommended, traffic-first)

1. ✅ **PDF Page Manager** (wave 1, done — page ops = highest PDF traffic)
2. **JSON + Code toolkit** (formatter, minify, diff, validator, flattener, JSON↔XML, JSON↔CSV) — developer traffic
3. **Image toolkit** (resize, crop, rotate, compress, convert, filters) — image traffic
4. **E-book converter** (EPUB/MOBI/AZW3/PDF) — 4 clusters merge at once
5. **Office → PDF converter** (Word/Excel/PPT/ODT/ODS/ODP) — 4 clusters merge at once

