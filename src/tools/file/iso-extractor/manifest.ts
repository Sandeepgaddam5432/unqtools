import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "iso-extractor",
  name: "ISO Extractor",
  description:
    "Extract files from ISO 9660 disk images in the browser — pure JavaScript sector-based reader. Parse Primary Volume Descriptor, list root directory, navigate directories, extract individual files. Supports Joliet extension. 100% client-side.",
  category: "file",
  keywords: [
    "iso extractor", "iso viewer", "iso reader", "iso 9660",
    "iso parser", "disk image", "joliet extension",
    "extract iso", "iso to zip", "iso-extractor",
  ],
  icon: "disc",
  requiresNetwork: false,
  seo: {
    title: "ISO Extractor — Extract .iso Files in Browser (Pure JS, ISO 9660) | UnQTools",
    faq: [
      { q: "What is an ISO file?", a: "An ISO file is a disk image — a byte-for-byte copy of an optical disc (CD, DVD, Blu-ray) or a virtual filesystem. ISO 9660 is the standard filesystem format used by data CDs since 1988. Most software installers, Linux distribution ISOs, and game backups use this format. The ISO container itself has no compression — files inside are stored as raw sectors (typically 2048 bytes each)." },
      { q: "How does this tool work?", a: "We parse the ISO 9660 filesystem in pure JavaScript: (1) read the Primary Volume Descriptor (PVD) at sector 16 to get the volume ID, creation date, and root directory location, (2) walk the root directory to list files and subdirectories, (3) for each file, read the bytes at its specified sector + offset. We support the Joliet extension (UTF-16LE filenames with full Unicode support) and the Rock Ridge extension (POSIX-style filenames, partially)." },
      { q: "Can I boot from this ISO?", a: "No. Booting requires a bootloader (BIOS/UEFI), which is a hardware-level operation browsers cannot perform. This tool is for file extraction only — useful for inspecting installer ISOs, extracting individual files from a Linux distribution ISO, or backing up data from an old CD image. To create a bootable USB from an ISO, use Rufus (Windows) or `dd` (Linux/macOS)." },
      { q: "Can I read UDF (Blu-ray) ISOs?", a: "Partially. Most Blu-ray discs use UDF (Universal Disk Format) instead of ISO 9660. We detect UDF volumes and list them as 'unsupported filesystem' — for those, use a desktop tool like 7-Zip or the `udftools` package. Standard ISO 9660 + Joliet (used by ~95% of installers) works fully." },
      { q: "Are large ISOs (4GB+) supported?", a: "Yes. ISO 9660 has a 4GB file size limit (32-bit fields), but most modern ISOs use the ISO 9660:1999 extension or UDF which support larger files. We read 32-bit size fields, so individual files >4GB may be reported with truncated sizes. The total ISO size is unlimited (we use byte offsets, not sector indexes)." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) Directory tree view — navigate folders. (3) Search files by name (case-insensitive). (4) Filter by file type (text, image, code, executable, etc.). (5) Stats — file count, directory count, total size, ISO size. (6) Preview text files inline (UTF-8 / ASCII). (7) Download individual files. (8) Download all as ZIP (re-zip STORE method). (9) Volume info display — volume ID, creation date, system, publisher, application. (10) History of recently extracted ISOs (localStorage — last 10)." },
      { q: "Is my ISO uploaded anywhere?", a: "No. All ISO 9660 parsing runs in your browser using pure JavaScript. File contents never leave your device. Only archive summaries (filename + volume ID + entry count) are saved to local history." },
      { q: "What's the maximum ISO size?", a: "There's no hard limit, but the practical limit is your browser's per-tab memory (~2-4 GB). ISOs are read in sectors, so we don't load the whole file into memory at once — only the sectors we need. For very large ISOs (>4GB), directory walking is fast but file extraction may take a few seconds per file due to the byte ranges involved." },
    ],
  },
  status: "done",
};
