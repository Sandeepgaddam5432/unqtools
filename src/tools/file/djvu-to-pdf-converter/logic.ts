/**
 * djvu-to-pdf-converter — pure logic.
 * Uses _shared-ebook-converter module for the heavy lifting.
 */
export { extractTextFromDjvu, paginateText, formatLog, summarizeResult, type ConvertOptions, type ConvertResult } from "../_shared-ebook-converter";

export const SOURCE_FORMAT = "DjVu";
export const TARGET_FORMAT = "PDF";
export const SOURCE_EXT = ".djvu";
export const TARGET_EXT = ".pdf";
