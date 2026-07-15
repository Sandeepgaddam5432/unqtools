import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "tcr-to-epub-converter",
  name: "TCR to EPUB Converter",
  description:
    "Convert TCR (Psion) ebooks to EPUB format in your browser. Parses the TCR header (magic PCF), reads the 256-entry code dictionary, decodes the compressed text stream, splits into chapters, generates a complete EPUB with NCX + NAV TOC, and packages as a .epub ZIP. 100% client-side.",
  category: "file",
  keywords: [
    "tcr to epub", "convert tcr to epub", "psion to epub",
    "tcr ebook converter", "tcr to epub online", "tcr to epub free",
    "psion tcr to epub", "tcr to kindle", "tcr to ereader",
    "tcr file converter", "tcr decompressor",
  ],
  icon: "book-open",
  requiresNetwork: false,
  seo: {
    title: "TCR to EPUB Converter — Convert Psion TCR to EPUB | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It parses Psion TCR files by reading the 8-byte PCF magic header, loading the 256-entry code dictionary (variable-length codes 1-2 bytes each), decoding the compressed text stream bit-by-bit, splitting the resulting text into chapters by heading detection, and generating a valid EPUB 3 archive with both NCX (EPUB 2) and NAV (EPUB 3) tables of contents. The result opens in Apple Books, Calibre, Kobo, Nook, and most e-readers." },
      { q: "What is the TCR format?", a: "TCR is a simple text compression format used by Psion Series 3/5 PDAs and the EPOC operating system. It's essentially a Huffman-style code dictionary compressor: the file starts with a 'PCF' magic, then a 256-entry dictionary where each entry is a variable-length byte string (1-2 bytes), then the compressed text stream. Each byte in the compressed stream indexes into the dictionary to produce 1-2 output bytes." },
      { q: "Is TCR the same as compressed text?", a: "Yes — TCR is essentially a static dictionary compressor. The dictionary is per-file (stored at the start), so each TCR file is self-describing. Compression ratio is typically 40-50% for English text. We decompress fully client-side and report the compression ratio in the stats." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) Custom title and author metadata. (3) Stats — words, characters, compression ratio. (4) Live preview of the first chapter's XHTML. (5) Custom CSS injection into the EPUB stylesheet. (6) Configurable base font size (10–36pt). (7) Conversion history in localStorage (last 10). (8) Shareable URL with conversion options. (9) Chapter detection by heading. (10) Both NCX (EPUB 2) and NAV (EPUB 3) tables of contents for maximum reader compatibility." },
      { q: "Is my TCR file uploaded anywhere?", a: "No. All TCR parsing, dictionary decompression, EPUB XML generation, and ZIP packaging happens in your browser. File contents never leave your device." },
      { q: "What is the compression ratio I see in stats?", a: "The compression ratio is calculated as compressedBytes / decompressedBytes. For example, a ratio of 0.55 means the compressed TCR file is 55% the size of the decompressed text. A ratio near 1.0 means little compression was achieved (e.g., the file was already random or had a poor dictionary)." },
    ],
  },
  status: "done",
};
