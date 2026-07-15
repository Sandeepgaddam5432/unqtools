import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "wim-extractor",
  name: "WIM Extractor",
  description:
    "Extract files from Windows Imaging Format (.wim) files in your browser. Parses the WIM header (signature MSWIM\\0\\0\\0), reads the resource table, lists images, and extracts files from each image. 100% client-side. Browse, search, filter, preview, and download individual files or all as ZIP.",
  category: "file",
  keywords: [
    "wim extractor", "extract wim", "wim to zip", "wim file list",
    "windows imaging format", "wim unpack", "wim contents",
    "wim viewer", "wim online", "wim image extractor", "wim to files",
  ],
  icon: "package",
  requiresNetwork: false,
  seo: {
    title: "WIM Extractor — Extract Files from Windows Imaging Format (.wim) | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It parses Windows Imaging Format (.wim) files by reading the 8-byte MSWIM signature, decoding the WIM header (which points to the resource table, metadata, and lookup table), walking the image metadata to list the file tree, and extracting individual files. Files inside the WIM can be browsed, previewed as text or hex, and downloaded individually or all as a ZIP." },
      { q: "What is the WIM format?", a: "WIM (Windows Imaging Format) is Microsoft's file-based disk image format used for Windows deployment, install.esd/install.wim files on installation media, and enterprise imaging. Unlike sector-based formats (ISO, VHD), WIM stores files individually with metadata, enabling single-instance storage, compression (LZX/XPress), and multi-image support (multiple Windows editions in one .wim)." },
      { q: "Can it handle install.wim from Windows installers?", a: "Yes, but only uncompressed or XPRESS-compressed WIMs are fully supported. LZX-compressed WIMs (used in install.wim) require decompression which we partially support — file listing works, but extraction of compressed file resources may fail. For full LZX support, use DISM on Windows or wimlib on Linux." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) Image list with metadata. (3) File tree view with expand/collapse. (4) Filename search. (5) Filter by file type. (6) Stats — image count, file count, total size. (7) Download individual files. (8) Download all as ZIP. (9) History in localStorage (last 10). (10) Shareable URL with current view state." },
      { q: "Is my WIM file uploaded anywhere?", a: "No. All WIM parsing and file extraction happens in your browser. File contents never leave your device." },
      { q: "Can it apply the WIM to a disk partition?", a: "No — applying a WIM requires Windows DISM or wimlib-apply on Linux, plus filesystem-level access that browsers cannot provide. This tool lets you browse and extract files from any WIM, on any operating system, without installing anything." },
    ],
  },
  status: "done",
};
