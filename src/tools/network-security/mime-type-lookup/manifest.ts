import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "mime-type-lookup",
  name: "MIME Type Lookup",
  description:
    "Look up MIME types by file extension or vice versa. Includes common web types (HTML, CSS, JS, images, video, audio, fonts, documents) with official IANA registrations.",
  category: "network-security",
  keywords: [
    "mime",
    "mime type",
    "content type",
    "file extension",
    "media type",
    "iana",
    "internet media type",
    "lookup",
  ],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "MIME Type Lookup — File Extensions & Media Types | UnQTools",
    faq: [
      {
        q: "What is a MIME type?",
        a: "A MIME type (also called media type or content type) is a string that identifies the format of a file or data. For example, text/html for HTML files, image/png for PNG images. Defined in RFC 2045 and registered with IANA.",
      },
      {
        q: "Why are MIME types important?",
        a: "Browsers and servers use MIME types to know how to handle files. If a server sends a .css file with the wrong MIME type (e.g. text/plain), the browser may refuse to apply the styles. The X-Content-Type-Options: nosniff header prevents MIME-type guessing.",
      },
      {
        q: "Why are some extensions mapped to multiple MIME types?",
        a: "Some file formats have multiple MIME types for historical reasons. For example, .js can be application/javascript (standard), text/javascript (legacy), or application/ecmascript. We list the standard one first and alternatives second.",
      },
      {
        q: "What's the difference between MIME type and content type?",
        a: "Nothing — they're synonyms. 'MIME type' is the historical name (from Multipurpose Internet Mail Extensions, RFC 2045). 'Content type' is what the HTTP Content-Type header is called. 'Media type' is the modern IANA term.",
      },
    ],
  },
  status: "done",
};
