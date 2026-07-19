/**
 * PDF to PowerPoint Converter — pure logic.
 *
 * Pure functions only — no DOM, no pdf-lib. The PDF content-stream parsing
 * lives in ui.tsx; this module handles slide layout selection, title/content
 * extraction, PPTX/HTML/Markdown rendering, ZIP packaging, history, and
 * shareable URLs.
 */

import type { ToolResult } from "../../../lib/tool";

// ---------------------------------------------------------------------------
// Output formats and slide layouts
// ---------------------------------------------------------------------------

/**
 * Output format. Note: "markdown-sildes" is intentionally spelled this way
 * (internal id per spec) — display label is "Markdown slides (Marp)".
 */
export type OutputFormat = "pptx" | "html-slides" | "markdown-sildes";

export const OUTPUT_FORMATS: OutputFormat[] = ["pptx", "html-slides", "markdown-sildes"];

export const FORMAT_LABELS: Record<OutputFormat, string> = {
  pptx: "PowerPoint (.pptx)",
  "html-slides": "HTML slides (.html)",
  "markdown-sildes": "Markdown slides — Marp (.md)",
};

export const FORMAT_EXTENSIONS: Record<OutputFormat, string> = {
  pptx: "pptx",
  "html-slides": "html",
  "markdown-sildes": "md",
};

export const FORMAT_MIME: Record<OutputFormat, string> = {
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "html-slides": "text/html",
  "markdown-sildes": "text/markdown",
};

export type SlideLayout = "full-page" | "title-content" | "two-content" | "blank";

export const SLIDE_LAYOUTS: SlideLayout[] = ["full-page", "title-content", "two-content", "blank"];

export const SLIDE_LAYOUT_LABELS: Record<SlideLayout, string> = {
  "full-page": "Full-page (one big text block)",
  "title-content": "Title + content",
  "two-content": "Title + two columns",
  blank: "Blank (title only)",
};

// ---------------------------------------------------------------------------
// Heading levels
// ---------------------------------------------------------------------------

export type HeadingLevel = "h1" | "h2" | "h3" | "body";

// ---------------------------------------------------------------------------
// Core data shapes
// ---------------------------------------------------------------------------

export interface TextItem {
  text: string;
  fontSize: number;
  pageNumber: number;
  bold?: boolean;
  italic?: boolean;
}

export interface Paragraph {
  level: HeadingLevel;
  text: string;
  pageNumber: number;
  bold?: boolean;
  italic?: boolean;
}

/** A slide's worth of content extracted from a single PDF page. */
export interface SlideContent {
  /** 1-based slide number (corresponds to position in output). */
  slideNumber: number;
  /** Original PDF page number this slide was built from. */
  originalPage: number;
  /** Generated title (first heading or "Page N"). */
  title: string;
  /** Heading paragraphs found on the page (excludes the title). */
  headings: Paragraph[];
  /** Body paragraphs (non-heading text). */
  bodyParagraphs: Paragraph[];
  /** Bullets formatted from body paragraphs. */
  bullets: string[];
  /** Speaker notes (all non-heading text joined). */
  notes: string;
  /** Total text length on the page. */
  textLength: number;
  /** Whether a usable heading was found (title quality indicator). */
  hasHeadingTitle: boolean;
}

export interface AspectRatio {
  /** Width / height ratio of the source PDF page. */
  ratio: number;
  /** Slide width in EMU (914400 EMU = 1 inch). 0 if aspect not preserved. */
  slideWidthEmu: number;
  /** Slide height in EMU. */
  slideHeightEmu: number;
  /** Standard slide dimensions label, e.g. "16:9" or "4:3" or "Custom". */
  label: string;
}

export interface ConvertOptions {
  pageRange: string;
  slideLayout: SlideLayout;
  includeSpeakerNotes: boolean;
  preserveAspectRatio: boolean;
  outputFormat: OutputFormat;
}

export const DEFAULT_OPTIONS: ConvertOptions = {
  pageRange: "all",
  slideLayout: "title-content",
  includeSpeakerNotes: true,
  preserveAspectRatio: true,
  outputFormat: "pptx",
};

export interface SummaryStats {
  totalSlides: number;
  totalPagesInSource: number;
  totalBullets: number;
  totalHeadings: number;
  totalTextLength: number;
  avgBulletsPerSlide: number;
  slidesWithHeadingTitle: number;
  slidesWithNotes: number;
  layout: SlideLayout;
}

export interface TitleQualityScore {
  score: number; // 0–100
  reasons: string[];
}

