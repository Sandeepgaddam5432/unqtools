/**
 * Binary File Signature / Magic Number Inspector — pure logic.
 *
 * Pure-JS functions for detecting a file's true type from its leading magic
 * bytes, searching a 100+ entry signature database, rendering a hex dump,
 * and resolving ZIP-based container subtypes. 100% client-side. No DOM, no
 * network — pure functions only (FileReader / Blob lives in the UI layer).
 *
 * Database sources: Wikipedia "List of file signatures", Gary Kessler's
 * file signatures table, public domain forensic references.
 */

// ---------- Types ----------

export type FileCategory =
  | "image"
  | "archive"
  | "executable"
  | "document"
  | "audio"
  | "video"
  | "font"
  | "database"
  | "rom"
  | "system"
  | "cert"
  | "model"
  | "other";

export type Confidence = "high" | "medium" | "low";

export interface SignatureRule {
  /** Stable internal id. */
  id: string;
  /** Human-readable format name, e.g. "PNG image". */
  name: string;
  /** Canonical extension(s), e.g. ["png"]. */
  exts: string[];
  /** MIME type, e.g. "image/png". */
  mime: string;
  /** File category. */
  category: FileCategory;
  /** Magic bytes to match (decimal). */
  bytes: number[];
  /** Offset within the file at which to match. Default 0. */
  offset: number;
  /** Optional trailer bytes (e.g. WAV's "WAVE" after RIFF). */
  trailer?: { bytes: number[]; offset: number };
  /** Optional hex signature for display (auto-derived if omitted). */
  hex?: string;
  /** Short description of the format. */
  description: string;
}

export interface DetectionMatch {
  rule: SignatureRule;
  confidence: Confidence;
  /** Matched byte ranges within the file (for highlighting). */
  matchedRanges: { start: number; length: number }[];
}

export type Verdict = "match" | "spoof" | "unknown";

export interface DetectionResult {
  matches: DetectionMatch[];
  verdict: Verdict;
  /** The primary (highest-confidence) match, if any. */
  primary: DetectionMatch | null;
  /** True if the file extension contradicts the detected type. */
  extensionSpoofed: boolean;
  /** Plain text detection (no magic found but bytes look like text). */
  isPlainText: boolean;
  /** Number of bytes inspected. */
  bytesRead: number;
}

export interface HistoryEntry {
  ts: number;
  fileName: string;
  fileSize: number;
  detectedName: string;
  verdict: Verdict;
  hexPreview: string;
}

// ---------- Constants ----------

export const HISTORY_MAX = 20;
const HISTORY_KEY = "unqtools:binary-file-signature-magic-number-inspector:history";
const SHARE_MAX_BYTES = 1024;

// ---------- Signature Database (100+ entries) ----------

