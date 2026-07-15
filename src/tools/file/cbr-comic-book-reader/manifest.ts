import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "cbr-comic-book-reader",
  name: "CBR Comic Book Reader",
  description:
    "Read CBR (RAR-based) comic book archives in the browser. Detects RAR4 and RAR5 signatures, parses archive headers, lists file entries (page count, sizes, types), and displays comic info. Honest about RAR extraction limitations — full decompression requires WASM. 100% client-side.",
  category: "file",
  keywords: [
    "cbr reader", "cbr viewer", "cbr comic", "comic book reader",
    "rar archive viewer", "cbr file", "cbr extractor",
    "cbr-comic-book-reader", "rar header parser",
  ],
  icon: "book-open",
  requiresNetwork: false,
  seo: {
    title: "CBR Comic Book Reader — Read .cbr Files in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It reads CBR (RAR-based) comic book archives. The tool detects the RAR signature (RAR4: 0x52 0x61 0x72 0x21 0x1A 0x07 0x00, RAR5: 0x52 0x61 0x72 0x21 0x1A 0x07 0x01 0x00), parses the archive header to list file entries (page count, sizes, types), and displays comic info. RAR5 archives are also detected via the 8-byte signature." },
      { q: "Can it extract and display the comic pages?", a: "Honest answer: No. RAR uses a proprietary compression algorithm (the spec is closed, and a pure-JS implementation would be ~500KB+ of WASM). We parse the archive header and list all file entries (you'll see filenames, sizes, and types for every image inside the CBR). For extraction and actual page rendering, use a desktop tool like 7-Zip, The Unarchiver, or CDisplayEX — or convert your CBR to CBZ (which is ZIP-based and we CAN extract)." },
      { q: "What's the difference between RAR4 and RAR5?", a: "RAR4 (legacy): 7-byte signature 'Rar!\\x1a\\x07\\x00', header format with header-crc, header-type, header-flags, header-size fields. RAR5 (modern): 8-byte signature 'Rar!\\x1a\\x07\\x01\\x00', uses variable-length vint encoding, supports AES-256 encryption, larger dictionaries, and better compression ratios. We detect both and parse the headers correctly." },
      { q: "Why does this tool exist if it can't extract?", a: "Three reasons: (1) File inspection — you can see what's inside a CBR without opening it (page count, filenames, total size, RAR version). (2) Format detection — verify a .cbr file is actually RAR (not a misnamed ZIP or 7z). (3) CBZ fallback — we suggest converting CBR to CBZ (which we CAN extract) using a desktop tool, then opening the CBZ in our CBZ Comic Book Reader for full page rendering." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop file input. (2) RAR4 signature detection (7-byte magic). (3) RAR5 signature detection (8-byte magic). (4) File listing from header (filename, size, type). (5) Page counter (counts image files inside). (6) Stats — file count, total size, image count, largest file. (7) Honest disclaimer displayed prominently. (8) CBZ fallback suggestion (link to our CBZ reader). (9) File info display (RAR version, archive flags, entry count). (10) History (localStorage — last 10 opened CBRs)." },
      { q: "Is my CBR file uploaded anywhere?", a: "No. All RAR header parsing runs in your browser using pure JavaScript. File contents never leave your device. Only archive summaries (filename + entry count + RAR version) are saved to local history." },
      { q: "Can I extract pages from a CBR using this tool?", a: "No — full RAR decompression requires WASM. We suggest: (1) Use a desktop tool (7-Zip, The Unarchiver) to extract the CBR to a folder of images. (2) Re-zip the images into a CBZ (just rename .zip to .cbz, or use our Online ZIP Compressor after adding the images). (3) Open the CBZ in our CBZ Comic Book Reader for full page-by-page navigation. This is documented as an honesty-clause limitation." },
      { q: "What file types are detected as 'pages' inside the CBR?", a: "We recognize: .jpg, .jpeg (JPEG), .png (PNG), .gif (GIF), .webp (WebP), .bmp (BMP), .avif (AVIF). Files with these extensions are counted as pages and sorted naturally (page2.jpg < page10.jpg). Other files (metadata XML, cover thumbnails) are listed but not counted as pages." },
    ],
  },
  status: "done",
};
