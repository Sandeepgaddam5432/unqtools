import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "presentation-slide-outliner",
  name: "Presentation Slide Outliner",
  description:
    "Generate presentation slide outlines for 6 audience levels (elementary → expert). Title slide, agenda, content slides, summary, Q&A. Auto-calculates slide count from duration, per-slide time allocation, speaker notes, visual suggestions. Export TXT, HTML, Markdown (Marp/reveal.js), CSV. 100% client-side.",
  category: "education",
  keywords: [
    "presentation", "slides", "slide outline",
    "speaker notes", "presentation outline",
    "powerpoint outline", "keynote outline",
    "marp", "reveal.js", "lecture outline",
    "training outline", "conference talk",
  ],
  icon: "presentation",
  requiresNetwork: false,
  seo: {
    title: "Presentation Slide Outliner — 6 Audience Levels + Speaker Notes | UnQTools",
    faq: [
      {
        q: "How does the Presentation Slide Outliner work?",
        a: "Enter your presentation title, presenter name, audience level (elementary, middle-school, high-school, college, professional, expert), duration in minutes, and a topic outline (one section per line: section_title|key_points where key_points are semicolon-separated). The tool builds a structured outline: title slide → agenda → content slides → summary → Q&A, with per-slide bullets, speaker notes, visual suggestions, and time allocation. Export as TXT, HTML, Markdown (Marp/reveal.js compatible), or CSV.",
      },
      {
        q: "How is the slide count calculated?",
        a: "Slide count = presentation duration × slidesPerMinute. Default is 0.5 slides/minute (1 slide per 2 minutes), so a 30-minute talk gets 15 content slides plus optional title, agenda, summary, and Q&A slides. You can adjust slidesPerMinute for faster- or slower-paced talks. Each slide gets total_duration / slide_count minutes of time allocation.",
      },
      {
        q: "What audience levels are supported and how do they differ?",
        a: "Six levels: elementary (large visuals, simple words, lots of examples), middle-school (clear bullets, definitions), high-school (deeper context, comparisons), college (detailed content, charts, references), professional (action-oriented, data-driven), and expert (dense data, technical jargon, minimal fluff). Each level changes the bullet style, speaker note tone, and visual suggestion.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Topic outline parser (pipe + semicolon). (2) 6 audience level presets with distinct content styles. (3) Slide count calculator. (4) Slide template generator per audience level. (5) Slide structure builder (title → agenda → content → summary → Q&A). (6) Per-slide bullet point generator. (7) Speaker notes generator per slide. (8) Visual suggestion generator per slide. (9) Time allocation per slide. (10) Render as text outline. (11) Render as printable HTML slides. (12) Render as Markdown (Marp/reveal.js). (13) Render as CSV. (14) Copy + Download .txt + .html + .md + .csv. (15) History (localStorage, last 20). (16) Shareable URL. (17) Summary stats (total slides, total time, avg time per slide, by section count). (18) Presentation type presets (lecture, training, sales-pitch, conference-talk). (19) Bullet count validator (max 6 per slide). (20) Slide title length validator (max 50 chars).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All outline generation runs 100% client-side in your browser. No backend, no network calls. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
