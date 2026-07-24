/**
 * epub-to-pdf-converter — pure logic.
 * Uses _shared-ebook-converter module for the heavy lifting.
 */
export { extractTextFromEpub, paginateText, formatLog, summarizeResult, type ConvertOptions, type ConvertResult } from "../_shared-ebook-converter";

export const SOURCE_FORMAT = "EPUB";
export const TARGET_FORMAT = "PDF";
export const SOURCE_EXT = ".epub";
export const TARGET_EXT = ".pdf";
