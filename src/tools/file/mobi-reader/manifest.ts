import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "mobi-reader",
  name: "MOBI Reader",
  description:
    "Read MOBI ebook files in the browser — pure JavaScript binary MOBI parser. Parse PalmDB header + MOBI header, extract text content, chapter navigation, metadata (title, author). 100% client-side.",
  category: "file",
  keywords: [
    "mobi reader", "mobi viewer", "mobi browser", "read mobi",
    "ebook reader", "palmdb parser", "mobi header", "kindle format",
    "azw reader", "mobi-reader",
  ],
  icon: "book",
  requiresNetwork: false,
  seo: {
    title: "MOBI Reader — Read MOBI Ebooks in Browser (Pure JS) | UnQTools",
    faq: [
      { q: "What is a MOBI file?", a: "MOBI is an ebook format developed by Mobipocket (acquired by Amazon in 2005) and used by early Kindle devices. The format is based on the Palm Database (PalmDB) container: a 78-byte header followed by a list of records. The first record is the MOBI header (containing metadata, encoding, and compression info), and subsequent records hold the book's HTML content. Modern Kindles use KF8/AZW3 instead, but MOBI files are still widely distributed." },
      { q: "How does this reader work?", a: "We parse the binary MOBI format in pure JavaScript: (1) read the PalmDB header (78 bytes) to get the file type, creator, and record count, (2) read the record info table (each entry is 8 bytes: offset + attributes + unique ID), (3) read the first record as the MOBI header — extract the EXTH block for metadata, detect compression method (0=none, 1= PalmDOC, 2=HuffCDic), (4) for the standard text records, decode them using the compression method (we support 0=none and 1=PalmDOC RLE) and concatenate as HTML." },
      { q: "Which MOBI features are supported?", a: "We support: PalmDB header parsing, MOBI header parsing (including EXTH metadata for title, author, language, ISBN, publishing date), PalmDOC compression method 0 (no compression) and 1 (PalmDOC RLE), text extraction as HTML, and basic chapter detection (by <h1> / <h2> / <mbp:pagebreak/> tags). We do NOT support: HuffCDic compression (method 2), DRM-protected MOBI files, embedded fonts, image galleries, or KF8/AZW3 format (which uses a different container)." },
      { q: "Can I read DRM-protected MOBI files?", a: "No. DRM (Digital Rights Management) on MOBI files uses Amazon's proprietary encryption. Removing DRM requires the device's PID (Product ID) and serial number, plus custom decryption code that's legally restricted in many jurisdictions. If your MOBI file fails to open with a 'DRM-protected' error, that's why. Most Project Gutenberg and Standard Ebooks MOBI downloads are DRM-free." },
      { q: "What about AZW and AZW3?", a: "AZW is essentially MOBI with Amazon's DRM. AZW3 (KF8) is a newer format with a completely different internal structure (EPUB-like HTML + CSS). This tool reads plain MOBI only. For AZW3, convert to EPUB first with Calibre, then use our EPUB Reader tool." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop file input. (2) Font size adjustment (5 levels). (3) Dark / light reading mode. (4) Bookmark chapter (localStorage — resume from last chapter on reopen). (5) Search within book text. (6) Copy chapter text to clipboard. (7) File info panel — title, author, language, encoding, compression method, file size. (8) Chapter list / table of contents (sidebar). (9) Reading progress percentage. (10) History of recently opened books (localStorage — last 10)." },
      { q: "Is my book uploaded anywhere?", a: "No. The MOBI binary is parsed entirely in your browser using pure JavaScript. Book contents never leave your device. Only book titles + author names are saved to localStorage for the resume feature." },
      { q: "Why are some images missing?", a: "MOBI stores images as separate records (typically near the end of the file). We parse and list these records but only inline them if they're referenced via standard <img src=\"recindex:N\"/> tags. Some MOBI files use non-standard image references that we may not catch. If images are missing, the text content is still fully readable." },
    ],
  },
  status: "done",
};
