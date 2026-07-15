/**
 * PDF to ODP Converter — pure-JS OpenDocument Presentation generator.
 *
 * ODP structure (ZIP):
 *   - mimetype (STORE, first, uncompressed)
 *   - META-INF/manifest.xml
 *   - content.xml — draw:page elements with draw:frame + draw:text-box
 *   - styles.xml — named styles (Title, Bullets, default)
 *   - meta.xml — document metadata
 *
 * Each PDF page becomes one slide (<draw:page>). The first non-empty line
 * becomes the title; the remaining lines become bullet points.
 */

import {
  extractPdfText,
  formatBytes,
  type ConvertOptions as TextOptions,
} from "../pdf-to-text-converter/logic";
import {
  createZipBlob,
  type ZipFile,
  xmlEscape,
  xmlAttrEscape,
} from "../csv-to-excel-converter/logic";
import type { ToolResult } from "../../../lib/tool";

// ===== Types =====

export type OdpLayout = "title-bullets" | "bullets-only";
export type OdpRatio = "16:9" | "4:3" | "a4";

export interface OdpOptions {
  /** Page range (e.g. "1-3,5"). Empty = all pages. */
  pageRange: string;
  /** Slide layout. */
  layout: OdpLayout;
  /** Slide aspect ratio. */
  ratio: OdpRatio;
  /** Body font size in pt. */
  fontSize: number;
  /** Slide master background color (hex without #). */
  backgroundColor: string;
  /** Title color (hex without #). */
  titleColor: string;
  /** Custom document title. */
  title: string;
  /** Custom document author. */
  author: string;
}

export const DEFAULT_OPTIONS: OdpOptions = {
  pageRange: "",
  layout: "title-bullets",
  ratio: "16:9",
  fontSize: 18,
  backgroundColor: "FFFFFF",
  titleColor: "1F4E79",
  title: "Converted from PDF",
  author: "UnQTools",
};

export interface OdpSlide {
  /** 1-indexed slide number. */
  number: number;
  /** Title text (empty for bullets-only). */
  title: string;
  /** Bullet point paragraphs. */
  bullets: string[];
  /** Word count. */
  wordCount: number;
}

export interface OdpResult {
  blob: Blob;
  fileName: string;
  slideCount: number;
  wordCount: number;
  charCount: number;
  pageCount: number;
  odpBytes: number;
  slides: OdpSlide[];
}

// ===== Slide dimensions =====

/** Get slide dimensions in cm for content.xml's draw:page. */
export function getSlideDimensionsCm(ratio: OdpRatio): { width: number; height: number } {
  if (ratio === "16:9") return { width: 33.867, height: 19.05 }; // 13.333" x 7.5"
  if (ratio === "4:3") return { width: 25.4, height: 19.05 }; // 10" x 7.5"
  return { width: 21.0, height: 29.7 }; // A4 portrait
}

// ===== Slide building =====

/** Build OdpSlide objects from PDF page texts. */
export function buildSlides(pageTexts: string[], opts: OdpOptions): OdpSlide[] {
  const slides: OdpSlide[] = [];
  let number = 1;
  for (const pageText of pageTexts) {
    const lines = pageText.split("\n").map((l) => l.trim()).filter((l) => l !== "");
    if (lines.length === 0) continue;
    const title = opts.layout === "title-bullets" ? lines[0]! : "";
    const bullets = opts.layout === "title-bullets" ? lines.slice(1) : lines;
    slides.push({
      number: number++,
      title,
      bullets,
      wordCount: countWords(lines.join(" ")),
    });
  }
  return slides;
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter((s) => s.length > 0).length;
}

// ===== content.xml =====

const OFFICE_NS = "urn:oasis:names:tc:opendocument:xmlns:office:1.0";
const DRAW_NS = "urn:oasis:names:tc:opendocument:xmlns:drawing:1.0";
const TEXT_NS = "urn:oasis:names:tc:opendocument:xmlns:text:1.0";
const STYLE_NS = "urn:oasis:names:tc:opendocument:xmlns:style:1.0";
const FO_NS = "urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0";
const SVG_NS = "urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0";

