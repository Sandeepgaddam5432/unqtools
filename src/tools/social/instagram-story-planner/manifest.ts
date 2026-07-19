import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "instagram-story-planner",
  name: "Instagram Story Planner",
  description:
    "Plan Instagram story sequences with text overlays, stickers, polls, and questions. 7 story-type templates (announcement, tutorial, behind-the-scenes, Q&A, poll, list, story-time), 4 tones (casual, professional, playful, urgent), 6 sticker types (poll, question, link, location, mention, hashtag), slide text-overlay generator, story sequence validator (hook + CTA), story flow checker, slide count calculator, poll/question/link slide generators, slide duration calculator (3-15 sec), music suggestion per story type, 2 alt-variations, summary stats, CSV/text export, history (localStorage), shareable URL. 100% client-side.",
  category: "social",
  keywords: [
    "instagram story", "ig story", "story planner",
    "story sequence", "story slides", "storyboard",
    "ig story planner", "story template", "insta story",
    "story stickers", "story poll",
  ],
  icon: "instagram",
  requiresNetwork: false,
  seo: {
    title: "Instagram Story Planner — 7 Story Templates, Stickers, Polls | UnQTools",
    faq: [
      {
        q: "How does the Instagram story planner work?",
        a: "Pick a story type (announcement, tutorial, behind-the-scenes, Q&A, poll, list, or story-time), a tone (casual, professional, playful, urgent), and the number of slides (5-15). The tool generates a slide-by-slide storyboard using a per-type template (e.g. announcement = hook → context → details → CTA → link), with concise text overlays, sticker placements, and per-slide durations (3-15 seconds based on content length).",
      },
      {
        q: "What sticker types are supported?",
        a: "Six sticker types: poll (with question + 2 options), question sticker (open-ended prompt), link sticker (with URL — requires 10K+ followers on classic accounts, available to all on professional accounts), location sticker, mention sticker, and hashtag sticker. Each sticker is placed at the right point in the sequence based on the story template.",
      },
      {
        q: "How is slide duration calculated?",
        a: "Each slide gets a duration between 3 and 15 seconds based on its text length and slide type. Hook and CTA slides get longer durations (more time to land the message). Poll and question slides get 10-15s so viewers have time to interact. Default text slides get 5-8s depending on character count.",
      },
      {
        q: "What is the story sequence validator?",
        a: "Two checks run on every generated storyboard: (1) Sequence validator confirms a hook slide (first slide) and a CTA slide (last slide) are present — required for effective stories. (2) Flow checker confirms slides follow a logical progression from intro to CTA with no gaps (e.g. tutorial must have at least one 'step' slide before 'result').",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 7 story-type templates (announcement, tutorial, BTS, Q&A, poll, list, story-time). (2) Slide text overlay generator (concise per-slide text). (3) Sticker placement recommender (6 sticker types). (4) Story sequence validator (hook + CTA). (5) Story flow checker. (6) 4 tone presets (casual, professional, playful, urgent). (7) Slide count calculator. (8) Poll slide generator (question + 2 options). (9) Question sticker slide generator. (10) Link sticker slide generator (with URL). (11) Render as text storyboard. (12) Render as CSV (slide_num, type, text_overlay, stickers, duration_sec). (13) Copy + Download .txt + Download CSV. (14) History (localStorage, last 20). (15) Shareable URL (inputs encoded in hash). (16) Summary stats (slides, by type, by sticker). (17) Slide duration calculator (3-15s per slide). (18) Story variation generator (2 variations with different hooks). (19) Music suggestion per story type (built-in mood-to-genre mapping).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All story planning runs locally in your browser. Your topic and inputs never leave this device. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
