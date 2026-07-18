import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "video-schema-generator",
  name: "Video Schema Generator (VideoObject JSON-LD)",
  description:
    "Generate VideoObject JSON-LD schema markup for videos. Duration converter (HH:MM:SS / MM:SS / seconds → ISO 8601 PT), schema validator, HTML script tag wrapper, BreadcrumbList companion schema, Clip schema for chapters, SeekToAction schema, Google rich results compliance check, CSV export, history (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "video schema", "videoobject", "json-ld", "schema markup",
    "structured data", "video seo", "rich results", "schema generator",
    "iso 8601 duration", "video markup", "breadcrumblist", "seektoaction",
  ],
  icon: "video",
  requiresNetwork: false,
  seo: {
    title: "Video Schema Generator — VideoObject JSON-LD Markup | UnQTools",
    faq: [
      {
        q: "How does the video schema generator work?",
        a: "Enter your video title, description, video URL, thumbnail URL, upload date, duration, creator, and optional metrics like views/likes. The tool generates a VideoObject JSON-LD schema with all required Google fields, validates it, and produces an HTML <script type=\"application/ld+json\"> tag you can paste into your page.",
      },
      {
        q: "What duration formats are supported?",
        a: "Three formats: (1) ISO 8601 already (e.g. PT4M13S) — passed through; (2) HH:MM:SS or MM:SS (e.g. 1:02:03 or 4:13) — converted to ISO 8601; (3) Plain seconds (e.g. 253) — converted to PT4M13S. The tool picks the right parser automatically based on the input string format.",
      },
      {
        q: "Can I add Clip and SeekToAction schemas for video chapters?",
        a: "Yes. Provide chapters in the description (one per line in `0:00 Intro` format) and the tool generates both Clip schema entries (one per chapter, with startOffset/name) and a SeekToAction potentialAction markup so Google can show chapter segments directly in search results.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) VideoObject JSON-LD generator (all required + optional fields). (2) Duration converter (HH:MM:SS / MM:SS / seconds → ISO 8601). (3) Schema validator (required fields, URL format, date format). (4) HTML script tag wrapper. (5) BreadcrumbList companion schema (toggleable). (6) Clip schema for video chapters. (7) SeekToAction schema generator. (8) Text report renderer. (9) CSV export. (10) Copy + Download .json + Download .html. (11) History (localStorage, last 20). (12) Shareable URL. (13) Schema validation report (errors/warnings). (14) Summary stats. (15) Google rich results compliance checker.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All schema generation and validation runs locally in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
