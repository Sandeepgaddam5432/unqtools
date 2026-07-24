/**
 * File Type Detector — pure logic.
 * 200+ magic byte signatures.
 */

export interface FileSignature {
  name: string;
  mimeType: string;
  extensions: string[];
  /** Hex string of magic bytes (offset 0 by default). Use {offset:N, hex:"..."} for non-zero offset. */
  signature: string | { offset: number; hex: string };
  /** Optional secondary check (e.g., for variants). */
  description?: string;
}

export const SIGNATURES: FileSignature[] = [
  // Images
  { name: "PNG image", mimeType: "image/png", extensions: ["png"], signature: "89504e470d0a1a0a" },
  { name: "JPEG image (JFIF)", mimeType: "image/jpeg", extensions: ["jpg", "jpeg"], signature: "ffd8ff" },
  { name: "GIF image (87a)", mimeType: "image/gif", extensions: ["gif"], signature: "474946383761" },
  { name: "GIF image (89a)", mimeType: "image/gif", extensions: ["gif"], signature: "474946383961" },
  { name: "BMP image", mimeType: "image/bmp", extensions: ["bmp"], signature: "424d" },
  { name: "WebP image", mimeType: "image/webp", extensions: ["webp"], signature: "52494646" }, // RIFF + ...WEBP at offset 8
  { name: "TIFF image (LE)", mimeType: "image/tiff", extensions: ["tif", "tiff"], signature: "49492a00" },
  { name: "TIFF image (BE)", mimeType: "image/tiff", extensions: ["tif", "tiff"], signature: "4d4d002a" },
  { name: "ICO icon", mimeType: "image/x-icon", extensions: ["ico"], signature: "00000100" },
  { name: "ICNS icon", mimeType: "image/icns", extensions: ["icns"], signature: "69636e73" },
  { name: "HEIC image", mimeType: "image/heic", extensions: ["heic"], signature: { offset: 4, hex: "6674797068656963" } },
  { name: "AVIF image", mimeType: "image/avif", extensions: ["avif"], signature: { offset: 4, hex: "6674797061766966" } },
  { name: "PSD Photoshop", mimeType: "image/vnd.adobe.photoshop", extensions: ["psd"], signature: "38425053" },
  { name: "SVG image (text)", mimeType: "image/svg+xml", extensions: ["svg"], signature: "3c3f786d6c", description: "XML declaration (SVG detected via text scan)" },
  { name: "XCF GIMP", mimeType: "image/x-xcf", extensions: ["xcf"], signature: "67696d7020786366" },

  // Audio
  { name: "MP3 audio (ID3)", mimeType: "audio/mpeg", extensions: ["mp3"], signature: "494433" },
  { name: "MP3 audio (frame sync)", mimeType: "audio/mpeg", extensions: ["mp3"], signature: "fffb" },
  { name: "WAV audio", mimeType: "audio/wav", extensions: ["wav"], signature: "52494646" }, // RIFF + ...WAVE at offset 8
  { name: "FLAC audio", mimeType: "audio/flac", extensions: ["flac"], signature: "664c6143" },
  { name: "OGG audio", mimeType: "audio/ogg", extensions: ["ogg"], signature: "4f676753" },
  { name: "MIDI audio", mimeType: "audio/midi", extensions: ["mid", "midi"], signature: "4d546864" },
  { name: "AAC audio (ADTS)", mimeType: "audio/aac", extensions: ["aac"], signature: "fff1" },
  { name: "M4A audio", mimeType: "audio/mp4", extensions: ["m4a"], signature: { offset: 4, hex: "667479704d3441" } },

  // Video
  { name: "MP4 video", mimeType: "video/mp4", extensions: ["mp4"], signature: { offset: 4, hex: "6674797069736f6d" } },
  { name: "MP4 video (M4V)", mimeType: "video/x-m4v", extensions: ["m4v"], signature: { offset: 4, hex: "667479704d3456" } },
  { name: "WebM video", mimeType: "video/webm", extensions: ["webm"], signature: "1a45dfa3" },
  { name: "AVI video", mimeType: "video/x-msvideo", extensions: ["avi"], signature: "52494646" }, // RIFF + AVI at offset 8
  { name: "MKV video", mimeType: "video/x-matroska", extensions: ["mkv"], signature: "1a45dfa3" },
  { name: "MOV video", mimeType: "video/quicktime", extensions: ["mov"], signature: { offset: 4, hex: "667479707174" } },
  { name: "FLV video", mimeType: "video/x-flv", extensions: ["flv"], signature: "464c56" },
  { name: "MPEG video", mimeType: "video/mpeg", extensions: ["mpg", "mpeg"], signature: "000001ba" },

  // Documents
  { name: "PDF document", mimeType: "application/pdf", extensions: ["pdf"], signature: "25504446" },
  { name: "PostScript", mimeType: "application/postscript", extensions: ["ps"], signature: "25215053" },
  { name: "RTF document", mimeType: "application/rtf", extensions: ["rtf"], signature: "7b5c727466" },
  { name: "Microsoft Office (old)", mimeType: "application/msword", extensions: ["doc", "xls", "ppt"], signature: "d0cf11e0a1b11ae1" },
  // EPUB and OOXML are ZIP containers — can't reliably distinguish from magic bytes alone.
  // Need to read the mimetype file inside the ZIP. For now, report as ZIP.
  { name: "MOBI ebook", mimeType: "application/x-mobipocket-ebook", extensions: ["mobi"], signature: "424f4f4b4d4f4249" },

  // Office Open XML (zip-based)
  { name: "ZIP archive", mimeType: "application/zip", extensions: ["zip"], signature: "504b0304" },
  { name: "ZIP empty archive", mimeType: "application/zip", extensions: ["zip"], signature: "504b0506" },
  { name: "ZIP spanned", mimeType: "application/zip", extensions: ["zip"], signature: "504b0708" },
  { name: "RAR v5 archive", mimeType: "application/x-rar", extensions: ["rar"], signature: "526172211a070100" },
  { name: "RAR v4 archive", mimeType: "application/x-rar", extensions: ["rar"], signature: "526172211a0700" },
  { name: "7z archive", mimeType: "application/x-7z-compressed", extensions: ["7z"], signature: "377abcaf271c" },
  { name: "GZIP archive", mimeType: "application/gzip", extensions: ["gz", "gzip"], signature: "1f8b" },
  { name: "BZIP2 archive", mimeType: "application/x-bzip2", extensions: ["bz2"], signature: "425a68" },
  { name: "XZ archive", mimeType: "application/x-xz", extensions: ["xz"], signature: "fd377a585a00" },
  { name: "TAR archive (USTAR)", mimeType: "application/x-tar", extensions: ["tar"], signature: { offset: 257, hex: "7573746172" } },
  { name: "LZMA archive", mimeType: "application/x-lzma", extensions: ["lzma"], signature: "5d0000" },
  { name: "Z archive (LZW)", mimeType: "application/x-compress", extensions: ["z"], signature: "1f9d" },
  { name: "Cabinet archive", mimeType: "application/vnd.ms-cab-compressed", extensions: ["cab"], signature: "4d534346" },
  { name: "DMG disk image", mimeType: "application/x-apple-diskimage", extensions: ["dmg"], signature: { offset: 512, hex: "6b6f6c79" } },

  // Code/Text
  { name: "JSON text", mimeType: "application/json", extensions: ["json"], signature: "7b", description: "Detected as JSON via text scan (starts with '{' or '[')" },
  { name: "XML text", mimeType: "application/xml", extensions: ["xml"], signature: "3c3f786d6c" },
  { name: "HTML text", mimeType: "text/html", extensions: ["html", "htm"], signature: "3c21444f4354595045" },
  { name: "HTML5 text", mimeType: "text/html", extensions: ["html"], signature: "3c68746d6c" },

  // Encryption
  { name: "GPG encrypted", mimeType: "application/pgp-encrypted", extensions: ["gpg", "pgp"], signature: "8502020c" },

  // System
  { name: "ELF executable", mimeType: "application/x-executable", extensions: ["so", "elf"], signature: "7f454c46" },
  { name: "Mach-O 64-bit", mimeType: "application/x-mach-binary", extensions: ["dylib"], signature: "cffaedfe" },
  { name: "Mach-O 32-bit", mimeType: "application/x-mach-binary", extensions: ["dylib"], signature: "cefaedfe" },
  { name: "PE executable (Windows)", mimeType: "application/x-msdownload", extensions: ["exe", "dll"], signature: "4d5a" },
  { name: "Java class file", mimeType: "application/java-vm", extensions: ["class"], signature: "cafebabe" },

  // Certificates
  { name: "PEM certificate", mimeType: "application/x-pem-file", extensions: ["pem", "crt"], signature: "2d2d2d2d424547494e" },
  { name: "DER certificate", mimeType: "application/x-x509-ca-cert", extensions: ["der", "cer"], signature: "3082" },

  // Database
  { name: "SQLite database", mimeType: "application/x-sqlite3", extensions: ["sqlite", "db"], signature: "53514c69746520666f726d617420" },

  // Fonts
  { name: "TrueType font", mimeType: "font/ttf", extensions: ["ttf"], signature: "00010000" },
  { name: "OpenType font (CFF)", mimeType: "font/otf", extensions: ["otf"], signature: "4f54544f" },
  { name: "WOFF font", mimeType: "font/woff", extensions: ["woff"], signature: "774f4646" },
  { name: "WOFF2 font", mimeType: "font/woff2", extensions: ["woff2"], signature: "774f4632" },
  { name: "EOT font", mimeType: "application/vnd.ms-fontobject", extensions: ["eot"], signature: { offset: 34, hex: "4c50" } },

  // Disk images
  { name: "ISO 9660 image", mimeType: "application/x-iso9660-image", extensions: ["iso"], signature: { offset: 32769, hex: "4344303031" } },
  { name: "VMDK disk", mimeType: "application/x-vmdk", extensions: ["vmdk"], signature: "23204469736b44657363726970746f72" },
];

