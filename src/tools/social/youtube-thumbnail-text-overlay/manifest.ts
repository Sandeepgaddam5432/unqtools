import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "youtube-thumbnail-text-overlay",
  name: "YouTube Thumbnail Text Overlay",
  description:
    "Generate text overlay suggestions for YouTube thumbnails — what text to put, where to place it, what font size, and which high-contrast color combo to use. 8 video category presets (tech, education, gaming, vlog, tutorial, review, music, comedy), 4 thumbnail style presets (face-cam, screenshot, illustration, text-only), 3 text-length presets (short/medium/long), keyword extractor, number extractor ($1M, 30 days, etc.), text shortener (1-7 words), position recommender (5 positions with reasoning), font size calculator, color recommender (10+ high-contrast combos), font recommender (5 display fonts), 3 variation generator, category-based template selector, CTR predictor, A/B test suggestion, history (localStorage), shareable URL. 100% client-side.",
  category: "social",
  keywords: [
    "youtube thumbnail", "thumbnail text", "thumbnail overlay",
    "youtube text overlay", "thumbnail font", "thumbnail color",
    "thumbnail design", "youtube ctr", "thumbnail generator",
  ],
  icon: "youtube",
  requiresNetwork: false,
  seo: {
    title: "YouTube Thumbnail Text Overlay — Text, Position, Font, Color | UnQTools",
    faq: [
      {
        q: "How does the YouTube Thumbnail Text Overlay tool work?",
        a: "Paste your video title (e.g. 'How I Built a $1M App in 30 Days'), pick the video category (tech, education, gaming, vlog, tutorial, review, music, comedy), thumbnail style (face-cam, screenshot, illustration, text-only), and desired text length (short 1-3 words, medium 4-7, long 8+). The tool extracts the most engaging keywords and numbers from your title, shortens them to a thumbnail-readable length, recommends a position (top-left, top-right, bottom-center, etc.), calculates font size, suggests a high-contrast color combo, and picks a bold display font.",
      },
      {
        q: "Which fonts and color combinations are recommended?",
        a: "Five bold display fonts: Impact (universal), Bebas Neue (modern), Anton (heavy), Oswald (condensed), and Montserrat Black (premium). Ten+ high-contrast color combos optimized for click-through: yellow on black, white on red, black on yellow, red on white, white on black, yellow on red, black on white, blue on yellow, red on yellow, and white on blue. Each combo includes hex codes.",
      },
      {
        q: "How does the CTR predictor work?",
        a: "The predictor scores each variation 0-100 based on proven CTR patterns: presence of numbers in the title ($1M, 30 days, 50K), text length (short performs better), category-based power words (gaming = 'INSANE', tech = 'NEW', education = 'GUIDE'), emoji presence, and font/color contrast level. Scores 70+ predict above-average CTR. Scores below 40 suggest rewrites. The A/B test suggestion picks the two best variations to test against each other.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 8 video category presets (tech, education, gaming, vlog, tutorial, review, music, comedy). (2) 4 thumbnail style presets (face-cam, screenshot, illustration, text-only). (3) 3 text length presets (short/medium/long). (4) Text extractor (most engaging keywords from title). (5) Number extractor ($1M, 30 days, etc.). (6) Text shortener (1-7 words max). (7) Position recommender (5 positions with reasoning). (8) Font size calculator (based on text length + position). (9) Color recommender (10+ high-contrast combos). (10) Font recommender (5 bold display fonts). (11) Text overlay variation generator (3 variations). (12) Category-based template selector (gaming=INSANE, tech=NEW, education=GUIDE). (13) Render as text report (full overlay spec). (14) Render as CSV (variation, text, position, font_size, color_combo). (15) Copy + Download .txt + Download CSV. (16) History (localStorage, max 20). (17) Shareable URL (encode inputs in hash). (18) Summary stats (total variations, avg text length, recommended positions). (19) CTR predictor (based on text patterns, numbers, emoji presence). (20) A/B test suggestion (which 2 variations to test).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All overlay generation runs locally in your browser. Your video title never leaves this device. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};
