/**
 * Central tool registry — explicit imports (Next.js-compatible, no Vite glob).
 *
 * Adding a new tool: drop a folder under src/tools/<cat>/<id>/ with a manifest.ts,
 * then add an import + TOOLS.push line below. Routing, search, and the homepage
 * grid pick it up automatically.
 */
import type { ToolCategory, ToolManifest } from "./tool";

import { manifest as emiCalculator } from "@/tools/calculators/emi-calculator/manifest";
import { manifest as mortgageCalculator } from "@/tools/calculators/mortgage-calculator/manifest";
import { manifest as sipCalculator } from "@/tools/calculators/sip-calculator/manifest";
import { manifest as base64 } from "@/tools/developer/base64/manifest";
import { manifest as hashGenerator } from "@/tools/developer/hash-generator/manifest";
import { manifest as jsonFormatter } from "@/tools/developer/json-formatter/manifest";
import { manifest as urlEncoder } from "@/tools/developer/url-encoder/manifest";
import { manifest as uuidGenerator } from "@/tools/developer/uuid-generator/manifest";
import { manifest as colorPicker } from "@/tools/image/color-picker/manifest";
import { manifest as imageCompressor } from "@/tools/image/image-compressor/manifest";
import { manifest as bcryptHashGenerator } from "@/tools/network-security/bcrypt-hash-generator/manifest";
import { manifest as cspEvaluator } from "@/tools/network-security/csp-evaluator/manifest";
import { manifest as dataUrlConverter } from "@/tools/network-security/data-url-converter/manifest";
import { manifest as fileHashChecker } from "@/tools/file/file-hash-checker/manifest";
import { manifest as fileMetadataViewer } from "@/tools/file/file-metadata-viewer/manifest";
import { manifest as httpStatusCodeReference } from "@/tools/network-security/http-status-code-reference/manifest";
import { manifest as ipSubnetCalculator } from "@/tools/network-security/ip-subnet-calculator/manifest";
import { manifest as jwtDecoder } from "@/tools/network-security/jwt-decoder/manifest";
import { manifest as mimeTypeLookup } from "@/tools/network-security/mime-type-lookup/manifest";
import { manifest as passwordGenerator } from "@/tools/network-security/password-generator/manifest";
import { manifest as totpGenerator } from "@/tools/network-security/totp-generator/manifest";
import { manifest as urlParser } from "@/tools/network-security/url-parser/manifest";
import { manifest as compressPdf } from "@/tools/pdf/compress-pdf/manifest";
import { manifest as contactSheetPdf } from "@/tools/pdf/pdf-contact-sheet/manifest";
import { manifest as cropPdf } from "@/tools/pdf/crop-pdf/manifest";
import { manifest as csvFileJoiner } from "@/tools/file/csv-file-joiner/manifest";
import { manifest as csvFileSplitter } from "@/tools/file/csv-file-splitter/manifest";
import { manifest as csvToTsvConverter } from "@/tools/file/csv-to-tsv-converter/manifest";
import { manifest as deletePdfPages } from "@/tools/pdf/delete-pdf-pages/manifest";
import { manifest as duplicatePdfPages } from "@/tools/pdf/duplicate-pdf-pages/manifest";
import { manifest as duplicateFileFinder } from "@/tools/file/duplicate-file-finder/manifest";
import { manifest as extractPdfPages } from "@/tools/pdf/extract-pdf-pages/manifest";
import { manifest as fileRenameUtility } from "@/tools/file/file-rename-utility/manifest";
import { manifest as flattenPdf } from "@/tools/pdf/flatten-pdf/manifest";
import { manifest as htmlToPdf } from "@/tools/pdf/html-to-pdf/manifest";
import { manifest as imagesToPdf } from "@/tools/pdf/images-to-pdf/manifest";
import { manifest as insertPdfPages } from "@/tools/pdf/insert-pdf-pages/manifest";
import { manifest as interleavePdf } from "@/tools/pdf/interleave-pdf/manifest";
import { manifest as jsonToXmlConverter } from "@/tools/file/json-to-xml-converter/manifest";
import { manifest as markdownToPdf } from "@/tools/pdf/markdown-to-pdf/manifest";
import { manifest as mergePdf } from "@/tools/pdf/merge-pdf/manifest";
import { manifest as nUpPdf } from "@/tools/pdf/n-up-pdf/manifest";
import { manifest as pdfBookmarksEditor } from "@/tools/pdf/pdf-bookmarks-editor/manifest";
import { manifest as pdfMetadataEditor } from "@/tools/pdf/pdf-metadata-editor/manifest";
import { manifest as pdfPageNumbers } from "@/tools/pdf/pdf-page-numbers/manifest";
import { manifest as pdfSignDraw } from "@/tools/pdf/pdf-sign-draw/manifest";
import { manifest as pdfStamp } from "@/tools/pdf/pdf-stamp/manifest";
import { manifest as pdfWatermark } from "@/tools/pdf/pdf-watermark/manifest";
import { manifest as removeBlankPages } from "@/tools/pdf/remove-blank-pages/manifest";
import { manifest as reorderPdfPages } from "@/tools/pdf/reorder-pdf-pages/manifest";
import { manifest as resizePdfPages } from "@/tools/pdf/resize-pdf-pages/manifest";
import { manifest as rtfToPdf } from "@/tools/pdf/rtf-to-pdf/manifest";
import { manifest as reversePdf } from "@/tools/pdf/reverse-pdf/manifest";
import { manifest as rotatePdf } from "@/tools/pdf/rotate-pdf/manifest";
import { manifest as scalePdf } from "@/tools/pdf/scale-pdf/manifest";
import { manifest as splitPdf } from "@/tools/pdf/split-pdf/manifest";
import { manifest as svgToPdf } from "@/tools/pdf/svg-to-pdf/manifest";
import { manifest as textFileJoiner } from "@/tools/file/text-file-joiner/manifest";
import { manifest as textToPdf } from "@/tools/pdf/text-to-pdf/manifest";
import { manifest as tsvToCsvConverter } from "@/tools/file/tsv-to-csv-converter/manifest";
import { manifest as addLineBreaks } from "@/tools/text/add-line-breaks/manifest";
import { manifest as addPrefixSuffix } from "@/tools/text/add-prefix-suffix/manifest";
import { manifest as bigTextGenerator } from "@/tools/text/big-text-generator/manifest";
import { manifest as boldTextGenerator } from "@/tools/text/bold-text-generator/manifest";
import { manifest as bubbleTextGenerator } from "@/tools/text/bubble-text-generator/manifest";
import { manifest as caesarCipher } from "@/tools/text/caesar-cipher/manifest";
import { manifest as caseConverter } from "@/tools/text/case-converter/manifest";
import { manifest as csvToMarkdown } from "@/tools/text/csv-to-markdown/manifest";
import { manifest as csvToTextList } from "@/tools/text/csv-to-text-list/manifest";
import { manifest as diffChecker } from "@/tools/text/diff-checker/manifest";
import { manifest as duplicateLinesRemover } from "@/tools/text/duplicate-lines-remover/manifest";
import { manifest as wordCharacterCounter } from "@/tools/text/word-character-counter/manifest";