export interface NotesValidation {
  ok: boolean;
  emptyNotesCount: number;
  tooLongNotesCount: number;
  warnings: string[];
}

export interface HistoryEntry {
  ts: number;
  fileName: string;
  pageCount: number;
  slideCount: number;
  layout: SlideLayout;
  format: OutputFormat;
}

// ---------------------------------------------------------------------------
// Page-range normalization (reuses the shared parser logic conceptually)
// ---------------------------------------------------------------------------

export function normalizePageRangeSpec(spec: string): string {
  const trimmed = (spec ?? "").trim().toLowerCase();
  if (!trimmed) return "all";
  if (trimmed === "all") return "all";
  return trimmed.replace(/\s+/g, " ");
}

export function resolveAllRange(spec: string, pageCount: number): string {
  const normalized = normalizePageRangeSpec(spec);
  if (normalized === "all") return pageCount > 0 ? `1-${pageCount}` : "1";
  return normalized;
}

// ---------------------------------------------------------------------------
// Slide-layout selector
// ---------------------------------------------------------------------------

export interface SlideLayoutShape {
  layout: SlideLayout;
  hasTitle: boolean;
  /** Number of body content placeholders. */
  bodyPlaceholderCount: number;
  /** Whether the layout uses two-column split. */
  twoColumn: boolean;
}

/** Return the placeholder shape for the given slide layout. */
export function selectSlideLayout(layout: SlideLayout): SlideLayoutShape {
  switch (layout) {
    case "full-page":
      return { layout, hasTitle: false, bodyPlaceholderCount: 1, twoColumn: false };
    case "title-content":
      return { layout, hasTitle: true, bodyPlaceholderCount: 1, twoColumn: false };
    case "two-content":
      return { layout, hasTitle: true, bodyPlaceholderCount: 2, twoColumn: true };
    case "blank":
      return { layout, hasTitle: true, bodyPlaceholderCount: 0, twoColumn: false };
  }
}

// ---------------------------------------------------------------------------
// Font-size analysis (for heading detection)
// ---------------------------------------------------------------------------

export function analyzeFontSizes(items: TextItem[]): { bodyFontSize: number; headingFontSizes: number[] } {
  if (items.length === 0) return { bodyFontSize: 0, headingFontSizes: [] };
  const counts = new Map<number, number>();
  let totalChars = 0;
  for (const it of items) {
    if (it.fontSize <= 0) continue;
    const len = it.text.length;
    counts.set(it.fontSize, (counts.get(it.fontSize) ?? 0) + len);
    totalChars += len;
  }
  if (counts.size === 0 || totalChars === 0) {
    return { bodyFontSize: 0, headingFontSizes: [] };
  }
  let body = 0;
  let bodyChars = -1;
  for (const [size, chars] of counts) {
    if (chars > bodyChars) { body = size; bodyChars = chars; }
  }
  const headingFontSizes = Array.from(counts.keys())
    .filter((s) => s > body * 1.15)
    .sort((a, b) => b - a);
  return { bodyFontSize: body, headingFontSizes };
}

export function classifyHeadingLevel(
  fontSize: number,
  bodyFontSize: number,
  headingSizes: number[] = [],
): HeadingLevel {
  if (bodyFontSize <= 0 || fontSize <= bodyFontSize * 1.15) return "body";
  const sorted = [...headingSizes].sort((a, b) => b - a);
  if (sorted.length === 0) {
    const ratio = fontSize / bodyFontSize;
    if (ratio >= 2) return "h1";
    if (ratio >= 1.5) return "h2";
    return "h3";
  }
  if (fontSize >= sorted[0]) return "h1";
  if (sorted.length >= 2 && fontSize >= sorted[1]) return "h2";
  if (sorted.length >= 3 && fontSize >= sorted[2]) return "h3";
  if (fontSize > bodyFontSize * 1.15) return "h3";
  return "body";
}

// ---------------------------------------------------------------------------
// Paragraph detection (from a flat list of text items on one page)
// ---------------------------------------------------------------------------

