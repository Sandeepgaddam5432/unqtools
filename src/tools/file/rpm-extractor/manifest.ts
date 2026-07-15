import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "rpm-extractor",
  name: "RPM Extractor",
  description:
    "Extract files from RPM packages (Red Hat Package Manager) in your browser. Parses the RPM lead header (magic ed ab ee db), reads signature + regular headers for package metadata (name, version, release), and extracts the embedded cpio archive (gzip-compressed or uncompressed). 100% client-side. Browse, search, filter, preview, and download individual files or all as ZIP.",
  category: "file",
  keywords: [
    "rpm extractor", "extract rpm", "rpm to zip", "rpm file list",
    "red hat package manager", "rpm unpack", "rpm contents",
    "rpm viewer", "rpm online", "rpm to cpio", "rpm extractor free",
  ],
  icon: "package",
  requiresNetwork: false,
  seo: {
    title: "RPM Extractor — Extract Files from RPM Packages in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It parses RPM packages by reading the 96-byte lead header (magic ed ab ee db), walking the signature header (to skip it), parsing the regular header for package metadata (name, version, release, summary, architecture), and extracting the embedded cpio archive (which is usually gzip-compressed). Files inside the cpio are listed in a file tree, can be previewed as text or hex, and downloaded individually or all as a ZIP." },
      { q: "What is the RPM format?", a: "RPM (RPM Package Manager, originally Red Hat Package Manager) is the package format used by Red Hat, Fedora, CentOS, SUSE, and other Linux distributions. A .rpm file contains: (1) a 96-byte lead header with the package name and basic info, (2) a signature header for verification, (3) a regular header with metadata (name, version, file list), and (4) a cpio archive (often gzip-compressed) holding the actual files." },
      { q: "Does it support .src.rpm files?", a: "Yes. Source RPM files (.src.rpm) use the same format as binary RPMs but typically contain a .tar.gz source tarball, a .spec file, and patches. The extractor lists them just like binary RPM contents. Source RPMs usually have type=1 (source) in the lead header instead of type=0 (binary)." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) File tree view with expand/collapse. (3) Filename search. (4) Filter by file type (regular / directory / symlink). (5) Stats — file count, total size, package info (name, version, release, arch). (6) Download individual files. (7) Download all as ZIP. (8) Package info card (name, version, release, summary, architecture). (9) History in localStorage (last 10). (10) Shareable URL with current view state." },
      { q: "Is my RPM file uploaded anywhere?", a: "No. All RPM parsing, cpio extraction, and ZIP packaging happens in your browser. File contents never leave your device." },
      { q: "Can it install the RPM for me?", a: "No — this is an extractor, not an installer. Installing RPMs requires root access and the rpm/dnf package manager, which can only run on Linux. This tool lets you inspect and extract files from any RPM, on any operating system, without installing anything." },
    ],
  },
  status: "done",
};
