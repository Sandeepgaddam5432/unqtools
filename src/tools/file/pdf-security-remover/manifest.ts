import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-security-remover",
  name: "PDF Security Remover",
  description:
    "Remove password protection and security restrictions from PDF files. Parse the existing /Encrypt dictionary, verify the user password against the stored /U hash, decode the current permission flags, then strip the /Encrypt dictionary from the trailer. Honest about stream decryption limitations. 100% client-side.",
  category: "file",
  keywords: [
    "pdf security remover", "remove pdf password", "decrypt pdf",
    "pdf unlock", "pdf permissions remover", "strip pdf encryption",
    "remove pdf restrictions", "pdf-security-remover", "crack pdf password",
  ],
  icon: "unlock",
  requiresNetwork: false,
  seo: {
    title: "PDF Security Remover — Remove PDF Password & Restrictions | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It removes the /Encrypt dictionary from a PDF file's trailer, effectively stripping the password prompt and permission restrictions. The tool parses the existing /Encrypt dictionary to show you what permissions were removed (print, copy, modify, etc.), verifies your supplied user password against the stored /U hash (per the PDF spec algorithm), and outputs the modified PDF without the /Encrypt reference." },
      { q: "Can it remove security from any PDF?", a: "Honest answer: It depends on the PDF. There are two cases: (1) PDFs with a 'soft' /Encrypt dictionary (no actual stream encryption) — common for PDFs that were 'locked' by tools that don't actually encrypt streams. We can fully unlock these. (2) PDFs with full stream encryption (every string and stream is RC4/AES-encrypted) — produced by Adobe Acrobat, qpdf, or system PDF tools. We CAN remove the /Encrypt dictionary, but the stream objects remain encrypted and the resulting PDF will be unreadable (garbage text) because we don't decrypt the streams. For case (2), the right approach is to use Adobe Acrobat with the password (which decrypts streams at load time) and re-save without encryption." },
      { q: "How does password verification work?", a: "Per the PDF spec, the /U hash in the /Encrypt dictionary is computed from the user password + document ID using MD5 + RC4. We recompute /U from your supplied password and compare to the stored /U. If they match (first 16 bytes for R=3+, all 32 bytes for R=2), the password is correct. If they don't match, we show 'Wrong password'. This verification happens entirely in your browser — no server round-trip." },
      { q: "What if I just want to view permissions without removing them?", a: "The tool shows the current /Encrypt dictionary contents and decoded permissions in the UI before you click 'Remove Security'. You'll see: the /V (algorithm version), /R (revision), /Length (key bits), /P (permissions integer) decoded into the 8 permission flags, and the /O and /U hashes as hex. This is useful for inspecting what restrictions a PDF has without modifying it." },
      { q: "What does 'Remove Security' actually do to the PDF?", a: "It: (1) loads the PDF using pdf-lib with the ignoreEncryption:true option (so we can read the structure), (2) re-saves the PDF without the /Encrypt dictionary in the trailer (pdf-lib doesn't copy /Encrypt when saving), (3) returns the modified PDF bytes. The output PDF will open without a password prompt in any viewer. For 'soft-locked' PDFs (no stream encryption), the content is fully readable. For 'hard-encrypted' PDFs (streams actually encrypted), the content remains encrypted and may appear as garbage." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop file input. (2) Password input (with show/hide toggle). (3) Permission display — shows the 8 permission flags decoded from /P before removal. (4) Stats — file size before/after (the unlocked PDF is usually slightly smaller without the /Encrypt dictionary). (5) Preview of /Encrypt dictionary contents (V, R, O, U, P, Length). (6) Batch decrypt — process multiple PDFs at once. (7) Custom output filename. (8) History (localStorage — last 10 removal operations). (9) Shareable URL. (10) Error handling for wrong password — we verify the password against /U before attempting removal." },
      { q: "Is my PDF or password uploaded anywhere?", a: "No. All /Encrypt dictionary parsing, password verification (MD5 + RC4), and PDF re-saving runs in your browser using pure JavaScript. Your PDF contents and password never leave your device. Only batch summaries (filenames + sizes + whether password was verified) are saved to local history — passwords are NEVER stored." },
      { q: "Why does the output PDF show garbage text for some files?", a: "This happens when the input PDF had full stream encryption (every string and stream was RC4 or AES encrypted). We remove the /Encrypt dictionary, but the streams themselves remain encrypted. Without the /Encrypt dictionary, viewers don't know how to decrypt the streams, so they show raw encrypted bytes (garbage). For such PDFs, the only solution is to use Adobe Acrobat (which decrypts at load time) or qpdf with --decrypt. This is documented as an honesty-clause limitation — we cannot decrypt streams without implementing the full per-object RC4/AES decryption pipeline." },
    ],
  },
  status: "done",
};
