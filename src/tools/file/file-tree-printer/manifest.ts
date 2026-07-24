/**
 * File Tree Printer — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "file-tree-printer",
  name: "File Tree Printer",
  description:
    "Generate ASCII / Unicode file tree from a folder (via File System Access API or webkitdirectory). Customizable depth, filters, exclude patterns, and 10+ extras. 100% private.",
  category: "file",
  keywords: ["file tree", "directory tree", "ascii tree", "folder structure", "tree printer", "file listing"],
  icon: "folder-tree",
  requiresNetwork: false,
  seo: {
    title: "File Tree Printer — ASCII Folder Structure Generator | UnQTools",
    faq: [
      { q: "How does this tool access my files?", a: "Use the 'Pick folder' button (Chrome/Edge) or drag-drop a folder. Files are read via the File System Access API or webkitdirectory input. Nothing is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) ASCII or Unicode tree chars, (2) Max depth control, (3) Include/exclude glob patterns, (4) Show/hide hidden files, (5) Show/hide file sizes, (6) Sort by name/size/type, (7) Show file count + total size summary, (8) Copy tree to clipboard, (9) Download as .txt, (10) Markdown code-block wrap, (11) Color-coded by extension, (12) JSON output mode, (13) Ignore common dirs (node_modules, .git, dist), (14) Custom indent size." },
    ],
  },
  status: "done",
};