/** Generate a single draw:page element. */
export function generateSlideXml(slide: OdpSlide, opts: OdpOptions): string {
  const dims = getSlideDimensionsCm(opts.ratio);
  const titleFrame = opts.layout === "title-bullets" && slide.title
    ? `      <draw:frame draw:style-name="TitleFrame" draw:text-style-name="TitlePara" svg:x="1.5cm" svg:y="1cm" svg:width="${(dims.width - 3).toFixed(2)}cm" svg:height="3cm" xmlns:svg="${SVG_NS}">
        <draw:text-box>
          <text:p text:style-name="TitlePara">${escapeXml(slide.title)}</text:p>
        </draw:text-box>
      </draw:frame>`
    : "";
  const topY = opts.layout === "title-bullets" ? 4.5 : 1;
  const height = dims.height - topY - 1;
  const bulletsXml = slide.bullets.length > 0
    ? slide.bullets.map((b) => `          <text:p text:style-name="BulletPara">${escapeXml(b)}</text:p>`).join("\n")
    : `          <text:p text:style-name="BulletPara"/>`;
  const contentFrame = `      <draw:frame draw:style-name="ContentFrame" draw:text-style-name="BulletPara" svg:x="1.5cm" svg:y="${topY}cm" svg:width="${(dims.width - 3).toFixed(2)}cm" svg:height="${height.toFixed(2)}cm" xmlns:svg="${SVG_NS}">
        <draw:text-box>
${bulletsXml}
        </draw:text-box>
      </draw:frame>`;
  return `    <draw:page draw:name="slide${slide.number}" draw:style-name="SlideStyle" draw:master-page-name="Standard">
${titleFrame}
${contentFrame}
    </draw:page>`;
}

/** Generate the full content.xml. */
export function generateContentXml(slides: OdpSlide[], opts: OdpOptions): string {
  const dims = getSlideDimensionsCm(opts.ratio);
  const bgColor = opts.backgroundColor.replace(/^#/, "").toUpperCase();
  const titleColor = opts.titleColor.replace(/^#/, "").toUpperCase();
  const fs = Math.max(10, Math.min(36, opts.fontSize));
  const pagesXml = slides.map((s) => generateSlideXml(s, opts)).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="${OFFICE_NS}" xmlns:draw="${DRAW_NS}" xmlns:text="${TEXT_NS}" xmlns:style="${STYLE_NS}" xmlns:fo="${FO_NS}" xmlns:svg="${SVG_NS}" office:version="1.2">
  <office:automatic-styles>
    <style:style style:name="SlideStyle" style:family="drawing-page">
      <style:drawing-page-properties draw:fill="solid" draw:fill-color="${bgColor}"/>
    </style:style>
    <style:style style:name="TitleFrame" style:family="graphic">
      <style:graphic-properties draw:stroke="none" draw:fill="none"/>
    </style:style>
    <style:style style:name="ContentFrame" style:family="graphic">
      <style:graphic-properties draw:stroke="none" draw:fill="none"/>
    </style:style>
    <style:style style:name="TitlePara" style:family="paragraph">
      <style:text-properties fo:font-size="28pt" fo:font-weight="bold" fo:color="#${titleColor}"/>
    </style:style>
    <style:style style:name="BulletPara" style:family="paragraph">
      <style:paragraph-properties fo:margin-left="0.5cm" fo:text-indent="-0.5cm"/>
      <style:text-properties fo:font-size="${fs}pt"/>
    </style:style>
  </office:automatic-styles>
  <office:body>
    <office:presentation>
${pagesXml}
    </office:presentation>
  </office:body>
</office:document-content>`;
}

// ===== styles.xml =====

export function generateStylesXml(opts: OdpOptions): string {
  const dims = getSlideDimensionsCm(opts.ratio);
  const bgColor = opts.backgroundColor.replace(/^#/, "").toUpperCase();
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="${OFFICE_NS}" xmlns:draw="${DRAW_NS}" xmlns:style="${STYLE_NS}" xmlns:fo="${FO_NS}" xmlns:svg="${SVG_NS}" office:version="1.2">
  <office:font-face-decls>
    <style:font-face style:name="Liberation Sans" svg:font-family="Liberation Sans"/>
  </office:font-face-decls>
  <office:styles>
    <style:default-style style:family="paragraph">
      <style:text-properties style:font-name="Liberation Sans"/>
    </style:default-style>
  </office:styles>
  <office:master-styles>
    <style:master-page style:name="Standard" style:page-layout-name="Mpm1">
      <draw:frame draw:style-name="MasterBg" svg:x="0cm" svg:y="0cm" svg:width="${dims.width}cm" svg:height="${dims.height}cm">
        <draw:text-box/>
      </draw:frame>
    </style:master-page>
  </office:master-styles>
  <office:automatic-styles>
    <style:page-layout style:name="Mpm1">
      <style:page-layout-properties fo:page-width="${dims.width}cm" fo:page-height="${dims.height}cm" fo:margin-top="0cm" fo:margin-bottom="0cm" fo:margin-left="0cm" fo:margin-right="0cm"/>
    </style:page-layout>
  </office:automatic-styles>
</office:document-styles>`;
}

// ===== meta.xml =====

export function generateMetaXml(opts: OdpOptions, stats: { slideCount: number }): string {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="${OFFICE_NS}" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" office:version="1.2">
  <office:meta>
    <meta:generator>UnQTools PDF to ODP Converter</meta:generator>
    <dc:title>${xmlEscape(opts.title)}</dc:title>
    <dc:creator>${xmlEscape(opts.author)}</dc:creator>
    <meta:creation-date>${now}</meta:creation-date>
    <dc:date>${now}</dc:date>
    <meta:document-statistic meta:page-count="${stats.slideCount}"/>
  </office:meta>
</office:document-meta>`;
}

// ===== META-INF/manifest.xml =====

export function generateManifestXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:media-type="application/vnd.oasis.opendocument.presentation" manifest:full-path="/"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="content.xml"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="styles.xml"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="meta.xml"/>
</manifest:manifest>`;
}

// ===== XML escape =====

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ===== Top-level conversion =====

export async function convertPdfToOdp(
  pdfBytes: Uint8Array,
  opts: OdpOptions = DEFAULT_OPTIONS,
  outputFileName: string = "converted.odp",
): Promise<ToolResult<OdpResult>> {
  const textOptions: TextOptions = {
    pageRange: opts.pageRange,
    lineSeparator: "\n",
    pageSeparator: "",
    trimLines: true,
    removeEmptyLines: false,
    lineNumbers: false,
    addBom: false,
  };
  const textResult = await extractPdfText(pdfBytes, textOptions);
  if (!textResult.ok) {
    return { ok: false, error: textResult.error };
  }
  const pageTexts = textResult.output.pages.map((p) => p.text);
  const slides = buildSlides(pageTexts, opts);
  if (slides.length === 0) {
    return { ok: false, error: "No text content found in the PDF." };
  }
  const enc = new TextEncoder();
  const files: ZipFile[] = [];
  files.push({ name: "mimetype", data: enc.encode("application/vnd.oasis.opendocument.presentation") });
  files.push({ name: "META-INF/manifest.xml", data: enc.encode(generateManifestXml()) });
  files.push({ name: "content.xml", data: enc.encode(generateContentXml(slides, opts)) });
  files.push({ name: "styles.xml", data: enc.encode(generateStylesXml(opts)) });
  files.push({ name: "meta.xml", data: enc.encode(generateMetaXml(opts, { slideCount: slides.length })) });
  const blob = createZipBlob(files);
  const wordCount = slides.reduce((s, sl) => s + sl.wordCount, 0);
  const charCount = slides.reduce((s, sl) => s + sl.title.length + sl.bullets.join(" ").length, 0);
  return {
    ok: true,
    output: {
      blob,
      fileName: outputFileName,
      slideCount: slides.length,
      wordCount,
      charCount,
      pageCount: textResult.output.pageCount,
      odpBytes: blob.size,
      slides,
    },
  };
}

// ===== Utilities =====

export { formatBytes, xmlEscape, xmlAttrEscape };

// ===== History =====

const HISTORY_KEY = "unqtools-pdf-to-odp-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  pdfBytes: number;
  odpBytes: number;
  slideCount: number;
  wordCount: number;
  convertedAt: string;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch { return []; }
}

export function saveToHistory(entry: HistoryEntry): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const updated = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
}

