import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "deb-extractor",
  name: "DEB Extractor",
  description:
    "Extract files from Debian .deb packages in the browser — pure JavaScript AR archive parser. Lists debian-binary, control.tar.gz, and data.tar.gz members; parses control for package name/version/architecture; preview text members; download individual files or all as ZIP. 100% client-side.",
  category: "file",
  keywords: [
    "deb extractor", "debian package", "deb viewer", "deb reader",
    "ar archive", "control tar", "data tar", "debian-binary",
    "extract deb", "deb-extractor",
  ],
  icon: "file-archive",
  requiresNetwork: false,
  seo: {
    title: "DEB Extractor — Extract .deb Files in Browser (Pure JS) | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It extracts files from Debian (.deb) packages in your browser using a pure-JavaScript AR archive parser. A .deb file is an 'ar' archive containing three members: debian-binary (version string), control.tar.gz (package metadata + maintainer scripts), and data.tar.gz (the actual filesystem payload). We parse the AR header, list all three members, and let you download them individually or together as a ZIP. For control.tar.gz, we also attempt to decompress it and parse the 'control' file for the Package, Version, Architecture, Maintainer, Description and Depends fields." },
      { q: "What is the AR archive format?", a: "AR (archive) is a simple Unix format predating TAR. An AR archive starts with an 8-byte magic '!<arch>\\n' followed by 60-byte file headers. Each header has fields: name (16 bytes, terminated by '/' or whitespace), modification timestamp (12 bytes decimal), owner ID (6 bytes decimal), group ID (6 bytes decimal), file mode (8 bytes octal), file size (10 bytes decimal), and a 2-byte end marker '`\\n'. File data follows immediately and is padded to an even 2-byte boundary. AR is simpler than TAR — no checksum, no prefix field, no type flags." },
      { q: "Can I see the package info?", a: "Yes. We attempt to inflate the control.tar.gz member (using the browser's native DecompressionStream('gzip') API), parse it as a TAR archive, and locate the './control' file inside. The control file is RFC 822-style — we extract the Package, Version, Architecture, Maintainer, Installed-Size, Description, Depends, Recommends, Suggests, Conflicts, Breaks, Provides, Replaces, Section, Priority, Homepage and Source fields." },
      { q: "Can I extract the data.tar.gz payload?", a: "Yes, but as a compressed blob — we don't recursively inflate it here because the uncompressed payload of a real .deb can be tens or hundreds of MB. Use the GZIP Decompressor tool to inflate data.tar.gz into a plain .tar, then the TAR Extractor tool to list/extract individual files from it. This separation keeps each tool focused and lets us stay within the per-tool 50KB bundle budget." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) File tree view of AR members. (3) Search members by name. (4) Stats — total size, member count, largest member. (5) Preview text members inline (debian-binary, control, scripts). (6) Download individual members. (7) Download all members as ZIP. (8) Package info panel parsed from control (Package, Version, Architecture, Maintainer, Description, Depends). (9) History of recently extracted .deb files (localStorage — last 10). (10) Shareable URL with view options." },
      { q: "Is my .deb file uploaded anywhere?", a: "No. All AR parsing and (where applicable) GZIP inflation runs in your browser using pure JavaScript and native APIs. File contents never leave your device. Only file summaries (filename + size + member count) are saved to local history." },
      { q: "What about .deb files using xz compression?", a: "Modern .deb packages (Debian 11+ default) may use control.tar.xz and data.tar.xz. DecompressionStream('deflate-raw') can sometimes handle raw DEFLATE, but XZ is a different container format (LZMA2 inside an XZ wrapper). For .deb files with XZ members, we still list the members and let you download them; the package-info panel will skip parsing because we can't inflate XZ in pure JS without a WASM blob. Use the dpkg-deb tool on Linux or 7-Zip on Windows for full XZ support." },
    ],
  },
  status: "done",
};