export function detectParagraphs(items: TextItem[], bodyFontSize: number, headingSizes: number[]): Paragraph[] {
  const out: Paragraph[] = [];
  let current = "";
  let currentPage = 0;
  let currentSize = 0;
  let currentBold = false;
  let currentItalic = false;
  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) {
      out.push({
        level: classifyHeadingLevel(currentSize, bodyFontSize, headingSizes),
        text: trimmed,
        pageNumber: currentPage,
        bold: currentBold,
        italic: currentItalic,
      });
    }
    current = "";
  };
  for (const it of items) {
    if (current && (it.fontSize !== currentSize || it.bold !== currentBold || it.italic !== currentItalic)) {
      flush();
    }
    const parts = it.text.split(/\n\s*\n/);
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) flush();
      current += parts[i].replace(/\s+/g, " ");
    }
    currentSize = it.fontSize;
    currentPage = it.pageNumber;
    currentBold = it.bold ?? false;
    currentItalic = it.italic ?? false;
    if (/\.\s{2,}/.test(current)) flush();
  }
  flush();
  return out;
}

// ---------------------------------------------------------------------------
// Content extractor (per page → SlideContent)
// ---------------------------------------------------------------------------

/**
 * Build a SlideContent from a list of paragraphs on one PDF page.
 * Picks the first heading (h1 preferred, then h2, then h3) as the title;
 * if no heading is found, uses "Page N".
 */
export function extractSlideContent(paragraphs: Paragraph[], pageNumber: number, slideNumber: number): SlideContent {
  const headings = paragraphs.filter((p) => p.level !== "body");
  const bodyParagraphs = paragraphs.filter((p) => p.level === "body");

  // Title selection — first h1, else first h2, else first h3, else "Page N"
  let title = `Page ${pageNumber}`;
  let hasHeadingTitle = false;
  const firstH1 = headings.find((h) => h.level === "h1");
  const firstH2 = headings.find((h) => h.level === "h2");
  const firstH3 = headings.find((h) => h.level === "h3");
  const titlePara = firstH1 ?? firstH2 ?? firstH3;
  if (titlePara) {
    title = titlePara.text;
    hasHeadingTitle = true;
  }

  // Bullets — from body paragraphs (and remaining headings beyond the title)
  const bullets: string[] = [];
  for (const h of headings) {
    if (h === titlePara) continue;
    bullets.push(h.text);
  }
  for (const b of bodyParagraphs) {
    bullets.push(b.text);
  }

  // Speaker notes — all non-heading text + headings beyond the title
  const notesParts: string[] = [];
  for (const h of headings) {
    if (h === titlePara) continue;
    notesParts.push(h.text);
  }
  for (const b of bodyParagraphs) {
    notesParts.push(b.text);
  }
  const notes = notesParts.join("\n\n");
  const textLength = paragraphs.reduce((sum, p) => sum + p.text.length, 0);

  return {
    slideNumber,
    originalPage: pageNumber,
    title,
    headings: headings.filter((h) => h !== titlePara),
    bodyParagraphs,
    bullets,
    notes,
    textLength,
    hasHeadingTitle,
  };
}

// ---------------------------------------------------------------------------
// Slide title generator + content formatter
// ---------------------------------------------------------------------------

/** Standalone title generator (uses extractSlideContent internally). */
export function generateSlideTitle(paragraphs: Paragraph[], pageNumber: number): string {
  const headings = paragraphs.filter((p) => p.level !== "body");
  const firstH1 = headings.find((h) => h.level === "h1");
  const firstH2 = headings.find((h) => h.level === "h2");
  const firstH3 = headings.find((h) => h.level === "h3");
  const titlePara = firstH1 ?? firstH2 ?? firstH3;
  return titlePara ? titlePara.text : `Page ${pageNumber}`;
}

/** Format body paragraphs as bullet lines (one bullet per paragraph). */
export function formatSlideContent(slide: SlideContent, layout: SlideLayout): string[] {
  if (layout === "blank") return [];
  return slide.bullets.map((b) => `• ${b}`);
}

// ---------------------------------------------------------------------------
// Speaker-notes extractor
// ---------------------------------------------------------------------------

