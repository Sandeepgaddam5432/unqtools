/**
 * PDF to XPS Converter — pure logic.
 * Uses _shared-ebook-converter module for XPS-related helpers.
 */
export { paginateText, generateXpsXml, formatLog, summarizeResult, type ConvertOptions, type ConvertResult } from "../_shared-ebook-converter";

export const SOURCE_FORMAT = "PDF";
export const TARGET_FORMAT = "XPS";
export const SOURCE_EXT = ".pdf";
export const TARGET_EXT = ".xps";
