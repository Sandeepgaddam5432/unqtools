/**
 * Binary File Signature / Magic Number Inspector — Tool Manifest.
 * Tool #369 — Category 4 (Developer & Code).
 *
 * Detect a file's true type from its leading magic bytes (and trailer where
 * relevant) using a 100+ entry bundled signature database (PNG, JPG, GIF,
 * PDF, ZIP, ELF, PE, Mach-O, etc.). Show a hex dump of the header bytes,
 * search the database by extension / MIME / format name / hex signature,
 * resolve ZIP-based container subtypes (docx / xlsx / pptx / jar / apk /
 * epub / odt), flag extension spoofing, and report multiple candidates
 * with confidence. 100% client-side, nothing uploaded.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "binary-file-signature-magic-number-inspector",
  name: "Binary File Signature & Magic Number Inspector",
  description:
    "Detect a file's true type from its leading magic bytes (and trailer where relevant) using a 100+ entry bundled signature database (PNG, JPG, GIF, PDF, ZIP, ELF, PE, Mach-O, OLE, SQLite, WASM, GLB, ISO9660, and more). Show a hex dump of the header bytes with matched bytes highlighted, resolve ZIP-based container subtypes (docx / xlsx / pptx / jar / apk / epub / odt), explicitly warn on extension spoofing, and search the database by extension / MIME / format name / hex signature. 100% client-side, nothing uploaded.",
  category: "developer",
  keywords: [
    "magic number", "file signature", "magic bytes",
    "detect file type", "file type checker", "header bytes",
    "spoofed extension", "file identification", "binary signature",
    "hex magic", "file format detection", "container disambiguation",
    "docx zip detection", "elf pe macho", "iso9660 signature",
  ],
  icon: "binary",
  requiresNetwork: false,
  seo: {
    title: "Binary File Signature & Magic Number Inspector (100% client-side) | UnQTools",
    faq: [
      {
        q: "What is a magic number / file signature?",
        a: "A magic number is a constant sequence of bytes (usually at offset 0 of a file, sometimes at a fixed offset like 0x8001 for ISO9660) that uniquely identifies a file format. For example, every PNG file starts with the 8 bytes 89 50 4E 47 0D 0A 1A 0A, every PDF starts with %PDF, and every ZIP-based file starts with PK\\x03\\x04. The operating system, browsers, and forensic tools use these signatures instead of the (user-editable) file extension to decide what a file really is.",
      },
      {
        q: "How does the inspector detect file type?",
        a: "Drop or pick a file (or paste hex bytes) and the tool reads the first/last few KB locally via FileReader/Blob.slice, then runs a pure-JS matching engine over a 100+ entry signature database. Each rule specifies a byte pattern, an offset (usually 0, but 0x8001 for ISO9660, 4 for MP4 ftyp atoms, 257 for TAR ustar, etc.), an optional trailer, and an optional mask. Multiple matching rules are listed with confidence; ZIP-based files are further disambiguated by peeking at the central directory (docx / xlsx / pptx / jar / apk / epub / odt).",
      },
      {
        q: "What is extension spoofing and how is it flagged?",
        a: "Extension spoofing is when a file's extension doesn't match its true type — e.g. a PNG renamed to .jpg, or a Windows executable renamed to .pdf to evade mail filters. The tool compares the extension of the dropped file against the extension(s) implied by the detected signature(s) and shows a prominent warning when they disagree. The verdict banner displays MATCH (extension matches signature), SPOOF (extension contradicts signature), or UNKNOWN (no signature matched — common for plain text, CSV, JSON, log files).",
      },
      {
        q: "Can I search the signature database without a file?",
        a: "Yes. The reference table is searchable by extension (e.g. 'png'), MIME type (e.g. 'application/pdf'), format name (e.g. 'ELF'), or hex bytes (e.g. '89504E47' or '89 50 4E 47'). Each entry shows the signature bytes, offset, trailer (if any), MIME type, typical extensions, category, and a short description. The database is bundled in the JS bundle — no network needed.",
      },
      {
        q: "What extra features does this tool have compared to other magic-number checkers?",
        a: "(1) 100+ format database covering images, archives, executables, documents, audio, video, fonts, databases, ROMs, and more. (2) Offset-aware matching (ISO9660 at 0x8001, TAR ustar at 257, MP4 ftyp at 4, etc.). (3) Trailer checks (WAV/AVI/WebP after RIFF, DMG koly at EOF, etc.). (4) ZIP-based container disambiguation (docx/xlsx/pptx/jar/apk/epub/odt/ods/odp). (5) Extension-spoof warnings. (6) Mini hex dump of the first 64 bytes with matched bytes highlighted. (7) Multiple-candidate listing with confidence. (8) Searchable reference table by ext / MIME / name / hex. (9) Hex-byte input fallback (paste 'FFD8FFE0' instead of dropping a file). (10) Plain-text / no-magic detection with a friendly 'no signature' verdict. (11) History (localStorage, last 20). (12) Shareable URL with the hex input round-tripped (for small inputs). 100% client-side and offline — your bytes never leave the device.",
      },
    ],
  },
  status: "done",
};