/** Extract speaker notes — all non-heading text joined with blank lines. */
export function extractSpeakerNotes(paragraphs: Paragraph[], titlePara?: Paragraph): string {
  const parts: string[] = [];
  for (const p of paragraphs) {
    if (p === titlePara) continue;
    parts.push(p.text);
  }
  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Aspect-ratio calculator
// ---------------------------------------------------------------------------

const EMU_PER_INCH = 914400;
const DEFAULT_SLIDE_WIDTH_EMU = 9144000; // 10in (4:3)
const DEFAULT_SLIDE_HEIGHT_EMU = 6858000; // 7.5in (4:3)
const WIDESCREEN_WIDTH_EMU = 12192000; // 13.333in (16:9)
const WIDESCREEN_HEIGHT_EMU = 6858000; // 7.5in (16:9)

/**
 * Calculate slide dimensions from PDF page width/height (in PDF points).
 * 1 PDF point = 1/72 inch. If preserveAspectRatio is false, uses 16:9 default.
 */
export function calcSlideDimensions(
  pdfPageWidthPt: number,
  pdfPageHeightPt: number,
  preserveAspectRatio: boolean,
): AspectRatio {
  const w = pdfPageWidthPt > 0 ? pdfPageWidthPt : 612;
  const h = pdfPageHeightPt > 0 ? pdfPageHeightPt : 792;
  const ratio = w / h;

  if (!preserveAspectRatio) {
    return {
      ratio: 16 / 9,
      slideWidthEmu: WIDESCREEN_WIDTH_EMU,
      slideHeightEmu: WIDESCREEN_HEIGHT_EMU,
      label: "16:9 (default)",
    };
  }

  // Choose 16:9 if PDF is wider than ~1.4, else 4:3
  if (ratio >= 1.4) {
    return {
      ratio,
      slideWidthEmu: WIDESCREEN_WIDTH_EMU,
      slideHeightEmu: WIDESCREEN_HEIGHT_EMU,
      label: "16:9",
    };
  }
  if (Math.abs(ratio - 4 / 3) < 0.1) {
    return {
      ratio,
      slideWidthEmu: DEFAULT_SLIDE_WIDTH_EMU,
      slideHeightEmu: DEFAULT_SLIDE_HEIGHT_EMU,
      label: "4:3",
    };
  }
  // Custom — scale to fit the standard 10in × 7.5in canvas while preserving aspect
  const targetWidthIn = 10;
  const targetHeightIn = targetWidthIn / ratio;
  return {
    ratio,
    slideWidthEmu: Math.round(targetWidthIn * EMU_PER_INCH),
    slideHeightEmu: Math.round(targetHeightIn * EMU_PER_INCH),
    label: "Custom",
  };
}

// ---------------------------------------------------------------------------
// Escaping
// ---------------------------------------------------------------------------

export function escapeXml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function escapeHtml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function escapeMarkdown(s: string): string {
  return (s ?? "").replace(/([\\`*_{\}\[\]()#+\-.!|>])/g, "\\$1");
}

export function escapeCsv(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------------------------------------------------------------------------
// PPTX XML generators (minimal valid OOXML)
// ---------------------------------------------------------------------------

/** Generate [Content_Types].xml for the PPTX package. */
export function generateContentTypesXml(slideCount: number): string {
  const overrides: string[] = [
    `<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>`,
    `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>`,
    `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`,
    `<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>`,
  ];
  for (let i = 1; i <= slideCount; i++) {
    overrides.push(
      `<Override PartName="/ppt/slides/slide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
    );
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
${overrides.join("\n")}
</Types>`;
}

/** Generate _rels/.rels for the PPTX package. */
export function generateRootRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;
}

/** Generate ppt/_rels/presentation.xml.rels. */
export function generatePresentationRelsXml(slideCount: number): string {
  const rels: string[] = [
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`,
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>`,
  ];
  for (let i = 1; i <= slideCount; i++) {
    rels.push(
      `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i}.xml"/>`,
    );
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${rels.join("\n")}
</Relationships>`;
}

/** Generate ppt/presentation.xml. */
export function generatePresentationXml(slideCount: number, aspect: AspectRatio): string {
  const sldIds = Array.from({ length: slideCount }, (_, i) =>
    `<p:sldId id="${256 + i}" r:id="rId${i + 3}"/>`,
  ).join("");
  const sldSz = `<p:sldSz cx="${aspect.slideWidthEmu}" cy="${aspect.slideHeightEmu}" type="screen16x9"/>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
<p:sldIdLst>${sldIds}</p:sldIdLst>
<p:sldSz cx="${aspect.slideWidthEmu}" cy="${aspect.slideHeightEmu}"/>
<p:notesMasterIdLst><p:notesMasterId r:id="rId2"/></p:notesMasterIdLst>
</p:presentation>`;
}

/** Generate a minimal slideMaster1.xml. */
export function generateSlideMasterXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
</p:spTree></p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`;
}

/** Generate a minimal slideLayout1.xml. */
export function generateSlideLayoutXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="title" preserve="1">
<p:cSld name="Title Slide"><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
</p:spTree></p:cSld>
</p:sldLayout>`;
}

/** Generate a minimal theme1.xml. */
export function generateThemeXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">
<a:themeElements><a:clrScheme name="Office">
<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
<a:dk2><a:srgbClr val="44546A"/></a:dk2>
<a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>
<a:accent1><a:srgbClr val="4472C4"/></a:accent1>
<a:accent2><a:srgbClr val="ED7D31"/></a:accent2>
<a:accent3><a:srgbClr val="A5A5A5"/></a:accent3>
<a:accent4><a:srgbClr val="FFC000"/></a:accent4>
<a:accent5><a:srgbClr val="5B9BD5"/></a:accent5>
<a:accent6><a:srgbClr val="70AD47"/></a:accent6>
<a:hlink><a:srgbClr val="0563C1"/></a:hlink>
<a:folHlink><a:srgbClr val="954F72"/></a:folHlink>
</a:clrScheme>
<a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>
<a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="25400" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="38100" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements>
<a:objectDefaults/><a:extraClrSchemeLst/>
</a:theme>`;
}

