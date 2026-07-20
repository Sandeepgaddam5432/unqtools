import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-video-script-outliner",
  name: "AI Video Script Outliner",
  description:
    "Generate platform-specific video script outlines for YouTube long-form, Shorts/Reels, TikTok, and explainer videos. Scroll-stopping hook variants, scene-by-scene beats with timestamps, on-screen text and B-roll cues, retention-curve tips, CTAs, word-count ↔ duration estimates, teleprompter export, long-form → Shorts repurposing, and series planning. Pure-JS template engine — optional BYO-key LLM. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "video script", "video script generator", "youtube script outline",
    "tiktok script", "reels script", "shorts script",
    "video hook generator", "b-roll cues", "teleprompter script",
    "no login video script",
  ],
  icon: "video",
  requiresNetwork: false,
  seo: {
    title: "AI Video Script Outliner — Hook-Driven YouTube/Reels/TikTok Scripts | UnQTools",
    faq: [
      {
        q: "How does the video script outliner work?",
        a: "Enter your topic, pick a platform (YouTube long-form, YouTube Short, TikTok, Instagram Reel, or explainer video), a tone (casual, professional, energetic, educational, or dramatic), and a target length (short, medium, long). The tool generates a structured script: a scroll-stopping hook with 3 variants you can switch between, scene-by-scene beats with timestamps and talking points, on-screen text and B-roll cue suggestions per scene, retention-curve tips (where to add a pattern interrupt), a CTA tailored to the platform, and a word-count ↔ duration estimate using a configurable WPM rate. Export to Markdown, teleprompter plain text, or JSON.",
      },
      {
        q: "How are the platforms different?",
        a: "YouTube long-form scripts use a 6–8 scene structure (hook, intro, 3–5 main beats, recap, CTA) with deeper B-roll and on-screen text cues, targeting 8–20 minutes. YouTube Shorts / TikTok / Reels use a 5-scene micro structure (hook in <3 seconds, 2 value beats, twist, CTA) targeting 30–90 seconds with rapid-fire cuts. Explainer videos use a problem → solution → demo → proof → CTA structure targeting 60–180 seconds with on-screen text emphasis for key terms. Each platform also has its own retention-curve tips and CTA conventions.",
      },
      {
        q: "How is duration estimated from word count?",
        a: "The tool uses a words-per-minute (WPM) rate that defaults to 150 WPM for narration (the comfortable listening rate). You can adjust it between 120 WPM (slow, dramatic) and 180 WPM (fast, energetic). Duration in seconds = (word count / WPM) × 60, plus 10% padding for pauses, B-roll, and on-screen text. Conversely, if you set a target duration, the tool computes the maximum word count you should write to stay within that duration. The estimate is shown next to every scene so you can hit your target.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Five platform presets (YouTube long, YouTube Short, TikTok, Reels, explainer) with platform-specific scene templates. (2) Five tone presets (casual, professional, energetic, educational, dramatic). (3) Three length presets per platform (short/medium/long) with auto-computed target durations. (4) 3 hook variants per script with one-click switcher. (5) Scene-by-scene timestamps and beat talking points. (6) B-roll cue suggestions per scene. (7) On-screen text suggestions per scene. (8) Retention-curve tips and pattern-interrupt placements. (9) Platform-specific CTA generator. (10) Word-count ↔ duration estimator with adjustable WPM. (11) Long-form → Shorts repurposer (extracts 3 short hooks from a long script). (12) Series/episode planner (3-episode arc). (13) Copy + Download (Markdown / teleprompter text / JSON). (14) History (localStorage, last 20). (15) Shareable URL. (16) Optional BYO-key LLM enhancement.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All topic parsing, scene generation, hook writing, B-roll and CTA synthesis, and duration estimation run locally in your browser. Topics and scripts never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose.",
      },
    ],
  },
  status: "done",
};
