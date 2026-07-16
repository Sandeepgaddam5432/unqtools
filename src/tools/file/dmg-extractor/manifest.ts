import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "dmg-extractor",
  name: "DMG Extractor",
  description:
    "Inspect macOS DMG disk images in the browser — pure JavaScript UDIF trailer (koly) parser. Detects the 'koly' signature at the file's tail (last 512 bytes), parses the trailer fields (version, header size, flags, data fork offset/length, resource fork offset/length, segment info, plist pointer), and lists partition hints. Honest about HFS+/APFS extraction limitations — full disk-image decoding requires native libraries. 100% client-side.",
  category: "file",
  keywords: [
    "dmg extractor", "dmg viewer", "dmg reader", "dmg inspector",
    "macos disk image", "udif", "koly trailer", "apple dmg",
    "dmg-extractor", "hfs+ viewer",
  ],
  icon: "file-archive",
  requiresNetwork: false,
  seo: {
    title: "DMG Extractor — Inspect .dmg Disk Images in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It inspects macOS DMG (disk image) files. Every DMG ends with a 512-byte UDIF trailer called the 'koly' structure. The trailer's first 4 bytes are the ASCII signature 'koly' (0x6B 0x6F 0x6C 0x79). We read the last 512 bytes of the file, verify the signature, then parse the trailer fields: version, header size, flags, running data fork offset, data fork offset/length, resource fork offset/length, segment number/count, plist offset/length, and the master checksum. We also detect compression (UDZO, UDBZ, ULFO, UFBI, UDRO, UDCM) and report the segment count for multi-part DMGs." },
      { q: "Can it extract files from inside the DMG?", a: "Honest answer: No. The DMG data fork contains a raw disk image (typically HFS+, APFS, or a hybrid ISO9660/HFS layout). Decoding it requires parsing the filesystem structures (HFS+ B-tree, APFS container) and decompressing the block-level compression (UDZO=zlib, UDBZ=bzip2, ULFO=lzfse, UFBI=ADC). A pure-JS implementation would be hundreds of KB+ and we don't bundle it to stay within the per-tool budget. We DO show all the trailer info and detect the compression scheme — for full extraction, mount the DMG natively on macOS (double-click), or use 7-Zip (which supports UDZO/UDBZ) on Windows." },
      { q: "What is the UDIF 'koly' trailer?", a: "UDIF (Universal Disk Image Format) is Apple's native DMG container. The 'koly' block is a 512-byte trailer that always sits at the very end of the file (offset = fileSize - 512). Fields (big-endian): signature 'koly' (4 bytes), version (4 bytes, usually 4), header size (4 bytes, usually 512), flags (4 bytes), running data fork offset (8 bytes), data fork offset (8 bytes), data fork length (8 bytes), resource fork offset (8 bytes), resource fork length (8 bytes), segment number (4 bytes), segment count (4 bytes), UUID (16 bytes), plist offset (8 bytes), plist length (8 bytes), and a master checksum (4 bytes type + variable data)." },
      { q: "What are common DMG compression types?", a: "DMG uses a 4-character compression marker stored in the resource fork's plist (UDZO = zlib/DEFLATE, UDBZ = bzip2, ULFO = LZFSE, UFBI = ADC, UDRO = raw/uncompressed, UDCM = custom). We detect the compression from the plist XML and tell you what to expect. UDZO is the most common — created by macOS's default hdiutil 'UDZO' option. ULFO is the modern default on macOS 10.11+." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop file input. (2) UDIF trailer detection (reads last 512 bytes). (3) 'koly' signature verification (0x6B 0x6F 0x6C 0x79). (4) Trailer field extraction (version, header size, flags, data fork offset/length, resource fork offset/length, segment count, plist pointer). (5) Compression scheme detection (UDZO, UDBZ, ULFO, UFBI, UDRO, UDCM). (6) Stats panel — file size, data fork size, resource fork size, segment info. (7) Honesty disclaimer displayed prominently. (8) Alternative suggestions (macOS native mount, 7-Zip on Windows). (9) History (localStorage — last 10 inspected DMGs). (10) Shareable URL with inspector settings." },
      { q: "Is my DMG file uploaded anywhere?", a: "No. All koly trailer detection and field parsing runs in your browser using pure JavaScript. The DMG binary is read locally — only the last 512 bytes (the trailer) are parsed. File contents never leave your device. Only file summaries (filename, version, segment count) are saved to local history." },
      { q: "Why does the tool say 'compressed' for some DMGs?", a: "The DMG data fork is usually block-compressed (UDZO=zlib, UDBZ=bzip2, ULFO=LZFSE). We detect this from the resource fork's plist (a small XML inside the DMG). When the plist is present and references a known compression marker, we display the scheme. Note: the actual decompression of the disk image is not supported — we only identify what's inside." },
    ],
  },
  status: "done",
};
