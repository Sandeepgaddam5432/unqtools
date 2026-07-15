import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-to-powerpoint-converter",
  name: "PDF to PowerPoint Converter",
  description:
    "Convert PDF text to PPTX (PowerPoint) presentations in your browser. Extracts text from each PDF page and creates one slide per page with title + content layout. Pure-JS OOXML generator — no Microsoft Office needed. Downloads a .pptx file.",
  category: "file",
  keywords: [
    "pdf to powerpoint", "convert pdf to ppt", "pdf to pptx",
    "pdf to presentation", "pdf to slides", "pdf to pptx converter",
    "pdf to powerpoint online", "pdf to powerpoint free",
    "extract text from pdf to slides", "pdf slide converter",
  ],
  icon: "presentation",
  requiresNetwork: false,
  seo: {
    title: "PDF to PowerPoint Converter — Convert PDF to PPTX in Browser | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "It extracts text from your PDF using a pure-JS PDF parser, then generates a PowerPoint (.pptx) file in Office Open XML format. Each PDF page becomes one slide. You can choose between two layouts: 'title + content' (title at top, bullet points below) or 'content only' (single text box filling the slide). The .pptx opens in Microsoft PowerPoint, Apple Keynote, Google Slides, and LibreOffice Impress." },
      { q: "How are slides structured?", a: "We generate a minimal but valid OOXML Presentation: [Content_Types].xml, _rels/.rels, ppt/presentation.xml, ppt/presProps.xml, ppt/viewProps.xml, ppt/theme/theme1.xml, ppt/slideMasters/slideMaster1.xml, ppt/slideLayouts/slideLayout1.xml, and one ppt/slides/slideN.xml per PDF page. Each slide has a title (first non-empty line) and content (remaining lines as bullet points)." },
      { q: "What PDF features are supported?", a: "We extract text from PDF content streams (Tj, TJ, ', \" operators). We don't extract images, vector graphics, fonts, colors, or layout positioning — just the text. The first non-empty line becomes the slide title; subsequent lines become bullet points. Multiple consecutive blank lines are preserved as paragraph breaks." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop input. (2) Page range selector (e.g. '1-3,5'). (3) Two slide layouts (title+content / content only). (4) Custom title slide (you specify the title + subtitle for slide 1). (5) Stats — slide count, word count, character count. (6) Live preview of the first slide's XML. (7) Configurable base font size (14–32pt). (8) Conversion history in localStorage (last 10). (9) Shareable URL with conversion options. (10) Custom slide template color (accent color for titles)." },
      { q: "Is my PDF uploaded anywhere?", a: "No. All PDF parsing and PPTX generation happens in your browser. File contents never leave your device." },
      { q: "Why isn't the formatting preserved from the PDF?", a: "PPTX is a presentation format — slides have a fixed aspect ratio (16:9 or 4:3) and bullets. PDF is a fixed-layout document where text is positioned with absolute coordinates. We reflow the text into title + bullets per page. If you need pixel-perfect conversion (each PDF page as an image on a slide), use a desktop tool like Adobe Acrobat Pro." },
    ],
  },
  status: "done",
};
