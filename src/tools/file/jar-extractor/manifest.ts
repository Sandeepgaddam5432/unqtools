import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "jar-extractor",
  name: "JAR Extractor",
  description:
    "Extract and inspect Java JAR files in the browser — pure JavaScript JAR (ZIP) parser. Parse META-INF/MANIFEST.MF, list class files, detect Main-Class, view manifest attributes, extract individual files or all as ZIP. 100% client-side.",
  category: "file",
  keywords: [
    "jar extractor", "jar viewer", "jar reader", "java jar",
    "jar parser", "jar inspector", "extract jar", "manifest viewer",
    "main class detector", "jar-extractor",
  ],
  icon: "file-archive",
  requiresNetwork: false,
  seo: {
    title: "JAR Extractor — Inspect Java JAR Files in Browser (Pure JS) | UnQTools",
    faq: [
      { q: "What is a JAR file?", a: "JAR (Java Archive) is a ZIP-based package format for Java class files and associated metadata. A JAR contains .class files (compiled Java bytecode), optional resources (images, properties files), and a META-INF/MANIFEST.MF file that declares metadata like the Main-Class, Class-Path, and Signature-Version." },
      { q: "How does this tool work?", a: "We parse the JAR as a ZIP archive using a pure-JavaScript parser (supports STORE and DEFLATE entries via DecompressionStream). We list every file inside, identify .class files, find and parse META-INF/MANIFEST.MF into a key-value attribute map, detect the Main-Class attribute (entry point), and let you extract individual files or re-zip everything as a standard ZIP." },
      { q: "Can I run the JAR?", a: "No. Running JARs requires a Java Runtime Environment (JRE) and `java -jar` command, neither of which runs in a browser. This tool is for inspecting JAR contents — useful for security research, verifying dependencies, extracting resources, or understanding what's inside before deploying." },
      { q: "Can I decompile the .class files?", a: "No — we list and extract .class files but do not decompile them. Decompiling Java bytecode to readable source requires tools like CFR, Procyon, or JD-GUI, which run as desktop apps. You can extract .class files here and run them through a decompiler offline." },
      { q: "What's in the manifest viewer?", a: "The META-INF/MANIFEST.MF file is a plain-text file with `Key: Value` pairs separated by colons, with line continuations (lines starting with a space continue the previous value). We parse it into an interactive key-value viewer that shows every attribute, including Manifest-Version, Created-By, Main-Class, Class-Path, and any custom attributes. Signature-related entries (CERT.SF, CERT.RSA) are listed but not parsed." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) File tree grouped by package path. (3) Search files by name (class name, resource name). (4) Filter by file type (.class, .properties, .xml, images, signatures). (5) Stats — file count, class file count, total uncompressed size, compression ratio. (6) Manifest viewer (parsed key-value pairs). (7) Main-Class detector with prominent display. (8) Download individual files. (9) Download all as ZIP (re-zip STORE method). (10) History of recently inspected JARs (localStorage — last 10)." },
      { q: "Is my JAR uploaded anywhere?", a: "No. All JAR parsing runs in your browser using pure JavaScript. File contents never leave your device. Only archive summaries (filename + main class + entry count) are saved to local history for convenience." },
      { q: "Can I see what libraries a JAR depends on?", a: "Yes — if the manifest declares a `Class-Path` attribute, we display it in the manifest viewer. Note that this only shows libraries the JAR explicitly declares in its manifest — transitive dependencies (managed by Maven/Gradle) are not in the JAR file itself. For full dependency analysis, use `jdeps` (ships with the JDK)." },
    ],
  },
  status: "done",
};