/** Generate slideN.xml for a single slide. */
export function generateSlideXml(slide: SlideContent, layout: SlideLayout, includeNotes: boolean): string {
  const shape = selectSlideLayout(layout);
  const titleText = escapeXml(slide.title || `Slide ${slide.slideNumber}`);
  const bodyText = slide.bullets.map((b) => escapeXml(b)).join("</a:t><a:br/><a:t>");
  const titleShape = shape.hasTitle
    ? `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="274638"/><a:ext cx="8229600" cy="1143000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>${titleText}</a:t></a:r></a:p></p:txBody></p:sp>`
    : "";
  const bodyShape = (shape.bodyPlaceholderCount > 0 && bodyText)
    ? `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="1600200"/><a:ext cx="8229600" cy="4572000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>${bodyText}</a:t></a:r></a:p></p:txBody></p:sp>`
    : "";
  const notesShape = (includeNotes && slide.notes)
    ? `<p:notes><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>${escapeXml(slide.notes)}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
${titleShape}
${bodyShape}
</p:spTree></p:cSld>
${notesShape}
</p:sld>`;
}

// ---------------------------------------------------------------------------
// ZIP file builder (store mode, no compression) — reused pattern
// ---------------------------------------------------------------------------

/** CRC-32 table (polynomial 0xEDB88320). */
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export function utf8Encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function pushU32(arr: number[], val: number): void {
  arr.push(val & 0xFF, (val >>> 8) & 0xFF, (val >>> 16) & 0xFF, (val >>> 24) & 0xFF);
}
function pushU16(arr: number[], val: number): void {
  arr.push(val & 0xFF, (val >>> 8) & 0xFF);
}

export interface ZipFile {
  name: string;
  bytes: Uint8Array;
}

/** Build a minimal valid ZIP archive (store mode, no compression). */
export function buildZip(files: ZipFile[]): Uint8Array {
  const out: number[] = [];
  const centralDir: number[] = [];
  let offset = 0;
  for (const file of files) {
    const nameBytes = utf8Encode(file.name);
    const crc = crc32(file.bytes);
    const size = file.bytes.length;
    pushU32(out, 0x04034b50);
    pushU16(out, 20); pushU16(out, 0); pushU16(out, 0);
    pushU16(out, 0); pushU16(out, 0);
    pushU32(out, crc); pushU32(out, size); pushU32(out, size);
    pushU16(out, nameBytes.length); pushU16(out, 0);
    for (const b of nameBytes) out.push(b);
    for (const b of file.bytes) out.push(b);
    pushU32(centralDir, 0x02014b50);
    pushU16(centralDir, 20); pushU16(centralDir, 20);
    pushU16(centralDir, 0); pushU16(centralDir, 0);
    pushU16(centralDir, 0); pushU16(centralDir, 0);
    pushU32(centralDir, crc); pushU32(centralDir, size); pushU32(centralDir, size);
    pushU16(centralDir, nameBytes.length);
    pushU16(centralDir, 0); pushU16(centralDir, 0); pushU16(centralDir, 0);
    pushU16(centralDir, 0); pushU32(centralDir, 0);
    pushU32(centralDir, offset);
    for (const b of nameBytes) centralDir.push(b);
    offset = out.length;
  }
  const cdStart = out.length;
  const cdSize = centralDir.length;
  for (const b of centralDir) out.push(b);
  pushU32(out, 0x06054b50);
  pushU16(out, 0); pushU16(out, 0);
  pushU16(out, files.length); pushU16(out, files.length);
  pushU32(out, cdSize); pushU32(out, cdStart);
  pushU16(out, 0);
  return new Uint8Array(out);
}

