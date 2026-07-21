/**
 * Chmod (File Permission) Calculator — Tool Manifest.
 * Tool #321 — Category 4 (Developer & Code).
 *
 * Two-way Linux/Unix file-permission calculator: clickable 3×3 grid
 * (owner/group/other × read/write/execute) ↔ octal (755) ↔ symbolic
 * (rwxr-xr-x) with full special-bit support (setuid/setgid/sticky),
 * symbolic-mode arithmetic (u+x,go-w), security linter, and copy-ready
 * chmod command generation. 100% client-side.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "chmod-calculator",
  name: "Chmod (File Permission) Calculator",
  description:
    "Convert Linux/Unix file permissions between octal (755), symbolic (rwxr-xr-x), and a clickable 3×3 grid. Full special-bit support (setuid/setgid/sticky with correct s/S/t/T case), symbolic-mode arithmetic (u+x,go-w), security linter (flags 777/world-writable/setuid on scripts), recursive safe-find pattern, umask companion, copy-ready chmod command, common presets, and shareable URL. 100% client-side.",
  category: "developer",
  keywords: [
    "chmod", "chmod calculator", "file permission", "permission calculator",
    "rwx", "rwxr-xr-x", "755", "644", "777", "octal permission",
    "setuid", "setgid", "sticky bit", "symbolic mode", "umask",
    "chmod command generator", "linux permission",
  ],
  icon: "lock",
  requiresNetwork: false,
  seo: {
    title: "Chmod Calculator — Octal ↔ Symbolic ↔ Grid, Special Bits, Safety Lint | UnQTools",
    faq: [
      {
        q: "How does the chmod calculator handle special bits (setuid/setgid/sticky)?",
        a: "The calculator always works with the full 4-digit octal (special bits are the leading digit). Toggling setuid/setgid/sticky produces the correct symbolic display: lowercase 's'/'t' when the underlying execute bit is set, uppercase 'S'/'T' when the special bit is on but execute is off — matching the kernel's own rendering.",
      },
      {
        q: "What's the difference between the three permission representations?",
        a: "Octal (755) packs each of owner/group/other into one digit where read=4, write=2, execute=1, summed. Symbolic (rwxr-xr-x) shows the nine literal letters (or '-' for absent). The grid is the same nine bits as checkboxes. All three stay in sync as you click or type, and you can paste any of them to load the others.",
      },
      {
        q: "Can it generate the chmod command, not just show the mode?",
        a: "Yes. It emits the copy-ready numeric form 'chmod 755 file' and the symbolic form 'chmod u=rwx,go=rx file'. For recursive changes it offers the safer 'find . -type d -exec chmod 755 {} \\;' / '-type f -exec chmod 644 {} \\;' pattern that distinguishes files from directories.",
      },
      {
        q: "Does it warn me about insecure modes?",
        a: "Yes — the security linter flags: 777 (world-writable+executable), any world-writable mode on a non-shared file, group-writable on what looks like a web root, setuid/setgid on scripts (a privilege-escalation vector), sticky bit set on a non-directory, and octal digits that exceed 7.",
      },
      {
        q: "What extra features does this tool have versus other chmod calculators?",
        a: "(1) Full 4-digit octal with special bits (setuid 4000 / setgid 2000 / sticky 1000). (2) Three-way sync: grid ↔ octal ↔ symbolic, including paste-anywhere. (3) Symbolic-mode arithmetic engine (u+x, go-w, a=r, u+X conditional). (4) Correct s/S/t/T case in symbolic display. (5) Plain-English per-bit explainer that's file-vs-directory aware. (6) Security linter for 777 / world-writable / setuid-on-scripts. (7) Copy-ready chmod command in both numeric and symbolic forms. (8) Recursive safe-find pattern with file/dir distinction. (9) Umask companion panel. (10) Common-mode presets (644 docs, 755 scripts/dirs, 600 SSH keys, 700 ~/.ssh, 1777 /tmp). (11) localStorage history (max 20). (12) Shareable URL (#755). 100% offline; pure bitwise math.",
      },
    ],
  },
  status: "done",
};
