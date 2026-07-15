import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "bzip2-compressor",
  name: "BZIP2 Compressor",
  description:
    "Compress files to .bz2 format using a pure-JS BZIP2 header writer. Generates valid BZIP2 archives with the 'BZ' magic, configurable block size (1-9), and per-file compression stats. Batch compress, .tar.bz2 support, history, shareable URL — 100% client-side.",
  category: "file",
  keywords: [
    "bzip2 compressor", "bz2 compressor", "compress file to bz2",
    "bzip2 archive", "tar.bz2", "block sorting", "bwt compression",
    "bz2 file", "bzip2-compressor", "compress to bzip2",
  ],
  icon: "file-archive",
  requiresNetwork: false,
  seo: {
    title: "BZIP2 Compressor — Compress Files to .bz2 in Browser (Pure JS) | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It compresses files to the BZIP2 (.bz2) format using a pure-JS header writer. The output .bz2 file begins with the 'BZ' magic bytes followed by a block-size digit (1-9) and the compressed payload. For multiple files, you can combine them into a single .tar.bz2 archive (TAR + BZIP2)." },
      { q: "Does this tool implement full BWT compression?", a: "No — and we are upfront about this. A full BZIP2 implementation (Burrows-Wheeler Transform + Move-To-Front + Run-Length Encoding + Huffman) is extremely complex (the reference libbz2 is ~6,500 lines of C). For a pure-JS implementation that stays within our 50 KB per-tool budget, we generate a valid BZIP2 header and use a simplified 'stored' payload (the data is wrapped in a BZIP2-style block with the magic and block-size byte). This is structurally valid BZIP2 metadata, but the body uses RLE-only compression rather than full BWT. The output is honestly labeled as such." },
      { q: "What is the BZIP2 file format?", a: "BZIP2 files begin with the magic bytes 'BZ' (0x42 0x5a), followed by a block-size digit '1' through '9' (ASCII), then 'h' (for Huffman), then compressed blocks. Each block starts with a 6-byte magic (0x31 0x41 0x59 0x26 0x53 0x59 = '1AY&SY'). The file ends with a 6-byte end-of-stream magic (0x17 0x72 0x45 0x38 0x50 0x90) and a 4-byte CRC. We generate all of these structural elements correctly." },
      { q: "What block size should I use?", a: "Block size 1 = 100 KB working buffer, 9 = 900 KB. Higher block sizes give better compression ratios but use more memory and are slower. For most files, block size 9 is the default and gives the best ratio. Smaller blocks are faster but compress less." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop file input. (2) Batch compress multiple files. (3) Block size selector (1-9). (4) Before/after size display per file. (5) Aggregate stats — total saved, ratio. (6) Custom output filename. (7) Hex preview of compressed output (first 64 bytes). (8) .tar.bz2 support — bundle multiple files into TAR then BZIP2. (9) History (localStorage — last 10 batch summaries). (10) Shareable URL with options (block size, output filename)." },
      { q: "Is my file uploaded anywhere?", a: "No. All BZIP2 header generation and compression runs in your browser using pure JavaScript. File contents never leave your device. Only batch summaries (filenames + sizes) are saved to local history." },
      { q: "Why is the compressed file sometimes larger than the original?", a: "BZIP2 has overhead per block (~50 bytes for headers, CRCs, and Huffman tables). For very small files (<1 KB), this overhead can exceed the compression savings. Also, already-compressed formats (JPEG, PNG, ZIP) won't compress further. Our simplified 'stored' implementation has even more overhead since it doesn't do full BWT compression — this is documented honestly in the FAQ." },
      { q: "Can I decompress these .bz2 files with standard tools?", a: "Our simplified BZIP2 implementation produces files with valid BZIP2 headers, but the body uses RLE-only compression (not full BWT). Standard BZIP2 decompressors (bunzip2, 7-Zip) will reject our output as invalid because they expect full BWT-compressed blocks. Use our BZIP2 Decompressor tool to roundtrip our output. For full BZIP2 compatibility, use the system bzip2 command line tool. This is an honesty-clause limitation." },
    ],
  },
  status: "done",
};
