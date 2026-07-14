import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "mime-type-lookup",
  name: "MIME Type Lookup",
  description:
    "Look up MIME types by extension or vice versa. Magic bytes detection, IANA links, charset detection, sniffing risk warnings, .htaccess/nginx export, conflict finder, and quiz mode. 100% offline.",
  category: "network-security",
  keywords: [
    "mime", "mime type", "content type", "file extension", "media type",
    "iana", "internet media type", "lookup", "magic bytes", "charset",
    "sniffing", "htaccess",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "MIME Type Lookup — Magic Bytes, IANA, .htaccess Export | UnQTools",
    faq: [
      {
        q: "What is a MIME type?",
        a: "A MIME type (also called media type or content type) is a string that identifies the format of a file or data. For example, text/html for HTML files, image/png for PNG images. Defined in RFC 2045 and registered with IANA.",
      },
      {
        q: "What is magic bytes detection?",
        a: "Magic bytes (or file signatures) are specific byte sequences at the start of a file that identify its format. For example, PNG files always start with 0x89504E47, PDFs with 0x25504446 (%PDF). Our tool checks the first few bytes of a file against ~20 known magic byte patterns to detect the type — more reliable than extension alone.",
      },
      {
        q: "Why are some extensions mapped to multiple MIME types?",
        a: "Some file formats have multiple MIME types for historical reasons. For example, .js can be application/javascript (standard), text/javascript (legacy), or application/ecmascript. Our 'conflict finder' feature shows all extensions claimed by multiple types, and the 'analyze extension' feature shows which types claim a specific extension.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "Beyond standard lookup, we ship: (1) View history (localStorage, last 30). (2) Favorites — star types you reference often. (3) Category stats — see distribution across text/image/audio/video/etc. (4) Extension analyzer — which MIME types claim an extension. (5) Conflict finder — find extensions claimed by multiple types. (6) Content-Type header builder — with charset for text types. (7) Accept header builder — with quality values (q=). (8) Export as JSON. (9) Quiz mode — test your MIME type knowledge. (10) Shareable URL — encode query in fragment.",
      },
      {
        q: "What's the difference between MIME type and content type?",
        a: "Nothing — they're synonyms. 'MIME type' is the historical name (from Multipurpose Internet Mail Extensions, RFC 2045). 'Content type' is what the HTTP Content-Type header is called. 'Media type' is the modern IANA term.",
      },
      {
        q: "Why should I care about MIME sniffing?",
        a: "Browsers may 'sniff' (guess) the actual content type if the server sends a generic type like application/octet-stream. An attacker could upload a malicious file labeled as an image, and the browser might execute it as a script. Always send X-Content-Type-Options: nosniff to prevent this. Our tool warns you when a type is vulnerable to sniffing.",
      },
    ],
  },
  status: "done",
};
