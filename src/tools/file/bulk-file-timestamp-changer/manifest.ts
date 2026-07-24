/**
 * Bulk File Timestamp Changer — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "bulk-file-timestamp-changer",
  name: "Bulk File Timestamp Changer",
  description:
    "Batch change file modification, access, and creation timestamps. Relative offsets, absolute dates, EXIF-based, filename-parse, and 10+ extras. 100% private.",
  category: "file",
  keywords: ["file timestamp", "modify timestamp", "touch", "bulk rename", "file date", "mtime", "atime", "creation date"],
  icon: "clock",
  requiresNetwork: false,
  seo: {
    title: "Bulk File Timestamp Changer — mtime/atime/ctime Batch | UnQTools",
    faq: [
      { q: "Can browser-based tools really change file timestamps?", a: "Yes, with limitations. The File System Access API (Chrome/Edge) supports File SystemFileHandle.createWritable() with optional `lastModified` on the Blob. This tool generates a script + a downloadable ZIP with modified files for users without File System Access API support." },
      { q: "What extras does this tool have?", a: "Extras: (1) Set mtime/atime/ctime to absolute date, (2) Offset by relative time (+/- days/hours/min), (3) Set to file's EXIF DateTimeOriginal, (4) Parse date from filename (configurable regex), (5) Copy from another file's mtime, (6) Sequence mode (increment by N minutes per file), (7) Random within range, (8) Set to current time (touch), (9) Batch preview before apply, (10) CSV export of before/after, (11) Export PowerShell/Bash touch script, (12) Download modified files as ZIP, (13) Sort files by name/size/exif, (14) Drag-drop reordering for sequence mode." },
    ],
  },
  status: "done",
};
