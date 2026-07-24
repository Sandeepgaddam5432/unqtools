/**
 * XPS to PDF Converter — pure logic.
 * Uses _shared-ebook-converter module for XPS-related helpers.
 */
export { paginateText, generateXpsXml, formatLog, summarizeResult, type ConvertOptions, type ConvertResult } from "../_shared-ebook-converter";

export const SOURCE_FORMAT = "XPS";
export const TARGET_FORMAT = "PDF";
export const SOURCE_EXT = ".xps";
export const TARGET_EXT = ".pdf";