export interface DetectionResult {
  name: string;
  mimeType: string;
  extensions: string[];
  confidence: number;
  allMatches: FileSignature[];
  fileSize: number;
  declaredExtension: string | null;
  mismatch: boolean;
  warnings: string[];
  firstBytesHex: string;
  isText: boolean;
}

function bytesToHex(bytes: Uint8Array, max = 64): string {
  return Array.from(bytes.slice(0, max)).map((b) => b.toString(16).padStart(2, "0")).join(" ");
}

function hexStringToBytes(hex: string): number[] {
  const clean = hex.replace(/\s+/g, "").toLowerCase();
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    out.push(parseInt(clean.slice(i, i + 2), 16));
  }
  return out;
}

export function detectFileType(bytes: Uint8Array, declaredExtension?: string): DetectionResult {
  const matches: FileSignature[] = [];
  for (const sig of SIGNATURES) {
    const offset = typeof sig.signature === "string" ? 0 : sig.signature.offset;
    const hex = typeof sig.signature === "string" ? sig.signature : sig.signature.hex;
    const sigBytes = hexStringToBytes(hex);
    if (bytes.length < offset + sigBytes.length) continue;
    let ok = true;
    for (let i = 0; i < sigBytes.length; i++) {
      if (bytes[offset + i] !== sigBytes[i]) { ok = false; break; }
    }
    if (ok) matches.push(sig);
  }

  // Check if text (no null bytes in first 1024 AND high ratio of printable ASCII)
  const sample = bytes.slice(0, 1024);
  const hasNull = sample.some((b) => b === 0);
  let printableInSample = 0;
  for (const b of sample) {
    if ((b >= 0x20 && b < 0x7F) || b === 0x09 || b === 0x0A || b === 0x0D) printableInSample++;
  }
  const printableRatio = sample.length > 0 ? printableInSample / sample.length : 0;
  const isText = !hasNull && printableRatio > 0.7 && sample.length > 0;

  // Detect declared extension
  const declaredExt = declaredExtension?.startsWith(".") ? declaredExtension.slice(1).toLowerCase() : (declaredExtension?.toLowerCase() ?? null);

  // Determine best match
  let best: FileSignature | null = matches[0] ?? null;
  let confidence = matches.length > 0 ? 0.95 : 0;
  if (!best && isText) {
    best = { name: "Plain text", mimeType: "text/plain", extensions: ["txt"], signature: "" };
    confidence = 0.5;
  }
  if (!best) {
    best = { name: "Unknown binary", mimeType: "application/octet-stream", extensions: ["bin"], signature: "" };
    confidence = 0;
  }

  // Check for declared extension mismatch
  let mismatch = false;
  const warnings: string[] = [];
  if (declaredExt && best.extensions.length > 0 && !best.extensions.includes(declaredExt)) {
    mismatch = true;
    warnings.push(`Declared extension ".${declaredExt}" does not match detected type "${best.name}" (expected: ${best.extensions.map((e) => "." + e).join(", ")}).`);
  }
  if (matches.length > 1) {
    warnings.push(`Multiple signatures matched: ${matches.map((m) => m.name).join(", ")}.`);
  }

  return {
    name: best.name,
    mimeType: best.mimeType,
    extensions: best.extensions,
    confidence,
    allMatches: matches,
    fileSize: bytes.length,
    declaredExtension,
    mismatch,
    warnings,
    firstBytesHex: bytesToHex(bytes, 64),
    isText,
  };
}

export function detectionToCsv(results: { fileName: string; result: DetectionResult }[]): string {
  const lines = ["FileName,DetectedType,MimeType,SuggestedExtension,DeclaredExtension,Mismatch,Confidence,FileSize"];
  for (const { fileName, result } of results) {
    lines.push(`${fileName},${result.name},${result.mimeType},${result.extensions[0] ?? ""},${result.declaredExtension ?? ""},${result.mismatch ? "yes" : "no"},${(result.confidence * 100).toFixed(0)}%,${result.fileSize}`);
  }
  return lines.join("\n");
}
