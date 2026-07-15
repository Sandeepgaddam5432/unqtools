import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "apk-extractor",
  name: "APK Extractor",
  description:
    "Extract and inspect Android APK files in the browser — pure JavaScript APK (ZIP) parser. View AndroidManifest.xml (binary XML detection), list DEX files, resources, and assets, extract individual files, detect app info (package name, version) from manifest. 100% client-side.",
  category: "file",
  keywords: [
    "apk extractor", "apk viewer", "apk reader", "android apk",
    "apk parser", "apk inspector", "extract apk", "apk to zip",
    "android app extractor", "apk-extractor",
  ],
  icon: "smartphone",
  requiresNetwork: false,
  seo: {
    title: "APK Extractor — Inspect Android APK Files in Browser (Pure JS) | UnQTools",
    faq: [
      { q: "What is an APK file?", a: "APK (Android Package) is the file format Android uses to distribute and install apps. An APK is a ZIP archive containing: AndroidManifest.xml (the app's manifest, in a binary XML format), classes.dex (Dalvik bytecode), resources.arsc (compiled resources), res/ (XML + images), assets/ (raw files), lib/ (native libraries per ABI), and META-INF/ (signatures)." },
      { q: "How does this tool work?", a: "We parse the APK as a ZIP archive using a pure-JavaScript parser (supports both STORE and DEFLATE entries). We list every file inside, detect the AndroidManifest.xml (binary XML format), parse the package name and version code from it, identify DEX files, and let you extract individual files or re-zip everything as a standard ZIP. Decompression of DEFLATE entries uses the browser's native DecompressionStream API." },
      { q: "Why is AndroidManifest.xml shown as binary?", a: "Android compiles the manifest into a binary XML format (AXML) to save space on device. The format is documented (resource IDs, string pools, attribute namespaces) but parsing it requires significant code. We currently detect binary XML files by their magic bytes (0x03 0x00) and tag them as 'Binary XML (AXML)'. A textual representation of the manifest is in the resources.arsc file, which can also be extracted here for further analysis." },
      { q: "Can I install an APK from this tool?", a: "No. Installing APKs requires either ADB (Android Debug Bridge) or the Android package installer, neither of which runs in a browser. This tool is for inspecting and extracting APK contents — useful for security research, reverse engineering, asset extraction, or verifying what's inside an APK before installing it on a device." },
      { q: "Can I extract the app's source code?", a: "No — APKs contain compiled Dalvik bytecode (.dex files), not Java/Kotlin source. To read the bytecode you'd need a tool like jadx or dex2jar, which run as desktop apps (Java). This tool can extract the .dex files for offline analysis with those tools. Resources (images, XML, layout files) can be extracted as-is and inspected directly." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) File tree grouped by directory (res/, assets/, lib/, etc.). (3) Search files by name. (4) Filter by file type (DEX, resources, XML, images, native libs). (5) Stats — file count, total uncompressed size, compression ratio. (6) Download individual files. (7) Download all as ZIP (re-zip STORE method). (8) App info display — parse package name, version code, and version name from binary AndroidManifest. (9) Permission list — extract declared permissions from the manifest's string pool. (10) History of recently inspected APKs (localStorage — last 10)." },
      { q: "Is my APK uploaded anywhere?", a: "No. All APK parsing runs in your browser using pure JavaScript. File contents never leave your device. Only archive summaries (filename + package name + entry count) are saved to local history for convenience." },
      { q: "Can I see the app's signing certificate?", a: "We list the META-INF/ entries (CERT.RSA, CERT.SF, MANIFEST.MF) but do not parse the PKCS#7 signature. To inspect the certificate, extract CERT.RSA and use OpenSSL: `openssl pkcs7 -inform DER -in CERT.RSA -print_certs -text`. This keeps our tool focused on file inspection, not signature verification." },
    ],
  },
  status: "done",
};
