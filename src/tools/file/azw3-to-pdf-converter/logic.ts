/**
 * AZW3 to PDF Converter — pure logic.
 * Uses _shared-ebook-converter module for the heavy lifting.
 */
export { extractTextFromAzw3, paginateText, formatLog, summarizeResult, type ConvertOptions, type ConvertResult } from "../_shared-ebook-converter";

export const SOURCE_FORMAT = "AZW3";
export const TARGET_FORMAT = "PDF";
export const SOURCE_EXT = ".azw3";
export const TARGET_EXT = ".pdf";