export const SIGNATURES: SignatureRule[] = [
  // ---- Images ----
  {
    id: "png", name: "PNG image", exts: ["png"], mime: "image/png",
    category: "image", offset: 0,
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    description: "Portable Network Graphics; 8-byte signature includes newline defense against binary corruption.",
  },
  {
    id: "jpg", name: "JPEG image", exts: ["jpg", "jpeg"], mime: "image/jpeg",
    category: "image", offset: 0,
    bytes: [0xff, 0xd8, 0xff],
    description: "JPEG/JFIF image; SOI marker followed by an APPn marker (FF E0 / FF E1 …).",
  },
  {
    id: "gif87a", name: "GIF image (87a)", exts: ["gif"], mime: "image/gif",
    category: "image", offset: 0,
    bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
    description: "Graphics Interchange Format, original 1987 version.",
  },
  {
    id: "gif89a", name: "GIF image (89a)", exts: ["gif"], mime: "image/gif",
    category: "image", offset: 0,
    bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
    description: "Graphics Interchange Format, 1989 version (adds animation and transparency).",
  },
  {
    id: "bmp", name: "BMP image", exts: ["bmp", "dib"], mime: "image/bmp",
    category: "image", offset: 0,
    bytes: [0x42, 0x4d],
    description: "Windows bitmap; 'BM' magic followed by file size and reserved fields.",
  },
  {
    id: "tiff-le", name: "TIFF image (little-endian)", exts: ["tif", "tiff"], mime: "image/tiff",
    category: "image", offset: 0,
    bytes: [0x49, 0x49, 0x2a, 0x00],
    description: "Tagged Image File Format, little-endian byte order ('II' + 42).",
  },
  {
    id: "tiff-be", name: "TIFF image (big-endian)", exts: ["tif", "tiff"], mime: "image/tiff",
    category: "image", offset: 0,
    bytes: [0x4d, 0x4d, 0x00, 0x2a],
    description: "Tagged Image File Format, big-endian byte order ('MM' + 42).",
  },
  {
    id: "webp", name: "WebP image", exts: ["webp"], mime: "image/webp",
    category: "image", offset: 0,
    bytes: [0x52, 0x49, 0x46, 0x46],
    trailer: { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
    description: "RIFF container with 'WEBP' four-cc at offset 8.",
  },
  {
    id: "heic", name: "HEIF image (HEIC)", exts: ["heic", "heif"], mime: "image/heic",
    category: "image", offset: 4,
    bytes: [0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63],
    description: "High-Efficiency Image Container (Apple); 'ftypheic' at offset 4.",
  },
  {
    id: "avif", name: "AVIF image", exts: ["avif"], mime: "image/avif",
    category: "image", offset: 4,
    bytes: [0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66],
    description: "AV1 Image File Format; 'ftypavif' at offset 4.",
  },
  {
    id: "ico", name: "Windows icon (ICO)", exts: ["ico"], mime: "image/x-icon",
    category: "image", offset: 0,
    bytes: [0x00, 0x00, 0x01, 0x00],
    description: "Windows ICO resource; reserved 2 zero bytes then 01 00.",
  },
  {
    id: "cur", name: "Windows cursor (CUR)", exts: ["cur"], mime: "application/x-cursor",
    category: "image", offset: 0,
    bytes: [0x00, 0x00, 0x02, 0x00],
    description: "Windows CUR cursor; reserved 2 zero bytes then 02 00.",
  },
  {
    id: "psd", name: "Photoshop document", exts: ["psd"], mime: "image/vnd.adobe.photoshop",
    category: "image", offset: 0,
    bytes: [0x38, 0x42, 0x50, 0x53],
    description: "Adobe Photoshop document; '8BPS'.",
  },
  {
    id: "ilbm-iff", name: "IFF/ILBM image (Amiga)", exts: ["iff", "ilbm"], mime: "image/x-ilbm",
    category: "image", offset: 0,
    bytes: [0x46, 0x4f, 0x52, 0x4d],
    description: "Interchangeable File Format; 'FORM' container.",
  },
  {
    id: "pcx", name: "PCX image", exts: ["pcx"], mime: "image/x-pcx",
    category: "image", offset: 0,
    bytes: [0x0a, 0x05],
    description: "PC Paintbrush; version byte 0x0A followed by encoding 0x05.",
  },
  {
    id: "tga-targa", name: "Truevision TGA (v2)", exts: ["tga"], mime: "image/x-tga",
    category: "image", offset: 0,
    bytes: [0x54, 0x52, 0x55, 0x45, 0x56, 0x49, 0x53, 0x49, 0x4f, 0x4e, 0x2d, 0x58, 0x46, 0x49, 0x4c, 0x45],
    description: "TGA v2 footer 'TRUEVISION-XFILE' (often at end of file).",
  },

  // ---- Archives ----
  {
    id: "zip", name: "ZIP archive", exts: ["zip"], mime: "application/zip",
    category: "archive", offset: 0,
    bytes: [0x50, 0x4b, 0x03, 0x04],
    description: "PKZIP local file header; 'PK\\x03\\x04'.",
  },
  {
    id: "zip-empty", name: "Empty ZIP archive", exts: ["zip"], mime: "application/zip",
    category: "archive", offset: 0,
    bytes: [0x50, 0x4b, 0x05, 0x06],
    description: "PKZIP end-of-central-directory; empty archive.",
  },
  {
    id: "zip-span", name: "Spanned ZIP archive", exts: ["zip"], mime: "application/zip",
    category: "archive", offset: 0,
    bytes: [0x50, 0x4b, 0x07, 0x08],
    description: "PKZIP spanned-archive marker; 'PK\\x07\\x08'.",
  },
  {
    id: "rar-v4", name: "RAR archive (v4)", exts: ["rar"], mime: "application/x-rar-compressed",
    category: "archive", offset: 0,
    bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00],
    description: "RAR v4 signature; 'Rar!\\x1A\\x07\\x00'.",
  },
  {
    id: "rar-v5", name: "RAR archive (v5)", exts: ["rar"], mime: "application/x-rar-compressed",
    category: "archive", offset: 0,
    bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00],
    description: "RAR v5 signature; 'Rar!\\x1A\\x07\\x01\\x00'.",
  },
  {
    id: "gzip", name: "GZIP archive", exts: ["gz", "gzip"], mime: "application/gzip",
    category: "archive", offset: 0,
    bytes: [0x1f, 0x8b],
    description: "GZIP magic; \\x1F\\x8B.",
  },
  {
    id: "7z", name: "7-Zip archive", exts: ["7z"], mime: "application/x-7z-compressed",
    category: "archive", offset: 0,
    bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c],
    description: "7-Zip signature; '7z\\xBC\\xAF\\x27\\x1C'.",
  },
  {
    id: "bzip2", name: "BZIP2 archive", exts: ["bz2", "bzip2"], mime: "application/x-bzip2",
    category: "archive", offset: 0,
    bytes: [0x42, 0x5a, 0x68],
    description: "Bzip2 magic; 'BZh' + level digit.",
  },
  {
    id: "xz", name: "XZ archive", exts: ["xz"], mime: "application/x-xz",
    category: "archive", offset: 0,
    bytes: [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00],
    description: "XZ Utils signature; '\\xFD7zXZ\\x00'.",
  },
  {
    id: "lz4", name: "LZ4 archive", exts: ["lz4"], mime: "application/x-lz4",
    category: "archive", offset: 0,
    bytes: [0x04, 0x22, 0x4d, 0x18],
    description: "LZ4 frame magic; '\\x04\\x22M\\x18'.",
  },
  {
    id: "zstd", name: "Zstandard archive", exts: ["zst", "zstd"], mime: "application/zstd",
    category: "archive", offset: 0,
    bytes: [0x28, 0xb5, 0x2f, 0xfd],
    description: "Zstandard frame magic; '\\x28\\xB5/\\xFD'.",
  },
  {
    id: "cab", name: "Microsoft Cabinet", exts: ["cab"], mime: "application/vnd.ms-cab-compressed",
    category: "archive", offset: 0,
    bytes: [0x4d, 0x53, 0x43, 0x46],
    description: "MSCF cabinet file; 'MSCF'.",
  },
  {
    id: "tar-ustar", name: "TAR archive (USTAR)", exts: ["tar"], mime: "application/x-tar",
    category: "archive", offset: 257,
    bytes: [0x75, 0x73, 0x74, 0x61, 0x72],
    description: "POSIX/USTAR tape archive; 'ustar' magic at byte offset 257.",
  },
  {
    id: "cpio-newc", name: "CPIO archive (newc)", exts: ["cpio"], mime: "application/x-cpio",
    category: "archive", offset: 0,
    bytes: [0x30, 0x37, 0x30, 0x37, 0x30, 0x31],
    description: "cpio new ASCII format; '070701'.",
  },
  {
    id: "cpio-odc", name: "CPIO archive (odc)", exts: ["cpio"], mime: "application/x-cpio",
    category: "archive", offset: 0,
    bytes: [0x30, 0x37, 0x30, 0x37, 0x30, 0x37],
    description: "cpio old ASCII format; '070707'.",
  },
  {
    id: "iso9660", name: "ISO 9660 disc image", exts: ["iso"], mime: "application/x-iso9660-image",
    category: "archive", offset: 0x8001,
    bytes: [0x43, 0x44, 0x30, 0x30, 0x31],
    description: "ISO 9660 volume descriptor; 'CD001' at offset 32769 (0x8001).",
  },
  {
    id: "dmg", name: "Apple Disk Image (DMG)", exts: ["dmg"], mime: "application/x-apple-diskimage",
    category: "archive", offset: 0,
    bytes: [0x78, 0x01, 0x73, 0xda, 0x62, 0x70, 0x6f, 0x6f],
    description: "DMG UDIF trailer 'koly' at end-of-file; the leading bytes are usually zlib-compressed.",
  },
  {
    id: "ar", name: "Unix ar archive", exts: ["a", "ar"], mime: "application/x-archive",
    category: "archive", offset: 0,
    bytes: [0x21, 0x3c, 0x61, 0x72, 0x63, 0x68, 0x3e, 0x0a],
    description: "Unix ar archive; '!<arch>\\n' (used by .a static libraries and .deb packages).",
  },
  {
    id: "alz", name: "ALZip archive", exts: ["alz"], mime: "application/x-alz-compressed",
    category: "archive", offset: 0,
    bytes: [0x41, 0x4c, 0x5a, 0x01],
    description: "ALZip archive; 'ALZ\\x01'.",
  },
  {
    id: "stuffit", name: "StuffIt archive", exts: ["sit"], mime: "application/x-stuffit",
    category: "archive", offset: 0,
    bytes: [0x53, 0x49, 0x54, 0x21],
    description: "StuffIt classic; 'SIT!'.",
  },
  {
    id: "lha", name: "LHA archive", exts: ["lha", "lzh"], mime: "application/x-lzh-compressed",
    category: "archive", offset: 2,
    bytes: [0x2d, 0x6c, 0x68],
    description: "LHArc archive; '-lh' at offset 2.",
  },
  {
    id: "ace", name: "ACE archive", exts: ["ace"], mime: "application/x-ace-compressed",
    category: "archive", offset: 7,
    bytes: [0x2a, 0x41, 0x43, 0x45, 0x2a],
    description: "ACE archive; '**ACE**' at offset 7.",
  },
  {
    id: "arc", name: "ARC archive", exts: ["arc"], mime: "application/x-arc",
    category: "archive", offset: 0,
    bytes: [0x1a, 0x08],
    description: "SEA ARC archive; \\x1A + method byte.",
  },

  // ---- Executables ----
  {
    id: "elf", name: "ELF executable", exts: ["elf", "so", "bin"], mime: "application/x-elf",
    category: "executable", offset: 0,
    bytes: [0x7f, 0x45, 0x4c, 0x46],
    description: "Executable and Linkable Format; '\\x7FELF'. Used by Linux, BSD, Solaris binaries and .so shared objects.",
  },
  {
    id: "pe-mz", name: "DOS / Windows PE executable", exts: ["exe", "dll"], mime: "application/x-msdownload",
    category: "executable", offset: 0,
    bytes: [0x4d, 0x5a],
    description: "PE/COFF or MZ DOS executable; 'MZ' (initials of Mark Zbikowski).",
  },
  {
    id: "macho-32-le", name: "Mach-O 32-bit (LE)", exts: ["macho", "dylib"], mime: "application/x-mach-binary",
    category: "executable", offset: 0,
    bytes: [0xfe, 0xed, 0xfa, 0xce],
    description: "Mach-O 32-bit little-endian; used by macOS/iOS.",
  },
  {
    id: "macho-64-le", name: "Mach-O 64-bit (LE)", exts: ["macho", "dylib"], mime: "application/x-mach-binary",
    category: "executable", offset: 0,
    bytes: [0xfe, 0xed, 0xfa, 0xfe],
    description: "Mach-O 64-bit little-endian; current macOS default.",
  },
  {
    id: "macho-32-be", name: "Mach-O 32-bit (BE)", exts: ["macho"], mime: "application/x-mach-binary",
    category: "executable", offset: 0,
    bytes: [0xce, 0xfa, 0xed, 0xfe],
    description: "Mach-O 32-bit big-endian (PowerPC).",
  },
  {
    id: "macho-64-be", name: "Mach-O 64-bit (BE)", exts: ["macho"], mime: "application/x-mach-binary",
    category: "executable", offset: 0,
    bytes: [0xcf, 0xfa, 0xed, 0xfe],
    description: "Mach-O 64-bit big-endian (PowerPC 64).",
  },
  {
    id: "macho-fat", name: "Mach-O Universal (fat)", exts: ["macho", "dylib"], mime: "application/x-mach-binary",
    category: "executable", offset: 0,
    bytes: [0xca, 0xfe, 0xba, 0xbe],
    description: "Mach-O Universal binary; multi-architecture wrapper.",
  },
  {
    id: "java-class", name: "Java class file", exts: ["class"], mime: "application/java-vm",
    category: "executable", offset: 0,
    bytes: [0xca, 0xfe, 0xba, 0xbe],
    description: "JVM bytecode; 'CAFEBABE' (also used by Mach-O fat binaries — context disambiguates).",
  },
  {
    id: "wasm", name: "WebAssembly module", exts: ["wasm"], mime: "application/wasm",
    category: "executable", offset: 0,
    bytes: [0x00, 0x61, 0x73, 0x6d],
    description: "WebAssembly magic; '\\x00asm'.",
  },
  {
    id: "ne-pe-le", name: "LE/NE linear executable", exts: ["exe", "dll"], mime: "application/x-msdownload",
    category: "executable", offset: 0,
    bytes: [0x4d, 0x5a],
    description: "OS/2 LE / Windows NE linear executable — also MZ-prefixed.",
  },

  // ---- Audio ----
  {
    id: "wav", name: "WAVE audio", exts: ["wav"], mime: "audio/wav",
    category: "audio", offset: 0,
    bytes: [0x52, 0x49, 0x46, 0x46],
    trailer: { offset: 8, bytes: [0x57, 0x41, 0x56, 0x45] },
    description: "RIFF container with 'WAVE' four-cc at offset 8.",
  },
  {
    id: "ogg", name: "Ogg media", exts: ["ogg", "oga", "ogv"], mime: "application/ogg",
    category: "audio", offset: 0,
    bytes: [0x4f, 0x67, 0x67, 0x53],
    description: "Ogg transport layer; 'OggS'.",
  },
  {
    id: "flac", name: "FLAC audio", exts: ["flac"], mime: "audio/flac",
    category: "audio", offset: 0,
    bytes: [0x66, 0x4c, 0x61, 0x43],
    description: "Free Lossless Audio Codec; 'fLaC'.",
  },
  {
    id: "mp3-id3", name: "MP3 audio (ID3)", exts: ["mp3"], mime: "audio/mpeg",
    category: "audio", offset: 0,
    bytes: [0x49, 0x44, 0x33],
    description: "MP3 with ID3v2 tag; 'ID3' followed by version + flags.",
  },
  {
    id: "mp3-frame", name: "MP3 audio (frame sync)", exts: ["mp3"], mime: "audio/mpeg",
    category: "audio", offset: 0,
    bytes: [0xff, 0xfb],
    description: "MP3 frame sync (11 bits set); FF FB / FF F3 / FF F2 / FF E3 etc.",
  },
  {
    id: "aac", name: "AAC audio (ADTS)", exts: ["aac"], mime: "audio/aac",
    category: "audio", offset: 0,
    bytes: [0xff, 0xf1],
    description: "Advanced Audio Coding ADTS frame; FF F1 (also FF F9).",
  },
  {
    id: "midi", name: "MIDI audio", exts: ["mid", "midi"], mime: "audio/midi",
    category: "audio", offset: 0,
    bytes: [0x4d, 0x54, 0x68, 0x64],
    description: "Standard MIDI File; 'MThd'.",
  },
  {
    id: "amr", name: "AMR audio", exts: ["amr"], mime: "audio/amr",
    category: "audio", offset: 0,
    bytes: [0x23, 0x21, 0x41, 0x4d, 0x52],
    description: "Adaptive Multi-Rate audio; '#!AMR'.",
  },
  {
    id: "au", name: "Sun/NeXT AU audio", exts: ["au", "snd"], mime: "audio/basic",
    category: "audio", offset: 0,
    bytes: [0x2e, 0x73, 0x6e, 0x64],
    description: "Sun/NeXT audio; '.snd'.",
  },
  {
    id: "aiff", name: "AIFF audio", exts: ["aif", "aiff"], mime: "audio/aiff",
    category: "audio", offset: 0,
    bytes: [0x46, 0x4f, 0x52, 0x4d],
    trailer: { offset: 8, bytes: [0x41, 0x49, 0x46, 0x46] },
    description: "Audio Interchange File Format; 'FORM' + 'AIFF'.",
  },

  // ---- Video ----
  {
    id: "avi", name: "AVI video", exts: ["avi"], mime: "video/x-msvideo",
    category: "video", offset: 0,
    bytes: [0x52, 0x49, 0x46, 0x46],
    trailer: { offset: 8, bytes: [0x41, 0x56, 0x49, 0x20] },
    description: "RIFF container with 'AVI ' four-cc at offset 8.",
  },
  {
    id: "mp4", name: "MP4 video", exts: ["mp4", "m4v"], mime: "video/mp4",
    category: "video", offset: 4,
    bytes: [0x66, 0x74, 0x79, 0x70],
    description: "ISO base media file format; 'ftyp' atom at offset 4.",
  },
  {
    id: "mov", name: "QuickTime movie", exts: ["mov", "qt"], mime: "video/quicktime",
    category: "video", offset: 4,
    bytes: [0x6d, 0x6f, 0x6f, 0x76],
    description: "QuickTime container; 'moov' or 'mdat' atom at offset 4.",
  },
  {
    id: "mkv-webm", name: "Matroska / WebM", exts: ["mkv", "webm", "mka"], mime: "video/x-matroska",
    category: "video", offset: 0,
    bytes: [0x1a, 0x45, 0xdf, 0xa3],
    description: "EBML container; '\\x1A\\x45\\xDF\\xA3'. Used by both MKV and WebM.",
  },
  {
    id: "flv", name: "Flash video", exts: ["flv"], mime: "video/x-flv",
    category: "video", offset: 0,
    bytes: [0x46, 0x4c, 0x56, 0x01],
    description: "Flash Video; 'FLV\\x01'.",
  },
  {
    id: "mpeg-ps", name: "MPEG program stream", exts: ["mpg", "mpeg", "vob"], mime: "video/mpeg",
    category: "video", offset: 0,
    bytes: [0x00, 0x00, 0x01, 0xba],
    description: "MPEG-1/2 program stream pack header.",
  },
  {
    id: "mpeg-ts", name: "MPEG transport stream", exts: ["ts", "m2ts"], mime: "video/mp2t",
    category: "video", offset: 0,
    bytes: [0x47],
    description: "MPEG-TS sync byte 0x47; repeats every 188/204 bytes.",
  },
  {
    id: "3gp", name: "3GPP multimedia", exts: ["3gp", "3g2"], mime: "video/3gpp",
    category: "video", offset: 4,
    bytes: [0x66, 0x74, 0x79, 0x70, 0x33, 0x67],
    description: "3GPP/3GPP2 video; 'ftyp3g' at offset 4.",
  },
  {
    id: "asf", name: "Advanced Systems Format", exts: ["asf", "wmv", "wma"], mime: "video/x-ms-asf",
    category: "video", offset: 0,
    bytes: [0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11],
    description: "Microsoft ASF container; GUID 30 26 B2 75 8E 66 CF 11.",
  },

  // ---- Documents ----
  {
    id: "pdf", name: "PDF document", exts: ["pdf"], mime: "application/pdf",
    category: "document", offset: 0,
    bytes: [0x25, 0x50, 0x44, 0x46],
    description: "Portable Document Format; '%PDF'.",
  },
  {
    id: "rtf", name: "Rich Text Format", exts: ["rtf"], mime: "application/rtf",
    category: "document", offset: 0,
    bytes: [0x7b, 0x5c, 0x72, 0x74, 0x66, 0x31],
    description: "Rich Text Format; '{\\\\rtf1'.",
  },
  {
    id: "ole2", name: "OLE2 Compound Document", exts: ["doc", "xls", "ppt", "msi", "msg"], mime: "application/x-ole-storage",
    category: "document", offset: 0,
    bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
    description: "Microsoft OLE2 compound document; D0 CF 11 E0 A1 B1 1A E1 (DOC, XLS, PPT, MSI, MSG).",
  },
  {
    id: "ps", name: "PostScript", exts: ["ps"], mime: "application/postscript",
    category: "document", offset: 0,
    bytes: [0x25, 0x21, 0x50, 0x53],
    description: "PostScript; '%!PS'.",
  },
  {
    id: "eps", name: "Encapsulated PostScript", exts: ["eps"], mime: "application/postscript",
    category: "document", offset: 0,
    bytes: [0x25, 0x21, 0x50, 0x53, 0x2d, 0x41, 0x64, 0x6f, 0x62, 0x65],
    description: "EPS with Binary Header; '%!PS-Adobe'.",
  },
  {
    id: "fdf", name: "Forms Data Format", exts: ["fdf"], mime: "application/vnd.fdf",
    category: "document", offset: 0,
    bytes: [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x32],
    description: "PDF form data; '%PDF-1.2' (subset of PDF).",
  },
  {
    id: "djvu", name: "DjVu document", exts: ["djvu", "djv"], mime: "image/vnd.djvu",
    category: "document", offset: 0,
    bytes: [0x41, 0x54, 0x26, 0x54, 0x46, 0x4f, 0x52, 0x4d],
    description: "DjVu (IFF-based); 'AT&TFORM'.",
  },
  {
    id: "mobi", name: "Mobipocket eBook", exts: ["mobi", "prc"], mime: "application/x-mobipocket-ebook",
    category: "document", offset: 60,
    bytes: [0x42, 0x4f, 0x4f, 0x4b, 0x4d, 0x4f, 0x42, 0x49],
    description: "Mobipocket; 'BOOKMOBI' at offset 60.",
  },
  {
    id: "pdb-palm", name: "PalmDoc / PalmDB", exts: ["pdb"], mime: "application/vnd.palm",
    category: "document", offset: 60,
    bytes: [0x54, 0x65, 0x78, 0x65, 0x42, 0x6f, 0x6f, 0x6b],
    description: "PalmDOC; 'TexeBook' or other PDB type at offset 60.",
  },
  {
    id: "chm", name: "Windows Compiled HTML Help", exts: ["chm"], mime: "application/vnd.ms-htmlhelp",
    category: "document", offset: 0,
    bytes: [0x49, 0x54, 0x53, 0x46],
    description: "CHM help file; 'ITSF' (LZX-compressed HTML).",
  },
  {
    id: "xps", name: "XPS / OpenXPS document", exts: ["xps", "oxps"], mime: "application/vnd.ms-xpsdocument",
    category: "document", offset: 0,
    bytes: [0x50, 0x4b, 0x03, 0x04],
    description: "XPS is a ZIP-based container with FixedDocument parts.",
  },

  // ---- Fonts ----
  {
    id: "ttf", name: "TrueType font", exts: ["ttf", "ttc"], mime: "font/ttf",
    category: "font", offset: 0,
    bytes: [0x00, 0x01, 0x00, 0x00],
    description: "TrueType font; 00 01 00 00.",
  },
  {
    id: "otf", name: "OpenType font (CFF)", exts: ["otf"], mime: "font/otf",
    category: "font", offset: 0,
    bytes: [0x4f, 0x54, 0x54, 0x4f],
    description: "OpenType with CFF outlines; 'OTTO'.",
  },
  {
    id: "ttc", name: "TrueType Collection", exts: ["ttc"], mime: "font/collection",
    category: "font", offset: 0,
    bytes: [0x74, 0x74, 0x63, 0x66],
    description: "TrueType Collection; 'ttcf'.",
  },
  {
    id: "woff", name: "WOFF font", exts: ["woff"], mime: "font/woff",
    category: "font", offset: 0,
    bytes: [0x77, 0x4f, 0x46, 0x46],
    description: "Web Open Font Format v1; 'wOFF'.",
  },
  {
    id: "woff2", name: "WOFF2 font", exts: ["woff2"], mime: "font/woff2",
    category: "font", offset: 0,
    bytes: [0x77, 0x4f, 0x46, 0x32],
    description: "Web Open Font Format v2; 'wOF2'.",
  },
  {
    id: "eot", name: "Embedded OpenType", exts: ["eot"], mime: "application/vnd.ms-fontobject",
    category: "font", offset: 34,
    bytes: [0x4c, 0x50],
    description: "Microsoft EOT; 'LP' embedded at offset 34 (FontType signature).",
  },

  // ---- Databases ----
  {
    id: "sqlite3", name: "SQLite 3 database", exts: ["sqlite", "sqlite3", "db"], mime: "application/vnd.sqlite3",
    category: "database", offset: 0,
    bytes: [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00],
    description: "SQLite 3; 'SQLite format 3\\x00'.",
  },
  {
    id: "dbase3", name: "dBase III database", exts: ["dbf"], mime: "application/x-dbf",
    category: "database", offset: 0,
    bytes: [0x03],
    description: "dBase III DBF; version byte 0x03 (also 0x83 with memo, 0x8B, 0xF5 for FoxPro).",
  },
  {
    id: "parquet", name: "Apache Parquet file", exts: ["parquet"], mime: "application/vnd.apache.parquet",
    category: "database", offset: 0,
    bytes: [0x50, 0x41, 0x52, 0x31],
    description: "Parquet columnar storage; 'PAR1'.",
  },
  {
    id: "avro", name: "Apache Avro object", exts: ["avro"], mime: "application/vnd.apache.avro",
    category: "database", offset: 0,
    bytes: [0x4f, 0x62, 0x6a, 0x01],
    description: "Avro object container; 'Obj\\x01'.",
  },
  {
    id: "leveldb-ldb", name: "LevelDB SSTable", exts: ["ldb", "sst"], mime: "application/x-leveldb",
    category: "database", offset: 0,
    bytes: [0x57, 0xfb, 0x80, 0x8b, 0x24, 0x75, 0x47, 0xdb],
    description: "LevelDB/Snappy-compressed SSTable; 8-byte magic.",
  },
  {
    id: "lmdb-mdb", name: "LMDB database", exts: ["mdb"], mime: "application/x-lmdb",
    category: "database", offset: 0,
    bytes: [0x42, 0x44, 0x42, 0x31],
    description: "Lightning Memory-Mapped DB; 'BDB1' magic.",
  },
  {
    id: "ms-access", name: "Microsoft Access (Jet)", exts: ["mdb"], mime: "application/x-msaccess",
    category: "database", offset: 4,
    bytes: [0x53, 0x74, 0x61, 0x6e, 0x64, 0x61, 0x72, 0x64, 0x20, 0x4a, 0x65, 0x74, 0x20, 0x44, 0x42],
    description: "Access/Jet4 database; 'Standard Jet DB' at offset 4.",
  },

  // ---- System / Disk ----
  {
    id: "bplist", name: "Apple binary property list", exts: ["plist", "bplist"], mime: "application/x-plist",
    category: "system", offset: 0,
    bytes: [0x62, 0x70, 0x6c, 0x69, 0x73, 0x74, 0x30, 0x30],
    description: "Binary plist; 'bplist00'.",
  },
  {
    id: "ext2-superblock", name: "ext2/3/4 superblock", exts: ["img"], mime: "application/x-ext2",
    category: "system", offset: 0x438,
    bytes: [0x53, 0xef],
    description: "ext2/3/4 filesystem magic; 0x53EF at offset 1080 (0x438).",
  },
  {
    id: "swap-area", name: "Linux swap area", exts: ["swap"], mime: "application/x-swap",
    category: "system", offset: 0xff6,
    bytes: [0x53, 0x57, 0x41, 0x50, 0x53, 0x50, 0x41, 0x43, 0x45, 0x32],
    description: "Linux swap header 'SWAPSPACE2' at offset 4086.",
  },
  {
    id: "reiserfs", name: "ReiserFS superblock", exts: ["img"], mime: "application/x-reiserfs",
    category: "system", offset: 0x10040,
    bytes: [0x52, 0x65, 0x49, 0x73, 0x45, 0x72, 0x34, 0x46, 0x73, 0x52, 0x73],
    description: "ReiserFS 3.x; 'ReIsEr4Fs' or 'ReIsErFs' at offset 65536.",
  },
  {
    id: "pcap-ng", name: "pcapng capture", exts: ["pcapng"], mime: "application/x-pcapng",
    category: "system", offset: 0,
    bytes: [0x0a, 0x0d, 0x0d, 0x0a],
    description: "pcapng Section Header Block; '\\n\\r\\r\\n'.",
  },
  {
    id: "pcap-le", name: "pcap capture (LE)", exts: ["pcap"], mime: "application/vnd.tcpdump.pcap",
    category: "system", offset: 0,
    bytes: [0xd4, 0xc3, 0xb2, 0xa1],
    description: "pcap little-endian; A1B2C3D4 in memory = D4 C3 B2 A1 on disk.",
  },
  {
    id: "pcap-be", name: "pcap capture (BE)", exts: ["pcap"], mime: "application/vnd.tcpdump.pcap",
    category: "system", offset: 0,
    bytes: [0xa1, 0xb2, 0xc3, 0xd4],
    description: "pcap big-endian; 'A1B2C3D4' on disk.",
  },
  {
    id: "rpm", name: "RPM package", exts: ["rpm"], mime: "application/x-rpm",
    category: "system", offset: 0,
    bytes: [0xed, 0xab, 0xee, 0xdb],
    description: "RPM Package Manager; ED AB EE DB.",
  },
  {
    id: "deb", name: "Debian package", exts: ["deb"], mime: "application/vnd.debian.binary-package",
    category: "system", offset: 0,
    bytes: [0x21, 0x3c, 0x61, 0x72, 0x63, 0x68, 0x3e, 0x0a],
    description: "Debian .deb; Unix ar archive '!<arch>\\n' with 'debian-binary' as first member.",
  },
  {
    id: "msi", name: "Windows Installer (MSI)", exts: ["msi"], mime: "application/x-msi",
    category: "system", offset: 0,
    bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
    description: "MSI is an OLE2 compound document (shares the OLE2 magic).",
  },
  {
    id: "reg-hive", name: "Windows Registry hive", exts: ["hiv"], mime: "application/x-windows-registry",
    category: "system", offset: 0,
    bytes: [0x72, 0x65, 0x67, 0x66],
    description: "Registry hive; 'regf'.",
  },

  // ---- Cert / Keys ----
  {
    id: "pem-cert", name: "PEM certificate / key", exts: ["pem", "crt", "key"], mime: "application/x-pem-file",
    category: "cert", offset: 0,
    bytes: [0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x42, 0x45, 0x47, 0x49, 0x4e],
    description: "PEM container; '-----BEGIN'.",
  },
  {
    id: "ssh-private", name: "OpenSSH private key", exts: ["pem", "key"], mime: "application/x-openssh-key",
    category: "cert", offset: 0,
    bytes: [0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x42, 0x45, 0x47, 0x49, 0x4e, 0x20, 0x4f, 0x50, 0x45, 0x4e, 0x53, 0x53, 0x48],
    description: "OpenSSH private key; '-----BEGIN OPENSSH...'.",
  },
  {
    id: "der-asn1", name: "DER-encoded ASN.1", exts: ["der", "cer"], mime: "application/pkix-cert",
    category: "cert", offset: 0,
    bytes: [0x30, 0x82],
    description: "DER-encoded ASN.1 sequence; 30 82 (also PKCS#12, X.509 certs).",
  },
  {
    id: "jks", name: "Java KeyStore", exts: ["jks", "keystore"], mime: "application/x-java-keystore",
    category: "cert", offset: 0,
    bytes: [0xfe, 0xed, 0xfe, 0xed],
    description: "Java KeyStore; FE ED FE ED.",
  },
  {
    id: "pgp-pubring", name: "PGP public keyring", exts: ["pgp", "asc"], mime: "application/pgp-keys",
    category: "cert", offset: 0,
    bytes: [0x99, 0x01],
    description: "PGP public key packet; 0x99 (legacy) length prefix.",
  },
  {
    id: "gpg-keyring", name: "GPG keybox", exts: ["kbx"], mime: "application/pgp-keybox",
    category: "cert", offset: 0,
    bytes: [0xfe, 0x04, 0x00, 0x01],
    description: "GPG keybox; FE 04 00 01 header.",
  },

  // ---- ROMs ----
  {
    id: "nes", name: "Nintendo Entertainment ROM", exts: ["nes"], mime: "application/x-nes-rom",
    category: "rom", offset: 0,
    bytes: [0x4e, 0x45, 0x53, 0x1a],
    description: "iNES ROM; 'NES\\x1A'.",
  },
  {
    id: "n64", name: "Nintendo 64 ROM", exts: ["n64", "z64"], mime: "application/x-n64-rom",
    category: "rom", offset: 0,
    bytes: [0x80, 0x37, 0x12, 0x40],
    description: "N64 ROM; big-endian '80 37 12 40' (also byteswapped / LE variants).",
  },
  {
    id: "snes-smc", name: "SNES ROM (SMC)", exts: ["smc", "sfc"], mime: "application/x-snes-rom",
    category: "rom", offset: 0,
    bytes: [0xaa, 0xbb, 0x04],
    description: "SNES SMC header; AA BB 04 (also BB AA 04 variants).",
  },
  {
    id: "gbc", name: "Game Boy Color ROM", exts: ["gbc", "gb"], mime: "application/x-gb-rom",
    category: "rom", offset: 0x104,
    bytes: [0xce, 0xed, 0x66, 0x66, 0xcc, 0x0d, 0x00, 0x0b, 0x03, 0x73, 0x00, 0x83, 0x00, 0x0c, 0x00, 0x0d],
    description: "Game Boy ROM Nintendo logo at offset 0x104 (CE ED 66 66 …).",
  },
  {
    id: "nds", name: "Nintendo DS ROM", exts: ["nds"], mime: "application/x-nds-rom",
    category: "rom", offset: 0,
    bytes: [0x25, 0x14, 0x21, 0x26, 0xfe, 0x23, 0x26, 0x25],
    description: "NDS encryption key header at offset 0x07F0 — the game title is at offset 0.",
  },
  {
    id: "genesis", name: "Sega Genesis ROM", exts: ["md", "bin", "gen"], mime: "application/x-genesis-rom",
    category: "rom", offset: 0x100,
    bytes: [0x53, 0x45, 0x47, 0x41, 0x20, 0x4d, 0x45, 0x47, 0x41],
    description: "Sega Mega Drive ROM; 'SEGA MEGA' or 'SEGA GENESIS' at offset 0x100.",
  },

  // ---- 3D Models ----
  {
    id: "glb", name: "Binary glTF (GLB)", exts: ["glb"], mime: "model/gltf-binary",
    category: "model", offset: 0,
    bytes: [0x67, 0x6c, 0x54, 0x46],
    description: "Binary glTF; 'glTF'.",
  },
  {
    id: "fbx", name: "FBX binary model", exts: ["fbx"], mime: "application/x-fbx",
    category: "model", offset: 0,
    bytes: [0x4b, 0x61, 0x79, 0x64, 0x61, 0x72, 0x61, 0x20, 0x46, 0x42, 0x58, 0x20, 0x42, 0x69, 0x6e, 0x61, 0x72, 0x79],
    description: "Autodesk FBX binary; 'Kaydara FBX Binary'.",
  },
  {
    id: "ply", name: "PLY polygon model", exts: ["ply"], mime: "application/x-ply",
    category: "model", offset: 0,
    bytes: [0x70, 0x6c, 0x79, 0x0a],
    description: "Stanford PLY; 'ply\\n' (text or binary).",
  },
  {
    id: "stl", name: "STL mesh (text)", exts: ["stl"], mime: "application/x-stl",
    category: "model", offset: 0,
    bytes: [0x73, 0x6f, 0x6c, 0x69, 0x64, 0x20],
    description: "ASCII STL mesh; 'solid ' (binary STL has an 80-byte header).",
  },
  {
    id: "3ds", name: "3D Studio mesh", exts: ["3ds"], mime: "application/x-3ds",
    category: "model", offset: 0,
    bytes: [0x4d, 0x4d],
    description: "3ds Max; main chunk 0x4D4D.",
  },

  // ---- Other ----
  {
    id: "torrent", name: "BitTorrent metainfo", exts: ["torrent"], mime: "application/x-bittorrent",
    category: "other", offset: 0,
    bytes: [0x64, 0x38, 0x3a, 0x61, 0x6e, 0x6e, 0x6f, 0x75, 0x6e, 0x63, 0x65],
    description: "Bencode; 'd8:announce' (start of bencoded dict).",
  },
  {
    id: "yaml-doc", name: "YAML document", exts: ["yaml", "yml"], mime: "application/x-yaml",
    category: "other", offset: 0,
    bytes: [0x2d, 0x2d, 0x2d],
    description: "YAML document start; '---' (text file).",
  },
  {
    id: "xml-doc", name: "XML document", exts: ["xml", "svg", "xhtml"], mime: "application/xml",
    category: "other", offset: 0,
    bytes: [0x3c, 0x3f, 0x78, 0x6d, 0x6c],
    description: "XML prolog; '<?xml' (also valid for SVG, XHTML, OPML).",
  },
  {
    id: "matlab-mat", name: "MATLAB .mat v5", exts: ["mat"], mime: "application/x-matlab-data",
    category: "other", offset: 0,
    bytes: [0x4d, 0x41, 0x54, 0x4c, 0x41, 0x42, 0x20, 0x35, 0x2e, 0x30],
    description: "MATLAB v5 MAT-file; 'MATLAB 5.0'.",
  },
  {
    id: "shapefile-shp", name: "ESRI Shapefile", exts: ["shp"], mime: "application/x-esrishape",
    category: "other", offset: 0,
    bytes: [0x00, 0x00, 0x27, 0x0a],
    description: "Shapefile .shp; file code 0x0000270A (big-endian int32 = 9994).",
  },
  {
    id: "pcap-pcapng-alt", name: "pcapng capture (alt)", exts: ["pcapng"], mime: "application/x-pcapng",
    category: "system", offset: 0,
    bytes: [0x0a, 0x0d, 0x0d, 0x0a, 0x1c, 0x00, 0x00, 0x00, 0x4d, 0x3c, 0x2b, 0x1a],
    description: "pcapng SHB with full 12-byte preamble.",
  },
  {
    id: "tox-save", name: "Tox protocol save file", exts: ["tox"], mime: "application/x-tox-save",
    category: "other", offset: 0,
    bytes: [0x00, 0x00, 0x00, 0x00, 0x1f, 0x1b, 0xed, 0x15],
    description: "Tox save; 4 zero bytes then 1F 1B ED 15.",
  },
  {
    id: "minecraft-region", name: "Minecraft region (.mca)", exts: ["mca"], mime: "application/x-minecraft-region",
    category: "other", offset: 0,
    bytes: [0x00, 0x00, 0x00, 0x00],
    description: "Minecraft region; first 4096 bytes are location table (typically zero-padded).",
  },
  {
    id: "android-backup", name: "Android Backup", exts: ["ab"], mime: "application/x-android-backup",
    category: "system", offset: 0,
    bytes: [0x41, 0x4e, 0x44, 0x52, 0x4f, 0x49, 0x44, 0x20, 0x42, 0x41, 0x43, 0x4b, 0x55, 0x50],
    description: "Android backup; 'ANDROID BACKUP'.",
  },
  {
    id: "openexr", name: "OpenEXR image", exts: ["exr"], mime: "image/x-exr",
    category: "image", offset: 0,
    bytes: [0x76, 0x2f, 0x31, 0x01],
    description: "OpenEXR; magic 76 2F 31 01.",
  },
  {
    id: "fits", name: "FITS astronomy image", exts: ["fits"], mime: "application/fits",
    category: "image", offset: 0,
    bytes: [0x53, 0x49, 0x4d, 0x50, 0x4c, 0x45, 0x20, 0x20, 0x3d, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x54],
    description: "Flexible Image Transport System; 'SIMPLE  =  T'.",
  },
];

