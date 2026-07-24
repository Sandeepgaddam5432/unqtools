/**
 * Encoding Detector — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "encoding-detector",
  name: "File Encoding Detector",
  description:
    "Detect file encoding (UTF-8, UTF-16 LE/BE, ASCII, Latin-1, Windows-1252, BOM presence) from bytes. Confidence scores, byte histogram, and 10+ extras. 100% private.",
  category: "file",
  keywords: ["encoding detector", "charset", "utf-8", "utf-16", "bom", "ascii", "latin1", "file encoding"],
  icon: "binary",
  requiresNetwork: false,
  seo: {
    title: "File Encoding Detector — UTF-8/16 + BOM + Byte Histogram | UnQTools",
    faq: [
      { q: "How is encoding detected?", a: "The tool reads the first 8KB of the file as bytes and applies: (1) BOM check (UTF-8/16/32 BOM), (2) UTF-8 validity check (multi-byte sequence validation), (3) null-byte pattern for UTF-16, (4) ASCII-range ratio for ASCII/Latin-1, (5) Windows-1252 specific byte patterns." },
      { q: "What extras does this tool have?", a: "Extras: (1) Confidence score per encoding, (2) Byte histogram (256 buckets), (3) Show first 256 bytes in hex, (4) Show printable ASCII preview, (5) Detect BOM type (UTF-8/16LE/16BE/32), (6) Detect line endings alongside encoding, (7) Multi-file batch mode, (8) CSV export of batch results, (9) Suggest encoding for editor config, (10) Copy result as JSON, (11) Detect null bytes (binary indicator), (12) Show control char count, (13) Validate UTF-8 strict mode, (14) Show file size + first 4 bytes signature." },
    ],
  },
  status: "done",
};
