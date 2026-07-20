import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-text-to-image-generator",
  name: "AI Text-to-Image Prompt Builder",
  description:
    "Build optimized image-generation prompts for DALL·E 3, Stable Diffusion, and Midjourney from a single description. Pure-JS prompt engineer: 12 style presets, 6 aspect ratios, lighting & mood libraries, weighted-keyword tokenizer for SD, Midjourney parameter generator (--ar, --v, --stylize, --seed), negative-prompt builder, token count estimator, prompt validator, and seed reproducibility. Optional BYO-key OpenAI image API call — key stays 100% client-side. No images are generated without your own key; everything else runs on-device.",
  category: "ai",
  keywords: [
    "text to image", "image prompt builder", "dall-e prompt",
    "stable diffusion prompt", "midjourney prompt",
    "prompt engineer", "ai image generator no login",
    "negative prompt", "diffusion prompt", "image generation",
  ],
  icon: "image-plus",
  requiresNetwork: false,
  seo: {
    title: "AI Text-to-Image Prompt Builder — DALL·E / SD / Midjourney, Private | UnQTools",
    faq: [
      {
        q: "What does this text-to-image tool actually do?",
        a: "It builds optimized prompts for the three major image-generation models from a single free-text description. You describe the picture you want, pick a style (photorealistic, anime, oil painting, 3D render, etc.), an aspect ratio, and any lighting or mood hints, and the tool emits three tailored prompts: a natural-language DALL·E 3 prompt, a weighted-comma-separated Stable Diffusion prompt with a matched negative prompt, and a Midjourney prompt with the right --ar / --v / --stylize / --seed parameters. Actual image generation requires an API — bring your own key.",
      },
      {
        q: "Why are the prompts different for each model?",
        a: "Each model reads prompts differently. DALL·E 3 prefers flowing natural-language sentences. Stable Diffusion works best on weighted keyword chunks separated by commas, with a separate negative-prompt field listing what to avoid. Midjourney uses keyword phrases plus CLI-style parameters (--ar 16:9, --v 6, --stylize 250, --seed 12345). The tool generates the right shape for each.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 12 style presets (photorealistic, anime, oil, watercolor, 3D render, cyberpunk, fantasy, minimalist, pixel-art, line-art, isometric, low-poly). (2) 6 aspect-ratio presets (1:1, 16:9, 9:16, 4:3, 3:2, 21:9). (3) 6 lighting presets (golden hour, neon, studio, soft, dramatic, natural). (4) 6 mood presets (calm, epic, mysterious, joyful, dark, dreamy). (5) Weighted-keyword tokenizer for Stable Diffusion. (6) Midjourney parameter generator (--ar, --v, --stylize, --seed, --quality). (7) Negative-prompt builder with 6 presets + custom. (8) Token count estimator. (9) Prompt validator (length, key elements, safety). (10) Prompt-to-options heuristic parser. (11) Per-model stats (token count, character count). (12) Seed reproducibility (encode seed in share URL). (13) Copy/download all prompts as text or JSON. (14) Local history (max 20). (15) Shareable URL with all options. (16) Optional BYO-key OpenAI image API call. (17) Sample prompts. (18) Honesty disclaimers about on-device limits.",
      },
      {
        q: "Can I actually generate an image here?",
        a: "Only if you bring your own OpenAI API key — the optional 'Generate with DALL·E 3' button calls api.openai.com directly from your browser with your key in localStorage. Without a key, the tool is a pure prompt engineer: it builds the optimized prompts that you then paste into your model of choice. We never proxy or log prompts.",
      },
      {
        q: "Is my description or API key sent anywhere?",
        a: "Prompt building runs 100% locally. Your API key, if you provide one, is stored only in your browser's localStorage and is sent directly to api.openai.com — never to our servers. History is also local. We do not log prompts or generated images.",
      },
    ],
  },
  status: "done",
};