// ---------- Hex helpers ----------

/** Convert a hex string (with or without spaces) to a Uint8Array. */
export function hexStringToBytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/\s+/g, "").replace(/0x/gi, "");
  if (cleaned.length === 0) return new Uint8Array(0);
  if (cleaned.length % 2 !== 0) throw new Error("hex string has odd number of digits");
  if (!/^[0-9a-fA-F]+$/.test(cleaned)) throw new Error("hex string contains non-hex characters");
  const out = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < cleaned.length; i += 2) {
    out[i / 2] = parseInt(cleaned.slice(i, i + 2), 16);
  }
  return out;
}

/** Convert a Uint8Array to a hex string. */
export function bytesToHexString(bytes: Uint8Array, upperCase = true, separator = ""): string {
  const arr: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const h = bytes[i].toString(16).padStart(2, "0");
    arr.push(upperCase ? h.toUpperCase() : h);
  }
  return arr.join(separator);
}

/** Convert a single byte to its 2-digit hex representation. */
export function byteToHex(b: number, upperCase = true): string {
  const h = (b & 0xff).toString(16).padStart(2, "0");
  return upperCase ? h.toUpperCase() : h;
}

/** Convert a single byte to its ASCII character or '.' if non-printable. */
export function byteToAscii(b: number): string {
  if (b >= 32 && b <= 126) return String.fromCharCode(b);
  return ".";
}