export const TOOLS: readonly ToolManifest[] = [
  emiCalculator,
  mortgageCalculator,
  sipCalculator,
  base64,
  hashGenerator,
  jsonFormatter,
  urlEncoder,
  uuidGenerator,
  colorPicker,
  imageCompressor,
  bcryptHashGenerator,
  cspEvaluator,
  dataUrlConverter,
  httpStatusCodeReference,
  ipSubnetCalculator,
  jwtDecoder,
  mimeTypeLookup,
  passwordGenerator,
  totpGenerator,
  urlParser,
  csvFileJoiner,
  csvFileSplitter,
  csvToTsvConverter,
  fileHashChecker,
  fileMetadataViewer,
  fileRenameUtility,
  jsonToXmlConverter,
  textFileJoiner,
  tsvToCsvConverter,
  duplicateFileFinder,
  compressPdf,
  contactSheetPdf,
  cropPdf,
  deletePdfPages,
  duplicatePdfPages,
  extractPdfPages,
  flattenPdf,
  htmlToPdf,
  imagesToPdf,
  insertPdfPages,
  interleavePdf,
  markdownToPdf,
  mergePdf,
  nUpPdf,
  pdfBookmarksEditor,
  pdfMetadataEditor,
  pdfPageNumbers,
  pdfSignDraw,
  pdfStamp,
  pdfWatermark,
  removeBlankPages,
  reorderPdfPages,
  resizePdfPages,
  rtfToPdf,
  reversePdf,
  rotatePdf,
  scalePdf,
  splitPdf,
  svgToPdf,
  textToPdf,
  addLineBreaks,
  addPrefixSuffix,
  bigTextGenerator,
  boldTextGenerator,
  bubbleTextGenerator,
  caesarCipher,
  caseConverter,
  csvToMarkdown,
  csvToTextList,
  diffChecker,
  duplicateLinesRemover,
  wordCharacterCounter,
]
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name));

export function byCategory(c: ToolCategory): ToolManifest[] {
  return TOOLS.filter((t) => t.category === c);
}

export function byId(id: string): ToolManifest | undefined {
  return TOOLS.find((t) => t.id === id);
}

export function countByCategory(): Record<ToolCategory, number> {
  const counts = {} as Record<ToolCategory, number>;
  for (const t of TOOLS) {
    counts[t.category] = (counts[t.category] ?? 0) + 1;
  }
  return counts;
}