// ---------------------------------------------------------------------------
// PPTX package assembly
// ---------------------------------------------------------------------------

/** Build a complete .pptx file (ZIP of OOXML XML parts). */
export function buildPptxPackage(
  slides: SlideContent[],
  opts: ConvertOptions,
  aspect: AspectRatio,
): Uint8Array {
  const files: ZipFile[] = [
    { name: "[Content_Types].xml", bytes: utf8Encode(generateContentTypesXml(slides.length)) },
    { name: "_rels/.rels", bytes: utf8Encode(generateRootRelsXml()) },
    { name: "ppt/presentation.xml", bytes: utf8Encode(generatePresentationXml(slides.length, aspect)) },
    { name: "ppt/_rels/presentation.xml.rels", bytes: utf8Encode(generatePresentationRelsXml(slides.length)) },
    { name: "ppt/slideMasters/slideMaster1.xml", bytes: utf8Encode(generateSlideMasterXml()) },
    { name: "ppt/slideLayouts/slideLayout1.xml", bytes: utf8Encode(generateSlideLayoutXml()) },
    { name: "ppt/theme/theme1.xml", bytes: utf8Encode(generateThemeXml()) },
  ];
  for (let i = 0; i < slides.length; i++) {
    files.push({
      name: `ppt/slides/slide${i + 1}.xml`,
      bytes: utf8Encode(generateSlideXml(slides[i], opts.slideLayout, opts.includeSpeakerNotes)),
    });
  }
  return buildZip(files);
}

// ---------------------------------------------------------------------------
// HTML slides generator (single-file deck with prev/next nav)
// ---------------------------------------------------------------------------

export function generateHtmlSlides(slides: SlideContent[], opts: ConvertOptions): string {
  const sections = slides.map((s, i) => {
    const title = escapeHtml(s.title);
    const bullets = s.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("\n");
    const notes = opts.includeSpeakerNotes && s.notes
      ? `<aside class="notes"><h4>Speaker notes</h4><pre>${escapeHtml(s.notes)}</pre></aside>`
      : "";
    return `<section class="slide" data-slide="${i + 1}">
      <header><h2>${title}</h2><small>Slide ${i + 1} of ${slides.length} · from page ${s.originalPage}</small></header>
      ${bullets ? `<ul>${bullets}</ul>` : ""}
      ${notes}
    </section>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>PDF → Slides</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #111; color: #eee; }
  .deck { display: flex; flex-direction: column; align-items: center; padding: 1rem; gap: 1rem; }
  .slide { width: 90vw; max-width: 960px; aspect-ratio: 16/9; background: #fff; color: #111; border-radius: 8px; padding: 2rem 3rem; box-shadow: 0 8px 24px rgba(0,0,0,.4); display: flex; flex-direction: column; }
  .slide header h2 { margin: 0 0 .25rem; font-size: 2rem; }
  .slide header small { color: #888; font-size: .85rem; }
  .slide ul { font-size: 1.25rem; line-height: 1.5; flex: 1; }
  .slide .notes { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #ddd; color: #555; font-size: .85rem; }
  .slide .notes pre { white-space: pre-wrap; font-family: inherit; margin: 0; }
  nav { position: fixed; bottom: 1rem; right: 1rem; display: flex; gap: .5rem; }
  nav button { background: #333; color: #eee; border: 0; padding: .5rem 1rem; border-radius: 4px; cursor: pointer; }
  nav button:hover { background: #555; }
  @media print { body { background: #fff; } nav { display: none; } .slide { box-shadow: none; page-break-after: always; aspect-ratio: auto; width: 100%; max-width: none; } }
</style>
</head>
<body>
<div class="deck">
${sections}
</div>
<nav>
  <button onclick="window.scrollTo({top:0,behavior:'smooth'})">Top</button>
  <button onclick="window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'})">Bottom</button>
</nav>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Markdown slides generator (Marp-compatible)
// ---------------------------------------------------------------------------

export function generateMarkdownSlides(slides: SlideContent[], opts: ConvertOptions): string {
  const header = `---
marp: true
theme: default
paginate: true
---

`;
  const blocks = slides.map((s) => {
    const title = `# ${s.title}`;
    const bullets = s.bullets.map((b) => `- ${b.replace(/\n+/g, " ")}`).join("\n");
    const notes = opts.includeSpeakerNotes && s.notes
      ? `\n\n<!--\n${s.notes}\n-->`
      : "";
    return `${title}\n\n${bullets}${notes}`;
  });
  return header + blocks.join("\n\n---\n\n") + "\n";
}