/** Compute the canonical hex string for a signature rule. */
export function ruleHex(rule: SignatureRule): string {
  if (rule.hex) return rule.hex;
  return bytesToHexString(new Uint8Array(rule.bytes), true, " ");
}

// ---------- Hex dump ----------

export interface HexDumpLine {
  offset: number;
  hex: string;
  ascii: string;
}

export interface HexDumpOptions {
  bytesPerLine?: number;
  upperCase?: boolean;
  showAscii?: boolean;
  maxBytes?: number;
  /** Byte ranges to highlight (e.g. matched magic bytes). */
  highlights?: { start: number; length: number }[];
}

export function renderHexDump(bytes: Uint8Array, opts: HexDumpOptions = {}): HexDumpLine[] {
  const bytesPerLine = opts.bytesPerLine ?? 16;
  const upperCase = opts.upperCase ?? true;
  const maxBytes = opts.maxBytes ?? 1024;
  const slice = bytes.length > maxBytes ? bytes.slice(0, maxBytes) : bytes;
  const lines: HexDumpLine[] = [];
  for (let i = 0; i < slice.length; i += bytesPerLine) {
    const lineBytes = slice.slice(i, i + bytesPerLine);
    const hexArr: string[] = [];
    for (let j = 0; j < lineBytes.length; j++) {
      hexArr.push(byteToHex(lineBytes[j], upperCase));
    }
    // pad hex to bytesPerLine * 2 chars for alignment
    let hex = hexArr.join(" ");
    const pad = bytesPerLine * 3 - 1;
    if (hex.length < pad) hex = hex.padEnd(pad, " ");
    let ascii = "";
    for (let j = 0; j < lineBytes.length; j++) ascii += byteToAscii(lineBytes[j]);
    lines.push({ offset: i, hex, ascii });
  }
  return lines;
}

