import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "arj-extractor",
  name: "ARJ Extractor",
  description:
    "Inspect ARJ archives. Detects the ARJ magic (0x60 0xEA), parses header structures, lists file entries with sizes and CRCs, and extracts STORE-method files when possible. Honest about ARJ compression limitations. 100% client-side.",
  category: "file",
  keywords: [
    "arj extractor", "arj archive", "arj file",
    "extract arj", "arj viewer", "arj inspector",
    "arj-extractor", "compressed archive",
  ],
  icon: "file-archive",
  requiresNetwork: false,
  seo: {
    title: "ARJ Extractor — Inspect & Extract .arj Files in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It inspects ARJ archives. The tool detects the ARJ magic bytes (0x60 0xEA — the 2-byte header ID at the start of every ARJ file), parses the main archive header and per-file headers, lists all file entries with their sizes, CRCs, and compression methods, and extracts files stored with method 0 (stored / no compression)." },
      { q: "Can it extract all ARJ files?", a: "Honest answer: No. ARJ supports multiple compression methods (0=stored, 1=most compressed, 2=compressed, 3=fastest, 4=fastest no CRC). Methods 1-4 use a proprietary dictionary-based algorithm. We CAN extract stored (method 0) files, but those are rare — most ARJ files use method 1. For compressed files, we parse the header and list file entries, but content extraction fails. For full ARJ support, use ARJ software (DOS/Windows) or WinARJ." },
      { q: "What's the ARJ header structure?", a: "Each ARJ archive starts with a main archive header: (1) 2-byte magic 0x60 0xEA, (2) 2-byte basic header size (LE), (3) 1-byte first header size, (4) 1-byte archiver version (e.g., 0x01 0x06 = 1.06), (5) 1-byte min version to extract, (6) 1-byte host OS (0=MSDOS, 1=PRIMOS, 2=UNIX, 3=AMIGA, etc), (7) 1-byte archive flags, (8) 2-byte security version, (9) 4-byte file creation time (DOS format), (10) 4-byte modification time, (11) 4-byte archive size. Then each file has a similar header followed by compressed data." },
      { q: "What compression methods does ARJ use?", a: "ARJ supports 5 methods: 0 = stored (no compression), 1 = most compressed (default), 2 = compressed, 3 = fastest, 4 = fastest without CRC. Method 1 is the most common. The algorithm is dictionary-based (similar to LZ77) with arithmetic coding. We display the method for each file and can extract method 0 files." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop file input. (2) ARJ magic detection (0x60 0xEA). (3) File listing from header (filename, size, method). (4) Stats — file count, total sizes, method breakdown. (5) Compression method display per file. (6) Honest disclaimer displayed prominently. (7) File info display (archiver version, host OS, archive flags). (8) CRC32 display per file (when available). (9) History (localStorage — last 10 inspected ARJ files). (10) Shareable URL." },
      { q: "Is my ARJ file uploaded anywhere?", a: "No. All ARJ magic detection, header parsing, and file listing runs in your browser using pure JavaScript. File contents never leave your device. Only archive summaries (filename + entry count) are saved to local history." },
      { q: "Why are ARJ files rare today?", a: "ARJ (Archive by Robert Jung) was popular in the 1990s BBS era, especially in DOS and FidoNet networks. It lost market share to ZIP in the late 1990s due to ZIP's wider cross-platform support. ARJ is still occasionally found in legacy industrial systems, retro computing archives, and certain regional software distributions. If you encounter an ARJ file today, it's likely from an old backup or a legacy system." },
    ],
  },
  status: "done",
};