// ===== Shareable URL =====

export function buildShareUrl(opts: OdpOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  if (opts.pageRange) params.set("pages", opts.pageRange);
  params.set("layout", opts.layout);
  params.set("ratio", opts.ratio);
  params.set("fs", String(opts.fontSize));
  params.set("bg", opts.backgroundColor);
  params.set("title-color", opts.titleColor);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<OdpOptions> | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("layout") && !params.has("pages")) return null;
  const layout = (params.get("layout") ?? "title-bullets") as OdpLayout;
  const validLayouts: OdpLayout[] = ["title-bullets", "bullets-only"];
  const ratio = (params.get("ratio") ?? "16:9") as OdpRatio;
  const validRatios: OdpRatio[] = ["16:9", "4:3", "a4"];
  const fs = parseInt(params.get("fs") ?? "18", 10);
  return {
    pageRange: params.get("pages") ?? "",
    layout: validLayouts.includes(layout) ? layout : "title-bullets",
    ratio: validRatios.includes(ratio) ? ratio : "16:9",
    fontSize: isNaN(fs) ? 18 : Math.max(10, Math.min(36, fs)),
    backgroundColor: params.get("bg") ?? DEFAULT_OPTIONS.backgroundColor,
    titleColor: params.get("title-color") ?? DEFAULT_OPTIONS.titleColor,
  };
}