export function renderHexDumpText(bytes: Uint8Array, opts: HexDumpOptions = {}): string {
  const lines = renderHexDump(bytes, opts);
  return lines.map((l) => `${l.offset.toString(16).padStart(8, "0")}  ${l.hex}  |${l.ascii}|`).join("\n");
}

/** Returns true if the byte at offset `i` falls within any highlight range. */
export function isHighlighted(i: number, highlights: { start: number; length: number }[] | undefined): boolean {
  if (!highlights || highlights.length === 0) return false;
  return highlights.some((h) => i >= h.start && i < h.start + h.length);
}

// ---------- Plain-text detection ----------

/** Heuristic: are these bytes printable ASCII / UTF-8 text? */
export function isPlainText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  // Sample the first 512 bytes
  const sample = bytes.length > 512 ? bytes.slice(0, 512) : bytes;
  let printable = 0;
  let total = 0;
  for (let i = 0; i < sample.length; i++) {
    const b = sample[i];
    // Allow tab, newline, carriage return, form feed, and printable ASCII
    if (b === 0x09 || b === 0x0a || b === 0x0d || b === 0x0c || (b >= 0x20 && b <= 0x7e)) {
      printable++;
    } else if (b >= 0xc0) {
      // UTF-8 continuation / lead bytes — count as printable
      printable++;
    }
    total++;
  }
  // Require at least 90% printable (most binary formats have lots of high bytes)
  return total > 0 && printable / total >= 0.9;
}