// ---------------------------------------------------------------------------
// Text outline renderer (and CSV)
// ---------------------------------------------------------------------------

export function renderTextOutline(slides: SlideContent[], opts: ConvertOptions): string {
  const lines: string[] = [];
  lines.push(`PDF → Slides outline`);
  lines.push(`==================`);
  lines.push(`Layout: ${opts.slideLayout}`);
  lines.push(`Slides: ${slides.length}`);
  lines.push(`Notes:  ${opts.includeSpeakerNotes ? "included" : "excluded"}`);
  lines.push("");
  for (const s of slides) {
    lines.push(`[Slide ${s.slideNumber}] (from page ${s.originalPage})`);
    lines.push(`  Title: ${s.title}${s.hasHeadingTitle ? "" : " (auto)"}`);
    for (const b of s.bullets) {
      lines.push(`    • ${b}`);
    }
    if (opts.includeSpeakerNotes && s.notes) {
      lines.push(`  Notes: ${s.notes.slice(0, 100)}${s.notes.length > 100 ? "…" : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function renderCsv(slides: SlideContent[], opts: ConvertOptions): string {
  const header = "slide_num,original_page,title,has_heading_title,bullet_count,content,notes";
  const rows = [header];
  for (const s of slides) {
    rows.push([
      String(s.slideNumber),
      String(s.originalPage),
      escapeCsv(s.title),
      s.hasHeadingTitle ? "yes" : "no",
      String(s.bullets.length),
      escapeCsv(s.bullets.join(" | ")),
      opts.includeSpeakerNotes ? escapeCsv(s.notes) : "",
    ].join(","));
  }
  return rows.join("\n");
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

export function computeSummaryStats(slides: SlideContent[], opts: ConvertOptions, totalPagesInSource: number): SummaryStats {
  let totalBullets = 0;
  let totalHeadings = 0;
  let totalTextLength = 0;
  let slidesWithHeadingTitle = 0;
  let slidesWithNotes = 0;
  for (const s of slides) {
    totalBullets += s.bullets.length;
    totalHeadings += s.headings.length;
    totalTextLength += s.textLength;
    if (s.hasHeadingTitle) slidesWithHeadingTitle++;
    if (s.notes) slidesWithNotes++;
  }
  return {
    totalSlides: slides.length,
    totalPagesInSource,
    totalBullets,
    totalHeadings,
    totalTextLength,
    avgBulletsPerSlide: slides.length > 0 ? Math.round((totalBullets / slides.length) * 10) / 10 : 0,
    slidesWithHeadingTitle,
    slidesWithNotes,
    layout: opts.slideLayout,
  };
}

/** Calculate slide count given a page selection and total page count. */
export function calcSlideCount(pageIndices: number[]): number {
  return pageIndices.length;
}

// ---------------------------------------------------------------------------
// Title-extraction quality scorer
// ---------------------------------------------------------------------------

export function scoreTitleExtraction(slides: SlideContent[]): TitleQualityScore {
  if (slides.length === 0) {
    return { score: 0, reasons: ["No slides"] };
  }
  const withHeading = slides.filter((s) => s.hasHeadingTitle).length;
  const ratio = withHeading / slides.length;
  const reasons: string[] = [];
  if (ratio === 1) reasons.push("All slides have heading-derived titles");
  else if (ratio >= 0.75) reasons.push("Most slides have heading-derived titles");
  else if (ratio >= 0.5) reasons.push("About half the slides have heading-derived titles");
  else if (ratio > 0) reasons.push("Few slides have heading-derived titles");
  else reasons.push("No headings detected — all titles are 'Page N' placeholders");
  // Detect slides with very long titles (likely not real headings)
  const longTitles = slides.filter((s) => s.title.length > 80).length;
  if (longTitles > 0) reasons.push(`${longTitles} slide(s) have unusually long titles (over 80 chars)`);
  // Detect duplicate titles
  const titleCounts = new Map<string, number>();
  for (const s of slides) titleCounts.set(s.title, (titleCounts.get(s.title) ?? 0) + 1);
  const dupes = Array.from(titleCounts.values()).filter((c) => c > 1).length;
  if (dupes > 0) reasons.push(`${dupes} duplicate title(s) found`);
  const score = Math.round(ratio * 100);
  return { score, reasons };
}

// ---------------------------------------------------------------------------
// Speaker-notes length validator
// ---------------------------------------------------------------------------

const MAX_NOTES_LENGTH = 4000;

export function validateSpeakerNotes(slides: SlideContent[]): NotesValidation {
  let emptyNotesCount = 0;
  let tooLongNotesCount = 0;
  const warnings: string[] = [];
  for (const s of slides) {
    if (!s.notes || s.notes.trim().length === 0) {
      emptyNotesCount++;
    } else if (s.notes.length > MAX_NOTES_LENGTH) {
      tooLongNotesCount++;
      warnings.push(`Slide ${s.slideNumber}: notes are ${s.notes.length} chars (over ${MAX_NOTES_LENGTH})`);
    }
  }
  if (emptyNotesCount > 0) {
    warnings.push(`${emptyNotesCount} slide(s) have empty speaker notes`);
  }
  return {
    ok: emptyNotesCount === 0 && tooLongNotesCount === 0,
    emptyNotesCount,
    tooLongNotesCount,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Output dispatch
// ---------------------------------------------------------------------------

/** Render as text-based format (HTML, Markdown, text outline, CSV). PPTX uses buildPptxPackage directly. */
export function renderOutput(
  slides: SlideContent[],
  opts: ConvertOptions,
  aspect: AspectRatio,
): string {
  switch (opts.outputFormat) {
    case "html-slides": return generateHtmlSlides(slides, opts);
    case "markdown-sildes": return generateMarkdownSlides(slides, opts);
    case "pptx":
    default:
      return renderTextOutline(slides, opts);
  }
}

// ---------------------------------------------------------------------------
// Output filename helper
// ---------------------------------------------------------------------------

export function getOutputFilename(format: OutputFormat, originalName: string): string {
  const base = (originalName ?? "output").replace(/\.pdf$/i, "").replace(/[^\w.-]+/g, "_") || "output";
  return `${base}-slides.${FORMAT_EXTENSIONS[format]}`;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:pdf-to-powerpoint-converter:history";
const HISTORY_MAX = 20;

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore quota errors
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

const VALID_FORMATS = new Set<OutputFormat>(OUTPUT_FORMATS);
const VALID_LAYOUTS = new Set<SlideLayout>(SLIDE_LAYOUTS);

export function buildShareUrl(opts: ConvertOptions): string {
  const params = new URLSearchParams();
  if (opts.pageRange && opts.pageRange !== "all") params.set("range", opts.pageRange);
  if (opts.slideLayout !== "title-content") params.set("layout", opts.slideLayout);
  if (!opts.includeSpeakerNotes) params.set("notes", "0");
  if (!opts.preserveAspectRatio) params.set("aspect", "0");
  if (opts.outputFormat !== "pptx") params.set("format", opts.outputFormat);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ConvertOptions> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ConvertOptions> = {};
  const range = params.get("range");
  if (range) out.pageRange = range;
  const layout = params.get("layout");
  if (layout && VALID_LAYOUTS.has(layout as SlideLayout)) out.slideLayout = layout as SlideLayout;
  const notes = params.get("notes");
  if (notes !== null) out.includeSpeakerNotes = notes !== "0";
  const aspect = params.get("aspect");
  if (aspect !== null) out.preserveAspectRatio = aspect !== "0";
  const format = params.get("format");
  if (format && VALID_FORMATS.has(format as OutputFormat)) out.outputFormat = format as OutputFormat;
  return out;
}

// ---------------------------------------------------------------------------
// Options validation
// ---------------------------------------------------------------------------

export function validateOptions(opts: ConvertOptions, pageCount: number): ToolResult<ConvertOptions> {
  if (!opts) return { ok: false, error: "Missing options." };
  if (!VALID_FORMATS.has(opts.outputFormat)) {
    return { ok: false, error: `Unknown output format: ${opts.outputFormat}` };
  }
  if (!VALID_LAYOUTS.has(opts.slideLayout)) {
    return { ok: false, error: `Unknown slide layout: ${opts.slideLayout}` };
  }
  const normalized = normalizePageRangeSpec(opts.pageRange);
  if (normalized !== "all" && pageCount > 0) {
    if (!/^[0-9,\-\s]+$/.test(normalized)) {
      return { ok: false, error: `Invalid page range "${opts.pageRange}". Use "all" or e.g. "1-3, 5, 8-".` };
    }
  }
  return { ok: true, output: { ...opts, pageRange: normalized } };
}
