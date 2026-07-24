/**
 * mobi-to-pdf-converter — pure logic.
 * Uses _shared-ebook-converter module for the heavy lifting.
 */
export { extractTextFromMobi, paginateText, formatLog, summarizeResult, type ConvertOptions, type ConvertResult } from "../_shared-ebook-converter";

export const SOURCE_FORMAT = "MOBI";
export const TARGET_FORMAT = "PDF";
export const SOURCE_EXT = ".mobi";
export const TARGET_EXT = ".pdf";