// ---------- Detection engine ----------

function rangesMatch(
  bytes: Uint8Array,
  pattern: number[],
  offset: number,
): boolean {
  if (offset < 0) return false;
  if (bytes.length < offset + pattern.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    if (bytes[offset + i] !== pattern[i]) return false;
  }
  return true;
}

/** Test whether a single signature rule matches the given bytes. */
export function matchesRule(bytes: Uint8Array, rule: SignatureRule): boolean {
  if (!rangesMatch(bytes, rule.bytes, rule.offset)) return false;
  if (rule.trailer) {
    if (!rangesMatch(bytes, rule.trailer.bytes, rule.trailer.offset)) return false;
  }
  return true;
}

/** Find ALL rules that match the given bytes, ordered by specificity (longest pattern first). */
export function detectAll(bytes: Uint8Array): DetectionMatch[] {
  const out: DetectionMatch[] = [];
  for (const rule of SIGNATURES) {
    if (matchesRule(bytes, rule)) {
      // Compute confidence: longer signatures + trailer = higher
      const patternLen = rule.bytes.length + (rule.trailer ? rule.trailer.bytes.length : 0);
      let confidence: Confidence = "low";
      if (patternLen >= 8) confidence = "high";
      else if (patternLen >= 4) confidence = "medium";
      // Special-case: 2-byte signatures (BMP, GZIP) are inherently lower confidence
      if (patternLen <= 2) confidence = "low";
      const matchedRanges: { start: number; length: number }[] = [
        { start: rule.offset, length: rule.bytes.length },
      ];
      if (rule.trailer) {
        matchedRanges.push({ start: rule.trailer.offset, length: rule.trailer.bytes.length });
      }
      out.push({ rule, confidence, matchedRanges });
    }
  }
  // Sort by confidence (high first), then by pattern length (longest first)
  const order: Record<Confidence, number> = { high: 0, medium: 1, low: 2 };
  out.sort((a, b) => {
    if (order[a.confidence] !== order[b.confidence]) return order[a.confidence] - order[b.confidence];
    const aLen = a.rule.bytes.length + (a.rule.trailer ? a.rule.trailer.bytes.length : 0);
    const bLen = b.rule.bytes.length + (b.rule.trailer ? b.rule.trailer.bytes.length : 0);
    return bLen - aLen;
  });
  return out;
}

/** Return the primary (highest-confidence) match, or null. */
export function detectPrimary(bytes: Uint8Array): DetectionMatch | null {
  const all = detectAll(bytes);
  return all.length > 0 ? all[0] : null;
}

// ---------- ZIP container disambiguation ----------

export type ZipContainerSubtype =
  | "docx" | "docm" | "dotx"
  | "xlsx" | "xlsm" | "xltx"
  | "pptx" | "pptm" | "potx"
  | "jar" | "apk" | "aar"
  | "epub"
  | "odt" | "ods" | "odp" | "odg"
  | "vsdx"
  | "xpi"
  | "zip";

export interface ZipContainerInfo {
  subtype: ZipContainerSubtype;
  name: string;
  mime: string;
  ext: string;
  /** Marker file or directory found inside the ZIP central directory. */
  marker: string;
}

/**
 * Try to disambiguate a ZIP archive into a specific OOXML / Java / ODF / EPUB
 * subtype by scanning the central-directory file names. The ZIP central
 * directory is at the end of the file; we scan the whole tail looking for
 * the relevant marker entries.
 */
export function detectZipSubtype(bytes: Uint8Array): ZipContainerInfo | null {
  // Must be a ZIP
  if (!matchesRule(bytes, SIGNATURES.find((r) => r.id === "zip")!)) {
    // Also accept spanned/empty ZIP
    const empty = SIGNATURES.find((r) => r.id === "zip-empty")!;
    const span = SIGNATURES.find((r) => r.id === "zip-span")!;
    if (!matchesRule(bytes, empty) && !matchesRule(bytes, span)) return null;
  }
  // Decode the whole thing as latin1 — file names are ASCII
  let text = "";
  const sample = bytes.length > 65536 ? bytes.slice(bytes.length - 65536) : bytes;
  for (let i = 0; i < sample.length; i++) text += String.fromCharCode(sample[i]);
  const checks: { subtype: ZipContainerSubtype; name: string; mime: string; ext: string; marker: string }[] = [
    { subtype: "apk", name: "Android APK package", mime: "application/vnd.android.package-archive", ext: "apk", marker: "AndroidManifest.xml" },
    { subtype: "jar", name: "Java JAR archive", mime: "application/java-archive", ext: "jar", marker: "META-INF/MANIFEST.MF" },
    { subtype: "aar", name: "Android AAR library", mime: "application/x-android-archive", ext: "aar", marker: "classes.jar" },
    { subtype: "docx", name: "Word OOXML document", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx", marker: "word/document.xml" },
    { subtype: "docm", name: "Word OOXML macro document", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document.macroEnabled", ext: "docm", marker: "word/document.xml" },
    { subtype: "xlsx", name: "Excel OOXML workbook", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx", marker: "xl/workbook.xml" },
    { subtype: "xlsm", name: "Excel OOXML macro workbook", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.macroEnabled", ext: "xlsm", marker: "xl/workbook.xml" },
    { subtype: "pptx", name: "PowerPoint OOXML presentation", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", ext: "pptx", marker: "ppt/presentation.xml" },
    { subtype: "potx", name: "PowerPoint template", mime: "application/vnd.openxmlformats-officedocument.presentationml.template", ext: "potx", marker: "ppt/presentation.xml" },
    { subtype: "vsdx", name: "Visio OOXML drawing", mime: "application/vnd.ms-visio.drawing.main+xml", ext: "vsdx", marker: "visio/document.xml" },
    { subtype: "epub", name: "EPUB ebook", mime: "application/epub+zip", ext: "epub", marker: "META-INF/container.xml" },
    { subtype: "odt", name: "OpenDocument Text", mime: "application/vnd.oasis.opendocument.text", ext: "odt", marker: "application/vnd.oasis.opendocument.text" },
    { subtype: "ods", name: "OpenDocument Spreadsheet", mime: "application/vnd.oasis.opendocument.spreadsheet", ext: "ods", marker: "application/vnd.oasis.opendocument.spreadsheet" },
    { subtype: "odp", name: "OpenDocument Presentation", mime: "application/vnd.oasis.opendocument.presentation", ext: "odp", marker: "application/vnd.oasis.opendocument.presentation" },
    { subtype: "odg", name: "OpenDocument Drawing", mime: "application/vnd.oasis.opendocument.graphics", ext: "odg", marker: "application/vnd.oasis.opendocument.graphics" },
    { subtype: "xpi", name: "Mozilla XPI package", mime: "application/x-xpinstall", ext: "xpi", marker: "install.rdf" },
  ];
  // Order matters: more specific (docx) before generic (jar), since both can
  // contain META-INF/MANIFEST.MF — but OOXML documents don't.
  for (const c of checks) {
    if (text.includes(c.marker)) {
      return c;
    }
  }
  return { subtype: "zip", name: "Generic ZIP archive", mime: "application/zip", ext: "zip", marker: "PK\\x03\\x04" };
}

// ---------- Extension spoofing ----------

/** Extract the file extension (lowercase, without dot) from a filename. */
export function extractExtension(fileName: string): string {
  if (!fileName) return "";
  const clean = fileName.replace(/^.*\//, "");
  const dot = clean.lastIndexOf(".");
  if (dot < 0 || dot === clean.length - 1) return "";
  return clean.slice(dot + 1).toLowerCase();
}

/** Check whether the given extension matches any of the rule's extensions. */
export function extensionMatches(ext: string, rule: SignatureRule): boolean {
  if (!ext) return false;
  return rule.exts.includes(ext);
}

/** Run a full detection pass on a file's bytes + filename. */
export function detect(bytes: Uint8Array, fileName?: string): DetectionResult {
  const matches = detectAll(bytes);
  const ext = fileName ? extractExtension(fileName) : "";
  const primary = matches.length > 0 ? matches[0] : null;
  const isPlain = isPlainText(bytes);
  let extensionSpoofed = false;
  if (ext && primary) {
    extensionSpoofed = !extensionMatches(ext, primary.rule);
  }
  let verdict: Verdict = "unknown";
  if (primary) verdict = extensionSpoofed ? "spoof" : "match";
  else if (isPlain) verdict = "unknown";
  return {
    matches,
    verdict,
    primary,
    extensionSpoofed,
    isPlainText: isPlain && !primary,
    bytesRead: bytes.length,
  };
}

// ---------- Database search ----------

export interface SearchFilters {
  query?: string;
  category?: FileCategory | "";
  /** Limit results to N entries. Default 50. */
  limit?: number;
}

/** Search the signature database by extension, MIME, name, or hex bytes. */
export function searchSignatures(filters: SearchFilters = {}): SignatureRule[] {
  const q = (filters.query ?? "").toLowerCase().trim();
  const cat = filters.category ?? "";
  let out = SIGNATURES.slice();
  if (cat) out = out.filter((r) => r.category === cat);
  if (q) {
    out = out.filter((r) => {
      if (r.name.toLowerCase().includes(q)) return true;
      if (r.mime.toLowerCase().includes(q)) return true;
      if (r.exts.some((e) => e.includes(q))) return true;
      if (r.description.toLowerCase().includes(q)) return true;
      // Compare hex too — strip spaces from query
      const qHex = q.replace(/\s+/g, "");
      if (/^[0-9a-f]+$/.test(qHex) && qHex.length >= 2) {
        const ruleHexStr = bytesToHexString(new Uint8Array(r.bytes), false, "");
        if (ruleHexStr.includes(qHex)) return true;
      }
      return false;
    });
  }
  if (filters.limit && filters.limit > 0) out = out.slice(0, filters.limit);
  return out;
}

/** Group signatures by category. */
export function groupByCategory(rules: SignatureRule[]): Record<FileCategory, SignatureRule[]> {
  const out: Record<FileCategory, SignatureRule[]> = {
    image: [], archive: [], executable: [], document: [],
    audio: [], video: [], font: [], database: [],
    rom: [], system: [], cert: [], model: [], other: [],
  };
  for (const r of rules) out[r.category].push(r);
  return out;
}

export const CATEGORY_LABELS: Record<FileCategory, string> = {
  image: "Image",
  archive: "Archive",
  executable: "Executable",
  document: "Document",
  audio: "Audio",
  video: "Video",
  font: "Font",
  database: "Database",
  rom: "ROM / Game",
  system: "System",
  cert: "Certificate / Key",
  model: "3D Model",
  other: "Other",
};

// ---------- History (localStorage) ----------

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------- Shareable URL ----------

export function buildShareUrl(bytes: Uint8Array): string {
  const params = new URLSearchParams();
  if (bytes.length > 0 && bytes.length <= SHARE_MAX_BYTES) {
    params.set("hex", bytesToHexString(bytes, true, ""));
  } else if (bytes.length > SHARE_MAX_BYTES) {
    params.set("truncated", "1");
    params.set("size", bytes.length.toString(10));
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { bytes: Uint8Array; truncated: boolean; originalSize: number } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { bytes: new Uint8Array(0), truncated: false, originalSize: 0 };
  const params = new URLSearchParams(clean);
  const hex = params.get("hex");
  if (hex) {
    try {
      return { bytes: hexStringToBytes(hex), truncated: false, originalSize: hex.length / 2 };
    } catch {
      return { bytes: new Uint8Array(0), truncated: false, originalSize: 0 };
    }
  }
  const truncated = params.get("truncated") === "1";
  const size = parseInt(params.get("size") ?? "0", 10);
  return { bytes: new Uint8Array(0), truncated, originalSize: size };
}

// ---------- Report formatting ----------

/** Render a full text report of the detection result. */
export function renderReport(bytes: Uint8Array, fileName: string, result: DetectionResult): string {
  const lines: string[] = [];
  lines.push("=== Binary File Signature Report ===");
  lines.push(`File: ${fileName || "(no name)"}`);
  lines.push(`Bytes inspected: ${result.bytesRead}`);
  lines.push(`Verdict: ${result.verdict.toUpperCase()}`);
  if (result.primary) {
    lines.push("");
    lines.push(`Primary match: ${result.primary.rule.name}`);
    lines.push(`  MIME:      ${result.primary.rule.mime}`);
    lines.push(`  Extension: ${result.primary.rule.exts.join(", ")}`);
    lines.push(`  Category:  ${CATEGORY_LABELS[result.primary.rule.category]}`);
    lines.push(`  Hex magic: ${ruleHex(result.primary.rule)}`);
    lines.push(`  Offset:    0x${result.primary.rule.offset.toString(16).toUpperCase()}`);
    lines.push(`  Confidence: ${result.primary.confidence}`);
    lines.push(`  Description: ${result.primary.rule.description}`);
  } else if (result.isPlainText) {
    lines.push("");
    lines.push("No magic-number signature matched. The file appears to be plain text (CSV, JSON, log, source code, etc.).");
  } else {
    lines.push("");
    lines.push("No magic-number signature matched. The file format is unknown or truncated.");
  }
  if (result.matches.length > 1) {
    lines.push("");
    lines.push(`Other candidates (${result.matches.length - 1}):`);
    for (let i = 1; i < result.matches.length; i++) {
      const m = result.matches[i];
      lines.push(`  - ${m.rule.name} (${m.confidence})`);
    }
  }
  if (result.extensionSpoofed && result.primary) {
    const ext = extractExtension(fileName);
    lines.push("");
    lines.push(`WARNING: extension ".${ext}" does not match the detected ${result.primary.rule.name} signature.`);
    lines.push("This may indicate a renamed or spoofed file — verify the source before opening.");
  }
  lines.push("");
  lines.push("--- Hex dump (first 64 bytes) ---");
  lines.push(renderHexDumpText(bytes.slice(0, 64), { bytesPerLine: 16 }));
  return lines.join("\n");
}
